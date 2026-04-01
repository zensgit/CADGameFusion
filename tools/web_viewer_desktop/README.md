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
- `VEMCAD_DWG_PLUGIN` (optional direct DWG importer plugin path; when present, `.dwg` opens prefer router-side direct import before local conversion)

Desktop Settings (button or Cmd/Ctrl+,) persists overrides locally and uses them
for Open CAD File without changing shell environment variables. It also includes
Test Router / Check DWG helpers and shows /health info. When empty, it auto-fills
local CADGameFusion paths, detected `dwg2dxf`, and detected DWG importer plugin. `Check DWG`
now reports whether the desktop is ready via `direct-plugin` or `local-convert`, instead of only
reporting converter presence. As of Step254, opening the live settings modal also auto-refreshes
the current DWG route/readiness, and a successful `Open CAD File` status line explicitly reports
which route was used. As of Step256, route/setup failures also reopen Settings automatically and
show a concrete `Hint: ...` line for the next recovery step.
As of Step257, Settings also exposes a first-class `DWG Route Mode` (`auto`, `direct-plugin`,
`local-convert`) so QA/support can force a route instead of relying on the default preference.
As of Step258, router failures use that same structured recovery surface, so `Open CAD File` and
`Test Router` now expose `Router URL / auto start / start cmd / router plugin / convert_cli`
alongside a concrete router-specific `Hint: ...`, instead of a bare router error.
As of Step259, the real desktop open path also consumes runtime-detected router assets directly,
instead of depending on smoke-only explicit plugin/convert_cli injection. The desktop package now
has `npm run stage-cad-resources`, which stages local plugins / convert_cli / `cadgf-dwg-service`
 into `tools/web_viewer_desktop/bundled_resources`, and `pack` / `dist` include that staged tree
 as packaged `cad_resources`.
As of Step260, packaged builds prefer `Resources/cad_resources` over `app.asar/bundled_resources`,
and the staged runtime also includes the minimum router-owned Python/viewer payload:
`router/plm_router_service.py`, `tools/plm_convert.py`, `tools/web_viewer/**`, and
`schemas/*.json`. That makes a real packaged `VemCAD.app` capable of default local router
auto-start and real `.dwg` open without smoke-only explicit path injection.
As of Step261, opening Settings now auto-runs combined router + DWG readiness and explicitly shows
the runtime provenance in the live UI:
- `CAD runtime source`
- `CAD runtime root`
- `CAD runtime ready`
- bundled `Router service`
- bundled `Preview pipeline`
- bundled `Viewer root`
As of Step263, the same modal also exposes `Use Recommended`, which clears stale local overrides
and reapplies the current detected runtime defaults instead of freezing a new local snapshot.
As of Step264, the main desktop status line also reports startup readiness directly, for example
`Desktop ready via direct-plugin from packaged-cad-resources. Open CAD File or Settings.` That
same step also stops desktop mode from auto-loading the sample GLTF on startup.
As of Step265, the live viewer no longer fetches core Three.js modules from `unpkg`; desktop live
and packaged runtimes now load `tools/web_viewer/vendor/three/**`, and both settings smokes assert
`three_cdn_requests=[]` plus local `runtime_assets`.
As of Step266, the same viewer entrypoint also loads `Space Grotesk` and `IBM Plex Mono` from
`tools/web_viewer/vendor/fonts/**`, so live and packaged desktop no longer depend on
`fonts.googleapis.com` or `fonts.gstatic.com` for first paint. Both settings smokes now also assert
`font_cdn_requests=[]`.
As of Step267, the same modal also exposes `Export Diagnostics`, which downloads a structured
`vemcad.desktop.diagnostics.v1` support bundle with app info, main/settings status text, defaults,
current/draft/effective settings, router result, DWG result, and runtime asset provenance. Both
live and packaged settings smokes now assert that exported payload too.
As of Step268, desktop mode no longer treats that as a renderer-only download: the modal now uses a
native desktop save path when the Electron bridge is available, reports the actual saved file path
in the status surface, and packaged smoke verifies that the JSON file is really written to disk.

