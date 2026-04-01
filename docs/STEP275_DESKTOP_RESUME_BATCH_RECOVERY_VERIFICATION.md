# Step275: Desktop Resume And Batch Recovery Verification

## Scope

Verify that packaged desktop now supports `Resume Latest`, macOS self-registration of file-open services, and batch failure recovery through retry/export, while preserving the previously verified packaged DWG lanes.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
node --check deps/cadgamefusion/tools/web_viewer_desktop/preload.js
node --check deps/cadgamefusion/tools/web_viewer_desktop/launch_services_registration.js
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_resume_batch_recovery_smoke.js
node --test deps/cadgamefusion/tools/web_viewer_desktop/tests/launch_services_registration.test.js
node --test deps/cadgamefusion/tools/web_viewer_desktop/tests/open_file_handoff.test.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_resume_batch_recovery_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --input-dwg-alt "/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg" \
  --outdir /tmp/desktop-packaged-resume-batch-step275-rerun
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --input-dwg-alt "/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg" \
  --outdir /tmp/desktop-packaged-open-handoff-step275-rerun
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_assoc_multidrop_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --input-dwg-alt "/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg" \
  --outdir /tmp/desktop-packaged-assoc-multidrop-step275-rerun
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/desktop-packaged-smoke-step275-rerun
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py \
  --use-packaged-app \
  --use-runtime-autodetect \
  --router-auto-start-mode default \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /private/tmp/step275_packaged_dwg_open_smoke_rerun
git -C deps/cadgamefusion diff --check
```

## Expected Results

### 1. Static and unit checks

Expected to pass:

- `node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`
- `node --check deps/cadgamefusion/tools/web_viewer_desktop/preload.js`
- `node --check deps/cadgamefusion/tools/web_viewer_desktop/launch_services_registration.js`
- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_resume_batch_recovery_smoke.js`
- `node --test deps/cadgamefusion/tools/web_viewer_desktop/tests/launch_services_registration.test.js`
- `node --test deps/cadgamefusion/tools/web_viewer_desktop/tests/open_file_handoff.test.js`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`

### 2. Packaged resume + recovery smoke

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_resume_batch_recovery_smoke.js --input-dwg ... --input-dwg-alt ...`

Key facts:

- packaged desktop reaches ready state with no CDN requests;
- `Register macOS File Open` is visible on darwin and succeeds;
- opening one sample DWG seeds both the quick action and `File -> Resume Latest CAD`;
- relaunch with the same profile preserves the latest recent entry;
- `Resume Latest` reopens the latest sample through the same direct-plugin lane;
- a batch with one missing DWG plus one unsupported `.txt` ends as `Complete · 0 opened · 1 failed · 1 ignored`;
- `Retry Failed` replays only the failed DWG and ends as `Complete · 1 opened`;
- `Export Report` writes one `vemcad.desktop.batch_report.v1` JSON bundle.

Evidence from this run:

- summary: `/tmp/desktop-packaged-resume-batch-step275-rerun/20260326_181029/summary.json`

### 3. Step274 native handoff regression

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js --input-dwg ... --input-dwg-alt ...`

Key facts:

- second-instance forwarding still opens the running packaged window;
- macOS `open -a /abs/path/to/VemCAD.app <file>` still reaches that same window;
- startup-arg open still lands on `Opened ... via direct-plugin.`

Evidence from this run:

- summary: `/tmp/desktop-packaged-open-handoff-step275-rerun/20260326_181047/summary.json`

### 4. Step273 association + multi-drop regression

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_assoc_multidrop_smoke.js --input-dwg ... --input-dwg-alt ...`

Key facts:

- packaged `Info.plist` still exposes `.dwg/.dxf/.cad` only;
- mixed multi-drop still ends as `Complete · 2 opened · 1 ignored`;
- recent sidebar metadata and `File -> Open Recent CAD` ordering still match.

Evidence from this run:

- summary: `/tmp/desktop-packaged-assoc-multidrop-step275-rerun/20260326_181059/summary.json`

### 5. Step270 packaged settings regression

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js --input-dwg ...`

Key facts:

- packaged startup auto-repair still converges on recommended desktop settings;
- the packaged runtime still shows bundled router and DWG diagnostics;
- in-page `Open CAD File` still opens the sample DWG successfully.

Evidence from this run:

- summary: `/tmp/desktop-packaged-smoke-step275-rerun/20260326_181111/summary.json`

### 6. Packaged DWG smoke regression

Expected to pass:

- `python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect ...`

Key facts:

- packaged desktop still opens the sample DWG successfully;
- route contract remains `direct-plugin`;
- packaged runtime still resolves bundled `dwg2dxf` and manifest artifacts correctly.

Evidence from this run:

- summary: `/private/tmp/step275_packaged_dwg_open_smoke_rerun/20260326_181122/summary.json`

### 7. Patch hygiene

Expected to pass:

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step275 is verified when packaged VemCAD can restore the latest CAD session, help re-register macOS file-open services, recover failed batch opens without manual reselection, and preserve the previously verified packaged DWG open paths.
