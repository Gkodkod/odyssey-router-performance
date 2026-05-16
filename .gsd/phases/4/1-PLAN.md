# Plan: Phase 4 — Postgres Mutation Latency Fix

Implementing dynamic Vegeta target generation to eliminate row-level lock contention in PostgreSQL.

## Objectives
- Eliminate the "9-second latency" issue caused by concurrent updates to the same database row.
- Create a repeatable system for generating high-cardinality mutation payloads.
- Ensure the load test reflects actual system performance rather than database wait queues.

## Proposed Changes

### 1. Vegeta Configuration
- Create `vegeta/generate_targets.js`: A Node.js script that generates 100,000+ unique GraphQL mutation requests.
- The script will randomize:
    - `createReview`: `id` and `authorId`.
    - `updateReview`: `id` (using existing seeded IDs if possible, or a range).
    - `deleteReview`: `id`.
    - `createProduct`: `upc`.
- Output format: Vegeta's "HTTP" target format with inline JSON bodies.

### 2. Docker Integration
- Update `docker-compose.yaml`:
    - Add a `target-generator` service using the `node:20-slim` image.
    - This service will run before `vegeta-mutations` to populate a shared volume or the mounted `./vegeta` directory with `targets-dynamic.http`.
    - Update `vegeta-mutations` to use `-targets=/etc/vegeta/targets-dynamic.http`.

### 3. Verification Strategy
- **Empirical Validation**:
    - Run the load test at 200 RPS.
    - Observe the "Mutation Latency" panel in Grafana.
    - **Success Criteria**: p99 latency for mutations should drop from ~9s to < 500ms (depending on actual DB performance).

## Task Breakdown

### Wave 1: Generator Script
- [ ] Create `vegeta/generate_targets.js`.
- [ ] Test the script locally to ensure it produces valid HTTP target files.

### Wave 2: Orchestration
- [ ] Modify `docker-compose.yaml` to include the `target-generator` service.
- [ ] Update `vegeta-mutations` command to point to the new dynamic file.

### Wave 3: Verification
- [ ] Run `docker compose up target-generator`.
- [ ] Run `docker compose restart vegeta-mutations`.
- [ ] Capture and document performance metrics.

## Dependencies
- None (Postgres and Router must be running for verification, but not for planning/implementation).
