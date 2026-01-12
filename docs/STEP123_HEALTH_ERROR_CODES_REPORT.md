# Step 123: Router Health Error Codes - Report

## Goal
Expose supported error codes via `/health`, surface them in the web demo, and document them in the API reference.

## Scope
- `tools/plm_router_service.py`: include `error_codes` in `/health`.
- `tools/plm_web_demo/index.html` / `app.js` / `style.css`: display error codes in the router info panel.
- `docs/API.md`: replace the error code list with a detailed table.

## Summary
- `/health` now advertises the router error-code catalog.
- Web demo surfaces the list for quick debugging.
- API docs provide a single table mapping codes to fixes.
