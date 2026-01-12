# Step 125: Router Health Metadata - Report

## Goal
Expose version/commit/uptime in `/health` and surface the metadata in the web demo.

## Scope
- `tools/plm_router_service.py`: add `version`, `commit`, `uptime_seconds`, `default_convert_cli` to `/health`.
- `tools/plm_web_demo/index.html` / `app.js` / `style.css`: render metadata in the router info panel.
- `docs/API.md` / `tools/plm_web_demo/README.md`: document updated `/health` response.
- `tools/plm_error_codes_smoke.sh`: assert `/health` includes version/commit/uptime.

## Summary
- `/health` now advertises router metadata for client diagnostics.
- Web demo presents version/commit/uptime alongside plugin information.
