# Step 118: Web Demo Annotation Error UI - Report

## Goal
Expose annotation-specific error feedback near the annotation controls, with readable messages and error codes.

## Scope
- `tools/plm_web_demo/index.html`: add annotation error placeholder.
- `tools/plm_web_demo/style.css`: style annotation error text.
- `tools/plm_web_demo/app.js`: surface annotation failures using error-code mapping.

## Summary
- Annotation failures now show a local error message with the underlying `error_code`.
