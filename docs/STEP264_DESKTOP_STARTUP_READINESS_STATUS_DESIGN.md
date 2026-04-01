# Step264: Desktop Startup Readiness Status Design

## Goal

Surface desktop DWG/router readiness directly in the main status line on startup, so ordinary users do not need to guess whether they should click `Open CAD File` or fix Settings first.

## Problem

Before Step264:

- the authoritative readiness truth existed in Settings
- `Use Recommended` could repair stale overrides
- packaged and live settings smokes were green

But the main window still did not announce readiness on launch. Users had to know to open Settings first.

## Contract

### 1. Desktop startup status is explicit

When the desktop bridge is present and no explicit scene was requested, the main status line must summarize readiness immediately:

- ready case:
  - `Desktop ready via <route> from <runtime-source>. Open CAD File or Settings.`
- router setup case:
  - `Desktop needs router setup. Click Settings. ...`
- DWG setup case:
  - `Desktop needs DWG setup. Click Settings. ...`

### 2. Desktop integration does not auto-load the sample scene

When running in desktop mode, the default sample GLTF must not auto-load on startup. The first visible truth should be readiness, not a demo scene or a stray `Failed to fetch`.

### 3. Startup status is a formal formatter contract

Startup copy is centralized in `desktop_settings.js`, not hand-built inline in the renderer.

## Key Files

- `tools/web_viewer/desktop_settings.js`
- `tools/web_viewer/preview_app.js`
- `tools/web_viewer/tests/desktop_settings.test.js`
- `tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `tools/web_viewer_desktop/README.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`
- `docs/Tools.md`
- `docs/VEMCAD_QA_CHECKLIST.md`

## Acceptance

Step264 is complete when:

- startup status shows a readiness sentence in the main status bar
- desktop mode no longer auto-loads the sample scene by default
- live and packaged smokes both prove the startup status
- packaged smoke stays free of bootstrap console/page errors
