---
phase: 3
plan: 1
wave: 1
---

# Plan 3.1: Implement Grafana Panel Semantic Colors

## Objective
Update the `router.json` dashboard to enforce semantic metric colors for request latency percentiles, ensuring outliers like p99 are colored with warning colors (red/orange) instead of arbitrary ones.

## Context
- .gsd/DECISIONS.md
- grafana/provisioning/dashboards/default/router.json

## Tasks

<task type="auto">
  <name>Inject Field Overrides for Latency Panels</name>
  <files>grafana/provisioning/dashboards/default/router.json</files>
  <action>
    Modify `grafana/provisioning/dashboards/default/router.json`.
    Locate the "Request latency" panel and "Processing time" panel.
    For both panels, update the empty `fieldConfig.overrides: []` array to map the specific percentile names to the following fixed hex colors:
    - Match `p50` / `processing time p50` -> `#73BF69`
    - Match `p75` / `processing time p75` -> `#FADE2A`
    - Match `p90` / `processing time p90` -> `#FF9830`
    - Match `p95` / `processing time p95` -> `#FF780A`
    - Match `p99` / `processing time p99` -> `#E02F44`
    
    Ensure valid Grafana JSON override syntax is used (e.g., using `matcher.id = "byName"`).
  </action>
  <verify>Get-Content grafana/provisioning/dashboards/default/router.json | Select-String "#E02F44"</verify>
  <done>The `router.json` file contains explicit `overrides` for the percentile colors using the finalized hex codes.</done>
</task>

## Success Criteria
- [ ] `router.json` is successfully updated with the `fieldConfig.overrides` array containing the 5 color definitions for both latency panels.
