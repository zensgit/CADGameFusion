# Step279: Document Fallback Main-Cluster Verification

## Scope

Verify that packaged document-fallback preview now computes a density-based main-cluster focus region, keeps the packaged DWG open path working, and does not regress packaged desktop setup behavior.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer/document_preview_fallback.js
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_document_fallback_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/document_preview_fallback.test.js
npm --prefix deps/cadgamefusion/tools/web_viewer_desktop run pack
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_document_fallback_smoke.js \
  --app "/Applications/VemCAD.app/Contents/MacOS/VemCAD" \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/desktop-packaged-document-fallback-step279c
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js \
  --app "/Applications/VemCAD.app/Contents/MacOS/VemCAD" \
  --outdir /tmp/desktop-packaged-settings-step279
git -C deps/cadgamefusion diff --check
```

## Expected Results

### 1. Static and unit checks

Expected to pass:

- `node --check deps/cadgamefusion/tools/web_viewer/document_preview_fallback.js`
- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_document_fallback_smoke.js`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/document_preview_fallback.test.js`

The unit suite now includes a synthetic case where a sparse outer border surrounds a denser inner drawing. The new focus helper must prefer the dense inner region.

### 2. Packaged fallback smoke

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_document_fallback_smoke.js --app "/Applications/VemCAD.app/Contents/MacOS/VemCAD" ...`

Verified packaged run on March 27, 2026:

- summary: `/tmp/desktop-packaged-document-fallback-step279c/20260327_153453/summary.json`
- screenshot: `/tmp/desktop-packaged-document-fallback-step279c/20260327_153453/fallback_preview.png`

The passing run proved:

- packaged open still finished with:
  - `Opened BTJ02230301120-03保护罩组件v1 via direct-plugin with document fallback preview.`
- preview state remained:
  - `kind: "document-fallback"`
  - `renderableEntityCount: 1322`
  - `segmentCount: 2759`
- fallback preview now exposed:
  - `focusRegion.strategy: "density-cluster"`
  - `focusRegion.coverageRatio: 0.11732118471482662`
  - `focusRegion.bounds.minX: 49.557928`
  - `focusRegion.bounds.maxX: 234.597698`
  - `focusRegion.bounds.minY: 269.911602`
  - `focusRegion.bounds.maxY: 358.886935`
- viewport presentation remained:
  - `mode: "document-fallback"`
  - `controlsRotateEnabled: false`

### 3. Packaged desktop regression

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js --app "/Applications/VemCAD.app/Contents/MacOS/VemCAD" ...`

Verified packaged run on March 27, 2026:

- summary: `/tmp/desktop-packaged-settings-step279/20260327_153549/summary.json`

The passing run proved:

- packaged runtime still boots ready from bundled cad resources;
- startup auto-repair still restores bad router settings;
- bad `routerStartCmd` still self-recovers without crashing;
- packaged `Open CAD` still succeeds for the sample DWG.

### 4. Visual assessment

Compared with Step278:

- the fallback lane now has deterministic geometry-focus metadata instead of a pure heuristic box;
- text expansion is clamped so geometry remains the primary framing driver;
- the sample still shows a residual enclosing rectangle around the focused part, so this is an improvement in control and determinism, not yet a full "market CAD" first-view result.

This residual gap is real and should drive the next step:

- detect and suppress box-like enclosing border geometry that surrounds the dense part cluster.

### 5. Patch hygiene

Expected to pass:

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step279 is verified when packaged fallback preview computes a density-cluster focus region, packaged DWG open still passes, packaged settings behavior remains intact, and the remaining visual limitation is explicitly documented instead of hidden.
