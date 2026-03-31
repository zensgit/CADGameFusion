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

4) Open **Settings** and verify the status panel.
The modal now auto-runs the DWG readiness check on open, so you should immediately see which route will actually be used:
- `direct-plugin`: preferred, router-side direct `.dwg` import
- `local-convert`: fallback, local `DWG -> DXF` conversion first

If you need to force one route for QA or support, use **DWG Route Mode**:
- `Auto`
- `Direct Plugin`
- `Local Convert`

You can still click **Test Router** and **Check DWG** to re-run the checks manually.
If you hit stale local overrides after an upgrade or a failed experiment, click **Use Recommended**
to clear those overrides and repopulate the form from the current detected runtime defaults.
If support or QA needs a shareable snapshot, click **Export Diagnostics** to download one
structured `vemcad.desktop.diagnostics.v1` JSON bundle with app/runtime/settings/router/DWG facts.
As of Step268, desktop mode saves that bundle through the native bridge and reports the actual file
path in the modal, so packaged support collection no longer depends on a browser-style download.

The settings/open controls now come from the live desktop viewer page itself,
not a separate shell. That means the same visible viewer window is also where
you configure route/readiness and open CAD files.
As of Step264, you should also see startup readiness in the main status line before opening
Settings, for example `Desktop ready via direct-plugin from packaged-cad-resources. Open CAD File or Settings.`
As of Step265, the core viewer runtime is also self-contained: packaged and live desktop now load
Three.js from `tools/web_viewer/vendor/three`, not `unpkg`, and the settings smokes explicitly
assert `three_cdn_requests=[]`.
As of Step266, the desktop viewer typography is also self-contained: packaged and live desktop now
load `Space Grotesk` and `IBM Plex Mono` from `tools/web_viewer/vendor/fonts`, not
`fonts.googleapis.com` / `fonts.gstatic.com`, and the settings smokes explicitly assert
`font_cdn_requests=[]`.

5) Use **Open CAD File** to upload a DWG/DXF and load the preview.
On success, the viewer status line now reports the route that was actually used, for example:
- `Opened sample_part via direct-plugin.`
- `Opened sample_part via local-convert.`

If DWG setup is missing, the app now reopens **Settings** automatically and shows a `Hint: ...`
line telling you whether to fill `DWG Plugin Path`, `DWG Convert Command`, or router setup.
If router setup is missing, the same modal now shows structured router recovery details too:
- `Router URL`
- `Router auto start`
- `Router start ready / source / cmd`
- `Router plugin / convert CLI`
- router-specific `Hint: ...`

As of Step259, the real desktop open path also consumes staged/bundled CAD resources directly.
That means a packaged or pre-staged desktop build can discover:
- router DXF importer plugin
- router `convert_cli`
- DWG importer plugin
- bundled `cadgf-dwg-service`

