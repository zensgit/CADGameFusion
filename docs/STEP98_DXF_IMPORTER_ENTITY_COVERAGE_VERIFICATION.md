# DXF Importer Entity Coverage Verification

## Scope
- Build DXF importer plugin via CMake.
- Ensure DXF entities import into Document with expected types, layers, and styles.

## Steps
1. Build the plugin and test target:
   ```
   cmake --build build_vcpkg --target cadgf_dxf_importer_plugin test_dxf_importer_entities
   ```
2. Run the test directly:
   ```
   ./build_vcpkg/tests/tools/test_dxf_importer_entities \
     ./build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
     tests/plugin_data/importer_entities.dxf
   ```

## Expected
- 7 entities imported (polyline, line, circle, arc, ellipse, spline, text).
- Line style fields populated for the LINE entity.
- LINE entity color set to `0xFF0000`.
- BYLAYER style applied to SPLINE (line type `DASHED`, weight `0.25`, scale `1.25`).
- Layers `LayerA`, `LayerB`, `LayerC`, `LayerD`, `LayerText` present.
- Layer properties from TABLES/LAYER applied:
  - `LayerA`: printable = 0, color = `0x00FFFF`.
  - `LayerB`: locked = 1, color = `0xFFFF00`.
  - `LayerC`: frozen = 1, visible = 0, color = `0x00FF00`.

## Status
- PASS (manual).
- Notes: Re-ran after BYLAYER style fallback; build + test executed in `build_vcpkg`.
