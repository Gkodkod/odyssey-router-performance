---
phase: 6
plan: 1
wave: 1
---

# Plan 6.1: Advanced Targets & Segmentation Structure

## Objective
Create advanced query and mutation target JSON payloads for Vegeta, and segment the load testing structure into `targets-queries.http` and `targets-mutations.http` to isolate performance metrics.

## Context
- .gsd/SPEC.md
- .gsd/DECISIONS.md
- vegeta/targets.http

## Tasks

<task type="auto">
  <name>Create advanced JSON payloads</name>
  <files>
    - vegeta/deep_nested.json
    - vegeta/heavy_compute.json
    - vegeta/mutation_cross.json
  </files>
  <action>
    Create three new JSON files in the `vegeta` directory:
    1. `deep_nested.json`: `{"query": "query DeepNested { me { reviews { product { reviews { author { username } } } } } }"}`
    2. `heavy_compute.json`: `{"query": "query HeavyCompute { topProducts(first: 50) { name shippingEstimate inStock reviews { body } } }"}`
    3. `mutation_cross.json`: `{"query": "mutation ComplexReviewMutation { createReview(upc: \"1\", id: \"stress-1\", authorId: \"1\", body: \"test\") { id body author { username reviews { body } } product { name inStock shippingEstimate } } }"}`
  </action>
  <verify>Get-Content vegeta/deep_nested.json; Get-Content vegeta/heavy_compute.json; Get-Content vegeta/mutation_cross.json</verify>
  <done>All three JSON files exist with valid GraphQL payloads.</done>
</task>

<task type="auto">
  <name>Segment Vegeta target files</name>
  <files>
    - vegeta/targets.http
    - vegeta/targets-queries.http
    - vegeta/targets-mutations.http
  </files>
  <action>
    1. Rename `vegeta/targets.http` to `vegeta/targets-queries.http`.
    2. Append the new `deep_nested.json` and `heavy_compute.json` target configs to `vegeta/targets-queries.http`.
    3. Create `vegeta/targets-mutations.http` and add the `mutation_cross.json` target config to it.
  </action>
  <verify>Test-Path vegeta/targets-queries.http; Test-Path vegeta/targets-mutations.http; Select-String -Path vegeta/targets-mutations.http -Pattern "mutation_cross.json"</verify>
  <done>The load tests are successfully segmented into queries and mutations.</done>
</task>

## Success Criteria
- [ ] Three new advanced GraphQL operation JSON payloads exist.
- [ ] Vegeta configuration is split into `targets-queries.http` and `targets-mutations.http`.
