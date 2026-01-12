# Step 129: Metrics Auth - Report

## Goal
Allow `/metrics` to be protected by the router auth token when configured.

## Scope
- `tools/plm_router_service.py`: add `--metrics-auth` / `CADGF_ROUTER_METRICS_AUTH` gate for `/metrics`.
- `tools/plm_error_codes_smoke.sh`: validate `/metrics` auth behavior.
- `docs/API.md`, `docs/Tools.md`: document optional auth.

## Summary
- `/metrics` can now require Bearer auth when enabled.
- Smoke script confirms both protected and open modes.
