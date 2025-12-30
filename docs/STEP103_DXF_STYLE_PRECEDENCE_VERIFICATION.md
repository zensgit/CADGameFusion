# DXF Block Style Precedence Verification

## Scope
- Validate line style precedence for BYBLOCK, BYLAYER, and explicit entity styles.
- Ensure INSERT styles override layer styles when BYBLOCK is used.

## Steps
1. Build the plugin and block test target:
   ```
   cmake --build build_vcpkg --target cadgf_dxf_importer_plugin test_dxf_importer_blocks
   ```
2. Run the block test directly:
   ```
   ./build_vcpkg/tests/tools/test_dxf_importer_blocks \
     ./build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
     tests/plugin_data/importer_blocks.dxf
   ```

## Expected
- BYBLOCK + INSERT style wins over layer styles:
  - `LayerBlock` -> line type `CENTER`, line weight `0.5`.
  - `LayerNestedInsert` -> line type `DASHED`, line weight `0.2`.
- BYBLOCK with missing INSERT style falls back to layer styles:
  - `LayerByblockNoInsert` -> line type `DASHDOT`, line weight `0.7`.
- BYLAYER resolves to layer styles (INSERT style ignored):
  - `LayerBylayer` -> line type `CENTER2`, line weight `0.25`.
- Explicit entity styles override both INSERT and layer:
  - `LayerExplicit` -> line type `HIDDEN`, line weight `0.8`.

## Status
- PASS (manual).
- Notes: Executed in `build_vcpkg` after adding layer table + style precedence coverage.
