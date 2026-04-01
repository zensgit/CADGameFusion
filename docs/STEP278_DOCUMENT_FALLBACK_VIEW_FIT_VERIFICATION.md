# Step278: Document Fallback View Fit Verification

## Scope

Verify that packaged document-fallback preview now opens in a more CAD-like presentation, with better first-view framing and pan-first interaction.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_document_fallback_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/document_preview_fallback.test.js
npm --prefix deps/cadgamefusion/tools/web_viewer_desktop run pack
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_document_fallback_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/desktop-packaged-document-fallback-step278e
git -C deps/cadgamefusion diff --check
```

## Expected Results

### 1. Static and unit checks

Expected to pass:

- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_document_fallback_smoke.js`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/document_preview_fallback.test.js`

### 2. Packaged fallback smoke

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_document_fallback_smoke.js --input-dwg ...`

Key facts from the verified run on March 27, 2026:

- summary: `/tmp/desktop-packaged-document-fallback-step278e/20260327_081347/summary.json`
- screenshot: `/tmp/desktop-packaged-document-fallback-step278e/20260327_081347/fallback_preview.png`

The passing run proved:

- packaged open still finished with:
  - `Opened BTJ02230301120-03保护罩组件v1 via direct-plugin with document fallback preview.`
- preview state remained:
  - `kind: "document-fallback"`
  - `renderableEntityCount: 1322`
  - `segmentCount: 2759`
- viewport presentation switched to:
  - `mode: "document-fallback"`
  - `viewportClass: "viewport viewport--document-fallback"`
  - `gridVisible: false`
  - `controlsRotateEnabled: false`

### 3. Visual comparison

Before the Step278 fit/presentation work, the packaged fallback lane could render visible geometry but still looked poor:

- earlier screenshot from Step276:
  - `/tmp/desktop-packaged-document-fallback-step276/20260326_202145/fallback_preview.png`

After Step278, the packaged fallback screenshot shows:

- dark CAD-style viewport presentation;
- the drawing content framed larger and with better contrast;
- pan-first 2D interaction mode instead of a generic 3D-orbit presentation.

### 4. Patch hygiene

Expected to pass:

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step278 is verified when packaged document fallback preview remains functional, enters its CAD-style presentation mode, disables rotate-first interaction, and shows the drawing in a materially more legible first-view frame.
