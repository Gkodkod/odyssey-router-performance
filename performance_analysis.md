# Odyssey Router Performance Improvement Plan

This plan outlines the analysis of the current performance bottlenecks in the Odyssey Router setup and proposes actionable steps to resolve them, ensuring the system can handle the load tests effectively without constant `504 Gateway Timeout` errors.

## Analysis of the Bottlenecks

After a thorough review of the repository, including the subgraph source code and router configuration, here are the main factors degrading performance:

1.  **Massive Artificial Latency in `products` Subgraph (The Primary Culprit):**
    *   In `starstuff-services/products/index.js` (line 116), there is a simulated delay: `setTimeout(next, Math.floor((Math.random() * 1000) + 30));`.
    *   This means every single request to the `products` subgraph is delayed by up to **1030ms** (over 1 second).
    *   Your `router.yaml` has a global timeout for `all` subgraphs set to `500ms`. Because the `products` subgraph frequently takes longer than 500ms to respond, the router aggressively cuts the connection, resulting in the constant `504 Gateway Timeout` errors you see in Grafana and the logs.

2.  **N+1 Query Inefficiencies in Subgraph Architecture:**
    *   Currently, the subgraphs resolve entities using standard array `find()` and `filter()` methods without batching. While this is fast in-memory, in a real database scenario, this would lead to severe N+1 query problems. 

3.  **Positive Changes Already in Place:**
    *   **Entity Caching:** You recently enabled `preview_entity_cache` backed by Redis in `router.yaml`. This is an excellent feature that caches the results of subgraph requests, dramatically reducing latency for subsequent identical queries.
    *   **Query Deduplication:** You've enabled `deduplicate_query: true` across all subgraphs, which prevents the router from sending duplicate requests to the same subgraph simultaneously.

## Proposed Changes

### 1. `starstuff-services/products/index.js`
We need to bring the latency of the `products` subgraph down to a reasonable level, inline with the other subgraphs, so it respects the router's 500ms timeout.

#### [MODIFY] `products/index.js`
*   Change the `setTimeout` logic from `(Math.random() * 1000) + 30` to a much lower value, such as `(Math.random() * 20) + 30`. This will keep responses under 50ms, eliminating the timeouts entirely.

### 2. `router.yaml`
If we must keep the high latency in the `products` subgraph for demonstration purposes, we must increase the router's timeout configuration to tolerate it.

#### [MODIFY] `router/router.yaml` (Alternative if subgraph cannot be changed)
*   Override the timeout specifically for the `products` subgraph to `1500ms` to prevent the router from prematurely dropping connections.

## Verification Plan

### Automated Tests
1.  Apply the latency reduction to the `products` subgraph.
2.  Restart the `products` subgraph container.
3.  Run the Vegeta load test using `docker compose start vegeta`.
4.  Monitor Grafana (Tempo, Loki, Prometheus dashboards) to verify that the `504 Gateway Timeout` errors have disappeared and the system stabilizes at 800 requests per second.
