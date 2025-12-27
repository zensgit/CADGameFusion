# Step 75: Web Demo Pipeline Toggles - Design

## Goal
Expose document migration/validation options in the PLM web demo so operators can trigger schema controls from the browser.

## Web demo changes
- Add inputs for document target version and schema path.
- Add toggles for:
  - migrate_document
  - document_backup
  - validate_document
- Include fields in the `/convert` request payload.

## Files
- `tools/plm_web_demo/index.html`
- `tools/plm_web_demo/app.js`
- `tools/plm_web_demo/style.css`
- `docs/STEP75_WEB_PIPELINE_TOGGLES_DESIGN.md`
- `docs/STEP75_WEB_PIPELINE_TOGGLES_VERIFICATION.md`
