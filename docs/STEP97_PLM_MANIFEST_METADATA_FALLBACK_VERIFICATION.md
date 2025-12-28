# PLM Manifest Metadata Fallback Verification

## Scope
- `tools/plm_convert.py` writes `project_id`, `document_label`, `document_id` into manifest.json.
- Web viewer falls back to manifest metadata when query params are absent.

## Manual verification steps
1. Generate artifacts with manifest metadata:
   ```
   python3 tools/plm_convert.py --plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
     --input tests/plugin_data/importer_sample.dxf \
     --out build_vcpkg/plm_manifest_meta_smoke \
     --emit json,gltf \
     --project-id demo \
     --document-label sample
   ```
2. Confirm manifest includes metadata fields:
   ```
   python3 - <<'PY'
   import json
   from pathlib import Path
   manifest = json.loads(Path('build_vcpkg/plm_manifest_meta_smoke/manifest.json').read_text())
   print({k: manifest.get(k) for k in ['project_id','document_label','document_id']})
   PY
   ```
3. `python3 -m http.server 8080`
4. Open:
   `http://localhost:8080/tools/web_viewer/index.html?manifest=build_vcpkg/plm_manifest_meta_smoke/manifest.json`
5. Confirm the Document panel shows:
   - Project = `demo`
   - Label = `sample`
   - Document ID = `ZGVtbwpzYW1wbGU`

## Status
- PASS (manual).
