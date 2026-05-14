# ROADMAP.md

> **Current Phase**: Not started
> **Milestone**: v1.0 — Complete Performance Workshop Scaffold

## Must-Haves (from SPEC)

- [ ] All Docker services start cleanly with `docker compose up -d`
- [ ] Database auto-seeds on first boot
- [ ] Grafana shows live Router metrics, traces, and logs
- [ ] Redis entity cache measurably reduces subgraph calls
- [ ] Rate limiter correctly returns 429s under load
- [ ] DataLoader batching visible in `reviews` subgraph logs
- [ ] All subgraphs compose cleanly via `supergraph.graphql`

---

## Phases

### Phase 1: Infrastructure Validation
**Status**: ⬜ Not Started
**Objective**: Verify all Docker Compose services start correctly, dependencies resolve in order, database seeds successfully, and all subgraphs are reachable from the Router.
**Requirements**: Docker, docker-compose.yaml correctness, seed.js, subgraph health

---

### Phase 2: Router Performance Configuration
**Status**: ⬜ Not Started
**Objective**: Configure and validate all Router-level performance features in `router.yaml`: rate limiting, timeouts, query deduplication, query plan caching + warm-up, and Redis entity caching.
**Requirements**: SPEC — Goals 1, Performance Features table

---

### Phase 3: Observability Stack Validation
**Status**: ⬜ Not Started
**Objective**: Confirm Prometheus scrapes Router metrics, Tempo receives OTLP traces, Loki aggregates logs, and Grafana displays all three data sources with the pre-configured dashboard.
**Requirements**: SPEC — Goal 3

---

### Phase 4: Load Testing & Measurement
**Status**: ⬜ Not Started
**Objective**: Run Vegeta load tests to generate measurable traffic, validate rate-limit behavior, confirm cache hit/miss ratios in Grafana, and demonstrate DataLoader batching in `reviews` logs.
**Requirements**: SPEC — Goals 4 + Success Criteria

---

### Phase 5: DataLoader Consistency & Technical Debt
**Status**: ⬜ Not Started
**Objective**: Address known technical debt: extend DataLoader batching to other subgraphs where needed, fix the hardcoded `me()` query in `accounts`, and add a multi-user query to Vegeta config to fully exercise batch loading.
**Requirements**: SPEC — Technical Debt items from ARCHITECTURE.md
