# Apollo Router Performance & Observability Scaffold

Welcome to the starter code for **Performance in the Router**. You can find the [course lessons and instructions](https://www.apollographql.com/tutorials/router-performance) on Odyssey, [Apollo](https://www.apollographql.com/)'s learning platform.

You can use this repository as a starting point for exploring Apollo GraphOS performance features, tracing, caching, and rate limiting.

## Project Structure

This repository is fully containerized via `docker-compose.yaml` and includes the following components:

*   **`router/`**: The Apollo Router. Contains the main configuration (`router.yaml`) and the composed schema (`supergraph.graphql`).
*   **`starstuff-services/`**: Four Node.js/Express GraphQL subgraphs (`accounts`, `inventory`, `products`, `reviews`) built with Apollo Server 4 and `@apollo/subgraph`. Each subgraph connects to a shared **PostgreSQL** database and uses `dataloader` for N+1 query batching.
*   **`scripts/`**: Utility scripts for database management.
    *   **`seed.js`**: Seeds the PostgreSQL database with realistic mock data using `@faker-js/faker`. Run this once after the database container starts.
*   **`vegeta/`**: A high-performance HTTP load testing tool to simulate client traffic and test rate limits.
*   **`redis/`**: The distributed cache backend used for Subgraph Entity Caching and Query Planning.
*   **`postgres/`**: A PostgreSQL 16 database container that provides a shared, persistent, production-realistic data store for all subgraphs. Replaces the original hardcoded in-memory arrays.
*   **Observability Stack**:
    *   **`prometheus/`**: Scrapes and stores metrics from the Router and infrastructure.
    *   **`grafana/`**: Visualizes metrics, logs, and traces. Pre-configured with a comprehensive Router dashboard accessible at `http://localhost:3000`.
    *   **`tempo/`**: Distributed tracing backend (OpenTelemetry) to visualize exactly where a query spends its time across subgraphs.
    *   **`loki/` & `promtail/`**: Log aggregation system to correlate router logs with specific traces.
*   **`code-server/`**: A web-based VSCode instance for quick, isolated editing at `http://localhost:8080`.

## How to use this repo

The course will walk you step-by-step through what you'll need to do. This codebase is the starting point of your journey!

To run this repository, you'll need Docker and Docker Compose.

### 1. Start all services

Navigate to the root of the project and run:

```bash
docker compose up -d
```

This starts the composed Docker process in detached mode. This means the running process will not occupy the terminal where you ran the command. Instead, you can open up the Docker Desktop app to monitor the progress of each container as it boots up.

This single command starts **everything** in the correct order:

```
postgres (with healthcheck)
    └── seeder  ←  runs automatically, seeds 10k users / 5k products / 50k reviews
            └── accounts, inventory, products, reviews  ←  start only after DB is seeded
                    └── router, vegeta, observability stack
```

> **First startup takes ~60–90 seconds** while PostgreSQL initializes and the seeder populates the database. Subsequent restarts are fast because the data is persisted in a Docker volume (`postgres-data`).

### 2. Access the IDE

Navigate to [http://localhost:8080](http://localhost:8080) to access the VSCode IDE where you'll do all of your work.

### Useful commands

| Action | Command |
|---|---|
| Start all services | `docker compose up -d` |
| Rebuild a subgraph after code changes | `docker compose up -d --build <service>` |
| Re-run the seeder (manual / reset data) | `docker compose up seeder --force-recreate` |
| Reset the database completely | `docker compose down -v && docker compose up -d` |
| Watch subgraph logs | `docker compose logs -f <service>` |
| Watch seeder output | `docker compose logs seeder` |
| Stop the load test | `docker compose stop vegeta` |
| Start the load test | `docker compose start vegeta` |

## Performance Concepts Included

This scaffold implements several advanced performance optimizations detailed in the Apollo Odyssey courses. Below is a detailed breakdown of what each concept does and how to configure it in `router/router.yaml`.

### 1. Observability (Metrics, Traces, Logs)
**What it is:** A comprehensive suite to monitor the health and performance of the graph.
*   **Metrics (Prometheus & Grafana):** Provides a high-level overview of system health. You can track request rates, error rates, and latency over time.
*   **Traces (Tempo):** Distributed tracing powered by OpenTelemetry (OTLP) visualizes exactly where a query spends its time. It generates a waterfall graph showing how long the router took to parse the query, plan it, and how long each subgraph took to respond.
*   **Logs (Loki):** Aggregates text-based logs and correlates them with specific traces.

**How it's configured:**
The router exports telemetry data via the `telemetry` block in `router.yaml`:
```yaml
telemetry:
  exporters:
    tracing:
      otlp:
        enabled: true
        endpoint: tempo:4317
    metrics:
      prometheus:
        enabled: true
        listen: 0.0.0.0:9090
        path: /metrics
```

### 2. Client-Side Traffic Shaping
**What it is:** Protecting the router from being overwhelmed by too many incoming requests from clients (e.g., traffic spikes or DDOS).

**How to configure:**
Set a `global_rate_limit` and `timeout` under the `router` traffic shaping block in `router.yaml`:
```yaml
traffic_shaping:
  router:
    timeout: 5s
    global_rate_limit:
      capacity: 800
      interval: 1s
```
*   `capacity`: The maximum number of requests allowed per `interval`.
*   `timeout`: The maximum time the router will wait to process a client request before aborting.

### 3. Subgraph Traffic Management
**What it is:** Preventing a slow or failing subgraph from causing cascading failures across the entire supergraph.

**How to configure:**
Configure timeouts and rate limits per subgraph in `router.yaml`. This ensures that if the `products` subgraph is slow, the router times out that specific request instead of hanging the entire client query.
```yaml
traffic_shaping:
  all: # Default for all subgraphs
    timeout: 1500ms
  subgraphs:
    accounts: # Override for a specific subgraph
      timeout: 300ms
      global_rate_limit:
        capacity: 800
        interval: 1s
```

### 4. Query Deduplication
**What it is:** When multiple clients request the exact same data simultaneously, the router can deduplicate the subgraph requests. It sends only *one* request to the underlying subgraph and shares the result with all waiting clients, drastically reducing subgraph load.

**How to configure:**
Enable `deduplicate_query` per subgraph in `router.yaml`:
```yaml
traffic_shaping:
  subgraphs:
    products:
      deduplicate_query: true
```

### 5. Query Planning Optimization
**What it is:** Before the router can fetch data, it must parse the GraphQL operation and generate a "Query Plan" to determine which subgraphs to call. We can optimize this by caching plans in memory and pre-planning common queries on startup.

**How to configure:**
In `router.yaml`, configure the `query_planning` cache and specify how many operations to "warm up" when the schema loads:
```yaml
supergraph:
  query_planning:
    cache:
      in_memory:
        limit: 512
    warmed_up_queries: 100
```

### 6. Subgraph Entity Caching (Redis)
**What it is:** Instead of asking subgraphs to resolve the same entities (e.g., a `Product` or `User`) repeatedly, the router caches these resolutions in a distributed Redis cache. Subsequent requests for the same entity bypass the subgraphs entirely, returning in milliseconds.

**How to configure:**
Enable the preview feature and configure the Redis backend in `router.yaml`. You must explicitly enable it for the desired subgraphs:
```yaml
preview_entity_cache:
  enabled: true
  subgraph:
    all:
      enabled: false
      redis:
        urls: ["redis://redis:6379"]
        timeout: 15ms
        ttl: 10s
  subgraphs:
    products:
      enabled: true
```

### 7. Real Database Layer with DataLoader N+1 Batching

**What it is:** A production-realistic data layer replacing the original hardcoded in-memory arrays. All subgraphs connect to a shared **PostgreSQL** database and use the `dataloader` library to solve the classic GraphQL N+1 query problem.

**The N+1 Problem:**
When a query fetches 100 users and then their reviews, a naive resolver fires 100 individual `SELECT` queries — one per user. Under load, this is catastrophic.

**How DataLoader Solves It:**
DataLoader **batches** all resolver calls within a single event loop tick into one SQL query:
```sql
-- Without DataLoader: 100 individual queries
SELECT * FROM reviews WHERE author_id = '1';
SELECT * FROM reviews WHERE author_id = '2';
-- ... 98 more

-- With DataLoader: ONE batched query
SELECT * FROM reviews WHERE author_id = ANY('{1,2,3,...,100}'::text[]);
```

**How it's implemented in the subgraphs:**

Each subgraph uses `pg` (node-postgres) for database access and `dataloader` for batching. The loader is instantiated **per-request** via the GraphQL context so its cache is never shared between requests:

```javascript
const { Pool } = require('pg');
const DataLoader = require('dataloader');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// One SQL query for any number of userIds
const batchReviewsForUsers = async (userIds) => {
  const result = await pool.query(
    'SELECT * FROM reviews WHERE author_id = ANY($1::text[])',
    [userIds]
  );
  return userIds.map(id => result.rows.filter(r => r.author_id === id));
};

// Provided fresh per-request via expressMiddleware context
expressMiddleware(server, {
  context: async () => ({
    userReviewsLoader: new DataLoader(batchReviewsForUsers)
  })
});
```

**Why `pg` and not Prisma?**
For a performance workshop, raw `pg` is the right tool:
*   **Transparent SQL:** You see exactly which queries are being sent and can observe the batching directly.
*   **Lightweight Docker images:** No Prisma query engine binary to bundle.
*   **No build step:** `prisma generate` is not needed; the subgraphs start instantly.
*   **No abstraction conflict:** Prisma has its own query batching which would mask the DataLoader optimization.

**How to observe DataLoader in action:**

Watch the `reviews` subgraph logs during a load test. Without DataLoader (or with a per-user query), you'd see thousands of individual DB hits. With DataLoader correctly batching multi-user queries, you'll see batch sizes grow:
```bash
docker compose logs -f reviews
# Expected output during a multi-user query:
# Loader called with userIds: [ '1', '2', '3', '47', '88', ... ]  ← ONE batch!
```

> **Note:** The current Vegeta load test uses the `me { ... }` query which resolves only **one** user per request, so batches will show single-item arrays `[ '1' ]`. To fully demonstrate batching, run a query that resolves multiple users simultaneously (e.g., a query that fetches `topProducts { reviews { author { ... } } }`).

## Getting help

This repo is _not regularly monitored_.

For any issues or problems concerning the course content, please refer to the [Odyssey topic in our community forums](https://community.apollographql.com/tags/c/help/6/odyssey). You can also [join the Apollo Discord](https://discord.gg/graphos).

## Reference documentation

For further reference, please consider the following sections:

**Apollo Router**
- [Traffic shaping in the router](https://www.apollographql.com/docs/graphos/routing/performance/traffic-shaping)
- [Subgraph Entity Caching](https://www.apollographql.com/docs/graphos/routing/performance/caching/entity)
- [Query Planning Cache](https://www.apollographql.com/docs/graphos/routing/performance/query-planning)
- [Router Telemetry & Tracing (OTLP)](https://www.apollographql.com/docs/graphos/routing/observability/telemetry/exporters/tracing/otlp)

**Subgraph & Database Layer**
- [node-postgres (`pg`) documentation](https://node-postgres.com/)
- [DataLoader on GitHub](https://github.com/graphql/dataloader)
- [Apollo Server 4 Context](https://www.apollographql.com/docs/apollo-server/data/context/)
- [@faker-js/faker documentation](https://fakerjs.dev/)

**Observability**
- [Grafana Tempo documentation](https://grafana.com/docs/tempo/latest/)
- [Grafana Loki documentation](https://grafana.com/docs/loki/latest/)
- [Prometheus query basics (PromQL)](https://prometheus.io/docs/prometheus/latest/querying/basics/)
