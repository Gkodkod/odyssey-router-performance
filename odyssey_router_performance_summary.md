# Odyssey Router Performance Optimization & Infrastructure Fixes

**Conversation Reference:** `254232f3-ec5f-42e5-a918-cf196253f2b4`

## 1. Infrastructure & Environment Fixes
*   **Fixed .env Syntax**: Removed shell commands and backslashes that were causing Docker Compose to fail.
*   **Init Container Compatibility**: Updated `router-init` and `init-tempo` to use `alpine` images, as application images lacked the `chown` executable.
*   **Line Ending Conversion**: Converted `bootstrap.sh`, `loki.sh`, and `subgraphs.sh` from CRLF to LF to prevent execution errors in Linux containers.
*   **Version Pinning**:
    *   **Loki**: Pinned to `2.9.1`.
    *   **Tempo**: Pinned to `2.6.1`.
*   **Permission Fixes**: Implemented recursive `chown -R` in `init-tempo` to ensure the Write-Ahead Log (WAL) and data blocks were accessible.

## 2. Router & GraphQL Configuration
*   **CORS Fix**: Added `allow_any_origin: true` to `router.yaml` to allow **Apollo Sandbox** to connect from the browser.
*   **Introspection**: Enabled to allow Sandbox to populate the schema documentation.
*   **URL Fixes**: Updated `supergraph.graphql` to point subgraphs to the correct root path (`/`) instead of `/graphql`.

## 3. Performance & Monitoring
*   **Vegeta Load Test**: Reduced the attack rate from **500 to 50 requests/sec** to prevent subgraph saturation in a local development environment.
*   **Grafana Dashboard Fix**: Resolved a broken drilldown link in `router.json` by updating a hardcoded UID (`adw06lw71a41sd`) to the correct provisioned ID (`router`).
*   **Tempo Optimization**: Commented out incompatible `tempo.yaml` fields (like `stream_over_http_enabled`) that were causing startup crashes in version 2.6.1.

## Current System Status
*   **Apollo Router**: Healthy at `http://localhost:4000`
*   **Code Server**: Operational at `http://localhost:8080`
*   **Grafana**: Accessible at `http://localhost:3000`
