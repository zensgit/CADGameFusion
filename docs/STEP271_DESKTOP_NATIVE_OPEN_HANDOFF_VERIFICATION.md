# Step271: Desktop Native Open Handoff Verification

## Scope

Verify that packaged desktop can open a real DWG through native handoff paths, including startup arguments and second-instance forwarding, without regressing the Step270 packaged UI flow.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer_desktop/preload.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js
node --test deps/cadgamefusion/tools/web_viewer_desktop/tests/open_file_handoff.test.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/desktop-packaged-open-handoff-step271
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/desktop-packaged-smoke-step271-regress
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py \
  --use-packaged-app \
  --use-runtime-autodetect \
  --router-auto-start-mode default \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/step271_packaged_dwg_open_smoke
git -C deps/cadgamefusion diff --check
```

## Expected Results

### 1. Static and unit checks

Expected to pass:

- `node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`
- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer_desktop/preload.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js`
- `node --test deps/cadgamefusion/tools/web_viewer_desktop/tests/open_file_handoff.test.js`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`

Key facts:

- CLI CAD-path extraction ignores known flag values;
- renderer-ready handshake remains syntax-clean and test-covered.

### 2. Packaged native handoff smoke

Expected to pass:

- `cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack`
- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js --input-dwg ...`

Key facts:

- packaged desktop reaches initial ready status before any external open request;
- a second instance launched with the sample DWG exits with code `0`;
- the original visible window updates to `Opened ... via direct-plugin.`;
- a fresh launch with the same DWG as a startup argument also reaches `Opened ... via direct-plugin.`.

Evidence from this run:

- summary: `/tmp/desktop-packaged-open-handoff-step271/20260326_154217/summary.json`

### 3. Step270 packaged settings regression

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js --input-dwg ...`

Key facts:

- packaged startup auto-repair still works;
- packaged diagnostics still expose bundled `dwg2dxf`;
- the in-page `Open CAD File` flow still opens the sample DWG successfully.

Evidence from this run:

- summary: `/tmp/desktop-packaged-smoke-step271-regress/20260326_154229/summary.json`

### 4. Packaged DWG smoke regression

Expected to pass:

- `python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect ...`

Key facts:

- packaged desktop still opens the sample DWG successfully through the desktop smoke lane;
- route contract remains `direct-plugin`;
- packaged runtime still resolves `dwg2dxf_bin` from `Resources/cad_resources/dwg_service/bin`.

Evidence from this run:

- summary: `/private/tmp/step271_packaged_dwg_open_smoke/20260326_154236/summary.json`

### 5. Patch hygiene

Expected to pass:

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step271 is verified when packaged desktop can accept native CAD file-open handoff from both startup arguments and second-instance forwarding, while preserving the existing packaged Settings flow and packaged DWG open lane.
