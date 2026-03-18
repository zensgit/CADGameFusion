# STEP165 Viewport Layout Owner Fix Verification

## Setup
- DXF: `/Users/huazhou/Downloads/训练图纸/训练图纸/J0225034-05罐体部分v1.dxf`
- PDF: `/Users/huazhou/Documents/J0225034-05罐体部分v1-布局1.pdf`
- Plugin: `build/plugins/libcadgf_dxf_importer_plugin.dylib`
- Output: `build/plm_preview_j0225034_layoutfix_meta`

## Commands
Generate preview artifacts (include mesh_metadata for line overlay):
```
python3 tools/plm_preview.py \
  --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input "/Users/huazhou/Downloads/训练图纸/训练图纸/J0225034-05罐体部分v1.dxf" \
  --out build/plm_preview_j0225034_layoutfix_meta \
  --emit json,gltf,meta
```

Compare AutoCAD PDF to viewer (paper space + layout filter):
```
python3 scripts/compare_autocad_pdf.py \
  --pdf "/Users/huazhou/Documents/J0225034-05罐体部分v1-布局1.pdf" \
  --manifest build/plm_preview_j0225034_layoutfix_meta/manifest.json \
  --space paper \
  --paper-viewport 1 \
  --layout 布局1 \
  --playwright \
  --report docs/STEP165_VIEWPORT_LAYOUT_OWNER_FIX_VERIFICATION.md
```

## Results
- Viewer filter: `all`
- Viewer space: `paper`
- Paper viewport: on
- Layout filter: `布局1`
- Artifacts:
  - `docs/assets/autocad_model.png`
  - `docs/assets/autocad_model_crop.png`
  - `docs/assets/viewer_all.png`
  - `docs/assets/viewer_all_crop.png`
  - `docs/assets/autocad_vs_viewer_side_by_side.png`
  - `docs/assets/autocad_vs_viewer_edge_overlay.png`
- Rotation picked: 180 degrees
- Edge overlap (pixel count):
  - pdf_edges: 24819
  - viewer_edges: 34139
  - overlap: 1753
  - jaccard: 0.0306
- Aligned edge overlap (pixel count):
  - shift_dx: 71
  - shift_dy: 61
  - overlap_aligned: 3377
  - jaccard_aligned: 0.0447


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/J0225034-05罐体部分v1-布局2.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_j0225034_layoutfix_meta/manifest.json`
- Viewer filter: `all`
- Viewer space: `paper`
- Paper viewport: on
- Layout filter: `布局2`
- Viewer capture: playwright
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
  - pdf_edges: 24970
  - viewer_edges: 34987
  - overlap: 1964
  - jaccard: 0.0339
- Aligned edge overlap (pixel count):
  - shift_dx: 68
  - shift_dy: 68
  - overlap_aligned: 3488
  - jaccard_aligned: 0.0459


## Blank layout DXF sample (import failed)
- PDF: `/Users/huazhou/Documents/布局空白 DXF-布局1.pdf`
- DXF: `/Users/huazhou/Downloads/训练图纸/训练图纸/布局空白 DXF.dxf`
- Command:
```
python3 tools/plm_preview.py \
  --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input "/Users/huazhou/Downloads/训练图纸/训练图纸/布局空白 DXF.dxf" \
  --out build/plm_preview_blank_layout \
  --emit json,gltf,meta
```
- Result: `import_to_document failed (code=2): no supported DXF entities found`
- Notes:
  - ENTITIES section only contains VIEWPORT entities (2 total).
  - No LINE/LWPOLYLINE/CIRCLE/TEXT/INSERT/etc present, so geometry is missing from DXF.


## Blank layout DXF sample (AutoCAD 2013, import failed)
- PDF: `/Users/huazhou/Documents/ACAD-布局空白 DXF-2013-布局1.pdf`
- DXF: `/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白 DXF-2013.dxf`
- Command:
```
python3 tools/plm_preview.py \
  --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input "/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白 DXF-2013.dxf" \
  --out build/plm_preview_acad_blank_layout_2013 \
  --emit json,gltf,meta
