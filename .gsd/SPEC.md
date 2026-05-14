# SPEC.md — Project Specification

> **Status**: `FINALIZED`
> **Source**: Apollo Odyssey — "Performance in the Router" course scaffold

---

## Vision

A fully containerized, production-realistic federated GraphQL performance workshop. The project demonstrates how Apollo Router can be configured to handle high-concurrency traffic efficiently through caching, traffic shaping, query optimization, and N+1 batching — with a complete observability stack (metrics, traces, logs) to make every optimization measurable.

---

## Goals

1. **Demonstrate Router-level performance features** — Traffic shaping (rate limiting, timeouts), query deduplication, query plan caching with warm-up, and Redis-backed subgraph entity caching.
2. **Implement a production-realistic data layer** — Replace hardcoded in-memory arrays with a shared PostgreSQL database across all four subgraphs, with DataLoader N+1 batching in the `reviews` subgraph.
3. **Provide full observability** — Metrics via Prometheus/Grafana, distributed tracing via Tempo (OTLP), and log aggregation via Loki/Promtail — all pre-wired and accessible out of the box.
4. **Enable repeatable load testing** — Vegeta load tester integrated as a compose service to simulate real client traffic and validate rate-limit and caching behavior under load.
5. **Serve as an Odyssey course scaffold** — The repo is the starting point for learners following the [Apollo Odyssey Router Performance course](https://www.apollographql.com/tutorials/router-performance), with all infrastructure pre-built so learners focus on configuration rather than setup.

---

## Non-Goals (Out of Scope)

- Production deployment / cloud hosting (this is a local Docker Compose dev environment only)
- Authentication or authorization implementation
- Unit or integration test suites for subgraph resolvers
- GraphQL subscription support
- Multi-region or HA Redis/PostgreSQL configuration
- Frontend client application

---

## Users

**Primary:** Apollo Odyssey learners working through the "Performance in the Router" course. They are GraphQL developers with intermediate experience who want hands-on practice configuring Router performance features.

**Secondary:** Apollo engineers or developer advocates using the scaffold as a reference implementation or demo environment.

---

## System Architecture

| Component | Role | Port |
|-----------|------|------|
| Apollo Router | Gateway / query orchestrator | 4000 |
| Accounts subgraph | User profiles | 4001 |
| Reviews subgraph | Product reviews (+ DataLoader) | 4002 |
| Products subgraph | Product catalog | 4003 |
| Inventory subgraph | Stock & shipping | 4004 |
| PostgreSQL 16 | Shared persistent DB | 5432 |
| Redis | Distributed entity cache | 6379 |
| Prometheus | Metrics scraping | 9090 |
| Grafana | Dashboard (metrics + traces + logs) | 3000 |
| Tempo | OTLP trace backend | 4317 |
| Loki + Promtail | Log aggregation | — |
| Vegeta | HTTP load tester | — |
| code-server | Web-based VSCode IDE | 8080 |

---

## Performance Features Covered

| Feature | Mechanism | Location |
|---------|-----------|----------|
| Client rate limiting | `traffic_shaping.router.global_rate_limit` | `router.yaml` |
| Request timeout | `traffic_shaping.router.timeout` | `router.yaml` |
| Subgraph timeout | `traffic_shaping.all.timeout` | `router.yaml` |
| Query deduplication | `traffic_shaping.subgraphs.*.deduplicate_query` | `router.yaml` |
| Query plan cache | `supergraph.query_planning.cache.in_memory` | `router.yaml` |
| Query plan warm-up | `supergraph.query_planning.warmed_up_queries` | `router.yaml` |
| Entity caching (Redis) | `preview_entity_cache` | `router.yaml` |
| N+1 batching | DataLoader per-request context | `reviews/index.js` |

---

## Constraints

- **Runtime:** Docker + Docker Compose required (no bare-metal setup path)
- **Language:** Node.js / Express for all subgraphs; raw `pg` driver (no Prisma) for transparent SQL
- **Database:** Seeded once on first boot (~60–90s); 10k users / 5k products / 50k reviews via `@faker-js/faker`
- **Router config:** All performance tuning is done exclusively via `router/router.yaml` — no Router plugin code
- **Scope boundary:** Learners interact via the `code-server` IDE at `localhost:8080`; they do not modify infrastructure

---

## Success Criteria

- [ ] `docker compose up -d` starts all services in the correct dependency order with no manual intervention
- [ ] Database seeds automatically on first boot and persists across restarts
- [ ] Grafana dashboard at `http://localhost:3000` shows live Router metrics, traces, and logs
- [ ] Vegeta load test generates measurable traffic visible in Grafana
- [ ] Redis entity cache demonstrably reduces subgraph calls (observable via cache hit/miss metrics)
- [ ] Query plan warm-up reduces cold-start latency spikes after router restart
- [ ] Rate limiter returns `429` responses when Vegeta exceeds `capacity` threshold
- [ ] DataLoader batching in `reviews` subgraph produces single batched SQL queries (visible in logs)
- [ ] All four subgraphs compose cleanly via `supergraph.graphql`
- [ ] `code-server` IDE is accessible at `http://localhost:8080`
