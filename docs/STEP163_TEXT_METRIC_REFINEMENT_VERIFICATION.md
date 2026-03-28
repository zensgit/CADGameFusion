# STEP163 Text Metric Refinement Verification

- Playwright-based comparison using model PDF to validate width factor/default height handling.

Command:
```
python3 scripts/compare_autocad_pdf.py \
  --playwright --ui 1 --text-overlay 1 --text-style clean --line-overlay 0 \
  --filter dimension --space model --paper-viewport 0 \
  --pdf "/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-模型.pdf" \
  --manifest build/plm_preview_dim_layout/manifest.json \
  --report docs/STEP163_TEXT_METRIC_REFINEMENT_VERIFICATION.md
```

Metadata test:
```
cmake --build build -j --target test_dxf_text_metadata
DYLD_LIBRARY_PATH=build/core:build/core_c:$DYLD_LIBRARY_PATH \
  build/tests/tools/test_dxf_text_metadata \
  build/plugins/libcadgf_dxf_importer_plugin.dylib \
  tests/plugin_data/importer_text_metadata.dxf
```


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-模型.pdf`
- Manifest: `build/plm_preview_dim_layout/manifest.json`
- Viewer filter: `dimension`
- Viewer space: `model`
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
  - viewer_edges: 27827
  - overlap: 658
  - jaccard: 0.0133
- Aligned edge overlap (pixel count):
  - shift_dx: -7
  - shift_dy: 62
  - overlap_aligned: 1459
  - jaccard_aligned: 0.0301
