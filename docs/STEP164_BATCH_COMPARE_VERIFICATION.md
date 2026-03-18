# Batch AutoCAD PDF Comparison

- Cases file: `docs/STEP164_BATCH_COMPARE_CASES.json`
- Note: the layout case uses a DXF without VIEWPORT entities; overlap is limited to paper-space geometry.


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `build/plm_preview_dim_layout/manifest.json`
- Viewer filter: `dimension`
- Viewer space: `model`
- Viewer capture: playwright
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/batch/ltj012306102_0084_model_dimension/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/batch/ltj012306102_0084_model_dimension/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/batch/ltj012306102_0084_model_dimension/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/batch/ltj012306102_0084_model_dimension/viewer_dimension.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/batch/ltj012306102_0084_model_dimension/viewer_dimension_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/batch/ltj012306102_0084_model_dimension/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/batch/ltj012306102_0084_model_dimension/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/batch/ltj012306102_0084_model_dimension/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 270 degrees
- Edge overlap (pixel count):
  - pdf_edges: 22143
  - viewer_edges: 27839
  - overlap: 564
  - jaccard: 0.0114
- Aligned edge overlap (pixel count):
  - shift_dx: -8
  - shift_dy: 62
  - overlap_aligned: 1463
  - jaccard_aligned: 0.0302


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `build/plm_preview_dim_layout/manifest.json`
- Viewer filter: `all`
- Viewer space: `paper`
- Paper viewport: on
- Viewer capture: playwright
- Artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/batch/ltj012306102_0084_layout_all/autocad_model.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/batch/ltj012306102_0084_layout_all/autocad_model_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/batch/ltj012306102_0084_layout_all/autocad_model_rotated.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/batch/ltj012306102_0084_layout_all/viewer_all.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/batch/ltj012306102_0084_layout_all/viewer_all_crop.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/batch/ltj012306102_0084_layout_all/autocad_vs_viewer_side_by_side.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/batch/ltj012306102_0084_layout_all/autocad_vs_viewer_edge_overlay.png`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/assets/batch/ltj012306102_0084_layout_all/autocad_vs_viewer_edge_overlay_aligned.png`
- Rotation picked: 270 degrees
- Edge overlap (pixel count):
  - pdf_edges: 112381
  - viewer_edges: 43958
  - overlap: 4648
  - jaccard: 0.0306
- Aligned edge overlap (pixel count):
  - shift_dx: 42
  - shift_dy: 0
  - overlap_aligned: 5907
  - jaccard_aligned: 0.0393


## Batch Summary
| Case | Filter | Space | Layout | Jaccard | Jaccard Aligned | Shift dx | Shift dy | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LTJ012306102-0084-model | dimension | model | - | 0.0114 | 0.0302 | -8 | 62 | ok |
| LTJ012306102-0084-layout | all | paper | - | 0.0306 | 0.0393 | 42 | 0 | ok |
