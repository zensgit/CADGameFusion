# Step 66: PLM Web Upload + Preview - Design

## Goal
Deliver a minimal web UI that calls the router service and opens the preview URL.

## Behavior
- Uploads a CAD/JSON file to `POST /convert`.
- Uses async mode by default and polls `/status/<task_id>`.
- Displays `viewer_url` in an iframe and exposes a link for a new tab.

## Files
- `tools/plm_web_demo/index.html`
- `tools/plm_web_demo/style.css`
- `tools/plm_web_demo/app.js`
- `tools/plm_web_demo/README.md`
- `docs/STEP66_PLM_WEB_UPLOAD_PREVIEW_DESIGN.md`
- `docs/STEP66_PLM_WEB_UPLOAD_PREVIEW_VERIFICATION.md`
