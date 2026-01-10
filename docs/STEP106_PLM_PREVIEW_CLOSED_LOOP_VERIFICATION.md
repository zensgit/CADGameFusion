# Step 106: PLM Preview Closed Loop - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## PLM Smoke (router + convert + annotate)
```bash
tools/plm_smoke.sh
```
Result:
- Status: OK (router + convert + annotate)
- Output folder: `build_vcpkg/plm_service_runs/20260110T111538Z_56754/output`

## Preview Helper (local artifacts + viewer URL)
```bash
python3 tools/plm_preview.py \
  --plugin build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib \
  --input tests/plugin_data/importer_sample.json \
  --out build_vcpkg/plm_preview_step106 \
  --emit json,gltf,meta \
  --project-id demo \
  --document-label sample
```
Artifacts:
```bash
ls build_vcpkg/plm_preview_step106
```
Output:
- `document.json`
- `manifest.json`
- `mesh.gltf`
- `mesh.bin`
- `mesh_metadata.json`
Viewer URL:
- `http://localhost:8080/tools/web_viewer/index.html?manifest=build_vcpkg/plm_preview_step106/manifest.json&project_id=demo&document_label=sample&document_id=ZGVtbwpzYW1wbGU`

## Manual (optional)
```bash
cd /Users/huazhou/Downloads/Github/CADGameFusion
python3 -m http.server 8080
```
Open the printed `viewer_url` from the preview helper output.
