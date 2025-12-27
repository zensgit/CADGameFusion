# Step 85: PLM Index Event Filter - Design

## Goal
Allow project/document index endpoints to filter by event type and reuse the UI event filter.

## Router changes
- `GET /projects` accepts `event=convert|annotation`.
- `GET /projects/{project_id}/documents` accepts `event=convert|annotation`.

## Web demo changes
- Reuse the Event filter in project/document index queries.

## Files
- `tools/plm_router_service.py`
- `tools/plm_web_demo/app.js`
- `docs/API.md`
- `docs/STEP85_PLM_INDEX_EVENT_FILTER_DESIGN.md`
- `docs/STEP85_PLM_INDEX_EVENT_FILTER_VERIFICATION.md`
