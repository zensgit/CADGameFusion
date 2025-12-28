# STEP88 PLM Router Deadlock Fix Verification

## Scope
- Verify `/convert` no longer hangs after moving history recording out of the task lock.
- Validate end-to-end flow: convert -> annotate for JSON and DXF inputs.

## Change Summary
- `tools/plm_router_service.py`: record history outside the task lock and always signal completion via `finally` to avoid deadlock.

## Environment
- Host: macOS (local)
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Router: `python3 tools/plm_router_service.py --port 9000`
- Plugins: `build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib`, `build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib`
- convert_cli: `build_vcpkg/tools/convert_cli`

## Steps

### 1) JSON conversion
```bash
python3 tools/plm_router_service.py --port 9000
```
```bash
curl -s --max-time 60 -X POST "http://127.0.0.1:9000/convert" \
  -F "file=@tests/plugin_data/importer_sample.json" \
  -F "plugin=build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib" \
  -F "emit=json,gltf,meta" \
  -F "project_id=demo" \
  -F "document_label=sample" \
  -F "wait_timeout=30"
```

### 2) JSON annotate
```bash
python3 tools/plm_annotate.py \
  --router http://127.0.0.1:9000 \
  --project-id demo \
  --document-label sample \
  --text "Reviewed" \
  --author sam
```

### 3) DXF conversion
```bash
curl -s --max-time 60 -X POST "http://127.0.0.1:9000/convert" \
  -F "file=@tests/plugin_data/importer_sample.dxf" \
  -F "plugin=build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib" \
  -F "emit=json,gltf,meta" \
  -F "project_id=demo" \
  -F "document_label=sample_dxf" \
  -F "wait_timeout=30"
```

### 4) DXF annotate
```bash
python3 tools/plm_annotate.py \
  --router http://127.0.0.1:9000 \
  --project-id demo \
  --document-label sample_dxf \
  --text "Reviewed" \
  --author sam
```

## Results
- `/convert` returned `status=ok` for both JSON and DXF inputs; no hang observed.
- JSON annotate succeeded with `document_id=ZGVtbwpzYW1wbGU`.
- DXF annotate succeeded with `document_id=ZGVtbwpzYW1wbGVfZHhm`.
- Router logs show `POST /convert done` and `POST /annotate -> ok` for both flows.

## Notes
- The previous hang was caused by `record_history()` acquiring the task lock while `_run_task` already held it. Moving history recording out of the lock resolved the deadlock.
