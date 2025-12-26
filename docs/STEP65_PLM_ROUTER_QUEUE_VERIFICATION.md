# Step 65: PLM Router Queue + Status - Verification

## Checks
```bash
python3 -m py_compile tools/plm_router_service.py
```

## Manual smoke
```bash
python3 tools/plm_router_service.py --default-plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib --default-convert-cli build_vcpkg/tools/convert_cli --port 9032
curl -s -X POST -F "file=@tests/plugin_data/importer_sample.dxf" -F "async=true" http://localhost:9032/convert
curl -s http://localhost:9032/status/<task_id>
```

## Results
- `py_compile`: PASS
- Manual smoke: PASS (async queue + status)
