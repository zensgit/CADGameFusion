# PLM Preview Metadata URL Verification

## Scope
- Ensure `tools/plm_preview.py` can emit viewer URLs with `project_id`, `document_label`, and `document_id`.

## Manual verification steps
1. `python3 -m http.server 8080`
2. In another terminal:
   ```
   python3 tools/plm_preview.py --plugin /dev/null --input /dev/null --out build_vcpkg/plm_convert_smoke --skip-convert --project-id demo --document-label sample --port 8080
   ```
3. Open the printed viewer URL.
4. Confirm the Document panel shows:
   - Project = `demo`
   - Label = `sample`
   - Document ID = `ZGVtbwpzYW1wbGU`
   - Manifest link resolves to `build_vcpkg/plm_convert_smoke/manifest.json`.

## Status
- PASS (manual).
- Notes: Used `build_vcpkg/plm_convert_smoke/manifest.json` with `--skip-convert`.
