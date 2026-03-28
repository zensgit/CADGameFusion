# STEP162 Paper Space Viewport Verification

- Playwright capture (synthetic viewport sample): `docs/assets/viewport_sample_paper.png`
- DXF used: `tests/plugin_data/viewport_sample.dxf` → `build/plm_preview_viewport_sample/manifest.json`
- Note: the LTJ layout PDF comparison below uses a DXF without VIEWPORT entities; overlap is limited to paper-space geometry.

Command:
```
npx playwright screenshot --viewport-size 1400,900 --wait-for-timeout 15000 \
  "http://127.0.0.1:8091/tools/web_viewer/index.html?manifest=build/plm_preview_viewport_sample/manifest.json&view=top&projection=ortho&grid=0&bg=black&ui=0&space=paper&paper_viewport=1&mesh=0&text_overlay=0" \
  docs/assets/viewport_sample_paper.png
```


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/文稿 - hua-MacBook Pro/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `build/plm_preview_dim_layout/manifest.json`
- Viewer filter: `all`
- Viewer space: `paper`
- Paper viewport: on
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


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/J0225034-05罐体部分v1-布局1.pdf`
- Manifest: `build/plm_preview_j0225034_v1/manifest.json`
- Viewer filter: `all`
- Viewer space: `paper`
- Paper viewport: on
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
  - pdf_edges: 38015
  - viewer_edges: 23225
  - overlap: 2461
  - jaccard: 0.0419
- Aligned edge overlap (pixel count):
  - shift_dx: -3
  - shift_dy: 61
  - overlap_aligned: 3160
  - jaccard_aligned: 0.0365
