# Step 111: Router Plugin Auto Selection - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Start Router (plugin map enabled)
```bash
mkdir -p build_vcpkg/plm_service_runs_step111
ROUTER_PORT=9012 \
CADGF_ROUTER_PLUGIN_MAP=".json=build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib,.dxf=build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib" \
CADGF_ROUTER_PLUGIN_ALLOWLIST="build_vcpkg/plugins" \
CADGF_ROUTER_CLI_ALLOWLIST="build_vcpkg/tools" \
python3 tools/plm_router_service.py \
  --port 9012 \
  --default-convert-cli build_vcpkg/tools/convert_cli \
  --out-root build_vcpkg/plm_service_runs_step111
```

## Convert (no plugin field)
```bash
curl -s -X POST http://127.0.0.1:9012/convert \
  -F "file=@tests/plugin_data/importer_sample.json" \
  -F "emit=json,gltf,meta" \
  -F "project_id=demo" \
  -F "document_label=auto_plugin"
```

Observed:
- `status` = `ok`
- `manifest.plugin` = `build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib`
- `outputs` include `json`, `gltf`, `meta`

## Shutdown
```bash
kill <router_pid>
```
