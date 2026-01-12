# Step 130: Metrics CI Smoke - Report

## Goal
Ensure `/metrics` exposes core Prometheus fields in CI by extending the existing router smoke script.

## Scope
- `tools/plm_error_codes_smoke.sh`: assert key metrics names are present.
- `docs/Tools.md`: note metrics validation in the smoke script.

## Summary
- The router smoke script now validates that `/metrics` includes core lines like
  `cadgf_router_info`, `cadgf_router_uptime_seconds`, and `cadgf_router_queue_depth`.
