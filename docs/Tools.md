# Tools Reference

This page summarizes CLI helpers for the PLM conversion pipeline.

## Quickstart
Run the router, convert a file, then annotate it.
The example below uses the JSON importer; swap the input and plugin to use DXF.

```bash
python3 tools/plm_router_service.py --port 9000
```

```bash
python3 tools/plm_convert.py \
  --plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input samples/example.dxf \
  --out /tmp/plm_run \
  --emit json,gltf,meta
```

```bash
python3 tools/plm_annotate.py \
  --router http://localhost:9000 \
  --project-id demo \
  --document-label sample \
  --text "Reviewed" \
  --author sam
```

DXF variant (replace the convert step):

```bash
curl -s -X POST "http://127.0.0.1:9000/convert" \
  -F "file=@tests/plugin_data/importer_sample.dxf" \
  -F "plugin=build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib" \
  -F "emit=json,gltf,meta" \
  -F "project_id=demo" \
  -F "document_label=sample_dxf"
```

Diff via router (left/right manifests or documents). If you send manifests, include the
referenced document JSON as `left_document`/`right_document`:

```bash
curl -s -X POST "http://127.0.0.1:9000/diff" \
  -F "left=@build_vcpkg/dwg_run_1/manifest.json" \
  -F "left_document=@build_vcpkg/dwg_run_1/document.json" \
  -F "right=@build_vcpkg/dwg_run_2/manifest.json" \
  -F "right_document=@build_vcpkg/dwg_run_2/document.json"
```

For raw documents, send `left=@.../document.json` and `right=@.../document.json` only.

## plm_router_service.py
Runs the HTTP router for uploads, history, and annotations.

```bash
python3 tools/plm_router_service.py --port 9000
```

DWG uploads require an external DWG→DXF converter. Configure the command and allowlist:

```bash
export CADGF_ROUTER_DWG_CONVERT_CMD="/usr/local/bin/dwg2dxf {input} {output}"
export CADGF_ROUTER_DWG_CONVERT_TIMEOUT=120
export CADGF_ROUTER_CLI_ALLOWLIST="/usr/local/bin/dwg2dxf"
```

## plm_convert.py
Runs the conversion pipeline (plugin import → artifacts).

```bash
python3 tools/plm_convert.py \
  --plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input samples/example.dxf \
  --out /tmp/plm_run \
  --emit json,gltf,meta
```

## plm_annotate.py
Posts annotations to the router without re-uploading.

```bash
python3 tools/plm_annotate.py \
  --router http://localhost:9000 \
  --project-id demo \
  --document-label sample \
  --text "Reviewed" \
  --author sam
```

## document_diff.py
Compares two document.json or manifest.json files and emits a diff report plus a diff document.

```bash
python3 tools/document_diff.py \
  --left build_vcpkg/run_a/manifest.json \
  --right build_vcpkg/run_b/manifest.json \
  --out /tmp/cadgf_diff
```

## plm_diff.py
Calls the router `/diff` endpoint with local inputs.

```bash
python3 tools/plm_diff.py \
  --router http://localhost:9000 \
  --left build_vcpkg/dwg_run_1/manifest.json \
  --left-document build_vcpkg/dwg_run_1/document.json \
  --right build_vcpkg/dwg_run_2/manifest.json \
  --right-document build_vcpkg/dwg_run_2/document.json
```

Auto-resolve document.json from manifests:

```bash
python3 tools/plm_diff.py \
  --router http://localhost:9000 \
  --left build_vcpkg/dwg_run_1/manifest.json \
  --right build_vcpkg/dwg_run_2/manifest.json
```

## plm_smoke.sh
Runs a local router plus convert + annotate in one script.

```bash
tools/plm_smoke.sh
```

## plm_diff_smoke.sh
Runs a local router and posts a diff request using sample JSON inputs.

```bash
tools/plm_diff_smoke.sh
```

## web_viewer_desktop
Electron wrapper for the Web Viewer.
End-user setup guide: `docs/VEMCAD_DESKTOP_GUIDE.md`.

```bash
cd tools/web_viewer_desktop
npm install
npm run start
```

Build installers locally:
```bash
npm run dist
```

Windows installers are built via GitHub Actions (workflow: Web Viewer Desktop (Windows)).

Desktop "Open CAD File" requires a running router:
- Desktop Settings (button or Cmd/Ctrl+,) lets you edit router/DWG settings in-app.
  Settings are stored locally and used as overrides for Open CAD File.
  Test Router / Check DWG buttons validate connectivity and DWG setup (including /health version info).
  When settings are empty, the app auto-fills local CADGameFusion paths and detected `dwg2dxf`.
- `VEMCAD_ROUTER_URL` (default `http://127.0.0.1:9000`)
- `VEMCAD_ROUTER_PLUGIN` / `VEMCAD_ROUTER_CONVERT_CLI` as needed (or configure router defaults).
- `VEMCAD_DWG_CONVERT_CMD` to enable DWG -> DXF before upload.
- `VEMCAD_ROUTER_AUTO_START=1` to auto-launch a local router (or set `VEMCAD_ROUTER_START_CMD`).
- `VEMCAD_DWG_SERVICE_PATH` lets the desktop auto-detect `cadgf-dwg-service` when no command is set.
- `VEMCAD_DWG2DXF_BIN` lets the desktop auto-pass LibreDWG `dwg2dxf` if installed.