without requiring those paths to be re-entered as explicit smoke-only CLI overrides.
As of Step260, the packaged runtime is self-contained enough for the full local desktop lane:
packaged builds now prefer `Resources/cad_resources`, auto-start the local router from bundled
`router/plm_router_service.py`, run bundled `tools/plm_convert.py`, and serve bundled
`tools/web_viewer/index.html` from the same packaged resource root.
As of Step270, packaged builds also stage `dwg2dxf` into
`Resources/cad_resources/dwg_service/bin` when it is available on the pack machine, and both
Settings diagnostics and packaged smoke now assert that staged fallback path explicitly.
As of Step271, packaged desktop also handles native CAD file-open handoff through the same visible
viewer window. That includes startup CLI paths, second launches while VemCAD is already running,
and macOS `open-file` delivery, with the same status/result contract as the in-page
`Open CAD File` button.
As of Step272, packaged desktop also supports direct CAD drag-drop onto the viewport and keeps a
shared recent-file list between the sidebar and `File -> Open Recent CAD`, so reopen behavior is
now available without re-browsing for the same DWG.
As of Step273, packaged desktop also declares viewer-oriented file associations for `.dwg`,
`.dxf`, and `.cad`, queues multi-file CAD drop through the same desktop open lane, and shows
extension + timestamp context in recent-file metadata. The packaged app intentionally does not
claim generic types such as `.json`.
As of Step274, packaged desktop also surfaces a visible batch queue for multi-file drop, classifies
ignored unsupported drop items instead of silently discarding them, and the packaged handoff smoke
now proves macOS `open -a VemCAD.app <file>` reaches the same visible viewer window.
As of Step275, packaged desktop also adds `Resume Latest` in both the viewer and `File` menu,
adds a native `Register macOS File Open` action that re-runs LaunchServices registration for the
current `.app` bundle, and lets you `Retry Failed` or `Export Report` from the batch panel after a
mixed or partially failed open.
As of Step276, packaged desktop no longer treats json-only DWG results as an empty successful load:
if a manifest has `document.json` but no `mesh_gltf`, the viewer now synthesizes fallback line
preview geometry, shows `document fallback preview` in the status bar, and exposes that preview mode
through packaged smoke diagnostics.
As of Step277, packaged desktop also isolates its bundled router from older local dev/legacy routers:
packaged builds now default to `http://127.0.0.1:19100`, while live/dev flows keep `http://127.0.0.1:9000`.
That prevents a stale router already bound on `9000` from hijacking packaged `.dwg` open and returning
errors such as `DWG_CONVERT_NOT_CONFIGURED`. Unless you explicitly override it, packaged Settings should
now show `Router URL: http://127.0.0.1:19100`.
As of Step278, packaged `document fallback preview` also opens in a CAD-oriented viewport treatment:
the viewport switches to a high-contrast dark presentation, disables rotate-first interaction in favor of
pan/zoom, and the initial fit now biases model content over sparse paper/layout frame noise so real DWG
fallback opens are more legible on first load.
As of Step261, the Settings modal also opens with the real combined router + DWG truth, and
explicitly shows which CAD runtime is active:
- `CAD runtime source`
- `CAD runtime root`
- `CAD runtime ready`
- `Router service`
- `Preview pipeline`
- `Viewer root`

Current readiness evidence:
- desktop direct-route proof: `docs/STEP250_DESKTOP_DWG_ROUTE_READINESS_VERIFICATION.md`
- 44-case DWG matrix proof: `docs/STEP251_DWG_OPEN_MATRIX_READINESS_VERIFICATION.md`
- live settings UI smoke: `docs/STEP253_DESKTOP_LIVE_SETTINGS_SMOKE_VERIFICATION.md`
- live route-feedback smoke: `docs/STEP254_DESKTOP_LIVE_DWG_ROUTE_FEEDBACK_VERIFICATION.md`
- smoke route-propagation proof: `docs/STEP255_DESKTOP_DWG_SMOKE_ROUTE_PROPAGATION_VERIFICATION.md`
- live setup-hint recovery smoke: `docs/STEP256_DESKTOP_DWG_SETUP_HINTS_VERIFICATION.md`
- explicit route-mode proof: `docs/STEP257_DESKTOP_DWG_ROUTE_MODE_CONTROL_VERIFICATION.md`
- router recovery diagnostics proof: `docs/STEP258_DESKTOP_ROUTER_RECOVERY_DIAGNOSTICS_VERIFICATION.md`
- bundled runtime auto-detect proof: `docs/STEP259_DESKTOP_BUNDLED_RUNTIME_AUTODETECT_VERIFICATION.md`
- document fallback preview proof: `docs/STEP276_DOCUMENT_FALLBACK_PREVIEW_VERIFICATION.md`
- packaged autostart + packaged DWG open proof: `docs/STEP260_DESKTOP_PACKAGED_AUTOSTART_VERIFICATION.md`
- runtime diagnostics + combined readiness proof: `docs/STEP261_DESKTOP_RUNTIME_DIAGNOSTICS_VERIFICATION.md`
- real packaged settings smoke proof: `docs/STEP262_DESKTOP_PACKAGED_SETTINGS_SMOKE_VERIFICATION.md`
- recommended-setup repair proof: `docs/STEP263_DESKTOP_RECOMMENDED_SETUP_REPAIR_VERIFICATION.md`
- startup readiness status proof: `docs/STEP264_DESKTOP_STARTUP_READINESS_STATUS_VERIFICATION.md`
- local Three.js runtime proof: `docs/STEP265_DESKTOP_LOCAL_THREE_RUNTIME_VERIFICATION.md`
- local font runtime proof: `docs/STEP266_DESKTOP_LOCAL_FONT_RUNTIME_VERIFICATION.md`
- diagnostics export proof: `docs/STEP267_DESKTOP_DIAGNOSTICS_EXPORT_VERIFICATION.md`
- native diagnostics save proof: `docs/STEP268_DESKTOP_NATIVE_DIAGNOSTICS_SAVE_VERIFICATION.md`
- startup auto-repair proof: `docs/STEP269_DESKTOP_STARTUP_AUTO_REPAIR_VERIFICATION.md`
- packaged Open CAD UI smoke proof: `docs/STEP270_DESKTOP_PACKAGED_OPEN_CAD_UI_SMOKE_VERIFICATION.md`
- native open handoff proof: `docs/STEP271_DESKTOP_NATIVE_OPEN_HANDOFF_VERIFICATION.md`
- drop + recent flow proof: `docs/STEP272_DESKTOP_DROP_RECENT_FLOW_VERIFICATION.md`
- file association + multi-drop proof: `docs/STEP273_DESKTOP_FILE_ASSOC_MULTI_DROP_VERIFICATION.md`
- LaunchServices + batch queue proof: `docs/STEP274_DESKTOP_LAUNCHSERVICES_BATCH_QUEUE_VERIFICATION.md`
- resume latest + batch recovery proof: `docs/STEP275_DESKTOP_RESUME_BATCH_RECOVERY_VERIFICATION.md`
- packaged router-port isolation proof: `docs/STEP277_DESKTOP_PACKAGED_ROUTER_PORT_ISOLATION_VERIFICATION.md`
- fallback viewport fit proof: `docs/STEP278_DOCUMENT_FALLBACK_VIEW_FIT_VERIFICATION.md`

