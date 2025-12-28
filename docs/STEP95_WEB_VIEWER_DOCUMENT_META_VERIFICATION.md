# Web Viewer Document Metadata Verification

## Scope
- Display `project_id`, `document_label`, `document_id`, and manifest link in the web viewer Document panel.

## Manual verification steps
1. `python3 -m http.server 8080`
2. Open:
   `http://localhost:8080/tools/web_viewer/index.html?manifest=build_vcpkg/plm_convert_smoke/manifest.json&project_id=demo&document_label=sample&document_id=ZGVtbwpzYW1wbGU`
3. Confirm the Document panel shows:
   - Project = `demo`
   - Label = `sample`
   - Document ID = `ZGVtbwpzYW1wbGU`
   - Manifest link is clickable and opens the manifest JSON.

## Status
- PASS (manual).
- Notes: `build_vcpkg/plm_convert_smoke/manifest.json` was used because it exists locally.
