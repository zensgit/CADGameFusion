# Step 71: PLM History Filters - Design

## Goal
Provide server-side filtering for history and expose filters in the web demo.

## Router changes
- `GET /history?limit=&project_id=&state=&from=&to=`
- Filters apply to `project_id`, `state`, and `created_at` range.

## Web demo changes
- Add filter controls for project, state, and date range.
- Refresh history when filters change.

## Files
- `tools/plm_router_service.py`
- `tools/plm_web_demo/index.html`
- `tools/plm_web_demo/app.js`
- `tools/plm_web_demo/style.css`
- `docs/STEP71_PLM_HISTORY_FILTERS_DESIGN.md`
- `docs/STEP71_PLM_HISTORY_FILTERS_VERIFICATION.md`