```
- Result: `import_to_document failed (code=2): no supported DXF entities found`
- Notes:
  - ENTITIES section only contains VIEWPORT entities (2 total).
  - No LINE/LWPOLYLINE/CIRCLE/TEXT/INSERT/etc present, so geometry is missing from DXF.
  - PDF size is 2706 bytes, likely blank output.


## AutoCAD EXPORTLAYOUT sample (layout1, model compare)
- DWG: `/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg`
- DXF: `/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dxf`
- PDF: `/Users/huazhou/Documents/ACAD-布局空白_布局1-布局1.pdf`
- Manifest: `build/plm_preview_acad_blank_layout_layout1/manifest.json`
- Viewer filter: `all`
- Viewer space: `model`
- Viewer capture: chrome
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
  - pdf_edges: 34017
  - viewer_edges: 19088
  - overlap: 2066
  - jaccard: 0.0405
- Aligned edge overlap (pixel count):
  - shift_dx: -8
  - shift_dy: -6
  - overlap_aligned: 7183
  - jaccard_aligned: 0.1237
- Notes:
  - DXF import succeeded; document.json only contains a frame polyline (no paper-space viewport metadata).


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/BTJ01239601522-03扭转弹簧v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_btj01239601522_layout/manifest.json`
- Viewer filter: `all`
- Viewer space: `paper`
- Paper viewport: on
- Layout filter: `布局1`
- Viewer capture: chrome
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
  - pdf_edges: 15768
  - viewer_edges: 13976
  - overlap: 1050
  - jaccard: 0.0366
- Aligned edge overlap (pixel count):
  - shift_dx: 51
  - shift_dy: -1
  - overlap_aligned: 1484
  - jaccard_aligned: 0.0525


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/BTJ01239601522-03扭转弹簧v1-布局2.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_btj01239601522_layout/manifest.json`
- Viewer filter: `all`
- Viewer space: `paper`
- Paper viewport: on
- Layout filter: `布局2`
- Viewer capture: chrome
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
  - pdf_edges: 6853
  - viewer_edges: 27719
  - overlap: 639
  - jaccard: 0.0188
- Aligned edge overlap (pixel count):
  - shift_dx: -4
  - shift_dy: -38
  - overlap_aligned: 1495
  - jaccard_aligned: 0.0506


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/BTJ01239601522-03扭转弹簧v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_btj01239601522_layout/manifest.json`
- Viewer filter: `text`
- Viewer space: `paper`
- Paper viewport: on
- Layout filter: `布局1`
- Viewer capture: chrome
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_text_title/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_text_title/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_text_title/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_text_title/viewer_text.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_text_title/viewer_text_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_text_title/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_text_title/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_text_title/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 90 degrees
- Edge overlap (pixel count):
  - pdf_edges: 768
  - viewer_edges: 6725
  - overlap: 114
  - jaccard: 0.0154
- Aligned edge overlap (pixel count):
  - shift_dx: -8
  - shift_dy: 13
  - overlap_aligned: 443
  - jaccard_aligned: 0.0628


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/BTJ01239601522-03扭转弹簧v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_btj01239601522_layout/manifest.json`
- Viewer filter: `dimension`
- Viewer space: `paper`
- Paper viewport: on
- Layout filter: `布局1`
- Viewer capture: chrome
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_dim_title/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_dim_title/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_dim_title/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_dim_title/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_dim_title/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_dim_title/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_dim_title/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_dim_title/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 90 degrees
- Edge overlap (pixel count):
  - pdf_edges: 768
  - viewer_edges: 6725
  - overlap: 114
  - jaccard: 0.0154
- Aligned edge overlap (pixel count):
  - shift_dx: -8
  - shift_dy: 13
  - overlap_aligned: 443
  - jaccard_aligned: 0.0628


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/BTJ01239601522-03扭转弹簧v1-布局2.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_btj01239601522_layout/manifest.json`
- Viewer filter: `text`
- Viewer space: `paper`
- Paper viewport: on
- Layout filter: `布局2`
- Viewer capture: chrome
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_text_title/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_text_title/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_text_title/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_text_title/viewer_text.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_text_title/viewer_text_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_text_title/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_text_title/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_text_title/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 766
  - viewer_edges: 3677
  - overlap: 249
  - jaccard: 0.0594
