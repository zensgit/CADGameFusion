# PR-09 P1 JSON Export Verification

## Scope
- Emit JSON for Ellipse/Spline/Text entities in `convert_cli`.
- Provide a JSON importer sample to exercise P1 entities.

## Build
- `cmake --build build -j --target cadgf_json_importer_plugin convert_cli`

## Run
- `DYLD_LIBRARY_PATH=build/core:build/core_c:build/plugins ./build/tools/convert_cli --plugin ./build/plugins/libcadgf_json_importer_plugin.dylib --input tests/plugin_data/importer_sample_p1.json --out /tmp/cadgf_convert_p1 --json`

## Results
- `convert_cli` completed and wrote `/tmp/cadgf_convert_p1/document.json`.
- Output includes `ellipse`, `spline`, and `text` blocks with expected fields.
