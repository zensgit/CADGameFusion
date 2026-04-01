# Step253: Desktop Live Settings Smoke Design

## Goal

Lock the new live desktop settings workflow behind an automated browser smoke, so Step252 stops depending on manual DevTools proof.

## Problem

Step252 moved the desktop controls onto the real live viewer entrypoint and proved them manually plus with the real desktop smoke.

That still left one gap:

- there was no dedicated automated regression that exercised the live settings modal itself

Without that, future changes could silently break:

- button visibility
- form population from defaults
- save/reset persistence
- `Test Router` structured status
- `Check DWG` structured status
- the actual use of saved overrides by `Open CAD File`

## Contract

### 1. Smoke runs against the real live viewer DOM

The smoke uses:

- `tools/web_viewer/index.html`
- `tools/web_viewer/preview_app.js`

This matters because the goal is to protect the actual Electron-facing page, not a helper-only mock UI.

### 2. Desktop backend is mocked, not the DOM

The smoke injects a mocked `window.vemcadDesktop` before page load.

That keeps the scope narrow:

- renderer/UI contract is real
- backend responses are deterministic
- no Electron packaging/runtime dependency is needed for this smoke lane

### 3. The smoke covers the user-visible workflow, not just one button

The protected workflow is:

1. buttons become visible when desktop bridge exists
2. settings modal opens
3. detected defaults populate the form
4. save persists overrides locally
5. `Open CAD File` reuses the saved overrides
6. `Test Router` surfaces structured router health text
7. `Check DWG` surfaces structured route/readiness text
8. reset restores defaults and clears persisted overrides
9. `onOpenSettings` can reopen the modal

### 4. Smoke summary is artifact-friendly

The script writes a standalone `summary.json` under:

- `build/desktop_live_settings_smoke/<run_id>/`

That makes it usable in the same artifact-first workflow as the rest of the browser smokes.

## Key Files

- `tools/web_viewer/scripts/desktop_live_settings_smoke.js`
  - new browser smoke
- `tools/web_viewer/desktop_settings.js`
  - reused settings/storage/formatting contract
- `tools/web_viewer/index.html`
  - live desktop controls
- `tools/web_viewer/preview_app.js`
  - live desktop settings wiring

## Non-Goals

Step253 does not:

- replace the real desktop main-process DWG smoke from Step250/252
- verify Electron packaging or preload correctness
- validate router/importer geometry output

## Acceptance

Step253 is complete when:

- a headless browser smoke passes against the live viewer DOM
- the smoke proves save/reset/test/open/menu-open behavior
- the smoke writes a standalone artifact summary
