# Step 112: Web Demo Smoke - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Start Router
```bash
mkdir -p build_vcpkg/plm_service_runs_step112
ROUTER_PORT=9013 \
CADGF_ROUTER_PLUGIN_MAP=".json=build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib,.dxf=build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib" \
CADGF_ROUTER_PLUGIN_ALLOWLIST="build_vcpkg/plugins" \
CADGF_ROUTER_CLI_ALLOWLIST="build_vcpkg/tools" \
python3 tools/plm_router_service.py \
  --port 9013 \
  --default-convert-cli build_vcpkg/tools/convert_cli \
  --out-root build_vcpkg/plm_service_runs_step112
```

## Web Demo Assets
```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9013/tools/plm_web_demo/
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9013/tools/plm_web_demo/app.js
```
Observed:
- `200`
- `200`

## Convert (no plugin field)
```bash
curl -s -X POST http://127.0.0.1:9013/convert \
  -F "file=@tests/plugin_data/importer_sample.json" \
  -F "emit=json,gltf,meta" \
  -F "project_id=demo" \
  -F "document_label=web_demo_smoke" \
  > build_vcpkg/plm_service_runs_step112/convert_response.json
```

Parsed:
- `status` = `ok`
- `viewer_url` = `http://127.0.0.1:9013/tools/web_viewer/index.html?manifest=build_vcpkg/plm_service_runs_step112/20260110T132902Z_87587/output/manifest.json&project_id=demo&document_label=web_demo_smoke&document_id=ZGVtbwp3ZWJfZGVtb19zbW9rZQ`

## Viewer URL + Manifest
```bash
curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:9013/tools/web_viewer/index.html?manifest=build_vcpkg/plm_service_runs_step112/20260110T132902Z_87587/output/manifest.json&project_id=demo&document_label=web_demo_smoke&document_id=ZGVtbwp3ZWJfZGVtb19zbW9rZQ"
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9013/build_vcpkg/plm_service_runs_step112/20260110T132902Z_87587/output/manifest.json
```
Observed:
- `200`
- `200`

## Shutdown
```bash
kill <router_pid>
```
