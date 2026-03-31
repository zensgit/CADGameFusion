# Step276: Document Fallback Preview Verification

## Scope

Verify that packaged desktop no longer shows a blank viewport for the current real DWG sample when conversion produces only `document.json`, and that the viewer now synthesizes visible fallback line preview geometry.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer/document_preview_fallback.js
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_document_fallback_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_drop_recent_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_assoc_multidrop_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_resume_batch_recovery_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/document_preview_fallback.test.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
node --test deps/cadgamefusion/tools/web_viewer_desktop/tests/open_file_handoff.test.js
npm --prefix deps/cadgamefusion/tools/web_viewer_desktop run pack
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_document_fallback_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/desktop-packaged-document-fallback-step276
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/desktop-packaged-smoke-step276-regress
git -C deps/cadgamefusion diff --check
```

## Expected Results

### 1. Static and unit checks

Expected to pass:

- `node --check deps/cadgamefusion/tools/web_viewer/document_preview_fallback.js`
- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_document_fallback_smoke.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_drop_recent_smoke.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_assoc_multidrop_smoke.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_resume_batch_recovery_smoke.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/document_preview_fallback.test.js`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`
- `node --test deps/cadgamefusion/tools/web_viewer_desktop/tests/open_file_handoff.test.js`

### 2. Packaged fallback preview smoke

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_document_fallback_smoke.js --input-dwg ...`

Key facts from the passing run:

- packaged status becomes `Opened ... via direct-plugin with document fallback preview.`
- `window.__cadgfPreviewDebug.getLastManifestPreviewState()` returns:
  - `kind: "document-fallback"`
  - `outputs: ["json"]`
  - `renderableEntityCount: 1322`
  - `segmentCount: 2759`
- `window.__cadgfPreviewDebug.getLineOverlayState()` is non-empty;
- the packaged screenshot shows visible CAD linework and dimensions on screen.

Evidence from this run:

- summary: `/tmp/desktop-packaged-document-fallback-step276/20260326_202145/summary.json`
- screenshot: `/tmp/desktop-packaged-document-fallback-step276/20260326_202145/fallback_preview.png`

### 3. Packaged settings regression

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js --input-dwg ...`

Key facts from the passing run:

- startup auto-repair still converges on recommended packaged settings;
- bad `routerStartCmd` startup repair still works;
- in-page `Open CAD File` now lands on `Opened ... via direct-plugin with document fallback preview.`

Evidence from this run:

- summary: `/tmp/desktop-packaged-smoke-step276-regress/20260326_202145/summary.json`

### 4. Patch hygiene

Expected to pass:

- `git -C deps/cadgamefusion diff --check`

## Notes

An additional rerun of `desktop_packaged_open_handoff_smoke.js` was attempted after the Step276 package rebuild. Its second-instance lane still passed, but the darwin `open -a` wait timed out in this environment:

- `/tmp/desktop-packaged-open-handoff-step276-regress/20260326_202234/summary.json`

That result does not invalidate the new fallback-preview proof above, but LaunchServices handoff should be rechecked separately if Step271/274 coverage is being re-certified.

## Conclusion

Step276 is verified when the packaged app can take a json-only CAD result, synthesize visible fallback line geometry, show truthful preview status, and preserve packaged settings behavior.
