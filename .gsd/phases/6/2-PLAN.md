---
phase: 6
plan: 2
wave: 1
---

# Plan 6.2: Implement Cache-Invalidating Mutations

## Objective
Implement `updateReview`, `deleteReview`, and `updateProductStock` mutations in their respective subgraphs and create Vegeta targets to test cache invalidation under load.

## Context
- .gsd/DECISIONS.md
- starstuff-services/reviews/index.js
- starstuff-services/inventory/index.js
- router/supergraph.graphql

## Tasks

<task type="auto">
  <name>Add mutations to Reviews subgraph</name>
  <files>
    - starstuff-services/reviews/index.js
    - router/supergraph.graphql
  </files>
  <action>
    1. Update the schema in `reviews/index.js` to add `updateReview(id: ID!, body: String): Review` and `deleteReview(id: ID!): Review` to the `Mutation` type.
    2. Add corresponding resolver logic to `reviews/index.js`. `updateReview` should perform an UPDATE in the database. `deleteReview` should perform a DELETE.
    3. Expose these new mutations in the `router/supergraph.graphql` file under the `Mutation` type.
  </action>
  <verify>Select-String -Path starstuff-services/reviews/index.js -Pattern "updateReview"; Select-String -Path router/supergraph.graphql -Pattern "updateReview"</verify>
  <done>The reviews subgraph supports update and delete mutations and they are exposed to the router.</done>
</task>

<task type="auto">
  <name>Add mutations to Inventory subgraph</name>
  <files>
    - starstuff-services/inventory/index.js
    - router/supergraph.graphql
  </files>
  <action>
    1. Update the schema in `inventory/index.js` to add `type Mutation { updateProductStock(upc: ID!, inStock: Boolean): Product }` (or similar).
    2. Add resolver logic to update the `inventory` table for the given UPC.
    3. Expose this mutation in the `router/supergraph.graphql` file.
  </action>
  <verify>Select-String -Path starstuff-services/inventory/index.js -Pattern "updateProductStock"; Select-String -Path router/supergraph.graphql -Pattern "updateProductStock"</verify>
  <done>The inventory subgraph supports stock updates exposed to the router.</done>
</task>

<task type="auto">
  <name>Create Vegeta targets for new mutations</name>
  <files>
    - vegeta/update_review.json
    - vegeta/delete_review.json
    - vegeta/update_stock.json
    - vegeta/targets-mutations.http
  </files>
  <action>
    Create JSON payloads for the three new mutations and append them as POST requests to `vegeta/targets-mutations.http`.
  </action>
  <verify>Get-Content vegeta/targets-mutations.http | Select-String -Pattern "update_stock.json"</verify>
  <done>New mutation targets are registered for load testing.</done>
</task>

## Success Criteria
- [ ] `updateReview`, `deleteReview`, and `updateProductStock` exist in the subgraphs and Supergraph.
- [ ] The mutations are added to `targets-mutations.http`.
