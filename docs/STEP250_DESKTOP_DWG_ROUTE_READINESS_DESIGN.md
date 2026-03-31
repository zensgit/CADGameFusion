# Step250: Desktop DWG Route Readiness Design

## Goal

Turn desktop DWG open from a partially wired engineering path into a more product-usable path by unifying route selection and making readiness explicit.

This step does not add new DWG geometry capability. It fixes the product boundary around opening `.dwg`:

- the real desktop button and `--smoke-dwg` use the same route-selection logic
- explicit desktop settings for `dwgPluginPath` are honored
- `Check DWG` reports the actual preferred route instead of only checking whether a converter exists

## Problem

Before this step, desktop DWG open had two mismatches:

### 1. Settings could not truly force direct DWG import

`Open CAD File` preferred a direct `.dwg` route only when `detectRouterPaths()` found a DWG plugin automatically.

That meant:

- a user could have a valid `dwgPluginPath` in Desktop Settings
- `buildDefaultSettings()` could expose that path
- but the actual open path still ignored it and only trusted auto-detection

This is a product bug, not an importer limitation.

### 2. Smoke mode did not match the preferred product route

`--smoke-dwg` went straight through `maybeConvertDwg(...)`, so it mainly verified the fallback path even when a direct DWG plugin was present.

That left a gap between:

- the preferred desktop business path
- the automated desktop smoke

### 3. `Check DWG` under-reported readiness

The old readiness handler only answered:

- is a converter configured?

It did not answer the questions a user actually needs:

- can this machine open `.dwg` right now?
- will it use direct plugin import or local conversion?
- is there a fallback path?

## Contract

### 1. Shared DWG route selection

Desktop DWG open now resolves through a single helper:

- non-`.dwg` files: passthrough
- `.dwg` with a configured or detected DWG plugin: `direct-plugin`
- otherwise: `local-convert`

This route selection is reused by:

- `vemcad:open-cad-file`
- `main.js --smoke-dwg`

### 2. Explicit settings win

The direct DWG route now respects explicit desktop configuration first:

- `dwgPluginPath` from Desktop Settings
- `--dwg-plugin`
- `VEMCAD_DWG_PLUGIN` / `CADGF_DWG_PLUGIN`
- then auto-detected `libcadgf_dwg_importer_plugin`

This makes the desktop product path consistent with user intent.

### 3. Readiness is route-based

`vemcad:test-dwg` now reports:

- `route`
- `direct_plugin_ready`
- `local_convert_ready`
- `dwg_plugin_path`
- `dwg_convert_cmd`
- `dwg2dxf_bin`

So `Check DWG` can describe the real open path instead of only converter presence.

### 4. Smoke verifies the real preferred route

Desktop smoke summaries now record:

- `prepared.route`
- `prepared.router_plugin`
- `prepared.dwg_plugin_path`

This makes it possible to distinguish:

- `direct-plugin` success
- `local-convert` fallback success

instead of only knowing that the desktop smoke passed somehow.

## Key Files

- `tools/web_viewer_desktop/main.js`
  - adds `resolveDwgPluginPath(...)`
  - adds `resolveDwgOpenPlan(...)`
  - reuses the shared plan in both desktop open and smoke mode
  - upgrades `vemcad:test-dwg`

- `tools/web_viewer_desktop/README.md`
  - documents `VEMCAD_DWG_PLUGIN`
  - documents `--dwg-plugin`
  - documents direct-plugin vs local-convert readiness

## Non-Goals

Step250 does not:

- add DWG-native editing
- remove the external converter dependency from the fallback path
- change router-side artifact schemas
- guarantee that every deployment has a DWG plugin available

## Acceptance

Step250 is complete when:

- desktop `.dwg` open and `--smoke-dwg` share one route-selection helper
- explicit `dwgPluginPath` can drive the preferred direct route
- `Check DWG` reports route/readiness facts
- desktop smoke records whether the run used `direct-plugin` or `local-convert`
