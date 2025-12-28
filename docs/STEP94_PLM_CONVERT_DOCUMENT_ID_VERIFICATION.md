# STEP94 PLM Convert Document ID Verification

## Scope
- Verify `/convert` includes `document_id` in the success response.

## Command
```bash
python3 tools/plm_router_service.py --port 9000
```
```bash
curl -s --max-time 60 -X POST "http://127.0.0.1:9000/convert" \
  -F "file=@tests/plugin_data/importer_sample.json" \
  -F "plugin=build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib" \
  -F "emit=json,gltf,meta" \
  -F "project_id=demo" \
  -F "document_label=sample_docid" \
  -F "wait_timeout=30" | \
  python3 -c 'import sys, json; data=json.load(sys.stdin); print(data.get("document_id", "")); assert data.get("status") == "ok"; assert data.get("document_id")'
```

## Results
- Response included `document_id` (`ZGVtbwpzYW1wbGVfZG9jaWQ`).
- `/convert` returned `status=ok`.

## Notes
- Router stopped after verification (Ctrl+C).
