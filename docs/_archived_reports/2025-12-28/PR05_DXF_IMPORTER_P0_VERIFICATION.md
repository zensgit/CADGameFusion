# PR-05 DXF Importer P0 Verification

## Scope
- Parse DXF LWPOLYLINE/LINE/ARC/CIRCLE entities.
- Import into Document entities and export via JSON.

## Build
- `cmake --build build -j --target cadgf_dxf_importer_plugin convert_cli`

## Run
- `DYLD_LIBRARY_PATH=build/core:build/core_c:build/plugins ./build/tools/convert_cli --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib --input tests/plugin_data/importer_sample.dxf --out /tmp/cadgf_dxf --json`

## Results
- `convert_cli` completed: `tests/plugin_data/importer_sample.dxf -> /tmp/cadgf_dxf`.
- `/tmp/cadgf_dxf/document.json` contains:
  - polyline entity with closed loop
  - line entity with endpoints
  - circle entity with center + radius
  - arc entity with radians (a0=0, a1=1.570796) and `cw=0`
