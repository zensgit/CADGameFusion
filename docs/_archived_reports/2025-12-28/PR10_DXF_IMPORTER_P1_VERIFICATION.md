# PR-10 DXF Importer P1 Verification

## Scope
- Parse DXF ELLIPSE/SPLINE/TEXT/MTEXT entities.
- Import into Document entities and export via JSON.

## Build
- `cmake --build build -j --target cadgf_dxf_importer_plugin convert_cli`

## Run
- `DYLD_LIBRARY_PATH=build/core:build/core_c:build/plugins ./build/tools/convert_cli --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib --input tests/plugin_data/importer_sample.dxf --out /tmp/cadgf_dxf_p1 --json`

## Results
- `convert_cli` completed and wrote `/tmp/cadgf_dxf_p1/document.json`.
- Output includes `ellipse`, `spline`, and `text` blocks in addition to P0 entities.
