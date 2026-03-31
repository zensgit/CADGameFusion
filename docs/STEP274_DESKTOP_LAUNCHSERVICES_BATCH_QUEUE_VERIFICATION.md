# Step274: Desktop LaunchServices And Batch Queue Verification

## Scope

Verify that packaged desktop now proves Finder-like LaunchServices open on macOS through `open -a`, exposes visible batch queue feedback for mixed multi-file drop, and does not regress the previously verified packaged DWG lanes.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_assoc_multidrop_smoke.js
node --test deps/cadgamefusion/tools/web_viewer_desktop/tests/open_file_handoff.test.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --input-dwg-alt "/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg" \
  --outdir /tmp/desktop-packaged-open-handoff-step274-clean
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_assoc_multidrop_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --input-dwg-alt "/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg" \
  --outdir /tmp/desktop-packaged-assoc-multidrop-step274
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_drop_recent_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --input-dwg-alt "/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg" \
  --outdir /tmp/desktop-packaged-drop-recent-step274-regress
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/desktop-packaged-smoke-step274-regress
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py \
  --use-packaged-app \
  --use-runtime-autodetect \
  --router-auto-start-mode default \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /private/tmp/step274_packaged_dwg_open_smoke
git -C deps/cadgamefusion diff --check
```

## Expected Results

### 1. Static and unit checks

Expected to pass:

- `node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`
- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_assoc_multidrop_smoke.js`
- `node --test deps/cadgamefusion/tools/web_viewer_desktop/tests/open_file_handoff.test.js`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`

### 2. Packaged native handoff + LaunchServices smoke

Expected to pass:

- `cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack`
- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js --input-dwg ... --input-dwg-alt ...`

Key facts:

- packaged desktop reaches initial ready status;
- second-instance forwarding still opens the first sample DWG in the original window;
- on macOS, `open -a /abs/path/to/VemCAD.app <alt.dwg>` updates the same visible window to the second sample;
- startup-arg open still reaches `Opened ... via direct-plugin.`;
- no Three.js CDN or Google Fonts requests appear.

Evidence from this run:

- summary: `/tmp/desktop-packaged-open-handoff-step274-clean/20260326_174516/summary.json`

### 3. Packaged file-association + batch queue smoke

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_assoc_multidrop_smoke.js --input-dwg ... --input-dwg-alt ...`

Key facts:

- packaged `Info.plist` still exposes the expected CAD document types;
- one mixed drop gesture with two DWGs plus one unsupported file finishes with `Complete · 2 opened · 1 ignored`;
- the batch panel shows two opened items and one ignored item;
- recent UI still shows the two CAD files newest-first;
- bridge recents and `File -> Open Recent CAD` still match the renderer.

Evidence from this run:

- summary: `/tmp/desktop-packaged-assoc-multidrop-step274/20260326_174341/summary.json`

### 4. Step272 drop/recent regression

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_drop_recent_smoke.js --input-dwg ... --input-dwg-alt ...`

Key facts:

- direct drag-drop still opens CAD files correctly;
- recent replay and clear-recents still work;
- menu and renderer MRU ordering still match.

Evidence from this run:

- summary: `/tmp/desktop-packaged-drop-recent-step274-regress/20260326_174341/summary.json`

### 5. Step270 packaged settings regression

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js --input-dwg ...`

Key facts:

- packaged startup repair still converges on a ready viewer;
- bundled runtime diagnostics remain visible in Settings;
- in-page `Open CAD File` still opens the sample DWG successfully.

Evidence from this run:

- summary: `/tmp/desktop-packaged-smoke-step274-regress/20260326_174341/summary.json`

### 6. Packaged DWG smoke regression

Expected to pass:

- `python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect ...`

Key facts:

- packaged desktop still opens the sample DWG successfully;
- route contract remains `direct-plugin`;
- packaged runtime still resolves bundled fallback readiness correctly.

Evidence from this run:

- summary: `/private/tmp/step274_packaged_dwg_open_smoke/20260326_174340/summary.json`

### 7. Patch hygiene

Expected to pass:

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step274 is verified when packaged VemCAD proves real macOS LaunchServices handoff through `open -a`, exposes a user-visible batch queue result for mixed multi-file drop, and preserves all previously verified packaged DWG open lanes.