## DWG Setup
DWG requires an external converter. Two supported options:

Preferred option: direct DWG plugin
- Set `VEMCAD_DWG_PLUGIN=/absolute/path/to/libcadgf_dwg_importer_plugin.dylib`
- or rely on auto-detected `libcadgf_dwg_importer_plugin`
- when present, desktop `.dwg` open prefers direct router-side import and keeps the original `.dwg` on the open path

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
If both the DWG plugin and a converter are available, the desktop stays on `direct-plugin`
and keeps local conversion as fallback readiness only.

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

`npm run pack` now stages bundled CAD resources first and rebuilds a clean pack output before
running `electron-builder --dir`.
When `dwg2dxf` is available on the pack machine, the staging step also copies it into
`cad_resources/dwg_service/bin` so packaged fallback DWG conversion does not depend on a separate
post-install host path tweak.

Packaged DWG smoke:

```bash
cd /Users/huazhou/Downloads/Github/VemCAD
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py \
  --use-packaged-app \
  --use-runtime-autodetect \
  --router-auto-start-mode default \
  --outdir deps/cadgamefusion/build/step260_packaged_dwg_open_smoke
```

Packaged native open handoff smoke:

```bash
cd /Users/huazhou/Downloads/Github/VemCAD
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir deps/cadgamefusion/build/step271_packaged_open_handoff_smoke
```

Packaged drop + recent smoke:

```bash
cd /Users/huazhou/Downloads/Github/VemCAD
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_drop_recent_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --input-dwg-alt "/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg" \
  --outdir deps/cadgamefusion/build/step272_packaged_drop_recent_smoke
```

Typical outputs:
- `tools/web_viewer_desktop/dist/VemCAD-<version>-arm64.dmg`
- `tools/web_viewer_desktop/dist/VemCAD-<version>-arm64-mac.zip`
- `tools/web_viewer_desktop/dist/mac-arm64/VemCAD.app`

Recent packaged preview milestones:
- Step278: fallback preview switched into a CAD-style dark viewport with pan-first interaction and improved first-frame fit.
- Step279: fallback preview now computes a density-cluster `focusRegion` and clamps text-driven re-expansion; this improves framing determinism but still leaves a residual enclosing rectangle on the current sample DWG.

## Windows Install (CI build)
Windows installers are produced via GitHub Actions (workflow: `Web Viewer Desktop (Windows)`).
Download the artifact and extract it locally:

1) Open the workflow run on GitHub and download the artifact zip.
2) Unzip it and run the installer or portable app from `dist/`.
3) If Windows SmartScreen blocks the app, click **More info** → **Run anyway**.

## Troubleshooting
- `DWG_CONVERT_NOT_CONFIGURED`: set `VEMCAD_DWG_CONVERT_CMD` or install `dwg2dxf`.
- `DWG_NOT_READY`: neither a direct DWG plugin nor a local DWG converter path is ready.
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
