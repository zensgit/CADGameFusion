# Step 83: PLM Annotate CLI - Design

## Goal
Provide a lightweight CLI to post annotations to the router without re-uploading.

## Script behavior
- `tools/plm_annotate.py` posts JSON to `/annotate`.
- Accepts `document_id` or `project_id` + `document_label`.
- Supports `--text` plus optional `--author`/`--kind`.
- Supports `--annotations` JSON or `--annotations-file`.

## Files
- `tools/plm_annotate.py`
- `docs/STEP83_PLM_ANNOTATE_CLI_DESIGN.md`
- `docs/STEP83_PLM_ANNOTATE_CLI_VERIFICATION.md`
