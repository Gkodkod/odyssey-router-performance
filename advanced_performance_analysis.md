# Advanced Performance Analysis & Optimizations

This document outlines the current state of the Odyssey Router performance lab and provides actionable steps for further optimization.

## 1. N+1 Query Batching (Implemented)

**The Issue:** A naive implementation of nested GraphQL fields (e.g., `User.reviews`) results in $N+1$ database queries — one for the user, plus one for every review belonging to that user.

**The Solution:** We have implemented **DataLoader** in the `reviews` subgraph.

### How it Works:
1.  **Batch Function:** The `batchReviewsByAuthorId` function uses the PostgreSQL `ANY` operator:
    ```sql
    SELECT * FROM reviews WHERE author_id = ANY($1::text[])
    ```
2.  **Request Context:** A new `DataLoader` instance is created per incoming HTTP request to ensure that batching and caching are scoped to a single request.
3.  **Efficiency:** Even if a query asks for 50 users and their reviews, the `reviews` subgraph will only execute **one** SQL query to fetch all reviews.

**Verification:** 
1.  **Check Logs:** Monitor the reviews subgraph:
    ```bash
    docker compose logs -f reviews
    ```
2.  **Run a Multi-User Query:** Use Apollo Sandbox (localhost:4000) to fetch several users:
    ```graphql
    query {
      recommendedProducts {
        upc
        reviews {
          body
        }
      }
    }
    ```
3.  **Observe:** You will see a single `Loader called with ... userIds` log entry, confirming the batching is active.

---

## 2. Entity Caching Monitoring (Grafana)

**The Issue:** The Router caches entities in Redis, but without dedicated panels you have no visibility into whether the cache is actually being hit, or whether Redis latency is creeping toward the 15ms timeout configured in `router.yaml`.

**The Solution:** Three panels have been **pre-provisioned** in `grafana/provisioning/dashboards/default/router.json` under the **"Entity Cache (Redis)"** row. They load automatically when Grafana starts — no manual UI work required.

---

### Panel 1 — Entity Cache Hit Rate (%)

**Type:** `stat` (big number, background colour = green/yellow/red)
**File location:** `router.json`, panel ID `101`

**PromQL:**
```promql
sum(rate(apollo_router_cache_hit_count[1m]))
  /
(sum(rate(apollo_router_cache_hit_count[1m])) + sum(rate(apollo_router_cache_miss_count[1m])))
  * 100
```

**How it works:**
- `apollo_router_cache_hit_count` — counter incremented every time the Router finds an entity in Redis and skips the downstream subgraph call.
- `apollo_router_cache_miss_count` — counter incremented every time the Router had to fetch from a subgraph (cache was cold or TTL expired).
- Dividing hits / (hits + misses) gives a ratio; multiplying by 100 gives a percentage.

**Colour thresholds:**
| Colour | Condition | Meaning |
|--------|-----------|---------|
| 🟥 Red | < 50% | Cache is barely helping — investigate TTL settings or query patterns |
| 🟨 Yellow | 50–80% | Cache is warming or partially effective |
| 🟩 Green | ≥ 80% | Cache is healthy — most entities served from Redis |

---

### Panel 2 — Redis p95 Latency (ms)

**Type:** `stat` (big number, background colour = green/yellow/red)
**File location:** `router.json`, panel ID `102`

**PromQL:**
```promql
histogram_quantile(0.95,
  sum(rate(apollo_router_cache_storage_estimated_size_bucket[1m])) by (le)
)
```

**How it works:**
- The Router exports cache operation timing as a histogram with `_bucket` labels.
- `histogram_quantile(0.95, ...)` computes the 95th-percentile latency — 95% of cache reads complete within this duration.
- Your `router.yaml` has `timeout: 15ms` for Redis. If the p95 approaches or exceeds 15ms, the Router will start timing out and falling back to subgraph fetches, silently degrading the cache hit rate.

