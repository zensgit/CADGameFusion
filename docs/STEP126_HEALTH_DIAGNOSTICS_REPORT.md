# Step 126: Router Health Diagnostics - Report

## Goal
Expand `/health` diagnostics with build/host metadata and make router status more visible in the web demo.

## Scope
- `tools/plm_router_service.py`: add `build_time`, `hostname`, `pid` to `/health` and log metadata on startup.
- `tools/plm_web_demo/index.html` / `app.js` / `style.css`: surface new fields and auto-refresh router status.
- `tools/plm_error_codes_smoke.sh`: validate default convert_cli executability/allowlist when configured.
- `docs/API.md`, `docs/Tools.md`, `tools/plm_web_demo/README.md`: update docs.

## Summary
- `/health` now includes build/host diagnostics to aid ops triage.
- Web demo refreshes router info every 60s and highlights non-ok status.
- Smoke script optionally checks default convert_cli for executable + allowlist alignment.
