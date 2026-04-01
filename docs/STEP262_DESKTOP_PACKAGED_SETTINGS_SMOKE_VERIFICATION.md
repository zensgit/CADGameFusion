# Step262: Desktop Packaged Settings Smoke Verification

## Scope

Verify that the real packaged desktop app renders live Settings correctly and that the packaged runtime/recommended-repair workflow is covered end to end.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack
cd /Users/huazhou/Downloads/Github/VemCAD
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static checks

Passed:

- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`

### 2. Packaged app rebuild

Passed:

- `cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack`

### 3. Real packaged Settings smoke

Passed:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_packaged_settings_smoke/20260326_091123/summary.json`

Key verified facts:

- packaged app binary launched successfully
- opening Settings showed combined `[Router]` + `[DWG]`
- live status showed:
  - `CAD runtime source: packaged-cad-resources`
  - `CAD runtime ready: yes`
  - packaged `Router service`
  - packaged `Preview pipeline`
  - packaged `Viewer root`
  - `Route: direct-plugin`
- form defaults were packaged values:
  - injected `Router URL`
  - packaged router start command
  - packaged DWG plugin path
  - `DWG Route Mode = auto`
- clicking `Use Recommended`:
  - restored packaged defaults
  - kept direct-plugin readiness visible
  - cleared `vemcad.desktop.settings.v1`
- `Test Router` and `Check DWG` both preserved packaged runtime facts
- packaged smoke stayed clean:
  - `console_messages = []`
  - `page_errors = []`

### 4. Patch hygiene

Passed:

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step262 is verified because the real packaged Electron UI now has automated proof for the same runtime truth and repair path that the backend packaged smoke had already proven.
