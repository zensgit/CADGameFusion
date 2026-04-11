# DXF B5e Block Leaf Entity Emitters Verification

## Build

```bash
cmake -S . -B build-codex
cmake --build build-codex --target \
  cadgf_dxf_importer_plugin \
  test_dxf_importer_entities \
  test_dxf_text_metadata \
  test_dxf_mleader_metadata \
  test_dxf_table_metadata \
  test_dxf_dimension_geometry_metadata \
  test_dxf_paperspace_insert_leader \
  test_dxf_paperspace_insert_dimension_hatch \
  test_dxf_paperspace_annotation_bundle \
  test_dxf_text_alignment_partial \
  test_dxf_text_alignment_extended \
  test_dxf_importer_blocks \
  test_dxf_insert_attributes \
  test_dxf_viewport_layout_metadata \
  test_dxf_hatch_dash \
  test_dxf_hatch_dense_cap \
  test_dxf_hatch_large_boundary_budget \
  test_dxf_nonfinite_numbers \
  test_dxf_roundtrip \
  test_dxf_roundtrip_styles \
  test_dxf_exporter_plugin_smoke \
  test_dwg_importer_plugin \
  test_dwg_matrix -j8
```

## Tests

```bash
ctest --test-dir build-codex --output-on-failure \
  -R "dxf|dwg" \
  -E "(convert_cli_dxf_style_smoke|test_dxf_leader_metadata_run|test_dxf_multi_layout_metadata_run|test_dxf_paperspace_insert_styles_run|test_dxf_paperspace_insert_dimension_run|test_dxf_paperspace_combo_run)"
```

## Hygiene

```bash
git diff --check
```
