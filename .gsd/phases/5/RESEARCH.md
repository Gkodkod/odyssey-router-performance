# Phase 5 Research

> Discovery Level: 0 — All patterns established in the codebase (`reviews/index.js`)

## DataLoader Pattern (established)

The `reviews` subgraph already implements the canonical pattern. All three remaining
subgraphs follow the same structure:

```js
// 1. Batch function — takes array of keys, returns parallel array of results
const batchByKey = async (keys) => {
  const result = await pool.query("SELECT ... WHERE col = ANY($1::text[])", [keys]);
  return keys.map(k => result.rows.find(r => r.col === k) || null);
};

// 2. DataLoader instantiated per-request in expressMiddleware context
context: async () => ({
  myLoader: new DataLoader(batchByKey),
})

// 3. Resolver uses loader instead of direct pool.query
async __resolveReference(object, _, context) {
  return context.myLoader.load(object.id);
}
```

## N+1 Hotspots Identified

| Subgraph | Resolver | Current Query | Fix |
|----------|----------|---------------|-----|
| products | `__resolveReference` | `SELECT * FROM products WHERE upc = $1` (1 per product) | Batch via `ANY($1::text[])` |
| inventory | `__resolveReference` | `SELECT upc, in_stock FROM inventory WHERE upc = $1` (1 per product) | Batch via `ANY($1::text[])` |
| accounts | `__resolveReference` | `SELECT * FROM users WHERE id = $1` (1 per user) | Batch via `ANY($1::text[])` |
| accounts | `me()` | Hardcoded `WHERE id = '1'` | Read `x-user-id` request header |

## Header Forwarding (router.yaml)

Apollo Router can propagate request headers to subgraphs via `headers` config:

```yaml
headers:
  subgraphs:
    accounts:
      request:
        - propagate:
            named: "x-user-id"
```

The subgraph reads the header via the Apollo Server `context` function:

```js
context: async ({ req }) => ({
  userId: req.headers['x-user-id'] || '1', // fallback for local dev
  ...loaders
})
```

## createReview Bug

Current implementation passes `author_id = null` but the DB schema has:
`author_id TEXT NOT NULL REFERENCES users(id)`

This means `createReview` mutations silently fail (or would throw a constraint error).
Fix: accept `authorId` as an argument and pass it to the INSERT.

## Inventory Mutation (new)

The inventory table exists but has no mutation. Adding `updateProductStock` allows:
- Load tests to toggle stock state
- Exercises the entity cache invalidation path

## Vegeta Multi-User N+1 Query

The key query that demonstrates N+1 without DataLoader (and batching with it):

```graphql
query MultiUserDeep {
  topProducts(first: 20) {
    name price inStock shippingEstimate
    reviews {
      body
      author { name username reviews { body } }
    }
  }
}
```

- `topProducts(first: 20)` → 20 products
- Each product has N reviews (from seed data, ~5 per product = ~100 reviews)
- Each review has an `author` → `accounts.__resolveReference` called per unique user
- Without DataLoader: up to 100 sequential `SELECT * FROM users WHERE id = $1` queries
- With DataLoader: 1 batched `SELECT * FROM users WHERE id = ANY($1)` query
