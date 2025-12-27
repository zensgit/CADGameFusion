# Step 77: PLM Metadata Filters - Design

## Goal
Enable filtering by owner/tags/revision_note across history and index endpoints, with matching UI controls in the web demo.

## Router changes
- `GET /history` supports `owner`, `tags` (comma-separated), `revision`.
- `GET /projects` supports `owner`, `tags`, `revision`.
- `GET /projects/{id}/documents` supports `owner`, `tags`, `revision`.
- `GET /documents/{id}/versions` supports `owner`, `tags`, `revision` (plus existing `state/from/to`).

## Web demo changes
- Add filter inputs for owner/tags/revision.
- Apply metadata filters to history, project list, document list, and version list.

## Files
- `tools/plm_router_service.py`
- `tools/plm_web_demo/index.html`
- `tools/plm_web_demo/app.js`
- `tools/plm_web_demo/style.css`
- `docs/STEP77_PLM_METADATA_FILTERS_DESIGN.md`
- `docs/STEP77_PLM_METADATA_FILTERS_VERIFICATION.md`
