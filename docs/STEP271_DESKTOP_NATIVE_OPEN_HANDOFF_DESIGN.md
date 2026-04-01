# Step271: Desktop Native Open Handoff Design

## Goal

Make the packaged desktop app open CAD files correctly when the path comes from native desktop entry points instead of only the in-page `Open CAD File` button.

## Problem

Step270 proves the packaged renderer button can open a real DWG through the desktop bridge, but a desktop CAD app also needs to handle file-open requests from outside the renderer:

1. app startup with a CAD path argument;
2. opening a CAD file while the app is already running;
3. macOS `open-file` delivery from Finder or `open -a`.

Before Step271, those paths were not normalized into the same renderer-visible open flow, and startup-arg delivery could race the renderer listener registration.

## Contract

### 1. Main process owns external CAD open queueing

The desktop main process now treats external CAD open requests as first-class input.

- accepted sources:
  - startup command-line CAD paths;
  - Electron `second-instance` command lines;
  - Electron `open-file` events on macOS;
- supported file types remain `.dwg`, `.dxf`, `.json`, `.cad`;
- duplicate paths are de-duped before dispatch.

### 2. CLI parsing must ignore non-open payloads

Not every path-like CLI value is a CAD open request. The parser must skip known value-taking flags such as:

- `--manifest`
- `--router-url`
- `--smoke-dwg`
- `--smoke-open-file`
- `--user-data-dir`

This prevents setup/diagnostic arguments from being misinterpreted as files to open.

### 3. Renderer readiness is explicit

The main process must not flush pending CAD open requests on `did-finish-load` alone.

- renderer listeners for `vemcad:open-cad-request` are installed first;
- renderer then sends `vemcad:renderer-ready`;
- only after that acknowledgment does the main process flush queued external CAD opens.

This removes the startup race where the renderer page finished loading before the bridge listeners were ready.

### 4. External file open reuses the same viewer contract

External open requests must not create a special-case rendering path.

- renderer receives `vemcad:open-cad-request`;
- renderer calls the shared desktop open path bridge with the incoming absolute path;
- status text, manifest loading, settings auto-recovery, and route reporting stay identical to the in-page `Open CAD File` flow.

### 5. Running app should keep one visible window

When a second launch carries a CAD path:

- the first instance keeps ownership;
- the new instance exits cleanly;
- the already-running visible window receives the file-open request and focuses itself.

## Scope

- `tools/web_viewer_desktop/open_file_handoff.js`
- `tools/web_viewer_desktop/tests/open_file_handoff.test.js`
- `tools/web_viewer_desktop/preload.js`
- `tools/web_viewer_desktop/main.js`
- `tools/web_viewer/preview_app.js`
- `tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js`
- `docs/STEP271_DESKTOP_NATIVE_OPEN_HANDOFF_DESIGN.md`
- `docs/STEP271_DESKTOP_NATIVE_OPEN_HANDOFF_VERIFICATION.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`

## Acceptance

Step271 is complete when:

- startup-arg open reaches `Opened ... via direct-plugin.` in packaged desktop;
- second-instance open reaches the same success status in the original window and the child exits with code `0`;
- macOS `open-file` is wired into the same queueing path;
- Step270 packaged settings smoke still passes;
- packaged Python DWG smoke still passes;
- parsing and readiness behavior are covered by automated tests and smoke evidence.
