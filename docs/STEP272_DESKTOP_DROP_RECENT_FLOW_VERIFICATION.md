# Step272: Desktop Drop And Recent Flow Verification

## Scope

Verify that packaged desktop supports drag-drop CAD open, keeps renderer recent files and menu recent files synchronized, and does not regress the Step271 native handoff lane or the Step270 packaged settings lane.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
node --check deps/cadgamefusion/tools/web_viewer_desktop/preload.js
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_drop_recent_smoke.js
node --test deps/cadgamefusion/tools/web_viewer_desktop/tests/open_file_handoff.test.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_drop_recent_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --input-dwg-alt "/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg" \
  --outdir /tmp/desktop-packaged-drop-recent-step272
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/desktop-packaged-open-handoff-step272-regress
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/desktop-packaged-smoke-step272-regress
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py \
  --use-packaged-app \
  --use-runtime-autodetect \
  --router-auto-start-mode default \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/step272_packaged_dwg_open_smoke
git -C deps/cadgamefusion diff --check
```

## Expected Results

### 1. Static and unit checks

Expected to pass:

- `node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`
- `node --check deps/cadgamefusion/tools/web_viewer_desktop/preload.js`
- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_drop_recent_smoke.js`
- `node --test deps/cadgamefusion/tools/web_viewer_desktop/tests/open_file_handoff.test.js`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`

### 2. Packaged drop + recent smoke

Expected to pass:

- `cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack`
- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_drop_recent_smoke.js --input-dwg ... --input-dwg-alt ...`

Key facts:

- packaged desktop starts with an empty recent list on a clean profile;
- dragenter reveals the drop overlay;
- dropping the first sample DWG opens it and creates one recent entry in both renderer and menu;
- dropping the second sample DWG moves it to the top of both renderer and menu recents;
- replay from the renderer recent list reopens the first sample and moves it back to the top;
- `Clear` empties renderer recent state and menu recent state;
- no Three.js CDN or Google Fonts requests appear.

Evidence from this run:

- summary: `/tmp/desktop-packaged-drop-recent-step272/20260326_160450/summary.json`

### 3. Step271 native handoff regression

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js --input-dwg ...`

Key facts:

- second-instance handoff still opens the sample DWG in the first window;
- startup-arg handoff still opens the sample DWG on launch.

Evidence from this run:

- summary: `/tmp/desktop-packaged-open-handoff-step272-regress/20260326_160506/summary.json`

### 4. Step270 packaged settings regression

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js --input-dwg ...`

Key facts:

- packaged startup auto-repair still succeeds;
- packaged diagnostics still expose bundled `dwg2dxf`;
- the packaged viewer still opens the sample DWG through the in-page `Open CAD File` flow.

Evidence from this run:

- summary: `/tmp/desktop-packaged-smoke-step272-regress/20260326_160506/summary.json`

### 5. Packaged DWG smoke regression

Expected to pass:

- `python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect ...`

Key facts:

- packaged desktop still opens the sample DWG successfully;
- route contract remains `direct-plugin`;
- packaged runtime still resolves `dwg2dxf_bin` from `Resources/cad_resources/dwg_service/bin`.

Evidence from this run:

- summary: `/private/tmp/step272_packaged_dwg_open_smoke/20260326_160506/summary.json`

### 6. Patch hygiene

Expected to pass:

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step272 is verified when packaged desktop supports drag-drop CAD open, maintains one synchronized recent-file truth across the renderer and the File menu, and preserves the previously verified native handoff and packaged DWG open flows.
