# Step265: Desktop Local Three Runtime Verification

## Scope

Verify that the desktop viewer runtime no longer depends on `unpkg` for Three.js and that the
real packaged DWG open path still works after repacking.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack
cd /Users/huazhou/Downloads/Github/VemCAD
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect --router-auto-start-mode default --outdir deps/cadgamefusion/build/step265_packaged_dwg_open_smoke
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static checks and existing formatter tests

Passed:

- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`
  - `8/8 PASS`

### 2. Live desktop settings smoke

Passed:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_live_settings_smoke/20260326_094501/summary.json`

Key verified facts:

- `initial.runtimeAssets.source = vendor/three@0.160.0`
- `initial.runtimeAssets.threeModuleUrl` resolves to `/tools/web_viewer/vendor/three/build/three.module.js`
- `three_cdn_requests = []`
- existing startup readiness, settings repair, and route-aware open flows remain green

### 3. Packaged desktop settings smoke

Passed:

- `cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack`
- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_packaged_settings_smoke/20260326_094529/summary.json`

Key verified facts:

- `initial.runtime_assets.source = vendor/three@0.160.0`
- packaged `threeModuleUrl` resolves to:
  - `file:///.../Contents/Resources/web_viewer/vendor/three/build/three.module.js`
- `three_cdn_requests = []`
- packaged renderer stays clean:
  - `console_messages = []`
  - `page_errors = []`

### 4. Packaged real DWG open

Passed:

- `python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect --router-auto-start-mode default --outdir deps/cadgamefusion/build/step265_packaged_dwg_open_smoke`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step265_packaged_dwg_open_smoke/20260326_094604/summary.json`

Key verified facts:

- `ok = true`
- `desktop_summary.convert.route = direct-plugin`
- `desktop_summary.viewer.status_code = 200`
- packaged runtime still uses bundled `cad_resources` plugin / router / viewer paths

### 5. Patch hygiene

Passed:

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step265 is verified because the live and packaged desktop renderers now load Three.js from local
vendored files, both settings smokes prove there are no `unpkg` Three.js requests, and the real
packaged DWG open path remains green after repacking.
