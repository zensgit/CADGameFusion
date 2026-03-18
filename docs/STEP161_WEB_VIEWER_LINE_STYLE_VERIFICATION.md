# STEP161 Web Viewer Line Style - Verification

## Manual check
1. Regenerate preview artifacts so `mesh_metadata.json` includes `line_entities`.
2. Open the viewer with these parameters:
   ```text
   http://127.0.0.1:8080/tools/web_viewer/index.html?manifest=build/plm_preview_dim/manifest.json&view=top&projection=ortho&bg=black&grid=0&ui=0
   ```
3. Confirm that dashed/center/hidden lines render with gaps.
4. Confirm line weight differences are visible (thicker lines appear bolder).

## Automated comparison
Use the PDF comparison script to validate layout alignment and line fidelity:
```bash
scripts/compare_autocad_pdf.py --pdf "/path/to/layout.pdf"
```

## Hatch dash sample
Added `tests/plugin_data/hatch_dash_sample.dxf` with an ANSI31 hatch pattern that
includes dash/gap entries (group code 49). Verified that hatch lines are emitted
as `LINE` entities.

```bash
./build/tools/convert_cli --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input tests/plugin_data/hatch_dash_sample.dxf --out build/hatch_dash_sample --json --gltf
python3 - <<'PY'
import json
with open('build/hatch_dash_sample/mesh_metadata.json','r',encoding='utf-8') as f:
    data=json.load(f)
print('line_entities', len(data.get('line_entities',[])))
print('line_segments', sum(e.get('index_count',0)//2 for e in data.get('line_entities',[])))
PY
```

Result (local):
- line_entities: 25
- line_segments: 28

## Hatch dense cap sample
Added `tests/plugin_data/hatch_dense_sample.dxf` with extremely small hatch spacing (pattern offset_y=0.0002) to
exercise the hatch density guardrails (stride/budget). Verified that:
- Import completes without hangs.
- Emitted hatch pattern `LINE` entities are capped near `dxf.hatch_pattern_ksteps_limit`.
- `document.json` contains attribution meta keys (clamped=1).

```bash
./build/tools/convert_cli --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input tests/plugin_data/hatch_dense_sample.dxf --out build/hatch_dense_sample --json --gltf
python3 - <<'PY'
import json
with open('build/hatch_dense_sample/document.json','r',encoding='utf-8') as f:
    doc=json.load(f)
meta=(doc.get('metadata') or {}).get('meta') or {}
print('meta.dxf.hatch_pattern_clamped', meta.get('dxf.hatch_pattern_clamped'))
print('meta.dxf.hatch_pattern_ksteps_limit', meta.get('dxf.hatch_pattern_ksteps_limit'))
print('meta.dxf.hatch_pattern_emitted_lines', meta.get('dxf.hatch_pattern_emitted_lines'))
PY
```

Result (local):
- meta.dxf.hatch_pattern_clamped: 1
- meta.dxf.hatch_pattern_ksteps_limit: 5000
- meta.dxf.hatch_pattern_emitted_lines: 4760
- meta.dxf.hatch_pattern_clamped_hatches: 1
- meta.dxf.hatch_pattern_stride_max: 21

## Hatch large boundary budget sample
Added `tests/plugin_data/hatch_large_boundary_budget_sample.dxf` with a large hatch boundary (3000 vertices) and moderate
spacing (offset_y=0.05) to exercise the **compute budget** guardrail (edge-check limit). Verified that:
- Import completes without hangs.
- Hatch pattern generation early-stops when the edge-check budget is exhausted.
- `document.json` contains attribution meta keys (edge budget exhausted + edge_checks capped).

```bash
./build/tools/convert_cli --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input tests/plugin_data/hatch_large_boundary_budget_sample.dxf --out build/hatch_large_boundary_budget_sample --json --gltf
python3 - <<'PY'
import json
with open('build/hatch_large_boundary_budget_sample/document.json','r',encoding='utf-8') as f:
    doc=json.load(f)
meta=(doc.get('metadata') or {}).get('meta') or {}
for k in [
  'dxf.hatch_pattern_clamped',
  'dxf.hatch_pattern_emitted_lines',
  'dxf.hatch_pattern_edge_checks',
  'dxf.hatch_pattern_edge_budget_exhausted_hatches',
  'dxf.hatch_pattern_boundary_points_max',
  'dxf.hatch_pattern_boundary_points_limit',
]:
    print(k, meta.get(k))
PY
```

Result (local):
- dxf.hatch_pattern_clamped: 1
- dxf.hatch_pattern_emitted_lines: 3328
- dxf.hatch_pattern_edge_checks: 10000000
- dxf.hatch_pattern_edge_budget_exhausted_hatches: 1
- dxf.hatch_pattern_boundary_points_max: 3000
- dxf.hatch_pattern_boundary_points_limit: 20000

## Status
- Implemented line style rendering in viewer (LineSegments2 + dash patterns + line weights).
- Added DXF hatch pattern line emission (ANSI31) so hatch linework appears in `line_entities`.
- Added support for hatch pattern dash/gap sequences (code 49). The LTJ file uses continuous ANSI31; the dedicated hatch dash sample above exercises the dash/gap path.
- Scaled hatch pattern definitions by `$LTSCALE * $CELTSCALE` to better match AutoCAD hatch density (aligned jaccard improved to 0.0975 on LTJ layout).
- Increased arc/ellipse sampling density for hatch clipping; LTJ layout metric unchanged (aligned jaccard still 0.0975).
- Pending: fine-tune dash/weight mapping based on PDF overlap.


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
  - viewer_edges: 117824
  - overlap: 4581
  - jaccard: 0.0201
