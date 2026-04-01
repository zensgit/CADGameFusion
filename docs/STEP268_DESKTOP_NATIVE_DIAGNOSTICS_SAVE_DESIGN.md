# Step268: Desktop Native Diagnostics Save Design

## Goal

Promote desktop diagnostics export from a browser-style download into a native desktop save path, so
packaged Electron users and support flows can rely on an actual file on disk instead of a renderer
download side effect.

## Problem

Before Step268:

- Step267 already exported a structured `vemcad.desktop.diagnostics.v1` payload
- live and packaged settings smokes already proved the payload contents
- the renderer still treated export like a browser download

That left a product gap for the packaged desktop:

- export did not explicitly use the desktop bridge
- support could not rely on a native saved path
- packaged smoke proved payload generation, but not actual on-disk support-bundle creation

## Contract

### 1. Desktop bridge exposes native diagnostics save

The Electron preload/main bridge must expose a first-class diagnostics-save action for desktop
mode.

### 2. Packaged desktop prefers native save over browser download

When `window.vemcadDesktop.saveDiagnostics(...)` is available, the renderer must use it instead of
the browser anchor-download fallback.

### 3. Export status surfaces the actual saved path

After a successful export, the settings status line must report the concrete saved path, not only
the generated file name.

### 4. Automation can force a deterministic save directory

Desktop main must support a narrow automation path via:

- `VEMCAD_DESKTOP_EXPORT_DIR`
- `CADGF_DESKTOP_EXPORT_DIR`

When present, diagnostics export writes directly into that directory instead of opening a save
dialog. This keeps the real packaged smoke deterministic without weakening the user-facing native
save contract.

### 5. Live and packaged settings smokes verify actual save behavior

- live smoke must verify the bridge receives and returns a native save result
- packaged smoke must verify a real diagnostics JSON file is written to disk and contains the
  expected schema/runtime facts

### 6. Packaged real DWG open remains green

The stronger packaged real DWG smoke must remain green after the native-save change.

## Key Files

- `tools/web_viewer/preview_app.js`
- `tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `tools/web_viewer_desktop/preload.js`
- `tools/web_viewer_desktop/main.js`
- `tools/web_viewer/README.md`
- `tools/web_viewer_desktop/README.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`
- `docs/Tools.md`
- `docs/VEMCAD_QA_CHECKLIST.md`

## Acceptance

Step268 is complete when:

- desktop export uses the native bridge when available
- export status reports the saved diagnostics path
- packaged settings smoke verifies an actual saved JSON file on disk
- packaged real DWG open remains green after the change
