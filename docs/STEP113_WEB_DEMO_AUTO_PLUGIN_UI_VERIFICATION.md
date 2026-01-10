# Step 113: Web Demo Auto Plugin UI - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Start Router (plugin map enabled)
```bash
mkdir -p build_vcpkg/plm_service_runs_step113
ROUTER_PORT=9014 \
CADGF_ROUTER_PLUGIN_MAP=".json=build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib,.dxf=build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib" \
CADGF_ROUTER_PLUGIN_ALLOWLIST="build_vcpkg/plugins" \
CADGF_ROUTER_CLI_ALLOWLIST="build_vcpkg/tools" \
python3 tools/plm_router_service.py \
  --port 9014 \
  --default-convert-cli build_vcpkg/tools/convert_cli \
  --out-root build_vcpkg/plm_service_runs_step113
```

## Router Health
```bash
curl -s http://127.0.0.1:9014/health
```
Observed:
- `plugin_map` includes `.dxf`, `.json`

## Manual UI Check
Open:
- `http://127.0.0.1:9014/tools/plm_web_demo/`

Expected:
- Plugin input is hidden.
- “Importer plugin auto-selected…” notice is visible.
- Clicking “Override plugin” reveals the plugin input field.

## Shutdown
```bash
kill <router_pid>
```
