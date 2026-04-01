# Step267: Desktop Diagnostics Export Verification

## Scope

Verify that desktop settings can export a structured diagnostics bundle in both live and packaged
renderers, and that the packaged real DWG open path remains green after the change.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer/desktop_settings.js
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
node --check deps/cadgamefusion/tools/web_viewer_desktop/preload.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack
cd /Users/huazhou/Downloads/Github/VemCAD
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect --router-auto-start-mode default --outdir deps/cadgamefusion/build/step267_packaged_dwg_open_smoke
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static checks and formatter tests

Passed:

- `node --check deps/cadgamefusion/tools/web_viewer/desktop_settings.js`
- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`
- `node --check deps/cadgamefusion/tools/web_viewer_desktop/preload.js`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`
  - `9/9 PASS`

### 2. Live desktop settings smoke

Passed:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_live_settings_smoke/20260326_100452/summary.json`

Key verified facts:

- `after_export_diagnostics.payload.schema = vemcad.desktop.diagnostics.v1`
- `after_export_diagnostics.payload.app.app_name = VemCAD`
- `after_export_diagnostics.payload.settings.effective.routerUrl = http://127.0.0.1:9000`
- `after_export_diagnostics.payload.results.dwg_result.route = direct-plugin`
- `after_export_diagnostics.payload.runtime_assets.source = vendor/three@0.160.0`
- `three_cdn_requests = []`
- `font_cdn_requests = []`

### 3. Packaged desktop settings smoke

Passed:

- `cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack`
- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_packaged_settings_smoke/20260326_100521/summary.json`

Key verified facts:

- `after_export_diagnostics.payload.schema = vemcad.desktop.diagnostics.v1`
- `after_export_diagnostics.payload.app.is_packaged = true`
- `after_export_diagnostics.payload.app.app_version = 0.1.0`
- `after_export_diagnostics.payload.results.dwg_result.route = direct-plugin`
- `after_export_diagnostics.payload.runtime_assets.source = vendor/three@0.160.0`
- packaged renderer stays clean:
  - `three_cdn_requests = []`
  - `font_cdn_requests = []`
  - `console_messages = []`
  - `page_errors = []`

### 4. Packaged real DWG open

Passed:

- `python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect --router-auto-start-mode default --outdir deps/cadgamefusion/build/step267_packaged_dwg_open_smoke`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step267_packaged_dwg_open_smoke/20260326_100702/summary.json`

Key verified facts:

- `ok = true`
- `desktop_summary.prepared.route = direct-plugin`
- `desktop_summary.convert.route = direct-plugin`
- `desktop_summary.convert.cad_runtime_source = packaged-cad-resources`
- `desktop_summary.viewer.status_code = 200`

### 5. Patch hygiene

Passed:

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step267 is verified because both live and packaged desktop settings can now export one structured
support snapshot with app/runtime/settings/readiness facts, and the real packaged DWG open lane
remains green after the change.
