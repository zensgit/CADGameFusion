# Step260: Desktop Packaged Autostart Design

## Goal

Close the remaining ordinary-user gap for desktop DWG open by proving that a real packaged `VemCAD.app` can:

- use packaged CAD resources instead of repo-local paths
- auto-start the local router by default when the router URL is local
- convert and open a real `.dwg`
- load the packaged viewer successfully

without smoke-only explicit plugin / `convert_cli` / DWG convert command injection.

## Problem

Step259 proved runtime auto-detect in dev, but the packaged path still had three real gaps:

1. packaged resource detection could hit `app.asar/bundled_resources` before `Resources/cad_resources`
2. packaged readiness still suppressed auto-detected router start facts, so the UI could misreport `start_ready=false`
3. the packaged `cad_resources` tree did not yet contain the full minimum runtime set needed by the packaged router:
   - `tools/plm_convert.py`
   - `tools/web_viewer`
   - document / manifest schemas

That meant packaged runtime could partially work, but not complete the whole `router -> convert -> viewer` loop.

## Contract

### 1. Packaged builds must prefer real `cad_resources`

When `app.isPackaged`, bundled CAD resource detection now prefers:

- `process.resourcesPath/cad_resources`
- then `process.resourcesPath/bundled_resources`

and no longer prioritizes `__dirname/bundled_resources` inside `app.asar`.

This avoids packaged auto-start or conversion trying to execute tools from an asar path.

### 2. Packaged readiness must expose real auto-start facts

`resolveRouterReadiness()` now reports the effective auto-detected start command in packaged builds too.

That keeps:

- runtime behavior
- Settings readiness
- smoke evidence

on the same contract.

### 3. `cad_resources` must be self-contained for router-side preview

The staged packaged runtime now includes the minimum router-owned runtime set:

- `router/plm_router_service.py`
- `router/plugins/*`
- `router/tools/convert_cli`
- `dwg_service/cadgf_dwg_service.py`
- `tools/plm_convert.py`
- `tools/web_viewer/**`
- `schemas/document.schema.json`
- `schemas/plm_manifest.schema.json`

This allows the packaged router to:

- start locally
- run `plm_convert.py`
- emit/validate preview artifacts
- serve `/tools/web_viewer/index.html`

from the same packaged `cad_resources` root.

### 4. Packaged smoke is the acceptance gate

Step260 is only complete if a real packaged app passes:

- `--use-packaged-app`
- `--use-runtime-autodetect`
- `--router-auto-start-mode default`

and succeeds end-to-end on a real `.dwg`.

## Key Files

- `tools/web_viewer_desktop/main.js`
- `tools/web_viewer_desktop/scripts/stage_bundled_cad_resources.mjs`
- `tools/plm_dwg_open_desktop_smoke.py`
- `tools/web_viewer_desktop/README.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`
- `docs/Tools.md`
- `docs/VEMCAD_QA_CHECKLIST.md`

## Non-Goals

Step260 does not:

- bundle LibreDWG `dwg2dxf` itself
- solve installer signing / notarization
- replace release QA across all desktop platforms

## Acceptance

Step260 is complete when:

- packaged resource discovery resolves to `Resources/cad_resources`
- packaged router auto-start works with default local settings
- packaged conversion succeeds using packaged runtime tools
- the packaged viewer URL loads successfully
- the packaged smoke passes with validator checks green
