# Step252: Desktop Live Settings UI Design

## Goal

Turn desktop DWG/router readiness from a backend-only capability into a live renderer feature that users can actually operate.

This step wires the real Electron viewer entrypoint so that:

- `Open CAD File` is visible and usable
- `Settings` is visible and usable
- `Test Router` and `Check DWG` surface structured readiness facts in the live UI

## Problem

Before this step, the desktop backend contract was ahead of the renderer.

### 1. The live Electron page was not the same page that had the settings modal markup

The repo contained a settings modal in `html/index.html`, but Electron actually loads:

- `tools/web_viewer/index.html`

So the checked-in modal was effectively dead product surface.

### 2. Preload already exposed the right IPC, but the live renderer did not consume it

`tools/web_viewer_desktop/preload.js` already exposed:

- `getDefaultSettings()`
- `testRouter()`
- `testDwg()`
- `openCadFile()`
- `onOpenSettings()`

But the live renderer mostly only used desktop integration for `exportDxf`.

That meant the repo could already open DWG through the desktop business path, while the actual viewer UI still did not properly expose the controls a user needs to configure or inspect that path.

## Contract

### 1. Live renderer owns the desktop settings modal

The real viewer entrypoint now includes the desktop controls and settings modal in:

- `tools/web_viewer/index.html`

This replaces the previous dead-end situation where only the unused shell page carried the modal markup.

### 2. Settings are stored locally in the renderer

The renderer now:

- fetches detected defaults through `getDefaultSettings()`
- merges them with locally saved overrides
- persists saved overrides in local storage

This keeps the desktop product path configurable without requiring shell environment edits for every run.

### 3. `Check DWG` is structured, not just a one-line success/fail message

The live settings status panel now shows:

- route
- direct-plugin readiness
- local-convert readiness
- resolved DWG plugin path
- resolved converter command
- resolved `dwg2dxf`

This is important because Step250 already made the backend contract route-aware; Step252 makes that contract visible to the user.

### 4. The live UI exposes the real preferred direct-DWG setting

The live modal now includes `DWG Plugin Path`.

That matters because Step250 made `dwgPluginPath` authoritative for the preferred direct route.
Without this field in the live renderer, the new backend contract was still only partially usable.

## Key Files

- `tools/web_viewer/index.html`
  - live desktop controls and settings modal markup
- `tools/web_viewer/style.css`
  - modal/button styling for the live renderer
- `tools/web_viewer/preview_app.js`
  - renderer wiring for defaults, save/reset, open, router test, DWG test
- `tools/web_viewer/desktop_settings.js`
  - pure helper contract for fields, persistence normalization, and status formatting

## Non-Goals

Step252 does not:

- change router/importer geometry behavior
- add out-of-process settings sync beyond renderer-local persistence
- replace the Step250 desktop smoke
- add a dedicated repo-side automated UI smoke for the settings modal

## Acceptance

Step252 is complete when:

- the live Electron viewer shows `Open CAD File` and `Settings`
- the settings modal is available from the button and menu event
- `Test Router` and `Check DWG` surface structured readiness facts
- the live viewer still passes the real desktop DWG smoke
