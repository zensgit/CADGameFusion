## DXF B3h Verification

Run from the repository root.

### Configure
`cmake -S . -B build-codex`

### Build
Build:
- `cadgf_dxf_importer_plugin`

### Test
Run:

`ctest --test-dir build-codex --output-on-failure -R "dxf|dwg" -E "(convert_cli_dxf_style_smoke|test_dxf_leader_metadata_run|test_dxf_multi_layout_metadata_run|test_dxf_paperspace_insert_styles_run|test_dxf_paperspace_insert_dimension_run|test_dxf_paperspace_combo_run)"`

### Acceptance
- `cadgf_dxf_importer_plugin` builds
- runnable DXF/DWG subset passes
- no widened failure surface versus current `main`
- `git diff --check` is clean
