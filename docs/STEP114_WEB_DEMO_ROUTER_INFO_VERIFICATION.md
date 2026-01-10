# Step 114: Web Demo Router Info Panel - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Start Router
```bash
mkdir -p build_vcpkg/plm_service_runs_step114
ROUTER_PORT=9015 \
CADGF_ROUTER_PLUGIN_MAP=".json=build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib,.dxf=build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib" \
CADGF_ROUTER_PLUGIN_ALLOWLIST="build_vcpkg/plugins" \
CADGF_ROUTER_CLI_ALLOWLIST="build_vcpkg/tools" \
python3 tools/plm_router_service.py \
  --port 9015 \
  --default-plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
  --default-convert-cli build_vcpkg/tools/convert_cli \
  --out-root build_vcpkg/plm_service_runs_step114
```

## Router Health
```bash
curl -s http://127.0.0.1:9015/health
```
Observed:
- `plugin_map` = `[".dxf", ".json"]`
- `default_plugin` = `libcadgf_dxf_importer_plugin.dylib`

## Web Demo Markup
```bash
curl -s http://127.0.0.1:9015/tools/plm_web_demo/ | rg -n "router-info|router-status|router-plugin-map|router-default-plugin"
```
Observed:
- `router-info` panel present with status/map/default placeholders.

## Manual UI Check
Open:
- `http://127.0.0.1:9015/tools/plm_web_demo/`

Expected:
- Router info panel shows `ok` status.
- Plugin map shows `.dxf, .json`.
- Default plugin shows `libcadgf_dxf_importer_plugin.dylib`.

## Shutdown
```bash
kill <router_pid>
```
