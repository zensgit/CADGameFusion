# Step 70: PLM Project/Document Grouping - Design

## Goal
Capture project/document metadata during upload and surface grouping in the history list.

## Router changes
- Accept `project_id` and `document_label` fields in `/convert`.
- Persist these fields into history entries.

## Web demo changes
- Add form fields for project ID and document label.
- Group history items by project ID.

## Files
- `tools/plm_router_service.py`
- `tools/plm_web_demo/index.html`
- `tools/plm_web_demo/app.js`
- `tools/plm_web_demo/style.css`
- `docs/STEP70_PLM_PROJECT_GROUPING_DESIGN.md`
- `docs/STEP70_PLM_PROJECT_GROUPING_VERIFICATION.md`
