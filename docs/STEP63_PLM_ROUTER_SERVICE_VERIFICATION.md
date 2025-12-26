# Step 63: PLM Router Service - Verification

## Checks
```bash
python3 -m py_compile tools/plm_router_service.py
```

## Manual smoke (optional)
```bash
python3 tools/plm_router_service.py --default-plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib --default-convert-cli build_vcpkg/tools/convert_cli --port 9031
curl -s -X POST -F "file=@tests/plugin_data/importer_sample.dxf" http://localhost:9031/convert
```

## Results
- `py_compile`: PASS
- Manual smoke: PASS (see terminal output)
