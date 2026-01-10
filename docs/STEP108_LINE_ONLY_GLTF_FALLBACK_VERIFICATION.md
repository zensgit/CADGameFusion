# Step 108: Line-only glTF Fallback - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Preview Helper (line-only)
```bash
python3 tools/plm_preview.py \
  --plugin build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib \
  --input tests/plugin_data/importer_sample_p1.json \
  --out build_vcpkg/plm_preview_step108 \
  --emit json,gltf \
  --project-id demo \
  --document-label line_only
```

Artifacts:
```bash
ls build_vcpkg/plm_preview_step108
```

Observed:
- `manifest.json`
- `document.json`
- `mesh.gltf`
- `mesh.bin`

Manifest summary:
- `status` = `ok`
- `outputs` = `["gltf", "json"]`
- `artifacts` include `document_json`, `mesh_gltf`, `mesh_bin`

Viewer URL:
- `http://localhost:8080/tools/web_viewer/index.html?manifest=build_vcpkg/plm_preview_step108/manifest.json&project_id=demo&document_label=line_only&document_id=ZGVtbwpsaW5lX29ubHk`