- Aligned edge overlap (pixel count):
  - shift_dx: -79
  - shift_dy: -74
  - overlap_aligned: 11637
  - jaccard_aligned: 0.0429


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
  - pdf_edges: 112381
  - viewer_edges: 81535
  - overlap: 8607
  - jaccard: 0.0464
- Aligned edge overlap (pixel count):
  - shift_dx: -24
  - shift_dy: 12
  - overlap_aligned: 18654
  - jaccard_aligned: 0.0867


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
  - pdf_edges: 112381
  - viewer_edges: 67502
  - overlap: 6037
  - jaccard: 0.0347
- Aligned edge overlap (pixel count):
  - shift_dx: -26
  - shift_dy: -28
  - overlap_aligned: 17134
  - jaccard_aligned: 0.0903


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
  - pdf_edges: 66705
  - viewer_edges: 31699
  - overlap: 5597
  - jaccard: 0.0603
- Aligned edge overlap (pixel count):
  - shift_dx: -24
  - shift_dy: 3
  - overlap_aligned: 7329
  - jaccard_aligned: 0.0658


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
  - pdf_edges: 112381
  - viewer_edges: 21745
  - overlap: 4053
  - jaccard: 0.0312
- Aligned edge overlap (pixel count):
  - shift_dx: 5
  - shift_dy: -23
  - overlap_aligned: 6390
  - jaccard_aligned: 0.0489


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
  - pdf_edges: 112381
  - viewer_edges: 67502
  - overlap: 6037
  - jaccard: 0.0347
- Aligned edge overlap (pixel count):
  - shift_dx: -26
  - shift_dy: -28
  - overlap_aligned: 17134
  - jaccard_aligned: 0.0903


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
  - pdf_edges: 112381
  - viewer_edges: 96336
  - overlap: 10126
  - jaccard: 0.0510
- Aligned edge overlap (pixel count):
  - shift_dx: -54
  - shift_dy: -25
  - overlap_aligned: 19159
  - jaccard_aligned: 0.0833


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
  - pdf_edges: 112381
  - viewer_edges: 101417
  - overlap: 11800
  - jaccard: 0.0584
- Aligned edge overlap (pixel count):
  - shift_dx: -22
  - shift_dy: 25
  - overlap_aligned: 20078
  - jaccard_aligned: 0.0870


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Edge component filter: min_size=50
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
  - pdf_edges: 110578
  - viewer_edges: 61813
  - overlap: 4890
  - jaccard: 0.0292
- Aligned edge overlap (pixel count):
  - shift_dx: -44
  - shift_dy: -28
  - overlap_aligned: 16158
  - jaccard_aligned: 0.0883


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Edge component filter: min_size=100
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
  - pdf_edges: 108525
  - viewer_edges: 59094
  - overlap: 4421
  - jaccard: 0.0271
- Aligned edge overlap (pixel count):
  - shift_dx: -44
  - shift_dy: -28
  - overlap_aligned: 15882
  - jaccard_aligned: 0.0899


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Edge component filter: min_size=200
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
  - pdf_edges: 104157
  - viewer_edges: 56499
  - overlap: 3759
  - jaccard: 0.0240
- Aligned edge overlap (pixel count):
  - shift_dx: -44
  - shift_dy: -28
  - overlap_aligned: 15444
  - jaccard_aligned: 0.0912


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Edge component filter: min_size=400
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
  - pdf_edges: 93281
  - viewer_edges: 115698
  - overlap: 6715
  - jaccard: 0.0332
- Aligned edge overlap (pixel count):
  - shift_dx: -11
  - shift_dy: -20
  - overlap_aligned: 9995
  - jaccard_aligned: 0.0502


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_preview_dim/manifest.json`
- Viewer filter: `all`
- Edge component filter: min_size=800
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
  - pdf_edges: 75125
  - viewer_edges: 74082
  - overlap: 2328
  - jaccard: 0.0158
- Aligned edge overlap (pixel count):
  - shift_dx: -1
  - shift_dy: -40
  - overlap_aligned: 6350
  - jaccard_aligned: 0.0445


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `build/plm_preview_dim_hatch/manifest.json`
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
  - viewer_edges: 71067
  - overlap: 7236
  - jaccard: 0.0411
- Aligned edge overlap (pixel count):
  - shift_dx: -26
  - shift_dy: -28
  - overlap_aligned: 18097
  - jaccard_aligned: 0.0930


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `build/plm_preview_dim_hatch_dash/manifest.json`
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
  - viewer_edges: 71067
  - overlap: 7236
  - jaccard: 0.0411
- Aligned edge overlap (pixel count):
  - shift_dx: -26
  - shift_dy: -28
  - overlap_aligned: 18097
  - jaccard_aligned: 0.0930


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `build/plm_preview_dim_hatch_scaled/manifest.json`
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
  - viewer_edges: 76055
  - overlap: 9279
  - jaccard: 0.0518
- Aligned edge overlap (pixel count):
  - shift_dx: -44
  - shift_dy: -28
  - overlap_aligned: 19652
  - jaccard_aligned: 0.0975


## AutoCAD PDF comparison
- PDF: `/Users/huazhou/Documents/LTJ012306102-0084调节螺栓v1-布局1.pdf`
- Manifest: `build/plm_preview_dim_hatch_scaled_dense/manifest.json`
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
  - viewer_edges: 76055
  - overlap: 9279
  - jaccard: 0.0518
- Aligned edge overlap (pixel count):
  - shift_dx: -44
  - shift_dy: -28
  - overlap_aligned: 19652
  - jaccard_aligned: 0.0975


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
  - viewer_edges: 76055
  - overlap: 9279
  - jaccard: 0.0518
- Aligned edge overlap (pixel count):
  - shift_dx: -44
  - shift_dy: -28
  - overlap_aligned: 19652
  - jaccard_aligned: 0.0975
