---
phase: 5
plan: 2
wave: 1
---

# Plan 5.2: Accounts DataLoader + Dynamic me() via Request Header

## Objective
Two fixes in the `accounts` subgraph:
1. Add a DataLoader to `__resolveReference` so that resolving many `User` entities
   (e.g., from `topProducts → reviews → author`) batches into a single SQL query.
2. Fix the hardcoded `me()` resolver (`WHERE id = '1'`) to read the `x-user-id`
   request header forwarded by the Router, falling back to `'1'` for local dev.

## Context
- `.gsd/phases/5/RESEARCH.md`
- `starstuff-services/accounts/index.js`
- `router/router.yaml`

## Tasks

<task type="auto">
  <name>Add DataLoader + dynamic me() to accounts subgraph</name>
  <files>starstuff-services/accounts/index.js</files>
  <action>
    1. Add `const DataLoader = require("dataloader");` at the top (after pg import).

    2. Define batch function above the resolvers block:
    ```js
    const batchUsersById = async (ids) => {
      console.log(`[accounts] Loader called with ${ids.length} userIds:`, ids);
      const result = await pool.query(
        "SELECT * FROM users WHERE id = ANY($1::text[])",
        [ids]
      );
      return ids.map(id => result.rows.find(r => r.id === id) || null);
    };
    ```

    3. Update `Query.me` to read the `x-user-id` header from context:
    ```js
    Query: {
      async me(parent, args, context, info) {
        info.cacheControl.setCacheHint({ maxAge: 60, scope: "PRIVATE" });
        const userId = context.userId || '1';
        return context.userLoader.load(userId);
      },
      async recommendedProducts(parent, args, contextValue, info) {
        // unchanged
        info.cacheControl.setCacheHint({ maxAge: 10, scope: "PRIVATE" });
        const result = await pool.query(
          "SELECT upc FROM products ORDER BY RANDOM() LIMIT 20"
        );
        return result.rows.map((r) => ({ upc: r.upc }));
      },
    },
    ```

    4. Update `User.__resolveReference` to use the loader:
    ```js
    User: {
      async __resolveReference(object, context, info) {
        info.cacheControl.setCacheHint({ maxAge: 60 });
        return context.userLoader.load(object.id);
      },
    },
    ```

    5. Update `expressMiddleware` to pass `context` with `userId` from header:
    ```js
    expressMiddleware(server, {
      context: async ({ req }) => ({
        userId: req.headers['x-user-id'] || '1',
        userLoader: new DataLoader(batchUsersById),
      }),
    })
    ```

    IMPORTANT: The resolver signatures change from `(object, _, info)` to
    `(object, context, info)` — context is the 3rd argument in `__resolveReference`,
    and the 3rd argument in Query resolvers. Double-check argument order.
  </action>
  <verify>docker compose logs accounts --tail=30 --no-log-prefix | Select-String "Loader"</verify>
  <done>
    After running `{ topProducts { reviews { author { name } } } }` (which resolves
    many User references), accounts logs show "[accounts] Loader called with N userIds"
    where N > 1, confirming batch execution.
  </done>
</task>

<task type="auto">
  <name>Configure Router to forward x-user-id header to accounts subgraph</name>
  <files>router/router.yaml</files>
  <action>
    Add a `headers` section to `router.yaml` that propagates the `x-user-id` header
    from the client request to the accounts subgraph.

    Add this block BEFORE the `telemetry:` section:
    ```yaml
    headers:
      subgraphs:
        accounts:
          request:
            - propagate:
                named: "x-user-id"
    ```

    This tells the Router: "If the client sends an `x-user-id` header, include it
    in the subgraph fetch to accounts." The subgraph reads it from `req.headers`.

    DO NOT add header forwarding for other subgraphs — only accounts needs it.
    DO NOT change any other router.yaml settings.
  </action>
  <verify>docker compose restart router 2>&1; Start-Sleep 5; Invoke-RestMethod "http://localhost:9090/api/v1/query?query=apollo_router_http_requests_total" | ConvertTo-Json -Depth 3</verify>
  <done>
    Router restarts without errors and the Prometheus endpoint responds with HTTP 200.
    Sending `{ me { name } }` with header `x-user-id: 2` returns user id=2 from the DB
    (not always Ada Lovelace / id=1).
  </done>
</task>

## Success Criteria
- [ ] `accounts/__resolveReference` uses `context.userLoader.load(id)` — no direct pool.query
- [ ] `accounts/me()` uses `context.userId` from header, falls back to `'1'`
- [ ] `router.yaml` has `headers.subgraphs.accounts.request` propagating `x-user-id`
- [ ] Sending `x-user-id: 5` header to Router returns user id=5 from `{ me { name } }`
- [ ] Accounts logs batch calls with N > 1 under multi-user entity loads
