# PR-12 DXF Line Style Mapping Verification

## Scope
- Map DXF line style codes (6/48/370) to Document line style fields.
- Verify JSON output reflects imported line styles.

## Build
- `cmake --build build -j --target cadgf_dxf_importer_plugin convert_cli`

## Run
- `DYLD_LIBRARY_PATH=build/core:build/core_c:build/plugins ./build/tools/convert_cli --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib --input tests/plugin_data/importer_sample.dxf --out /tmp/cadgf_dxf_line_style --json`

## Results
- `/tmp/cadgf_dxf_line_style/document.json` includes `line_type`, `line_weight`, `line_type_scale` for LINE and ELLIPSE entities.
- Example weights mapped from DXF 370 (hundredths of mm): 25 -> 0.25, 18 -> 0.18.
