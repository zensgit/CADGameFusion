# Step262: Desktop Packaged Settings Smoke Design

## Goal

Add a real packaged-Electron UI smoke for desktop Settings, so packaged runtime truth is verified in the same live modal ordinary users see.

## Problem

Before Step262:

- packaged DWG smoke proved the main-process open lane
- live settings smoke proved the renderer workflow, but only with a mocked bridge

That left one gap: no end-to-end automated proof that a real packaged `VemCAD.app` could open Settings and render:

- combined `[Router]` + `[DWG]` readiness
- packaged runtime provenance
- packaged router/DWG defaults in the form itself

## Contract

### 1. Packaged app smoke must drive the real Settings modal

The smoke launches the packaged Electron app and verifies the actual visible renderer, not a mock browser shell.

### 2. Packaged Settings must expose packaged runtime truth

The modal must show:

- `CAD runtime source: packaged-cad-resources`
- `CAD runtime ready: yes`
- packaged `Router service`
- packaged `Preview pipeline`
- packaged `Viewer root`
- `Route: direct-plugin`

### 3. Packaged defaults must be repairable from the UI

The same smoke also proves that `Use Recommended` restores the form to authoritative packaged defaults and clears stale local overrides.

## Key Files

- `tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `tools/web_viewer/preview_app.js`
- `tools/web_viewer/index.html`
- `tools/web_viewer_desktop/README.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`
- `docs/Tools.md`
- `docs/VEMCAD_QA_CHECKLIST.md`

## Acceptance

Step262 is complete when:

- the packaged app can be launched by smoke without mock bridge injection
- the real Settings modal shows packaged runtime diagnostics
- `Test Router` and `Check DWG` both keep those packaged facts visible
- `Use Recommended` restores authoritative packaged defaults and clears local storage
