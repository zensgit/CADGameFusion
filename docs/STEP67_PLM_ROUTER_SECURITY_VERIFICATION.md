# Step 67: PLM Router Security - Verification

## Checks
```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile tools/plm_router_service.py
```

## Manual smoke
```bash
python3 tools/plm_router_service.py \
  --default-plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
  --default-convert-cli build_vcpkg/tools/convert_cli \
  --auth-token testtoken \
  --cors-origins http://localhost:9050 \
  --port 9050

curl -s -o /dev/null -w "%{http_code}" http://localhost:9050/health
curl -s -o /dev/null -w "%{http_code}" -F "file=@tests/plugin_data/importer_sample.dxf" http://localhost:9050/convert
curl -s -H "Authorization: Bearer testtoken" -F "file=@tests/plugin_data/importer_sample.dxf" http://localhost:9050/convert
```

## Results
- `py_compile`: PASS
- Manual smoke: blocked by `PermissionError` when binding to localhost in this environment
