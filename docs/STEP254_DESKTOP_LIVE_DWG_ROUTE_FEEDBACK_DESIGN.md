# Step254: Desktop Live DWG Route Feedback Design

## Goal

Close the last product gap between DWG route readiness and the visible live desktop workflow.

After Step250-Step253, the backend and the live settings modal could already determine the real DWG route, but two UX gaps remained:

- opening the settings modal still started from a generic `Ready.` state until the user clicked `Check DWG`
- a successful `Open CAD File` status line did not tell the user which DWG route was actually used

Step254 makes the live desktop viewer surface those route facts by default.

## Problem

### 1. Route readiness was available but not shown early enough

The desktop bridge already exposed `testDwg()`, and the live modal already had a `Check DWG` button.

That still left a usability gap:

- the user opened Settings
- saw a neutral status panel
- had to know to click `Check DWG`

For a product that now has multiple DWG routes (`direct-plugin` vs `local-convert`), that is unnecessary friction.

### 2. Open success was under-specified

The desktop main process already resolved a DWG open plan before conversion, but `open-cad-file` success responses did not carry the selected route back to the renderer.

That meant the live viewer could say:

- `Opened sample_part.`

but not:

- `Opened sample_part via direct-plugin.`

## Contract

### 1. Opening the settings modal auto-refreshes DWG readiness

`openDesktopSettingsModal()` now immediately runs the same route-aware DWG readiness check that backs the `Check DWG` button.

This keeps the modal truthful on first open and after reopening with saved overrides.

### 2. Manual `Check DWG` reuses the same logic

The button and modal-open path now share a single renderer helper instead of maintaining two independent flows.

That avoids drift between:

- auto status on modal open
- explicit status after clicking `Check DWG`

### 3. Successful desktop open returns route facts

`vemcad:open-cad-file` now merges the prepared DWG route data into the successful router result:

- `route`
- `dwg_plugin_path`
- `router_plugin`

This preserves the router/importer behavior while making the route visible to the renderer.

### 4. The live viewer status becomes route-aware

On successful desktop open, the live renderer now reports:

- `Opened <document_label> via <route>.`

This is deliberately short and user-facing, while the settings modal can still show the fuller structured status.

## Key Files

- `tools/web_viewer_desktop/main.js`
  - merge prepared DWG route facts into successful `open-cad-file` results
- `tools/web_viewer/preview_app.js`
  - auto-refresh DWG status when settings opens
  - reuse the same helper for manual `Check DWG`
  - show route-aware open success text
- `tools/web_viewer/desktop_settings.js`
  - format success results with route/plugin facts
- `tools/web_viewer/scripts/desktop_live_settings_smoke.js`
  - protect modal-open auto status and route-aware open text

## Non-Goals

Step254 does not:

- change router/importer geometry behavior
- change route selection policy
- replace the real desktop DWG smoke or the 44-case matrix
- add packaging/installer behavior

## Acceptance

Step254 is complete when:

- opening the live settings modal immediately shows structured DWG route/readiness
- reopening the modal after saving overrides reflects those overrides without extra clicks
- successful `Open CAD File` status text includes the actual route
- the automated live desktop settings smoke proves both behaviors
