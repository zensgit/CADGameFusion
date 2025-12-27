# Step 68: PLM Task History - Design

## Goal
Expose a lightweight task history feed and surface it in the web demo.

## Router changes
- `GET /history?limit=N` returns recent tasks (default limit 50).
- History entries are in-memory and bounded by `--history-limit` (default 200).
- Auth and CORS rules match `/status`.

## Web demo changes
- Task list panel with status, timestamps, and preview links.
- Manual refresh plus optional polling.

## Files
- `tools/plm_router_service.py`
- `tools/plm_web_demo/app.js`
- `tools/plm_web_demo/index.html`
- `tools/plm_web_demo/style.css`
- `docs/STEP68_PLM_TASK_HISTORY_DESIGN.md`
- `docs/STEP68_PLM_TASK_HISTORY_VERIFICATION.md`