- Aligned edge overlap (pixel count):
  - shift_dx: 4
  - shift_dy: -76
  - overlap_aligned: 498
  - jaccard_aligned: 0.1169


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/BTJ01239601522-03扭转弹簧v1-布局2.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_btj01239601522_layout/manifest.json`
- Viewer filter: `dimension`
- Viewer space: `paper`
- Paper viewport: on
- Layout filter: `布局2`
- Viewer capture: chrome
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_dim_title/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_dim_title/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_dim_title/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_dim_title/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_dim_title/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_dim_title/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_dim_title/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_dim_title/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 766
  - viewer_edges: 3677
  - overlap: 249
  - jaccard: 0.0594
- Aligned edge overlap (pixel count):
  - shift_dx: 4
  - shift_dy: -76
  - overlap_aligned: 498
  - jaccard_aligned: 0.1169


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/BTJ01239601522-03扭转弹簧v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_btj01239601522_layout/manifest.json`
- Viewer filter: `text`
- Viewer space: `paper`
- Paper viewport: on
- Layout filter: `布局1`
- Viewer capture: chrome
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_text_full/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_text_full/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_text_full/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_text_full/viewer_text.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_text_full/viewer_text_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_text_full/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_text_full/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_text_full/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 270 degrees
- Edge overlap (pixel count):
  - pdf_edges: 15768
  - viewer_edges: 13976
  - overlap: 1050
  - jaccard: 0.0366
- Aligned edge overlap (pixel count):
  - shift_dx: 51
  - shift_dy: -1
  - overlap_aligned: 1484
  - jaccard_aligned: 0.0525


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/BTJ01239601522-03扭转弹簧v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_btj01239601522_layout/manifest.json`
- Viewer filter: `dimension`
- Viewer space: `paper`
- Paper viewport: on
- Layout filter: `布局1`
- Viewer capture: chrome
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_dim_full/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_dim_full/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_dim_full/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_dim_full/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_dim_full/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_dim_full/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_dim_full/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout1_dim_full/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 270 degrees
- Edge overlap (pixel count):
  - pdf_edges: 15768
  - viewer_edges: 13976
  - overlap: 1050
  - jaccard: 0.0366
- Aligned edge overlap (pixel count):
  - shift_dx: 51
  - shift_dy: -1
  - overlap_aligned: 1484
  - jaccard_aligned: 0.0525


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/BTJ01239601522-03扭转弹簧v1-布局2.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_btj01239601522_layout/manifest.json`
- Viewer filter: `text`
- Viewer space: `paper`
- Paper viewport: on
- Layout filter: `布局2`
- Viewer capture: chrome
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_text_full/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_text_full/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_text_full/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_text_full/viewer_text.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_text_full/viewer_text_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_text_full/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_text_full/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_text_full/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 6853
  - viewer_edges: 27719
  - overlap: 639
  - jaccard: 0.0188
- Aligned edge overlap (pixel count):
  - shift_dx: -4
  - shift_dy: -38
  - overlap_aligned: 1495
  - jaccard_aligned: 0.0506


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/BTJ01239601522-03扭转弹簧v1-布局2.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_btj01239601522_layout/manifest.json`
- Viewer filter: `dimension`
- Viewer space: `paper`
- Paper viewport: on
- Layout filter: `布局2`
- Viewer capture: chrome
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_dim_full/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_dim_full/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_dim_full/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_dim_full/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_dim_full/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_dim_full/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_dim_full/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/btj01239601522/layout2_dim_full/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 0 degrees
- Edge overlap (pixel count):
  - pdf_edges: 6853
  - viewer_edges: 27719
  - overlap: 639
  - jaccard: 0.0188
- Aligned edge overlap (pixel count):
  - shift_dx: -4
  - shift_dy: -38
  - overlap_aligned: 1495
  - jaccard_aligned: 0.0506
