# Postgres Performance Improvements

## Mutation Latency Analysis: Row-Level Database Lock Contention

The extreme latency (e.g., ~9 seconds) observed during mutation load tests is primarily a result of database contention caused by static load test payloads.

### The Problem
If the Vegeta load test payloads for mutations are static:
- `mutation_cross.json`: Uses `id: "stress-1"` for `createReview`
- `update_review.json`: Uses `id: "stress-1"` for `updateReview`
- `delete_review.json`: Uses `id: "stress-1"` for `deleteReview`
- `create_product.json`: Uses `upc: "product-123"` for `createProduct`

When firing these mutations concurrently at a high rate (e.g., 50 RPS), every single request attempts to mutate the **exact same row** in the PostgreSQL database.

#### How Postgres Handles Concurrent Updates to the Same Row:
1. **Updates/Deletes**: When transaction A executes an `UPDATE` or `DELETE` on a row, Postgres acquires an exclusive row-level lock on that row. If transaction B tries to update the same row at the same time, it is put into a queue and must wait for transaction A to finish.
2. **Inserts (ON CONFLICT)**: Similarly, concurrent inserts of the exact same primary key (`id`) cause index-level contention.
3. **The Snowball Effect**: If 50 requests arrive per second trying to update `id: "stress-1"`, they form a single-file line in the database. The 50th request has to wait for all 49 previous requests to complete their database transactions. As the queue grows, latency spikes astronomically, easily reaching 9+ seconds.

## Recommended Solutions

To speed up the load test and measure *actual* system performance (rather than DB lock queues), we must eliminate the row contention.

### 1. Generate Dynamic Vegeta Targets (Recommended)
Instead of using a single static JSON payload, use a script to generate a `targets.txt` file containing unique GraphQL requests with randomly generated IDs.

```json
// Example of what the script would generate:
{"query": "mutation { createReview(upc: \"1\", id: \"stress-73891\", authorId: \"1\", body: \"test\") ... }"}
{"query": "mutation { createReview(upc: \"1\", id: \"stress-99234\", authorId: \"1\", body: \"test\") ... }"}
```
This distributes the database writes across different rows, eliminating row-level locks and allowing the database to process them in parallel.

### 2. Randomize IDs inside the Resolvers
If testing database throughput is not the primary goal, modify the resolvers to ignore the provided `id` and generate a unique one (e.g., a UUID) during load tests.

### 3. Reduce Mutation Concurrency
If using static IDs is required, reduce the Vegeta rate for mutations specifically (e.g., to 1-5 RPS) to allow the database to clear locks before the next request arrives.

**Summary:** Implementing Solution 1 will drop mutation latency from seconds back to millisecond ranges by allowing concurrent database processing.
