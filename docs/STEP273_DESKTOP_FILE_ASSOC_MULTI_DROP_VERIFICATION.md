# Step273: Desktop File Association And Multi-Drop Verification

## Scope

Verify that packaged desktop now declares narrow CAD file associations, queues multi-file drop through the existing desktop open flow, enriches recent metadata, and does not regress the previously verified packaged DWG lanes.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_assoc_multidrop_smoke.js
node --test deps/cadgamefusion/tools/web_viewer_desktop/tests/open_file_handoff.test.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_assoc_multidrop_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --input-dwg-alt "/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg" \
  --outdir /tmp/desktop-packaged-assoc-multidrop-step273
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_drop_recent_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --input-dwg-alt "/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg" \
  --outdir /tmp/desktop-packaged-drop-recent-step273-regress
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/desktop-packaged-open-handoff-step273-regress
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/desktop-packaged-smoke-step273-regress
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py \
  --use-packaged-app \
  --use-runtime-autodetect \
  --router-auto-start-mode default \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /private/tmp/step273_packaged_dwg_open_smoke
git -C deps/cadgamefusion diff --check
```

## Expected Results

### 1. Static and unit checks

Expected to pass:

- `node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`
- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_assoc_multidrop_smoke.js`
- `node --test deps/cadgamefusion/tools/web_viewer_desktop/tests/open_file_handoff.test.js`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`

### 2. Packaged file-association + multi-drop smoke

Expected to pass:

- `cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack`
- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_assoc_multidrop_smoke.js --input-dwg ... --input-dwg-alt ...`

Key facts:

- packaged `Info.plist` exposes `CFBundleDocumentTypes`;
- declared extensions include `.dwg`, `.dxf`, and `.cad`;
- declared extensions do not include `.json`;
- one multi-file drop gesture opens both sample DWGs in order;
- the final visible status is the second sample opening successfully;
- renderer recents show both files newest-first;
- recent metadata includes `Last opened:`;
- bridge recents and `File -> Open Recent CAD` match renderer ordering;
- no Three.js CDN or Google Fonts requests appear.

Evidence from this run:

- summary: `/tmp/desktop-packaged-assoc-multidrop-step273/20260326_162310/summary.json`

### 3. Step272 drop/recent regression

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_drop_recent_smoke.js --input-dwg ... --input-dwg-alt ...`

Key facts:

- single-file drag-drop still works;
- renderer recent replay still works;
- clear-recents still empties both renderer and menu state.

Evidence from this run:

- summary: `/tmp/desktop-packaged-drop-recent-step273-regress/20260326_162310/summary.json`

### 4. Step271 native handoff regression

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js --input-dwg ...`

Key facts:

- startup-arg handoff still opens the sample DWG;
- second-instance handoff still forwards to the running packaged window.

Evidence from this run:

- summary: `/tmp/desktop-packaged-open-handoff-step273-regress/20260326_162310/summary.json`

### 5. Step270 packaged settings regression

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js --input-dwg ...`

Key facts:

- packaged startup repair still converges on a ready viewer;
- bundled runtime diagnostics remain visible in Settings;
- in-page `Open CAD File` still opens the sample DWG successfully.

Evidence from this run:

- summary: `/tmp/desktop-packaged-smoke-step273-regress/20260326_162310/summary.json`

### 6. Packaged DWG smoke regression

Expected to pass:

- `python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect ...`

Key facts:

- packaged desktop still opens the sample DWG successfully;
- route contract remains `direct-plugin`;
- packaged runtime still resolves bundled fallback readiness correctly.

Evidence from this run:

- summary: `/private/tmp/step273_packaged_dwg_open_smoke/20260326_162309/summary.json`

### 7. Patch hygiene

Expected to pass:

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step273 is verified when packaged VemCAD advertises the right CAD document types, proves that multi-file drop is a first-class queued open path, shows richer recent metadata in the renderer, and preserves all previously verified packaged DWG open lanes.
