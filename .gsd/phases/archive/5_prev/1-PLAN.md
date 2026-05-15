---
phase: 5
plan: 1
wave: 1
---

# Plan 5.1: DataLoader Batching — Products & Inventory

## Objective
Eliminate N+1 query patterns in `products` and `inventory` subgraphs by adding
per-request DataLoaders to their `__resolveReference` resolvers. Without this,
every federated entity resolution fires one SQL query per entity — e.g., resolving
20 products from `recommendedProducts` causes 20 sequential `SELECT` statements.

## Context
- `.gsd/SPEC.md`
- `.gsd/phases/5/RESEARCH.md`
- `starstuff-services/products/index.js`
- `starstuff-services/inventory/index.js`

## Tasks

<task type="auto">
  <name>Add DataLoader to products subgraph __resolveReference</name>
  <files>starstuff-services/products/index.js</files>
  <action>
    1. Add `const DataLoader = require("dataloader");` at the top (after pg import).

    2. Define a batch function ABOVE the resolvers block:
    ```js
    const batchProductsByUpc = async (upcs) => {
      const result = await pool.query(
        "SELECT * FROM products WHERE upc = ANY($1::text[])",
        [upcs]
      );
      return upcs.map(upc => result.rows.find(r => r.upc === upc) || null);
    };
    ```

    3. In `__resolveReference`, REPLACE the direct pool.query call with the loader:
    ```js
    Product: {
      async __resolveReference(object, context, info) {
        info.cacheControl.setCacheHint({ maxAge: 60 });
        return context.productLoader.load(object.upc);
      },
    },
    ```

    4. In `startApolloServer`, change `expressMiddleware(server)` to:
    ```js
    expressMiddleware(server, {
      context: async () => ({
        productLoader: new DataLoader(batchProductsByUpc),
      }),
    })
    ```

    DO NOT change the Query.topProducts resolver — it already uses a single
    `SELECT * FROM products LIMIT $1` and does not need a loader.

    DO NOT change the Mutation.createProduct resolver.
  </action>
  <verify>docker compose logs products --tail=20 --no-log-prefix | Select-String "Loader"</verify>
  <done>
    After running a query like `{ topProducts { name reviews { product { name } } } }`,
    the products container logs show "Loader called with N upcs" where N > 1,
    confirming batch fired instead of N individual queries.
  </done>
</task>

<task type="auto">
  <name>Add DataLoader to inventory subgraph __resolveReference</name>
  <files>starstuff-services/inventory/index.js</files>
  <action>
    1. Add `const DataLoader = require("dataloader");` at the top (after pg import).

    2. Define a batch function ABOVE the resolvers block:
    ```js
    const batchInventoryByUpc = async (upcs) => {
      console.log(`[inventory] Loader called with ${upcs.length} upcs:`, upcs);
      const result = await pool.query(
        "SELECT upc, in_stock FROM inventory WHERE upc = ANY($1::text[])",
        [upcs]
      );
      return upcs.map(upc => {
        const row = result.rows.find(r => r.upc === upc);
        return row ? { upc, inStock: row.in_stock } : { upc, inStock: false };
      });
    };
    ```

    3. In `__resolveReference`, REPLACE the direct pool.query with loader:
    ```js
    Product: {
      async __resolveReference(object, context, info) {
        info.cacheControl.setCacheHint({ maxAge: 60 });
        const inv = await context.inventoryLoader.load(object.upc);
        return { ...object, inStock: inv.inStock };
      },
      shippingEstimate(object) {
        if (object.price > 1000) return 0;
        return Math.floor(object.weight * 0.5);
      },
    },
    ```

    4. In `startApolloServer`, change `expressMiddleware(server)` to:
    ```js
    expressMiddleware(server, {
      context: async () => ({
        inventoryLoader: new DataLoader(batchInventoryByUpc),
      }),
    })
    ```
  </action>
  <verify>docker compose logs inventory --tail=20 --no-log-prefix | Select-String "Loader"</verify>
  <done>
    After running `{ recommendedProducts { name inStock shippingEstimate } }`,
    inventory logs show "[inventory] Loader called with N upcs" where N > 1,
    proving all products were batched into a single SQL query.
  </done>
</task>

## Success Criteria
- [ ] `products/__resolveReference` uses `context.productLoader.load(upc)` — no direct `pool.query`
- [ ] `inventory/__resolveReference` uses `context.inventoryLoader.load(upc)` — no direct `pool.query`
- [ ] Both subgraphs log batch calls with N > 1 when federated queries resolve multiple entities
- [ ] `docker compose restart products inventory` — services start without errors
