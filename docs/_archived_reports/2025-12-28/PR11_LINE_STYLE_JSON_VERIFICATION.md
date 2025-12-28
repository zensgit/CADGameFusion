# PR-11 Line Style JSON Verification

## Scope
- Emit `line_type`, `line_weight`, `line_type_scale` in JSON when set.
- Read line style fields via JSON importer and apply to entities.

## Build
- `cmake --build build -j --target cadgf_json_importer_plugin convert_cli`

## Run
- `DYLD_LIBRARY_PATH=build/core:build/core_c:build/plugins ./build/tools/convert_cli --plugin ./build/plugins/libcadgf_json_importer_plugin.dylib --input tests/plugin_data/importer_sample_p1.json --out /tmp/cadgf_convert_line_style --json`

## Results
- Output `/tmp/cadgf_convert_line_style/document.json` includes line style fields on entities with non-default values.
