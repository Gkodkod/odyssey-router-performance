# Advanced Performance Analysis & Optimizations

This document outlines specific, actionable steps to further optimize the Odyssey Router and subgraph infrastructure. Each section includes exactly *what* to change, *where* to change it, and *how* to verify the change.

## 1. Fix N+1 Queries with DataLoader

**The Issue:** Subgraphs use `.filter()` and `.find()` directly in resolvers, which will cause massive N+1 queries when transitioning to a real database.

### Implementation Step: Update `reviews` Subgraph
**Where:** `starstuff-services/reviews/index.js`
**How:**
1.  Install DataLoader in the `reviews` service:
    ```bash
    cd starstuff-services/reviews
    npm install dataloader
    ```
2.  Update the server initialization to provide DataLoaders via the GraphQL Context:
    ```javascript
    const DataLoader = require('dataloader');
    
    // Create batch functions
    const batchReviewsForUsers = async (userIds) => {
      // In a real app, this is a single SQL query: SELECT * FROM reviews WHERE authorID IN (userIds)
      return userIds.map(id => reviews.filter(review => review.authorID === id));
    };

    // Update ApolloServer startup to include context
    app.use("/", cors(), json(), expressMiddleware(server, {
      context: async () => ({
        userReviewsLoader: new DataLoader(batchReviewsForUsers)
      })
    }));
    ```
3.  Update the `User.reviews` resolver to use the loader:
    ```javascript
    User: {
      reviews(user, args, context) {
        return context.userReviewsLoader.load(user.id);
      }
    }
    ```

**Verification:** Add logging inside `batchReviewsForUsers`. You should see it called only *once* per request, even if the query asks for reviews of 50 different users.

---

## 2. Entity Caching Monitoring (Grafana)

**The Issue:** The Router caches entities in Redis, but there is no visibility into how effective this cache is or if Redis is timing out.

### Implementation Step: Add Grafana Panels
**Where:** Grafana UI (http://localhost:3000) -> Router Dashboard -> Add Panel
**How:**
Add these specific PromQL queries to new panels:

1.  **Cache Hit Rate Panel:**
    *   **Title:** Entity Cache Hit Rate (%)
    *   **Query:** `sum(rate(apollo_router_cache_hit_count[1m])) / (sum(rate(apollo_router_cache_hit_count[1m])) + sum(rate(apollo_router_cache_miss_count[1m]))) * 100`
    *   **Unit:** Percent (0-100)
2.  **Redis Latency Panel:**
    *   **Title:** Redis p95 Latency
    *   **Query:** `histogram_quantile(0.95, sum(rate(apollo_router_redis_latency_bucket[1m])) by (le))`
    *   **Unit:** Milliseconds

**Verification:** Run the Vegeta load test (`docker compose start vegeta`). The Cache Hit Rate should stabilize near 100% for repeated queries, and Latency should remain below the `15ms` timeout.

---

## 3. Enable Automatic Persisted Queries (APQ)

**The Issue:** Clients send massive query strings (like the `Large` query), burning network bandwidth and Router CPU for parsing.

### Implementation Step: Enable APQ
**Where:** `router/router.yaml`
**How:** Add this block to the root of the configuration:
```yaml
apq:
  enabled: true
  router:
    cache:
      in_memory:
        limit: 512
```
**Verification:** Run a client configured with APQ. Inspect the Network tab: the first request sends the full query and a SHA256 hash. Subsequent requests *only* send the SHA256 hash.

---

## 4. Secure Production Environments

**The Issue:** Introspection and Apollo Sandbox are enabled unconditionally on the Router, exposing the schema in production.

### Implementation Step: Conditional Introspection
**Where:** `router/router.yaml`
**How:** Update the `supergraph` and `sandbox` blocks to use environment variables for conditional logic:
```yaml
supergraph:
  listen: 0.0.0.0:4000
  introspection: ${env.ENABLE_INTROSPECTION:-false}

sandbox:
  enabled: ${env.ENABLE_INTROSPECTION:-false}
```
**Verification:** 
1.  Set `ENABLE_INTROSPECTION=false` in your `.env` file.
2.  Restart the router (`docker compose restart router`).
3.  Visit `http://localhost:4000`. Sandbox should be disabled, and GraphQL introspection queries will be rejected.
