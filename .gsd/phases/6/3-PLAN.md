---
phase: 6
plan: 3
wave: 2
---

# Plan 6.3: Grafana Segmentation Panels

## Objective
Update the Grafana provisioning to introduce new panels that visualize the segmented load testing results, explicitly separating query and mutation performance and tracking cache invalidation.

## Context
- .gsd/DECISIONS.md
- grafana/provisioning/dashboards/

## Tasks

<task type="auto">
  <name>Create segmented Grafana dashboard panels</name>
  <files>
    - grafana/provisioning/dashboards/router.json (or equivalent dashboard file)
  </files>
  <action>
    Update the primary Grafana dashboard JSON to include new panels:
    1. "Query Latency vs Mutation Latency": Comparing the P99 latency where the GraphQL operation type is `query` vs `mutation` (using PromQL).
    2. "Cache Invalidation Rate": Tracking Loki logs or router metrics for entity cache invalidations.
    3. "Throughput by Operation Type": Showing RPS explicitly for queries vs mutations.
  </action>
  <verify>Select-String -Path grafana/provisioning/dashboards/*.json -Pattern "mutation" -Quiet</verify>
  <done>The Grafana dashboard JSON contains panels designed for segmenting query vs mutation performance.</done>
</task>

## Success Criteria
- [ ] Segmented dashboard panels are added to Grafana provisioning files.
