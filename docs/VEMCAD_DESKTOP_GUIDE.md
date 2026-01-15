# VemCAD Desktop Guide

VemCAD Desktop is a thin wrapper around the Web Viewer. It relies on the
local router to convert CAD files into preview artifacts (document.json + glTF).
Release notes: `docs/VEMCAD_RELEASE_NOTES_v0.1.0.md`.
QA checklist: `docs/VEMCAD_QA_CHECKLIST.md`.

## Quickstart
1) Start the router (default port 9000):

```bash
python3 tools/plm_router_service.py \
  --default-plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
  --default-convert-cli build_vcpkg/tools/convert_cli
```

2) Launch VemCAD (macOS example):

```bash
open /Applications/VemCAD.app
```

3) Open Settings (toolbar button or Cmd/Ctrl+,) and fill in:
- Router URL (e.g. `http://127.0.0.1:9000`)
- Plugin path (DXF importer)
- Convert CLI path
- Optional DWG convert command

4) Click **Test Router** and **Check DWG** to verify setup.

5) Use **Open CAD File** to upload a DWG/DXF and load the preview.

## DWG Setup
DWG requires an external converter. Two supported options:

Option A: LibreDWG `dwg2dxf`
- Install LibreDWG and ensure `dwg2dxf` is in PATH.
- Set one of:
  - `VEMCAD_DWG2DXF_BIN=/path/to/dwg2dxf`
  - `VEMCAD_DWG_CONVERT_CMD="/path/to/dwg2dxf {input} -o {output}"`

Option B: cadgf-dwg-service
- Use the Python wrapper:

```bash
export VEMCAD_DWG_CONVERT_CMD="python3 /path/to/cadgf_dwg_service.py convert"
```

When the command is empty, the desktop app auto-detects common locations.

## Router Tips
- Router URL default: `http://127.0.0.1:9000`
- You can run on a different port (example 7910):

```bash
python3 tools/plm_router_service.py \
  --port 7910 \
  --default-plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
  --default-convert-cli build_vcpkg/tools/convert_cli \
  --dwg-convert-cmd "/opt/homebrew/bin/dwg2dxf {input} -o {output}"
```

## Packaging
```bash
cd tools/web_viewer_desktop
npm run pack
```

Typical outputs:
- `tools/web_viewer_desktop/dist/VemCAD-<version>-arm64.dmg`
- `tools/web_viewer_desktop/dist/VemCAD-<version>-arm64-mac.zip`
- `tools/web_viewer_desktop/dist/mac-arm64/VemCAD.app`

## Windows Install (CI build)
Windows installers are produced via GitHub Actions (workflow: `Web Viewer Desktop (Windows)`).
Download the artifact and extract it locally:

1) Open the workflow run on GitHub and download the artifact zip.
2) Unzip it and run the installer or portable app from `dist/`.
3) If Windows SmartScreen blocks the app, click **More info** → **Run anyway**.

## Troubleshooting
- `DWG_CONVERT_NOT_CONFIGURED`: set `VEMCAD_DWG_CONVERT_CMD` or install `dwg2dxf`.
- `DWG_CONVERT_FAILED`: verify the converter command works in a terminal.
- `CONVERT_CLI_NOT_FOUND`: fix the `convert_cli` path or router defaults.
- `PLUGIN_NOT_FOUND`: confirm the DXF importer path is correct.
- `invalid UTF-8`: update to the latest build; if it still happens, share the
  DWG/DXF path for analysis.
- Router not ready: check `/health` and the router logs, then restart.

## Environment Overrides
Desktop supports these optional overrides:
- `VEMCAD_ROUTER_URL`
- `VEMCAD_ROUTER_PLUGIN`
- `VEMCAD_ROUTER_CONVERT_CLI`
- `VEMCAD_ROUTER_EMIT`
- `VEMCAD_ROUTER_AUTH_TOKEN`
- `VEMCAD_DWG_CONVERT_CMD`
- `VEMCAD_DWG2DXF_BIN`
- `VEMCAD_ROUTER_AUTO_START`
- `VEMCAD_ROUTER_START_CMD`