As of Step252, those controls are rendered by the live viewer entrypoint
`tools/web_viewer/index.html` itself, so the desktop app no longer depends on a separate
unused shell page to expose `Open CAD File`, `Settings`, `Test Router`, and `Check DWG`.

That live renderer wiring is now protected by a browser smoke:

```bash
cd ..
node tools/web_viewer/scripts/desktop_live_settings_smoke.js
```

That smoke now also proves the Settings modal opens with combined `[Router]` + `[DWG]` readiness
and packaged-style runtime diagnostics, while the core viewer runtime stays on local vendored
`three` assets, and it exports a structured diagnostics bundle from the real renderer.

Real packaged-Electron Settings smoke:

```bash
cd ..
node tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
```

That smoke launches the real packaged app, verifies packaged runtime diagnostics in the live modal,
proves `Use Recommended` restores packaged defaults and clears local overrides, and asserts the
packaged renderer does not request `unpkg` for Three.js. It also proves `Export Diagnostics`
downloads a structured packaged support snapshot instead of a renderer-side guess, and now verifies
the snapshot is actually saved to disk through the native desktop save path.

Stage bundled CAD resources before packaging:

```bash
npm run stage-cad-resources
```

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
- `--dwg-route`
- `--dwg-plugin`

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

DWG open now uses one shared route-selection helper for both the real desktop button and
`--smoke-dwg`:
- preferred: direct router-side `.dwg` import via `VEMCAD_DWG_PLUGIN` or detected `libcadgf_dwg_importer_plugin`
- fallback: local `DWG -> DXF` conversion via `VEMCAD_DWG_CONVERT_CMD`

As of Step255, the real desktop smoke also proves that the final successful convert result keeps
the same `route / dwg_plugin_path / router_plugin` facts, instead of exposing them only in the
prepared open plan.

Auto-start example (explicit command):
```bash
export VEMCAD_ROUTER_START_CMD="python3 tools/plm_router_service.py --default-plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib --default-convert-cli build_vcpkg/tools/convert_cli --port 9000"
```

## CLI smoke for DWG open
The Electron main process also supports a smoke-only mode that reuses the real
desktop open path without showing the window:

```bash
npm run start -- \
  --smoke-dwg "/absolute/path/to/file.dwg" \
  --smoke-summary "/tmp/vemcad_dwg_desktop_summary.json" \
  --router-url "http://127.0.0.1:9060" \
  --router-plugin "/absolute/path/to/libcadgf_dxf_importer_plugin.dylib" \
  --router-convert-cli "/absolute/path/to/convert_cli" \
  --router-auto-start on
```

For a repo-level wrapper that also runs the existing validators, use:

```bash
cd ..
python3 tools/plm_dwg_open_desktop_smoke.py \
  --input-dwg "/absolute/path/to/file.dwg"
```

To prove the desktop can open `.dwg` without explicitly passing plugin / convert_cli / DWG
convert overrides to Electron, use:

```bash
cd ..
python3 tools/plm_dwg_open_desktop_smoke.py \
  --use-runtime-autodetect \
  --input-dwg "/absolute/path/to/file.dwg"
```

To prove the packaged app can do the same with default local router auto-start, use:

```bash
cd ..
python3 tools/plm_dwg_open_desktop_smoke.py \
  --use-packaged-app \
  --use-runtime-autodetect \
  --router-auto-start-mode default \
  --input-dwg "/absolute/path/to/file.dwg"
```

## Package
```bash
npm run pack
```

`pack` now stages CAD runtime resources and rebuilds a clean pack output before running
`electron-builder --dir`.

## Build installers
```bash
npm run dist
```

Windows builds are generated in CI (GitHub Actions) via the Windows desktop workflow.
