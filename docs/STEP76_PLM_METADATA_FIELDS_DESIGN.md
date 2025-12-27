# Step 76: PLM Metadata Fields - Design

## Goal
Capture owner/tags/revision note metadata on upload and surface it in history and index views.

## Router changes
- `POST /convert` accepts:
  - `owner`
  - `tags` (comma-separated)
  - `revision_note`
- History entries include `owner`, `tags`, and `revision_note`.
- Index endpoints return latest metadata per project/document.

## Web demo changes
- Add metadata inputs for owner, tags, revision note.
- Show metadata in project/document list and version detail cards.

## Files
- `tools/plm_router_service.py`
- `tools/plm_web_demo/index.html`
- `tools/plm_web_demo/app.js`
- `tools/plm_web_demo/style.css`
- `docs/STEP76_PLM_METADATA_FIELDS_DESIGN.md`
- `docs/STEP76_PLM_METADATA_FIELDS_VERIFICATION.md`
