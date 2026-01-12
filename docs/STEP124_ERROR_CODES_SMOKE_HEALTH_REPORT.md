# Step 124: Error Codes Smoke Health Check - Report

## Goal
Extend the error-code smoke script to validate `/health` advertises `error_codes`.

## Scope
- `tools/plm_error_codes_smoke.sh`: assert `error_codes` list includes `AUTH_REQUIRED`.
- `docs/Tools.md`: mention `/health` validation.

## Summary
- Smoke script now verifies router health exposes the error-code catalog.