**Colour thresholds:**
| Colour | Condition | Meaning |
|--------|-----------|---------|
| 🟩 Green | < 10ms | Well within the 15ms timeout |
| 🟨 Yellow | 10–15ms | Close to the timeout — monitor closely |
| 🟥 Red | ≥ 15ms | Exceeds timeout — Redis is overloaded or networking issue |

---

### Panel 3 — Cache Hits vs Misses (rate/s)

**Type:** `timeseries` (dual-series line graph)
**File location:** `router.json`, panel ID `103`

**PromQL (series A — Hits):**
```promql
sum(rate(apollo_router_cache_hit_count[1m]))
```

**PromQL (series B — Misses):**
```promql
sum(rate(apollo_router_cache_miss_count[1m]))
```

**How it works:**
This panel shows the raw rate of hits and misses over time, so you can observe:
1. **Warm-up ramp** — when the stack first starts, misses dominate. As entities get cached, hits rise and misses fall.
2. **TTL expiry spikes** — if you see periodic miss spikes, your TTL (`ttl: 10s` in `router.yaml`) is too short for your load pattern.
3. **Cache invalidation** — a sudden drop in hits + spike in misses typically means a subgraph was restarted and the Router re-fetched all entities.

---

### How the provisioning works

Grafana reads `grafana/provisioning/dashboards/default/router.json` on startup. The three panels above are appended to the existing `panels` array under a new collapsible row `"Entity Cache (Redis)"`. The dashboard version was bumped from `6` → `7`, which tells Grafana to reload it on next restart.

**To apply the panels immediately (if stack is already running):**
```bash
docker compose restart grafana
```

