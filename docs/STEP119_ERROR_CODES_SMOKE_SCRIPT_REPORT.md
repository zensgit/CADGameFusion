# Step 119: Error Codes Smoke Script - Report

## Goal
Add a lightweight regression script that validates common router error codes and document the behavior in the web demo README.

## Scope
- `tools/plm_error_codes_smoke.sh`: start router with auth and assert key error codes.
- `tools/plm_web_demo/README.md`: describe error-code behavior with a sample response.

## Summary
- New smoke script confirms `AUTH_REQUIRED`, `TASK_NOT_FOUND`, `MISSING_PLUGIN`, and `MISSING_ANNOTATIONS`.
- Web demo README now highlights error codes and links to the full list in `docs/API.md`.
