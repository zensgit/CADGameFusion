# STEP134 PLM Router Closed Loop Verification

## Scope
- CLI helper for router upload → convert → preview URL flow.
- Readme update for the helper invocation.

## Manual Test Steps
1. Build core artifacts run locally (plugin + convert_cli).
2. Start the router service:
   ```bash
   python3 tools/plm_router_service.py \
     --default-plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
     --default-convert-cli build_vcpkg/tools/convert_cli
   ```
3. Run the helper:
   ```bash
   python3 tools/plm_router_smoke.py \
     --input tests/plugin_data/importer_sample.dxf \
     --plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
     --emit json,gltf,meta
   ```
4. Open the printed `viewer_url` in a browser to confirm the preview loads.

## Automated Tests
- `python3 -m py_compile tools/plm_router_smoke.py`

## Verification Result
- Passed: `python3 -m py_compile tools/plm_router_smoke.py`
