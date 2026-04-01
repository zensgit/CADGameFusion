# Step264: Desktop Startup Readiness Status Verification

## Scope

Verify that the main desktop status line now exposes startup readiness and that desktop mode no longer auto-loads the sample scene.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer/desktop_settings.js
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack
cd /Users/huazhou/Downloads/Github/VemCAD
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static checks and formatter tests

Passed:

- `node --check deps/cadgamefusion/tools/web_viewer/desktop_settings.js`
- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`
  - `8/8 PASS`

Key contract proof:

- `formatDesktopStartupStatus` now has explicit ready/router-setup/DWG-setup coverage

### 2. Live desktop settings smoke

Passed:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_live_settings_smoke/20260326_093120/summary.json`

Key verified facts:

- initial main status is:
  - `Desktop ready via direct-plugin from packaged-cad-resources. Open CAD File or Settings.`
- desktop mode no longer shows the old sample-scene `Loaded successfully.` startup message
- existing `Use Recommended`, `Test Router`, `Check DWG`, and failure-recovery flows still pass

### 3. Packaged desktop settings smoke

Passed:

- `cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack`
- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_packaged_settings_smoke/20260326_093154/summary.json`

Key verified facts:

- initial packaged main status is:
  - `Desktop ready via direct-plugin from packaged-cad-resources. Open CAD File or Settings.`
- packaged Settings still shows combined runtime diagnostics
- packaged `Use Recommended` still restores defaults and clears storage
- packaged smoke is clean:
  - `console_messages = []`
  - `page_errors = []`

### 4. Patch hygiene

Passed:

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step264 is verified because startup readiness is now a visible product surface, and the desktop renderer no longer opens with a misleading sample-scene/default-fetch path.
