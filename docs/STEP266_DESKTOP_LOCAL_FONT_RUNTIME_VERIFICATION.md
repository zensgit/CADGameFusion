# Step266: Desktop Local Font Runtime Verification

## Scope

Verify that the desktop viewer no longer requests Google Fonts and that the packaged DWG open path
remains green after repacking.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack
cd /Users/huazhou/Downloads/Github/VemCAD
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect --router-auto-start-mode default --outdir deps/cadgamefusion/build/step266_packaged_dwg_open_smoke
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static checks and existing formatter tests

Passed:

- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`
  - `8/8 PASS`

Note:

- `style.css` is not a JavaScript module, so `node --check` is not applicable to it

### 2. Live desktop settings smoke

Passed:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_live_settings_smoke/20260326_095227/summary.json`

Key verified facts:

- `three_cdn_requests = []`
- `font_cdn_requests = []`
- startup readiness, settings repair, and route-aware open flows remain green

### 3. Packaged desktop settings smoke

Passed:

- `cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack`
- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_packaged_settings_smoke/20260326_095248/summary.json`

Key verified facts:

- `three_cdn_requests = []`
- `font_cdn_requests = []`
- packaged renderer stays clean:
  - `console_messages = []`
  - `page_errors = []`

### 4. Packaged real DWG open

Passed:

- `python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect --router-auto-start-mode default --outdir deps/cadgamefusion/build/step266_packaged_dwg_open_smoke`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step266_packaged_dwg_open_smoke/20260326_095300/summary.json`

Key verified facts:

- `ok = true`
- `desktop_summary.convert.route = direct-plugin`
- `desktop_summary.viewer.status_code = 200`
- packaged runtime still uses bundled `cad_resources`

### 5. Patch hygiene

Passed:

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step266 is verified because live and packaged desktop no longer request Google Fonts for first
paint, and the real packaged DWG open lane remains green after repacking.
