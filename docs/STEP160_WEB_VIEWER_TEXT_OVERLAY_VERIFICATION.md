# STEP160 Web Viewer Text Overlay - Verification

## Manual steps
1. Build artifacts and run a preview conversion that emits `document.json` (e.g. convert_cli + dxf importer).
2. Serve the web viewer:
   ```bash
   python3 -m http.server 8080
   ```
3. Open the viewer with a manifest that includes `document_json`:
   ```text
   http://localhost:8080/tools/web_viewer/index.html?manifest=/path/to/manifest.json
   ```
4. Toggle the **Text** button on/off and confirm:
   - Text labels appear above the canvas.
   - Dimension text uses the rotation from `dim_text_rotation`.
   - Alignment respects `text_attachment` (or `text_halign/text_valign`).
5. Toggle filters:
   - Dimension: only dimension labels remain.
   - Text: only non-dimension labels remain.
   - All: all labels return.
6. Confirm basic text cleanup:
   - `\\P` becomes a line break.
   - `\\H`, braces, and `\\S` formatting codes are removed or simplified.
7. Zoom out until text shrinks; labels below the minimum screen size should hide.
8. Pan/zoom so labels leave the viewport; off-screen labels should hide.
9. Optional: add `text_style=clean` to confirm CAD-like label rendering (no background/border).
10. Optional: add `line_overlay=0&mesh=0` to isolate text-only screenshots.
11. Optional: use `--max-component-size` in `compare_autocad_pdf.py` to filter out large edge components (focus on text).
12. Note: Canvas overlay capture is more reliable with `--ui 1` in headless mode.

## Status
## Automated verification (2026-01-30)
1. Generate preview artifacts (already available):
   ```bash
   python3 tools/plm_preview.py \
     --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib \
     --input "/Users/huazhou/Downloads/训练图纸/训练图纸_dxf_oda_20260123/LTJ012306102-0084调节螺栓v1.dxf" \
     --out build/plm_preview_dim \
     --emit json,gltf,meta \
     --project-id demo \
     --document-label dim_text
   ```
2. Serve the viewer:
   ```bash
   cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion
   python3 -m http.server 8080
   ```
   Or run the one-shot helper:
   ```bash
   scripts/verify_text_overlay.sh
   ```
