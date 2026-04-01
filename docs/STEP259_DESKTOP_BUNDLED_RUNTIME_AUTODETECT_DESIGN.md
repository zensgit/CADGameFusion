# Step259: Desktop Bundled Runtime Auto-Detect Design

## Goal

Move desktop DWG open one step closer to ordinary-user packaging by making the real runtime path consume detected/staged CAD resources directly, instead of relying on explicit smoke-only CLI overrides.

## Problem

Before Step259, desktop detection was asymmetric:

- the Settings UI could auto-fill detected plugin / convert_cli / DWG plugin paths
- but the actual desktop open path still mainly depended on explicit `routerPlugin`, `routerConvertCli`, and `dwgConvertCmd` inputs
- packaging had no first-class staging path for bundling those CAD resources with the desktop app

That meant the success path was proven, but the product still leaned too hard on external setup.

## Contract

### 1. Runtime router config now consumes detected paths

`resolveRouterConfig()` now falls back to detected router assets when explicit settings / CLI / env values are absent:

- DXF importer plugin
- `convert_cli`

This makes the real open path and auto-start path consume the same detected defaults already shown in Settings.

### 2. Desktop resource detection now includes bundled resources

The desktop main process now checks bundled resource roots before repository build roots:

- `tools/web_viewer_desktop/bundled_resources` in dev
- `process.resourcesPath/cad_resources` in packaged builds
- explicit `VEMCAD_DESKTOP_RESOURCE_ROOT` / `CADGF_DESKTOP_RESOURCE_ROOT`

Detected assets now include:

- router DXF importer plugin
- DWG importer plugin
- `convert_cli`
- bundled `cadgf-dwg-service`

### 3. Packaging gets a stable staging step

The desktop package now owns a first-class staging script:

- `npm run stage-cad-resources`

This script copies available local CAD resources into:

- `tools/web_viewer_desktop/bundled_resources/router/plugins`
- `tools/web_viewer_desktop/bundled_resources/router/tools`
- `tools/web_viewer_desktop/bundled_resources/dwg_service`

`pack` and `dist` now run this stage automatically before `electron-builder`, and `extraResources` ships the staged tree as `cad_resources`.

### 4. Real smoke must prove runtime auto-detect

The desktop DWG smoke now supports:

- `--use-runtime-autodetect`

When enabled, it omits explicit plugin / convert_cli / DWG convert overrides and relies on the desktop runtime to discover them.

Acceptance requires that the real Electron smoke still succeeds and that the resulting paths come from the staged bundled resource tree.

## Key Files

- `tools/web_viewer_desktop/main.js`
- `tools/web_viewer_desktop/package.json`
- `tools/web_viewer_desktop/.gitignore`
- `tools/web_viewer_desktop/scripts/stage_bundled_cad_resources.mjs`
- `tools/plm_dwg_open_desktop_smoke.py`
- `tools/web_viewer_desktop/README.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`
- `docs/Tools.md`
- `docs/VEMCAD_QA_CHECKLIST.md`

## Non-Goals

Step259 does not:

- guarantee CI installers already contain full CAD resources on every platform
- bundle LibreDWG `dwg2dxf` itself
- replace installer signing / release QA

## Acceptance

Step259 is complete when:

- desktop runtime open succeeds without explicit plugin / convert_cli / DWG convert CLI overrides
- the successful real smoke shows bundled resource paths in `prepared` / `convert`
- staging and packaging entrypoints exist in the desktop package
