---
phase: 5
plan: 3
wave: 2
---

# Plan 5.3: Fix createReview Mutation + Multi-User N+1 Vegeta Targets

## Objective
Two deliverables:
1. Fix the `createReview` mutation in `reviews` — the current implementation inserts
   `author_id = null` which violates the DB's `NOT NULL` constraint and causes silent
   failures or runtime errors under load. Fix it to accept `authorId` as an argument.
2. Add a new Vegeta target file (`multiuser.json`) containing the deep N+1 query that
   forces batching across all four subgraphs — and wire it into `targets.http`.

## Context
- `.gsd/phases/5/RESEARCH.md`
- `starstuff-services/reviews/index.js`
- `vegeta/targets.http`
- `vegeta/targets-local.http`
- `postgres/init.sql` (reviews schema: author_id NOT NULL)

## Tasks

<task type="auto">
  <name>Fix createReview mutation to accept and persist authorId</name>
  <files>starstuff-services/reviews/index.js</files>
  <action>
    The current mutation schema and resolver:
    ```graphql
    createReview(upc: ID!, id: ID!, body: String): Review
    ```
    ```js
    async createReview(_p, args) {
      await pool.query(
        "INSERT INTO reviews (id, author_id, product_upc, body) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        [id, null, args.upc, args.body]  // ← BUG: null author_id
      );
    }
    ```

    Fix both the schema definition and the resolver:

    1. Update the typeDefs mutation signature to add `authorId`:
    ```graphql
    type Mutation {
      createReview(upc: ID!, id: ID!, authorId: ID!, body: String): Review
    }
    ```

    2. Update the resolver to use `args.authorId`:
    ```js
    Mutation: {
      async createReview(_p, args) {
        const id = args.id || `review-${Date.now()}`;
        await pool.query(
          "INSERT INTO reviews (id, author_id, product_upc, body) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
          [id, args.authorId, args.upc, args.body]
        );
        return { id, body: args.body, product: { upc: args.upc }, author: { __typename: "User", id: args.authorId } };
      },
    },
    ```

    DO NOT change the `batchReviewsByAuthorId` or `batchReviewsByProductUpc` functions.
    DO NOT change the User or Product resolvers.
  </action>
  <verify>docker compose restart reviews 2>&1; Start-Sleep 5; Invoke-RestMethod -Method Post -Uri "http://localhost:4000/" -ContentType "application/json" -Body '{"query":"mutation { createReview(upc: \"1\", id: \"test-fix-1\", authorId: \"1\", body: \"test fix\") { id body } }"}' | ConvertTo-Json</verify>
  <done>
    The mutation returns `{ "id": "test-fix-1", "body": "test fix" }` without errors.
    Querying `{ topProducts { reviews { body author { name } } } }` returns reviews
    with non-null authors for the newly created review.
  </done>
</task>

<task type="auto">
  <name>Add multi-user N+1 Vegeta target and wire into targets.http</name>
  <files>vegeta/multiuser.json, vegeta/targets.http, vegeta/targets-local.http</files>
  <action>
    1. Create `vegeta/multiuser.json`:
    ```json
    {
      "query": "query MultiUserDeep { topProducts(first: 20) { name price inStock shippingEstimate reviews { body author { name username reviews { body } } } } }"
    }
    ```

    This query is the canonical N+1 stressor:
    - `topProducts(first: 20)` → 20 products (products subgraph)
    - Each product → `inStock`, `shippingEstimate` (inventory subgraph, batched)
    - Each product → `reviews` (reviews subgraph, batched)
    - Each review → `author.name/username` (accounts subgraph, batched)
    - Each author → nested `reviews` (reviews subgraph, second batch)

    2. Append the following to `vegeta/targets.http` (AFTER the last existing entry):
    ```
    POST http://router:4000/
    Accept: application/json
    Content-type: application/json
    @/etc/vegeta/multiuser.json
    ```

    3. Append the same entry to `vegeta/targets-local.http`, but with host `localhost:4000`:
    ```
    POST http://localhost:4000/
    Accept: application/json
    Content-type: application/json
    @/path/to/vegeta/multiuser.json
    ```

    Check `vegeta/targets-local.http` first to confirm the path format used for
    local file references, then mirror that pattern.

    DO NOT remove or reorder any existing targets — only append.
  </action>
  <verify>Get-Content vegeta/multiuser.json | ConvertFrom-Json | Select-Object query</verify>
  <done>
    `vegeta/multiuser.json` exists and parses as valid JSON with a `query` field.
    The file appears in both `targets.http` and `targets-local.http`.
    Running `docker compose restart vegeta` shows no errors in vegeta logs.
  </done>
</task>

## Success Criteria
- [ ] `createReview(upc, id, authorId, body)` mutation succeeds without constraint errors
- [ ] Newly created reviews have a non-null `author` when queried
- [ ] `vegeta/multiuser.json` exists with the 20-product deep N+1 query
- [ ] `multiuser.json` is referenced in both `targets.http` and `targets-local.http`
- [ ] Running the multiuser query in Apollo Sandbox returns data (no errors)