3. Capture headless Chrome screenshots (works when GPU is enabled):
   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
     --headless=new \
     --window-size=1400,900 \
     --virtual-time-budget=15000 \
     --screenshot=docs/assets/step160_text_overlay_dimension.png \
     "http://127.0.0.1:8080/tools/web_viewer/index.html?manifest=build/plm_preview_dim/manifest.json&project_id=demo&document_label=dim_text&document_id=ZGVtbwpkaW1fdGV4dA&text_filter=dimension"
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
     --headless=new \
     --window-size=1400,900 \
     --virtual-time-budget=15000 \
     --screenshot=docs/assets/step160_text_overlay_text.png \
     "http://127.0.0.1:8080/tools/web_viewer/index.html?manifest=build/plm_preview_dim/manifest.json&project_id=demo&document_label=dim_text&document_id=ZGVtbwpkaW1fdGV4dA&text_filter=text"
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
     --headless=new \
     --window-size=1400,900 \
     --virtual-time-budget=15000 \
     --screenshot=docs/assets/step160_text_overlay_all.png \
     "http://127.0.0.1:8080/tools/web_viewer/index.html?manifest=build/plm_preview_dim/manifest.json&project_id=demo&document_label=dim_text&document_id=ZGVtbwpkaW1fdGV4dA&text_filter=all"
   ```
   - Note: `--disable-gpu` produced a blank UI in headless; omit it.
4. JSON sanity check for text/dimension metadata:
   ```bash
   python3 - <<'PY'
   import json
   path='build/plm_preview_dim/document.json'
   with open(path,'r',encoding='utf-8') as f:
       doc=json.load(f)
   ents=doc.get('entities',[])
   text=[e for e in ents if e.get('type')==7 and 'text' in e]
   with_dim=[e for e in text if e.get('text_kind')=='dimension' or e.get('dim_type') is not None]
   missing=[e for e in with_dim if e.get('dim_text_rotation') is None or e.get('dim_text_pos') is None]
   print('entities',len(ents))
   print('text',len(text))
   print('dimension_text',len(with_dim))
   print('dimension_missing_meta',len(missing))
   PY
   ```

### Observations
- Headless render succeeded; screenshots saved to:
  - `docs/assets/step160_text_overlay_dimension.png`
  - `docs/assets/step160_text_overlay_text.png`
  - `docs/assets/step160_text_overlay_all.png`
- Viewer shows loaded scene with mesh stats (1 mesh / 211 vertices / 71 triangles) and text overlays toggle correctly per filter.
- Text Overlay panel updates (Filter + Total/Displayed/Capped counts) as filters change.
- JSON check output: `text=102`, `dimension_text=18`, `dimension_missing_meta=0` (all dimension text entries have `dim_text_pos` + `dim_text_rotation`).

## Status
- Headless automation: OK when GPU is enabled; screenshot captured.
- Manual verification: optional (headless already validates overlay + metadata binding).


## Automated verification (scripted)
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- document.json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/document.json`
- Screenshots:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/step160_text_overlay_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/step160_text_overlay_text.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/step160_text_overlay_all.png`
- JSON stats:
  - entities: 372
  - text: 102
  - dimension_text: 18
  - dimension_missing_meta: 0


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
- Edge overlap (pixel count):
  - pdf_edges: 16035
  - viewer_edges: 6799
  - overlap: 15
  - jaccard: 0.0007


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
- Edge overlap (pixel count):
  - pdf_edges: 5842
  - viewer_edges: 33793
  - overlap: 400
  - jaccard: 0.0102


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
- Rotation picked: 180 degrees
- Edge overlap (pixel count):
  - pdf_edges: 11923
  - viewer_edges: 36355
  - overlap: 1649
  - jaccard: 0.0354


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
- Rotation picked: 180 degrees
- Edge overlap (pixel count):
  - pdf_edges: 11923
  - viewer_edges: 36355
  - overlap: 1649
  - jaccard: 0.0354


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 0
  - viewer_edges: 47590
  - overlap: 0
  - jaccard: 0.0000


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 114249
  - viewer_edges: 118232
  - overlap: 10535
  - jaccard: 0.0475


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 114249
  - viewer_edges: 118232
  - overlap: 10535
  - jaccard: 0.0475
- Aligned edge overlap (pixel count):
  - shift_dx: -6
  - shift_dy: 0
  - overlap_aligned: 10960
  - jaccard_aligned: 0.0374


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 114249
  - viewer_edges: 67477
  - overlap: 7554
  - jaccard: 0.0434
- Aligned edge overlap (pixel count):
  - shift_dx: -4
  - shift_dy: 0
  - overlap_aligned: 7788
  - jaccard_aligned: 0.0362


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 113043
  - viewer_edges: 54197
  - overlap: 7149
  - jaccard: 0.0447
- Aligned edge overlap (pixel count):
  - shift_dx: -6
  - shift_dy: 0
  - overlap_aligned: 7573
  - jaccard_aligned: 0.0379


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 113043
  - viewer_edges: 54197
  - overlap: 7149
  - jaccard: 0.0447
- Aligned edge overlap (pixel count):
  - shift_dx: 9
  - shift_dy: 0
  - overlap_aligned: 7611
  - jaccard_aligned: 0.0381


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 25344
  - viewer_edges: 3258
  - overlap: 1273
  - jaccard: 0.0466
- Aligned edge overlap (pixel count):
  - shift_dx: -56
  - shift_dy: -77
  - overlap_aligned: 1749
  - jaccard_aligned: 0.0570


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 180 degrees
- Edge overlap (pixel count):
  - pdf_edges: 114249
  - viewer_edges: 9217
  - overlap: 2191
  - jaccard: 0.0181
- Aligned edge overlap (pixel count):
  - shift_dx: 20
  - shift_dy: -13
  - overlap_aligned: 3200
  - jaccard_aligned: 0.0254


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 180 degrees
- Edge overlap (pixel count):
  - pdf_edges: 114249
  - viewer_edges: 9217
  - overlap: 2191
  - jaccard: 0.0181
- Aligned edge overlap (pixel count):
  - shift_dx: 20
  - shift_dy: -13
  - overlap_aligned: 3200
  - jaccard_aligned: 0.0254


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 180 degrees
- Edge overlap (pixel count):
  - pdf_edges: 114249
  - viewer_edges: 8504
  - overlap: 3396
  - jaccard: 0.0285
- Aligned edge overlap (pixel count):
  - shift_dx: -10
  - shift_dy: 0
  - overlap_aligned: 4494
  - jaccard_aligned: 0.0375


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 114249
  - viewer_edges: 68003
  - overlap: 7575
  - jaccard: 0.0434
- Aligned edge overlap (pixel count):
  - shift_dx: -5
  - shift_dy: 0
  - overlap_aligned: 7900
  - jaccard_aligned: 0.0365


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 114249
  - viewer_edges: 9826
  - overlap: 2059
  - jaccard: 0.0169
- Aligned edge overlap (pixel count):
  - shift_dx: -18
  - shift_dy: 21
  - overlap_aligned: 3034
  - jaccard_aligned: 0.0250


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 114249
  - viewer_edges: 67563
  - overlap: 7565
  - jaccard: 0.0434
- Aligned edge overlap (pixel count):
  - shift_dx: -5
  - shift_dy: 0
  - overlap_aligned: 7872
  - jaccard_aligned: 0.0365


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 114249
  - viewer_edges: 67563
  - overlap: 7565
  - jaccard: 0.0434
- Aligned edge overlap (pixel count):
  - shift_dx: -5
  - shift_dy: 0
  - overlap_aligned: 7872
  - jaccard_aligned: 0.0365


## Automated verification (scripted)
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- document.json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/document.json`
- Screenshots:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/step160_text_overlay_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/step160_text_overlay_text.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/step160_text_overlay_all.png`
- JSON stats:
  - entities: 560
  - text: 102
  - dimension_text: 18
  - dimension_missing_meta: 0


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `dimension`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 112381
  - viewer_edges: 88230
  - overlap: 10395
  - jaccard: 0.0546
- Aligned edge overlap (pixel count):
  - shift_dx: -44
  - shift_dy: -28
  - overlap_aligned: 20503
  - jaccard_aligned: 0.0931


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 112381
  - viewer_edges: 113696
  - overlap: 9776
  - jaccard: 0.0452
- Aligned edge overlap (pixel count):
  - shift_dx: 68
  - shift_dy: -28
  - overlap_aligned: 23638
  - jaccard_aligned: 0.0922


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 112381
  - viewer_edges: 53220
  - overlap: 5221
  - jaccard: 0.0326
- Aligned edge overlap (pixel count):
  - shift_dx: 34
  - shift_dy: -8
  - overlap_aligned: 6127
  - jaccard_aligned: 0.0327


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `dimension`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 180 degrees
- Edge overlap (pixel count):
  - pdf_edges: 112381
  - viewer_edges: 30258
  - overlap: 1893
  - jaccard: 0.0134
- Aligned edge overlap (pixel count):
  - shift_dx: 78
  - shift_dy: -9
  - overlap_aligned: 3148
  - jaccard_aligned: 0.0207


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 112381
  - viewer_edges: 53078
  - overlap: 4190
  - jaccard: 0.0260
- Aligned edge overlap (pixel count):
  - shift_dx: -14
  - shift_dy: -47
  - overlap_aligned: 5154
  - jaccard_aligned: 0.0273


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `dimension`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 180 degrees
- Edge overlap (pixel count):
  - pdf_edges: 112381
  - viewer_edges: 30374
  - overlap: 1877
  - jaccard: 0.0133
- Aligned edge overlap (pixel count):
  - shift_dx: 78
  - shift_dy: -9
  - overlap_aligned: 3127
  - jaccard_aligned: 0.0205


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 112381
  - viewer_edges: 52708
  - overlap: 4687
  - jaccard: 0.0292
- Aligned edge overlap (pixel count):
  - shift_dx: 70
  - shift_dy: -8
  - overlap_aligned: 5495
  - jaccard_aligned: 0.0294


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `dimension`
- Edge component filter: min_size=5, max_size=800
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 37120
  - viewer_edges: 30313
  - overlap: 619
  - jaccard: 0.0093
- Aligned edge overlap (pixel count):
  - shift_dx: -55
  - shift_dy: -59
  - overlap_aligned: 1327
  - jaccard_aligned: 0.0169


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `dimension`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 180 degrees
- Edge overlap (pixel count):
  - pdf_edges: 112381
  - viewer_edges: 30374
  - overlap: 1877
  - jaccard: 0.0133
- Aligned edge overlap (pixel count):
  - shift_dx: 78
  - shift_dy: -9
  - overlap_aligned: 3127
  - jaccard_aligned: 0.0205


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 112381
  - viewer_edges: 52708
  - overlap: 4687
  - jaccard: 0.0292
- Aligned edge overlap (pixel count):
  - shift_dx: 70
  - shift_dy: -8
  - overlap_aligned: 5495
  - jaccard_aligned: 0.0294


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `dimension`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 180 degrees
- Edge overlap (pixel count):
  - pdf_edges: 112381
  - viewer_edges: 30374
  - overlap: 1877
  - jaccard: 0.0133
- Aligned edge overlap (pixel count):
  - shift_dx: 78
  - shift_dy: -9
  - overlap_aligned: 3127
  - jaccard_aligned: 0.0205


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `dimension`
- Edge component filter: min_size=3, max_size=100
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 90 degrees
- Edge overlap (pixel count):
  - pdf_edges: 3778
  - viewer_edges: 6200
  - overlap: 18
  - jaccard: 0.0018
- Aligned edge overlap (pixel count):
  - shift_dx: 72
  - shift_dy: 36
  - overlap_aligned: 52
  - jaccard_aligned: 0.0052


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `dimension`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 180 degrees
- Edge overlap (pixel count):
  - pdf_edges: 5842
  - viewer_edges: 20929
  - overlap: 259
  - jaccard: 0.0098
- Aligned edge overlap (pixel count):
  - shift_dx: -57
  - shift_dy: 80
  - overlap_aligned: 544
  - jaccard_aligned: 0.0324


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `dimension`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 180 degrees
- Edge overlap (pixel count):
  - pdf_edges: 5842
  - viewer_edges: 20929
  - overlap: 259
  - jaccard: 0.0098
- Aligned edge overlap (pixel count):
  - shift_dx: -57
  - shift_dy: 80
  - overlap_aligned: 544
  - jaccard_aligned: 0.0324


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 90 degrees
- Edge overlap (pixel count):
  - pdf_edges: 5842
  - viewer_edges: 18039
  - overlap: 210
  - jaccard: 0.0089
- Aligned edge overlap (pixel count):
  - shift_dx: 70
  - shift_dy: -63
  - overlap_aligned: 513
  - jaccard_aligned: 0.0220


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `dimension`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 180 degrees
- Edge overlap (pixel count):
  - pdf_edges: 5842
  - viewer_edges: 20939
  - overlap: 301
  - jaccard: 0.0114
- Aligned edge overlap (pixel count):
  - shift_dx: 9
  - shift_dy: -18
  - overlap_aligned: 539
  - jaccard_aligned: 0.0320


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 270 degrees
- Edge overlap (pixel count):
  - pdf_edges: 5842
  - viewer_edges: 18091
  - overlap: 234
  - jaccard: 0.0099
- Aligned edge overlap (pixel count):
  - shift_dx: -70
  - shift_dy: -2
  - overlap_aligned: 490
  - jaccard_aligned: 0.0209


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `dimension`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 12205
  - viewer_edges: 0
  - overlap: 0
  - jaccard: 0.0000
- Aligned edge overlap (pixel count):
  - shift_dx: -80
  - shift_dy: -80
  - overlap_aligned: 0
  - jaccard_aligned: 0.0000


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `dimension`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 12205
  - viewer_edges: 0
  - overlap: 0
  - jaccard: 0.0000
- Aligned edge overlap (pixel count):
  - shift_dx: -80
  - shift_dy: -80
  - overlap_aligned: 0
  - jaccard_aligned: 0.0000


## Automated verification (scripted)
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- document.json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/document.json`
- Screenshots:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/step160_text_overlay_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/step160_text_overlay_text.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/step160_text_overlay_all.png`
- JSON stats:
  - entities: 560
  - text: 102
  - dimension_text: 18
  - dimension_missing_meta: 0


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `dimension`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 12205
  - viewer_edges: 0
  - overlap: 0
  - jaccard: 0.0000
- Aligned edge overlap (pixel count):
  - shift_dx: -80
  - shift_dy: -80
  - overlap_aligned: 0
  - jaccard_aligned: 0.0000


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `dimension`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 90 degrees
- Edge overlap (pixel count):
  - pdf_edges: 19328
  - viewer_edges: 22700
  - overlap: 188
  - jaccard: 0.0045
- Aligned edge overlap (pixel count):
  - shift_dx: 79
  - shift_dy: 4
  - overlap_aligned: 523
  - jaccard_aligned: 0.0126


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 90 degrees
- Edge overlap (pixel count):
  - pdf_edges: 19328
  - viewer_edges: 22700
  - overlap: 188
  - jaccard: 0.0045
- Aligned edge overlap (pixel count):
  - shift_dx: 79
  - shift_dy: 4
  - overlap_aligned: 523
  - jaccard_aligned: 0.0126


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `dimension`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 180 degrees
- Edge overlap (pixel count):
  - pdf_edges: 12203
  - viewer_edges: 20037
  - overlap: 445
  - jaccard: 0.0140
- Aligned edge overlap (pixel count):
  - shift_dx: -70
  - shift_dy: -80
  - overlap_aligned: 1124
  - jaccard_aligned: 0.0274


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `all`
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 180 degrees
- Edge overlap (pixel count):
  - pdf_edges: 12203
  - viewer_edges: 20037
  - overlap: 445
  - jaccard: 0.0140
- Aligned edge overlap (pixel count):
  - shift_dx: -70
  - shift_dy: -80
  - overlap_aligned: 1124
  - jaccard_aligned: 0.0274


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `build/plm_preview_dim_hatch_scaled/manifest.json`
- Viewer filter: `dimension`
- Viewer capture: playwright
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 270 degrees
- Edge overlap (pixel count):
  - pdf_edges: 22143
  - viewer_edges: 27912
  - overlap: 547
  - jaccard: 0.0110
- Aligned edge overlap (pixel count):
  - shift_dx: -8
  - shift_dy: 62
  - overlap_aligned: 1499
  - jaccard_aligned: 0.0309
