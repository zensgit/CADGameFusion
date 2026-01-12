# Step 127: Router Health Started At - Report

## Goal
Add `started_at` to `/health`, compute uptime using a monotonic clock, and document build-time env inputs.

## Scope
- `tools/plm_router_service.py`: include `started_at` in `/health` and use `time.monotonic()` for uptime.
- `tools/plm_error_codes_smoke.sh`: validate `/health` includes `started_at` and `build_time` keys.
- `docs/API.md`, `docs/Tools.md`, `tools/plm_web_demo/README.md`: update health response docs.

## Summary
- `/health` now reports an ISO `started_at` timestamp and monotonic uptime to avoid clock skew.
- Smoke script asserts additional health fields for quicker regression detection.
- Router build-time env vars are documented.
