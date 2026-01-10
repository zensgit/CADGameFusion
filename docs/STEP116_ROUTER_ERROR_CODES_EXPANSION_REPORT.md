# Step 116: Router Error Codes Expansion - Report

## Goal
Standardize `error_code` across router endpoints and surface friendlier error messaging in the web demo.

## Scope
- `tools/plm_router_service.py`: add `error_code` to unauthorized/not-found responses for GET/POST endpoints.
- `tools/plm_web_demo/app.js`: map error codes to short user-facing messages in status pill and history cards.
- `docs/API.md`: document the error code catalog.

## Summary
- Router now emits `error_code` on auth failures, missing resources, and invalid requests across `/projects`, `/history`, `/status`, and `/convert`.
- Web demo displays readable error summaries with the underlying code for debugging.
