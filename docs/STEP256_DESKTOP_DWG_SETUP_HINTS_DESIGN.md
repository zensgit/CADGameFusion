# Step256: Desktop DWG Setup Hints Design

## Goal

Turn desktop DWG route/setup failures into actionable product feedback instead of leaving the user with a raw error string.

## Problem

By Step255, the desktop path already proved:

- real DWG route selection
- live route/readiness display
- route propagation through desktop smoke

The remaining usability gap was failure handling:

- if DWG setup was missing, the user only saw an error string
- the app did not guide the user back to the relevant settings
- route/setup hints were not standardized across `Check DWG` and `Open CAD File`

That is exactly the kind of last-mile friction that prevents “internal works today” from feeling like “product works normally.”

## Contract

### 1. Main process returns actionable DWG hints

The desktop main process now normalizes DWG readiness facts through a shared readiness helper and adds a stable `hint` when the DWG path is not configured.

Protected fields for `DWG_NOT_READY`:

- `route`
- `direct_plugin_ready`
- `local_convert_ready`
- `dwg_plugin_path`
- `dwg_convert_cmd`
- `dwg2dxf_bin`
- `hint`

### 2. Open-file failures can carry route/setup hints too

`vemcad:open-cad-file` now returns the same actionable hint lane for:

- `DWG_NOT_READY`
- router configuration / availability failures that should send the user back to Settings

### 3. Renderer auto-opens Settings for setup failures

When `Open CAD File` fails because route/setup is missing, the live viewer automatically reopens the Settings modal and renders the structured failure text there.

This keeps the user on the shortest recovery path instead of forcing manual discovery.

### 4. Shared formatting shows `Hint: ...`

Both:

- `Check DWG`
- `Open CAD File` failure details

now render the same explicit `Hint: ...` line when available.

### 5. Browser smoke protects the recovery workflow

The live desktop settings smoke must now prove:

1. success path still works
2. blanking DWG plugin + convert command makes the route not ready
3. `Open CAD File` failure auto-opens Settings
4. the modal shows the setup hint
5. reset restores detected defaults after the failure scenario

## Key Files

- `tools/web_viewer_desktop/main.js`
- `tools/web_viewer/desktop_settings.js`
- `tools/web_viewer/preview_app.js`
- `tools/web_viewer/tests/desktop_settings.test.js`
- `tools/web_viewer/scripts/desktop_live_settings_smoke.js`

## Non-Goals

Step256 does not:

- change DWG geometry conversion/import output
- change route selection preference (`direct-plugin` still wins)
- replace packaging/install-time setup

## Acceptance

Step256 is complete when:

- `DWG_NOT_READY` includes an actionable hint
- opening CAD with missing DWG setup auto-surfaces Settings again
- automated smoke proves both the happy path and the recovery path
