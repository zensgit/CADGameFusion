# Step275: Desktop Resume And Batch Recovery Design

## Goal

Push packaged desktop closer to everyday CAD desktop behavior by closing the loop around "come back to what I was viewing" and "recover from a bad batch open without starting over."

Step275 adds:

- a packaged, renderer-visible `Resume Latest` action that survives relaunch;
- a darwin-only self-registration action for file associations through LaunchServices;
- batch recovery actions for `Retry Failed` and `Export Report`;
- a packaged smoke that proves all three behaviors in one end-to-end run.

## Problem

Step274 already covers:

- real packaged open through `Open CAD File`;
- startup arg, second-instance, and `open -a` handoff;
- multi-file drop with visible opened/ignored classification.

Three practical gaps still remain:

1. after relaunch, the latest recent CAD entry exists but the UI has no one-click "resume where I left off" action;
2. file-association metadata is packaged, but the app itself cannot help the user re-register macOS file-open services after moving or unpacking the bundle;
3. batch failure details are visible, but the user still has to rebuild the failed set manually and cannot export a focused recovery report.

## Contract

### 1. Resume Latest must reuse the same MRU truth

Step275 must not create a second persistence source.

`Resume Latest` should be derived from the existing recent-file list already shared by:

- the renderer recent sidebar;
- `File -> Open Recent CAD`;
- native handoff updates.

That keeps ordering, labels, and last-open timestamps consistent across all surfaces.

### 2. Resume must be available in both UI and menu

The desktop page needs an explicit `Resume Latest` button near the open controls.

The native menu also needs `File -> Resume Latest CAD`, enabled only when the MRU has at least one entry.

Both triggers must queue the same latest CAD path through the existing desktop open lane.

### 3. macOS file-association registration must stay main-process owned

Actual LaunchServices registration is an OS integration concern and should remain in the desktop main process.

Step275 therefore adds:

- a small helper to resolve the packaged `.app` bundle path from `process.execPath`;
- a small helper to resolve `/System/.../lsregister`;
- one IPC entrypoint that runs `lsregister -f <VemCAD.app>` on macOS and returns structured success/failure data.

The renderer only decides whether to show the action and how to surface the result text.

### 4. Batch recovery must remain renderer-local

Retry/export is state recovery, not a new conversion protocol.

The renderer already owns the batch queue state. Step275 keeps recovery local by deriving:

- retryable paths from `failed` and `canceled` batch items;
- export payloads from the current batch state, app info, status text, and recent-file state.

No new background worker or progress IPC is needed.

### 5. Retry must preserve batch semantics

Retrying a single failed file should still show a real batch result rather than silently collapsing back to a plain single-file open.

That means retry must be able to force the batch panel visible even when only one path is being replayed.

### 6. Export must produce a narrow, supportable contract

The existing settings diagnostics bundle is broad. Batch recovery needs a smaller, action-specific artifact.

Step275 exports one focused JSON document with schema:

- `vemcad.desktop.batch_report.v1`

The payload should include:

- packaged app facts;
- current main/settings status;
- the batch summary and items;
- current recent-file state.

### 7. Packaged smoke must prove recovery across relaunch

This step is complete only if packaged evidence proves:

1. the file-association registration action is visible and succeeds on macOS;
2. opening one DWG seeds recent state and enables both `Resume Latest` surfaces;
3. relaunch with the same profile keeps `Resume Latest` enabled;
4. clicking `Resume Latest` reopens the latest DWG;
5. a batch with one missing DWG plus one unsupported file reports `failed` and `ignored`;
6. `Retry Failed` succeeds after the missing DWG is restored;
7. `Export Report` writes a valid `vemcad.desktop.batch_report.v1` JSON file.

## Scope

- `tools/web_viewer/index.html`
- `tools/web_viewer/style.css`
- `tools/web_viewer/preview_app.js`
- `tools/web_viewer_desktop/preload.js`
- `tools/web_viewer_desktop/main.js`
- `tools/web_viewer_desktop/launch_services_registration.js`
- `tools/web_viewer_desktop/tests/launch_services_registration.test.js`
- `tools/web_viewer/scripts/desktop_packaged_resume_batch_recovery_smoke.js`
- `docs/STEP275_DESKTOP_RESUME_BATCH_RECOVERY_DESIGN.md`
- `docs/STEP275_DESKTOP_RESUME_BATCH_RECOVERY_VERIFICATION.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`

## Acceptance

Step275 is complete when:

- packaged desktop shows `Resume Latest` from the same MRU source used by the menu;
- packaged desktop can self-register macOS file-open services through the native bridge;
- failed batch items can be retried without rebuilding the selection manually;
- batch recovery can export a dedicated JSON report;
- Step274 native handoff smoke still passes;
- Step273 association + multi-drop smoke still passes;
- Step270 packaged settings smoke still passes;
- packaged Python DWG smoke still passes.
