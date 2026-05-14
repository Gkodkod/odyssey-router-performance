# DECISIONS.md — Architecture Decision Records

> Tracks key technical decisions made during the project.

## Format

| ID | Decision | Rationale | Date | Status |
|----|----------|-----------|------|--------|
| ADR-001 | Use raw `pg` driver instead of Prisma | Transparent SQL for observing DataLoader batching; avoids Prisma's own query engine overhead and binary bundling in Docker | 2026-05-14 | Accepted |
| ADR-002 | DataLoader instantiated per-request | Prevents cross-request cache poisoning; each request gets a fresh loader instance via Express middleware context | 2026-05-14 | Accepted |
| ADR-003 | All performance tuning via `router.yaml` only | Keeps the workshop focused on Router configuration; no custom Rhai scripts or plugins needed for course scope | 2026-05-14 | Accepted |
| ADR-004 | Single shared PostgreSQL instance across all subgraphs | Simplifies local dev setup; acceptable for a workshop environment (not a multi-DB microservice pattern) | 2026-05-14 | Accepted |
| ADR-005 | DataLoader Implementation Strategy | Option B: Implement DataLoaders everywhere a database/API call is made inside a resolver across all remaining subgraphs to ensure blanket protection against N+1 queries. | 2026-05-14 | Accepted |
| ADR-006 | Accounts Subgraph Authentication Context | Pass authentication headers via Apollo Router to the subgraphs to resolve the hardcoded `me()` query and dynamically determine user context. | 2026-05-14 | Accepted |

## Phase 5 Decisions

**Date:** 2026-05-14

### Scope
- Implement DataLoaders in all 3 remaining subgraphs (`inventory`, `products`, `bookings`).
- Pass headers via router to `accounts` to fix the `me()` query.

### Approach
- Chose: Option B
- Reason: User requested blanket protection against N+1 queries.

### Constraints
- The multi-user Vegeta load test query is still undefined and requires research.
- Need to research potential issues with blanket DataLoader implementation obscuring specific performance deltas.

## Phase 6 Decisions

**Date:** 2026-05-14

### Scope
- Stress test the router's query planner, cache, and DataLoader boundaries using heavy queries and cross-subgraph mutations.
- Isolate query performance from mutation performance using segmented load testing.
- Visualize the segmented metrics explicitly in Grafana.

### Approach
- Chose: Segmented target load tests (separated query and mutation payloads) along with new dashboard panels.
- Reason: To ensure clear observability of how mutations affect caching and latency independently from read-heavy traffic.

### Constraints
- Mutations need to handle DB constraints gracefully (e.g. `ON CONFLICT DO NOTHING`) to allow high RPS stress testing without bloat.
