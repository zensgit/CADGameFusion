# Step270: Desktop Packaged Open CAD UI Smoke Verification

## Scope

Verify that the packaged desktop app can recover startup settings, expose packaged `dwg2dxf` diagnostics, and successfully execute the real renderer `Open CAD File` flow against a sample DWG.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
node --check deps/cadgamefusion/tools/web_viewer_desktop/scripts/stage_bundled_cad_resources.mjs
python3 -m py_compile deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js --outdir /tmp/desktop-live-smoke-step270
cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/desktop-packaged-smoke-step270
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py \
  --use-packaged-app \
  --use-runtime-autodetect \
  --router-auto-start-mode default \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/step270_packaged_dwg_open_smoke
git -C deps/cadgamefusion diff --check
```

## Expected Results

### 1. Static and unit checks

Expected to pass:

- `node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `node --check deps/cadgamefusion/tools/web_viewer_desktop/scripts/stage_bundled_cad_resources.mjs`
- `python3 -m py_compile deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`

### 2. Live smoke regression

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js --outdir /tmp/desktop-live-smoke-step270`

Key fact:

- Step270 packaged changes do not regress the existing live desktop settings lane.

### 3. Packaged settings smoke

Expected to pass:

- `cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack`
- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js --input-dwg ...`

Key facts:

- packaged startup still auto-repairs stale persisted settings;
- packaged form defaults, diagnostics payload, and `Check DWG` status all expose the staged `dwg2dxf` path from `Resources/cad_resources/dwg_service/bin`;
- the smoke clicks the real renderer `Open CAD File` button and reaches `Opened ... via direct-plugin.`;
- saving a blank router URL reopens Settings automatically with `Hint: Set Router URL in Settings before opening CAD files.`;
- `Reset` restores the packaged router URL and staged `dwg2dxf` path and clears localStorage overrides.

### 4. Packaged Python DWG smoke

Expected to pass:

- `python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect ...`

Key facts:

- packaged desktop still opens the sample DWG successfully;
- the smoke validator `packaged_dwg2dxf_runtime` confirms runtime autodetect resolved `dwg2dxf_bin` from packaged `cad_resources/dwg_service/bin`.

### 5. Patch hygiene

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step270 is verified if packaged desktop UI smoke covers the true `Open CAD File` flow, packaged fallback DWG conversion is staged into the app resources, and both renderer-level and broader desktop smokes agree on the packaged `dwg2dxf` runtime.
