# Step 110: Line-only Metadata Export - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Preview Helper (line-only + metadata)
```bash
python3 tools/plm_preview.py \
  --plugin build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib \
  --input tests/plugin_data/importer_sample_p1.json \
  --out build_vcpkg/plm_preview_step110 \
  --emit json,gltf,meta \
  --project-id demo \
  --document-label line_only_meta
```

Artifacts:
```bash
ls build_vcpkg/plm_preview_step110
```

Observed:
- `manifest.json`
- `document.json`
- `mesh.gltf`
- `mesh.bin`
- `mesh_metadata.json`

Manifest summary:
- `status` = `ok`
- `outputs` = `["gltf", "json", "meta"]`
- `artifacts` include `document_json`, `mesh_gltf`, `mesh_bin`, `mesh_metadata`

Viewer URL:
- `http://localhost:8080/tools/web_viewer/index.html?manifest=build_vcpkg/plm_preview_step110/manifest.json&project_id=demo&document_label=line_only_meta&document_id=ZGVtbwpsaW5lX29ubHlfbWV0YQ`
