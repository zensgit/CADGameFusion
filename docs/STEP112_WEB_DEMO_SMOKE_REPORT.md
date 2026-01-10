# Step 112: Web Demo Smoke - Report

## Goal
Verify the PLM web demo static assets are served correctly and the router can process an upload without manual plugin selection.

## Scope
- Serve `tools/plm_web_demo` via router service.
- POST `/convert` with a sample file (no `plugin` field) and confirm viewer URL and manifest are reachable.

## Summary
- Web demo index and JS assets served with HTTP 200.
- `/convert` succeeded using auto plugin map.
- Viewer URL and manifest returned HTTP 200.
