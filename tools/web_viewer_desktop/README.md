# Web Viewer Desktop

Electron wrapper for `tools/web_viewer`.

## Install
```bash
cd tools/web_viewer_desktop
npm install
```

## Run
```bash
npm run start
```

Overrides:
- `--url <viewer_url>`: open an existing hosted viewer URL (e.g., router `viewer_url`).
- `--manifest <manifest_url>`: append a manifest query to the viewer URL.
- `--viewer-path <path>`: local path to `index.html` (defaults to `../web_viewer/index.html`).

Environment alternatives:
- `VEMCAD_VIEWER_URL` (preferred)
- `VEMCAD_VIEWER_MANIFEST` (preferred)
- `VEMCAD_VIEWER_PATH` (preferred)
- `CADGF_VIEWER_URL` (legacy)
- `CADGF_VIEWER_MANIFEST` (legacy)
- `CADGF_VIEWER_PATH` (legacy)

## Open CAD file (desktop button)
The desktop app can upload a CAD file to a running router and load the preview.
Configure the router details via environment variables or CLI flags.

Environment variables:
- `VEMCAD_ROUTER_URL` (default `http://127.0.0.1:9000`)
- `VEMCAD_ROUTER_PLUGIN` (optional)
- `VEMCAD_ROUTER_CONVERT_CLI` (optional)
- `VEMCAD_ROUTER_EMIT` (default `json,gltf,meta`)
- `VEMCAD_ROUTER_AUTH_TOKEN` (optional bearer token)
- `VEMCAD_PROJECT_ID` (optional)
- `VEMCAD_DOCUMENT_LABEL_PREFIX` (optional)
- `VEMCAD_ROUTER_AUTO_START` (optional, default on in dev builds)
- `VEMCAD_ROUTER_START_CMD` (optional, overrides auto-start command)
- `VEMCAD_ROUTER_START_TIMEOUT_MS` (optional, default 15000)
- `VEMCAD_DWG_CONVERT_CMD` (optional DWG -> DXF conversion command)
- `VEMCAD_DWG_CONVERT_TIMEOUT_MS` (optional, default 60000)
- `VEMCAD_DWG_SERVICE_PATH` (optional, auto-detect `cadgf-dwg-service` directory)
- `VEMCAD_DWG2DXF_BIN` (optional, path to LibreDWG `dwg2dxf`)

Desktop Settings (button or Cmd/Ctrl+,) persists overrides locally and uses them
for Open CAD File without changing shell environment variables. It also includes
Test Router / Check DWG helpers and shows /health info. When empty, it auto-fills
local CADGameFusion paths and detected `dwg2dxf`.

Example:
```bash
export VEMCAD_ROUTER_URL="http://127.0.0.1:9000"
export VEMCAD_ROUTER_PLUGIN="build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib"
export VEMCAD_ROUTER_CONVERT_CLI="build_vcpkg/tools/convert_cli"
```

CLI overrides:
- `--router-url`
- `--router-plugin`
- `--router-convert-cli`
- `--router-emit`
- `--router-auth-token`
- `--project-id`
- `--router-auto-start`
- `--router-start-cmd`
- `--dwg-convert-cmd`

DWG conversion uses the same command template syntax as the router:
- If `{input}`/`{output}` appear, they are replaced.
- Otherwise the input/output paths are appended to the command.

Example (LibreDWG via cadgf-dwg-service):
```bash
export VEMCAD_DWG_CONVERT_CMD="python3 /Users/huazhou/Downloads/Github/cadgf-dwg-service/cadgf_dwg_service.py convert"
```

Auto-detect (no explicit command) looks for `cadgf_dwg_service.py` in common paths, including:
- `../cadgf-dwg-service` relative to the repo root
- `~/Downloads/Github/cadgf-dwg-service`

If LibreDWG is installed, auto-detect also checks common `dwg2dxf` paths
and passes `--dwg2dxf` automatically.

Auto-start example (explicit command):
```bash
export VEMCAD_ROUTER_START_CMD="python3 tools/plm_router_service.py --default-plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib --default-convert-cli build_vcpkg/tools/convert_cli --port 9000"
```

## Package
```bash
npm run pack
```

## Build installers
```bash
npm run dist
```

Windows builds are generated in CI (GitHub Actions) via the Windows desktop workflow.
