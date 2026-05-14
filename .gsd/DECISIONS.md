# DECISIONS.md — Architecture Decision Records

> Tracks key technical decisions made during the project.

## Format

| ID | Decision | Rationale | Date | Status |
|----|----------|-----------|------|--------|
| ADR-001 | Use raw `pg` driver instead of Prisma | Transparent SQL for observing DataLoader batching; avoids Prisma's own query engine overhead and binary bundling in Docker | 2026-05-14 | Accepted |
| ADR-002 | DataLoader instantiated per-request | Prevents cross-request cache poisoning; each request gets a fresh loader instance via Express middleware context | 2026-05-14 | Accepted |
| ADR-003 | All performance tuning via `router.yaml` only | Keeps the workshop focused on Router configuration; no custom Rhai scripts or plugins needed for course scope | 2026-05-14 | Accepted |
| ADR-004 | Single shared PostgreSQL instance across all subgraphs | Simplifies local dev setup; acceptable for a workshop environment (not a multi-DB microservice pattern) | 2026-05-14 | Accepted |
