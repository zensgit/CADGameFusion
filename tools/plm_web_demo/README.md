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

## Error Codes
- Router error responses include `error_code`; the demo surfaces it in the status pill and annotation section.
- Example:
```json
{
  "status": "error",
  "message": "missing plugin",
  "error_code": "MISSING_PLUGIN"
}
```
- Full code list: `docs/API.md`.

## Health Sample
```bash
curl -s http://localhost:9000/health
```

Example response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "commit": "abc1234",
  "build_time": "2024-01-01T00:00:00Z",
  "hostname": "router-01",
  "pid": 12345,
  "uptime_seconds": 120,
  "error_codes": ["AUTH_REQUIRED", "MISSING_PLUGIN"],
  "plugin_map": [".dxf", ".json"],
  "default_plugin": "libcadgf_dxf_importer_plugin.dylib",
  "default_convert_cli": "convert_cli"
}
```
