# ROADMAP.md

> **Current Phase**: Phase 4 — Load Testing & Measurement
> **Milestone**: v1.0 — Complete Performance Workshop Scaffold

## Must-Haves (from SPEC)

- [x] All Docker services start cleanly with `docker compose up -d`
- [x] Database auto-seeds on first boot
- [x] Grafana shows live Router metrics, traces, and logs
- [x] Redis entity cache measurably reduces subgraph calls
- [x] Rate limiter correctly returns 429s under load
- [ ] DataLoader batching visible in `reviews` subgraph logs
- [x] All subgraphs compose cleanly via `supergraph.graphql`

---

## Phases

### Phase 1: Infrastructure Validation
**Status**: ✅ Complete
**Objective**: Verify all Docker Compose services start correctly, dependencies resolve in order, database seeds successfully, and all subgraphs are reachable from the Router.
**Requirements**: Docker, docker-compose.yaml correctness, seed.js, subgraph health
**Completed**: 2026-05-14

---

### Phase 2: Router Performance Configuration
**Status**: ✅ Complete
**Objective**: Configure and validate all Router-level performance features in `router.yaml`: rate limiting, timeouts, query deduplication, query plan caching + warm-up, and Redis entity caching.
**Requirements**: SPEC — Goals 1, Performance Features table
**Completed**: 2026-05-14

---

### Phase 3: Observability Stack Validation
**Status**: ✅ Complete
**Objective**: Confirm Prometheus scrapes Router metrics, Tempo receives OTLP traces, Loki aggregates logs, and Grafana displays all three data sources with the pre-configured dashboard.
**Requirements**: SPEC — Goal 3
**Completed**: 2026-05-14

---

### Phase 4: Load Testing & Measurement
**Status**: ✅ Done
**Objective**: Run Vegeta load tests to generate measurable traffic, validate rate-limit behavior, confirm cache hit/miss ratios in Grafana, and demonstrate DataLoader batching in `reviews` logs.
**Requirements**: SPEC — Goals 4 + Success Criteria

---

### Phase 5: DataLoader Consistency & Technical Debt
**Status**: 🔄 In Progress
**Objective**: Address known technical debt: extend DataLoader batching to other subgraphs where needed, fix the hardcoded `me()` query in `accounts`, and add a multi-user query to Vegeta config to fully exercise batch loading.
**Requirements**: SPEC — Technical Debt items from ARCHITECTURE.md
