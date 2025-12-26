# Step 66: PLM Web Upload + Preview - Verification

## Checks
```bash
python3 -m py_compile tools/plm_router_service.py
```

## Manual smoke
```bash
python3 tools/plm_router_service.py --default-plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib --default-convert-cli build_vcpkg/tools/convert_cli --port 9040
curl -s http://localhost:9040/tools/plm_web_demo/index.html | head -n 5
```

## Results
- `py_compile`: PASS
- Demo page served from router: PASS
