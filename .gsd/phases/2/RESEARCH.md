---
phase: 2
level: 2
researched_at: 2026-05-14
---

# Phase 2 Research

## Questions Investigated
1. How are the timeseries colors currently configured in the Grafana dashboard (`router.json`)?
2. What are the best practices for semantic metric coloring, specifically for percentiles like p50, p90, and p99?
3. How do we override Grafana's default `palette-classic` to enforce these semantic colors?

## Findings

### Current Configuration
The `router.json` currently uses the `palette-classic` mode for the "Request latency" and "Processing time" panels. This assigns colors sequentially to targets. Since p50, p75, p90, p95, and p99 are added in order, Grafana arbitrarily assigns colors. This leads to the problem noted in `ideas.md` where p99 (the worst latency) might be colored green (which implies "good" or "healthy"), confusing the operator.

### Semantic Color Best Practices
For latency percentiles, the standard practice is a "heat progression" style where lower percentiles (typical user experience) are cool/positive colors, and higher percentiles (outliers/slow requests) are hot/warning colors:
- **p50 (Median)**: Green or Blue (e.g., `#73BF69` or `#5794F2`)
- **p75**: Light Green or Yellow (e.g., `#FADE2A`)
- **p90**: Orange (e.g., `#FF9830`)
- **p95**: Dark Orange or Red-Orange (e.g., `#FF780A`)
- **p99 (Outlier/Worst)**: Dark Red or Purple (e.g., `#E02F44` or `#8F3BB8`)

### How to Enforce in Grafana
To fix this, we need to add specific color overrides inside the `router.json` dashboard definition, rather than relying on `palette-classic`. We can use `fieldConfig.overrides` with `matcher.id = "byName"` matching the names "p50", "p75", "p90", "p95", and "p99", and setting the `color` property.

## Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Color Palette | Semantic Heat Progression | Ensures that spikes in p99 look like warnings (reds/oranges) instead of healthy (greens). |
| Implementation | Field Overrides | Using `fieldConfig.overrides` targeting "p50", "p99", etc., is the most robust way in `router.json`. |

## Patterns to Follow
- Use consistent hex codes across both "Request latency" and "Processing time" panels.

## Anti-Patterns to Avoid
- Relying on `palette-classic` for any latency percentile graphs.

## Dependencies Identified
| Package | Version | Purpose |
|---------|---------|---------|
| Grafana | N/A | Dashboard visualization |

## Risks
- Incorrect JSON modification can break the dashboard layout. Mitigation: Keep the modifications isolated to the `overrides` array and validate JSON syntax.

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
