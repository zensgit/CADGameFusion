# Step 72: PLM Project/Document Index - Design

## Goal
Expose a lightweight project/document index derived from router history, plus document version lookup.

## Router changes
- `GET /projects?limit=` lists projects derived from task history.
- `GET /projects/{project_id}/documents?limit=` lists documents for a project.
- `GET /documents/{document_id}/versions?limit=&state=&from=&to=` lists versions for a document.
- `document_id` is a URL-safe base64 token of `{project_id}\n{document_label}`.
- Missing `project_id` is surfaced as `unassigned` in the index.

## Web demo changes
- Add a Project Index card that lists projects, documents, and versions.
- Selecting a project loads its documents; selecting a document loads its versions.

## Files
- `tools/plm_router_service.py`
- `tools/plm_web_demo/index.html`
- `tools/plm_web_demo/app.js`
- `tools/plm_web_demo/style.css`
- `docs/STEP72_PLM_PROJECT_INDEX_DESIGN.md`
- `docs/STEP72_PLM_PROJECT_INDEX_VERIFICATION.md`
