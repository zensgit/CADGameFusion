# PLM Web Demo

## Goal
Provide a minimal browser UI to upload a CAD file to the router service and open the preview URL.

## Run
Start the router service (serves static files + conversion):
```bash
python3 tools/plm_router_service.py \
  --default-plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
  --default-convert-cli build_vcpkg/tools/convert_cli
```

Or use extension-based auto selection (plugin optional in uploads):
```bash
CADGF_ROUTER_PLUGIN_MAP=".dxf=build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib,.json=build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib" \
CADGF_ROUTER_PLUGIN_ALLOWLIST="build_vcpkg/plugins" \
CADGF_ROUTER_CLI_ALLOWLIST="build_vcpkg/tools" \
python3 tools/plm_router_service.py \
  --default-convert-cli build_vcpkg/tools/convert_cli
```

Then open the demo on the same host/port:
```
http://localhost:9000/tools/plm_web_demo/
```

## Notes
- The demo posts to `/convert` and polls `/status/<task_id>`.
- Use the router base URL field if the service runs on a different host.
- If router auth is enabled, paste the token (without `Bearer`) into the Auth Token field.