```bash
INPUT=tests/plugin_data/importer_sample.dxf \
PLUGIN=build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
DOCUMENT_LABEL=sample_dxf \
tools/plm_smoke.sh
```

Environment overrides:
- `ROUTER_URL`: Base URL for the router (default `http://127.0.0.1:9000`).
- `ROUTER_HOST`: Host for local router (default `127.0.0.1`).
- `ROUTER_PORT`: Port for local router (default `9000`).
- `SKIP_ROUTER`: Set to `1` to skip launching a local router.
- `INPUT`: Input file path (default `tests/plugin_data/importer_sample.json`).
- `PLUGIN`: Importer plugin path (default `build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib`).
- `EMIT`: Comma-separated outputs (default `json,gltf,meta`).
- `PROJECT_ID`: Project id (default `demo`).
- `DOCUMENT_LABEL`: Document label (default `sample`).
- `RUN_DIFF_SMOKE`: Set to `1` to also run diff smoke.
- `DIFF_LEFT_INPUT`: Diff left file (default `tests/plugin_data/importer_sample.json`).
- `DIFF_RIGHT_INPUT`: Diff right file (default `tests/plugin_data/importer_sample_p1.json`).
- `DIFF_PLUGIN`: Diff JSON plugin (default `build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib`).
- `DIFF_CONVERT_CLI`: Diff convert_cli path (default `build_vcpkg/tools/convert_cli`).
- `DIFF_EMIT`: Diff outputs (default `json,gltf,meta`).
- `WAIT_TIMEOUT`: Wait timeout seconds (default `30`).
- `VERIFY_ERRORS`: Set to `1` to run `tools/plm_error_codes_smoke.sh` after the main flow.

## plm_error_codes_smoke.sh
Validates common router error codes (auth required, missing plugin, etc.).
Also checks `/health` includes `error_codes`, `version`, `commit`, and `uptime_seconds`.
If `CADGF_ROUTER_DEFAULT_CONVERT_CLI` is set, it validates the default convert_cli is executable
and (when `CADGF_ROUTER_CLI_ALLOWLIST` is set) allowlisted.
Also checks `/metrics` exposes core router metrics.

```bash
tools/plm_error_codes_smoke.sh
```

Environment overrides:
- `ROUTER_URL`: Base URL for the router (default `http://127.0.0.1:9033`).
- `ROUTER_HOST`: Host for local router (default `127.0.0.1`).
- `ROUTER_PORT`: Port for local router (default `9033`).
- `SKIP_ROUTER`: Set to `1` to skip launching a local router.
- `AUTH_TOKEN`: Auth token for secured routes (default `testtoken`).
- `OUT_DIR`: Router output dir (default `build_vcpkg/plm_service_runs_error_codes`).

Print a document_id for `/documents/{id}/versions` or `POST /annotate`:

```bash
python3 tools/plm_annotate.py \
  --project-id demo \
  --document-label sample \
  --print-document-id
```

## Router environment variables
- `CADGF_ROUTER_AUTH_TOKEN`: Bearer token required for `/convert`, `/status`, `/annotate` when set.
- `CADGF_ROUTER_CORS_ORIGINS`: Comma-separated CORS allowlist (use `*` to allow all).
- `CADGF_ROUTER_PLUGIN_ALLOWLIST`: Comma-separated allowed plugin paths or directories.
- `CADGF_ROUTER_CLI_ALLOWLIST`: Comma-separated allowed convert CLI paths or directories.
- `CADGF_ROUTER_HISTORY_FILE`: Append task history to a JSONL file (directories created if needed).
- `CADGF_ROUTER_HISTORY_LOAD`: Max history entries to load on startup (0 = all).
- `CADGF_ROUTER_MAX_BYTES`: Max upload size in bytes (0 disables).
- `CADGF_BUILD_TIME`: ISO timestamp or epoch seconds for `/health` `build_time` (overrides `SOURCE_DATE_EPOCH`).
- `SOURCE_DATE_EPOCH`: Epoch seconds used for `/health` `build_time` when `CADGF_BUILD_TIME` is unset.
- `CADGF_ROUTER_METRICS_AUTH`: Set to `1` to require auth token for `/metrics`.

## Metrics
`GET /metrics` returns Prometheus text output for queue depth, task/history counts, and error codes.
Set `CADGF_ROUTER_METRICS_AUTH=1` or pass `--metrics-auth` to require the router auth token.
See `docs/PLM_METRICS_PROMETHEUS.md`, `docs/PLM_METRICS_DOCKER_COMPOSE.md`, and
`docs/grafana/cadgf_router_dashboard.json`.

## Notes
- Use `--token` with router/annotate if auth is enabled.
