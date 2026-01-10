# Step 115: Router Error Codes for /convert - Report

## Goal
Provide structured `error_code` values in `/convert` responses so the UI can surface actionable failure reasons.

## Scope
- `tools/plm_router_service.py`: attach `error_code` to `/convert` errors, `/status` payloads, and history entries.
- `tools/plm_web_demo/app.js`: display error codes in status pill and history cards.

## Summary
- `/convert` preflight errors now include `error_code` alongside the human-readable message.
- Conversion failures propagate `error_code` through `/status` and history for consistent UI rendering.
