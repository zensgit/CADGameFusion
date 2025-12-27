# Step 84: PLM Version Event Filter - Design

## Goal
Allow `/documents/{document_id}/versions` to filter by event type and reuse the UI event filter for version lists.

## Router changes
- `GET /documents/{document_id}/versions` accepts `event=convert|annotation`.
- Version listing filters entries by `event` when provided.

## Web demo changes
- Reuse the history Event filter when requesting document versions.

## Files
- `tools/plm_router_service.py`
- `tools/plm_web_demo/app.js`
- `docs/API.md`
- `docs/STEP84_PLM_VERSION_EVENT_FILTER_DESIGN.md`
- `docs/STEP84_PLM_VERSION_EVENT_FILTER_VERIFICATION.md`
