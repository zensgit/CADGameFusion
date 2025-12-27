# Step 79: PLM Post-Annotation - Design

## Goal
Allow annotations to be posted after conversion without re-uploading, and surface them in history/index views.

## Router changes
- Add `POST /annotate` (JSON, form, or multipart body).
- Accept `document_id` or `project_id` + `document_label`.
- Accept `annotation_text`/`annotation_author`/`annotation_kind` and/or `annotations` JSON.
- Create a new history entry with `event: "annotation"` and merged annotations.

## Web demo changes
- Add a "Post Annotation" action in the upload form.
- Send JSON to `/annotate`, using Project/Document fields or the selected document.
- Refresh history/projects/documents after posting.

## Files
- `tools/plm_router_service.py`
- `tools/plm_web_demo/index.html`
- `tools/plm_web_demo/app.js`
- `tools/plm_web_demo/style.css`
- `docs/STEP79_PLM_POST_ANNOTATE_DESIGN.md`
- `docs/STEP79_PLM_POST_ANNOTATE_VERIFICATION.md`
