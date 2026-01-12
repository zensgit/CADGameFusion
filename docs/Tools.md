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

## plm_router_service.py
Runs the HTTP router for uploads, history, and annotations.

```bash
python3 tools/plm_router_service.py --port 9000
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

## plm_smoke.sh
Runs a local router plus convert + annotate in one script.

```bash
tools/plm_smoke.sh
```

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
- `WAIT_TIMEOUT`: Wait timeout seconds (default `30`).
- `VERIFY_ERRORS`: Set to `1` to run `tools/plm_error_codes_smoke.sh` after the main flow.

## plm_error_codes_smoke.sh
Validates common router error codes (auth required, missing plugin, etc.).
Also checks `/health` includes `error_codes`, `version`, `commit`, and `uptime_seconds`.

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

## Notes
- Use `--token` with router/annotate if auth is enabled.
