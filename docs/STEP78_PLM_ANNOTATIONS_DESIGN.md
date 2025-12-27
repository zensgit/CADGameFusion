# Step 78: PLM Lightweight Annotations - Design

## Goal
Capture lightweight annotations/comments as metadata without touching geometry, and surface them in history/index views.

## Router changes
- `POST /convert` accepts:
  - `annotation_text`
  - `annotation_author` (optional)
  - `annotation_kind` (optional)
  - `annotations` (optional JSON array)
- History entries include `annotations` (list of {message, author, created_at, kind?}).
- Index endpoints include `annotation_count` and `latest_annotation` for projects/documents.

## Web demo changes
- Add annotation text + author inputs in the upload form.
- Display annotations in history cards and version detail cards.

## Files
- `tools/plm_router_service.py`
- `tools/plm_web_demo/index.html`
- `tools/plm_web_demo/app.js`
- `tools/plm_web_demo/style.css`
- `docs/STEP78_PLM_ANNOTATIONS_DESIGN.md`
- `docs/STEP78_PLM_ANNOTATIONS_VERIFICATION.md`
