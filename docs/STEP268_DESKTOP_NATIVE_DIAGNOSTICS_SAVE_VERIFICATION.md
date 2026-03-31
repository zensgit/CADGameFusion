# Step268: Desktop Native Diagnostics Save Verification

## Scope

Verify that desktop diagnostics export now uses native save behavior in desktop mode, that both
live and packaged smokes validate the saved-path contract, and that the packaged real DWG open path
remains green after the change.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
node --check deps/cadgamefusion/tools/web_viewer_desktop/preload.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack
cd /Users/huazhou/Downloads/Github/VemCAD
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect --router-auto-start-mode default --outdir deps/cadgamefusion/build/step268_packaged_dwg_open_smoke
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static checks and formatter tests

Passed:

- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`
- `node --check deps/cadgamefusion/tools/web_viewer_desktop/preload.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`
  - `9/9 PASS`

### 2. Live desktop settings smoke

Passed:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_live_settings_smoke/20260326_102445/summary.json`

Key verified facts:

- `after_export_diagnostics.exportResult.mode = mock-native`
- `after_export_diagnostics.exportResult.path = /tmp/vemcad/support/...json`
- `after_export_diagnostics.status` includes the saved path
- `after_export_diagnostics.saved.text` parses as `schema = vemcad.desktop.diagnostics.v1`
- `three_cdn_requests = []`
- `font_cdn_requests = []`

### 3. Packaged desktop settings smoke

Passed:

- `cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack`
- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_packaged_settings_smoke/20260326_102525/summary.json`

Key verified facts:

- `after_export_diagnostics.exportResult.mode = auto-dir`
- `after_export_diagnostics.exportResult.path` is inside:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_packaged_settings_smoke/20260326_102525/exported_diagnostics`
- exactly one diagnostics JSON file is written under that directory
- the saved file parses as:
  - `schema = vemcad.desktop.diagnostics.v1`
  - `app.is_packaged = true`
  - `results.dwg_result.route = direct-plugin`
- packaged renderer stays clean:
  - `three_cdn_requests = []`
  - `font_cdn_requests = []`
  - `console_messages = []`
  - `page_errors = []`

### 4. Packaged real DWG open

Passed:

- `python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect --router-auto-start-mode default --outdir deps/cadgamefusion/build/step268_packaged_dwg_open_smoke`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step268_packaged_dwg_open_smoke/20260326_102603/summary.json`

Key verified facts:

- `ok = true`
- `desktop_summary.prepared.route = direct-plugin`
- `desktop_summary.convert.route = direct-plugin`
- `desktop_summary.viewer.status_code = 200`
- packaged runtime still uses `packaged-cad-resources`

### 5. Patch hygiene

Passed:

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step268 is verified because desktop diagnostics export now uses a native save path in desktop mode,
live and packaged smokes both validate the actual save result, and the packaged real DWG open lane
remains green after the change.