**To verify the panels loaded:**
1. Open [http://localhost:3000](http://localhost:3000) → **Router dashboard**
2. Scroll to the bottom — you should see the **"Entity Cache (Redis)"** row
3. Click the row header to expand it and view all three panels

---

### Verification under load

1. Start the Vegeta load test:
   ```bash
   docker compose start vegeta
   ```
2. Let it run for ~60 seconds (enough for the 1m `rate()` window to fill).
3. Observe in Grafana:
   - **Hit Rate** should climb from ~0% to ≥80% as Redis warms up.
   - **p95 Latency** should stay below 10ms on a local Docker network.
   - **Hits vs Misses** will show the warm-up ramp in real time.

---

### Troubleshooting — metrics not appearing

If the panels show "No data":

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `apollo_router_cache_hit_count` absent | Entity caching not enabled | Verify `preview_entity_cache.enabled: true` in `router.yaml` |
| All cache metrics absent | Router not exporting metrics | Check `telemetry.exporters.metrics.prometheus.enabled: true` in `router.yaml` |
| Metric exists but always 0 | Cache misses only, never hits | Check Redis connectivity: `docker compose logs redis` |

---

## 3. Automatic Persisted Queries (APQ) — Implemented

**The Issue:** By default, every request sends the full GraphQL query string over the wire — potentially hundreds of characters for complex queries. Under Vegeta load (800 RPS) this burns CPU on repeated parsing and adds unnecessary payload bytes.

**The Solution:** APQ has been added to `router/router.yaml`. The Router now uses a two-phase protocol to send only a SHA-256 hash for previously-seen queries.

### How APQ works (two phases)

**Phase 1 — First request (hash + full query):**
```
Client → Router: { extensions: { persistedQuery: { sha256Hash: "abc123" } }, query: "{ topProducts { name } }" }
Router → Cache: STORE sha256 → query
Router → Response: normal data
```

**Phase 2 — Subsequent requests (hash only):**
```
Client → Router: { extensions: { persistedQuery: { sha256Hash: "abc123" } } }
Router → Cache: HIT — reconstruct query from hash
Router → Response: normal data (no re-parsing of query string)
```

If the Router doesn't recognise the hash (e.g. after a restart), it returns `PERSISTED_QUERY_NOT_FOUND` and the client automatically retries with the full query string.

### Configuration added to `router.yaml`

```yaml
apq:
  router:
    cache:
      in_memory:
        limit: 512  # max number of APQ entries stored in memory
```

**Key settings:**
- `limit: 512` — The cache holds up to 512 distinct query hashes. For this workshop the Vegeta test sends only 1–3 distinct queries, so 512 is more than sufficient. In production, size this to your unique operation count.
- There is no TTL on the in-memory APQ cache; entries live until the Router restarts or the cache is evicted by LRU.

### Verification

**Option A — Apollo Sandbox (browser Network tab):**
1. Open [http://localhost:4000](http://localhost:4000)
2. Run any query in Sandbox
3. Open DevTools → Network → find the `POST /` request
4. In the request payload you will see:
   ```json
   {
     "extensions": {
       "persistedQuery": {
         "version": 1,
         "sha256Hash": "<64-char hex string>"
       }
     }
   }
   ```
5. Run the **same query again** — on the second request, no `query` key will be present in the payload; only the hash is sent.

**Option B — Vegeta load test metrics:**
After APQ warms up, payload size should drop. You can measure this via the Router's request body size histogram:
```promql
histogram_quantile(0.95,
  sum(rate(apollo_router_http_request_body_size_bucket[1m])) by (le)
)
```
Expect p95 body size to drop from ~250 bytes (full query) to ~80 bytes (hash only) after warm-up.

**Option C — Tempo traces:**
In Grafana → Explore → Tempo, search for `{span.graphql.document=~".+"}`. On the first request the span will include the full query document. On subsequent requests the span will be absent or minimal, showing the query was resolved from the APQ cache without re-parsing.

---

## 4. Secure the Infrastructure

**The Issue:** Introspection and Apollo Sandbox expose the full schema to any client that connects to `localhost:4000`. In a production environment, this allows attackers to map your entire data model.

**The Solution:** `router.yaml` now reads the `ENABLE_INTROSPECTION` environment variable (defaulting to `true` in dev). Set it to `false` in production to lock down the schema.

### Configuration in `router.yaml`

```yaml
supergraph:
  introspection: ${env.ENABLE_INTROSPECTION:-true}

sandbox:
  enabled: ${env.ENABLE_INTROSPECTION:-true}
```

**How the env var syntax works:**
- `${env.ENABLE_INTROSPECTION:-true}` — reads the env var `ENABLE_INTROSPECTION`; if it is **not set or empty**, defaults to `true`.
- Setting `ENABLE_INTROSPECTION=false` in your `.env` or Docker environment disables **both** introspection queries and the Sandbox UI simultaneously.

### Environment matrix

| Environment | `ENABLE_INTROSPECTION` | Introspection | Sandbox |
|-------------|------------------------|---------------|---------|
| Local dev (default) | *(not set)* | ✅ Enabled | ✅ Enabled |
| Staging / CI | `true` | ✅ Enabled | ✅ Enabled |
| Production | `false` | ❌ Disabled | ❌ Disabled |

### How to toggle in `docker-compose.yaml`

Add the env var to the `router` service:
```yaml
router:
  environment:
    - ENABLE_INTROSPECTION=${ENABLE_INTROSPECTION:-true}
```

Then create or update your `.env` file:
```bash
# .env (dev — leave commented to enable introspection)
# ENABLE_INTROSPECTION=false

# .env (production)
ENABLE_INTROSPECTION=false
```

### Verification

**With introspection enabled (default):**
```bash
Invoke-RestMethod -Uri http://localhost:4000 -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"query":"{__schema{types{name}}}"}'`
# → Returns a full list of all GraphQL types
```

**With `ENABLE_INTROSPECTION=false`:**
```bash
Invoke-RestMethod -Uri http://localhost:4000 -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"query":"{__schema{types{name}}}"}'`
# → Returns: { "errors": [{ "message": "introspection is disabled" }] }
```

**Sandbox check:**
1. Navigate to [http://localhost:4000](http://localhost:4000)
2. With `false`: you will see a plain "Sandbox is disabled" page instead of the Explorer UI.

### Applying the change

```bash
# Restart only the router to pick up the new env var
docker compose restart router
```
