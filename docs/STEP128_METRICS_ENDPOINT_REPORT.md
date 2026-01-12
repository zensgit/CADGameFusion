# Step 128: Metrics Endpoint - Report

## Goal
Add a Prometheus `/metrics` endpoint to the router for operational visibility.

## Scope
- `tools/plm_router_service.py`: emit Prometheus text metrics (queue, task/history counts, error codes).
- `docs/API.md`: document the new `/metrics` endpoint.
- `docs/Tools.md`: mention metrics availability.

## Summary
- Added `/metrics` with router uptime, queue depth, task/history counts, and error code distributions.
- Metrics include build metadata and configuration flags for quick diagnostics.
