# DXF Block Style Precedence Verification

## Scope
- Validate line style + color + line type scale precedence for BYBLOCK, BYLAYER, and explicit entity styles.
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
  - `LayerBlock` -> line type `CENTER`, line weight `0.5`, scale `0.25`, color `0xFF0000`.
  - `LayerNestedInsert` -> line type `DASHED`, line weight `0.2`, scale `0.75`, color `0x00FF00`.
- BYBLOCK with missing INSERT style falls back to layer styles:
  - `LayerByblockNoInsert` -> line type `DASHDOT`, line weight `0.7`, scale `1.5`, color `0xFFFF00`.
- BYLAYER resolves to layer styles (INSERT style ignored):
  - `LayerBylayer` -> line type `CENTER2`, line weight `0.25`, scale `0.6`, color `0x00FFFF`.
- LWPOLYLINE BYBLOCK uses INSERT style:
  - `LayerPolyByblock` -> line type `PHANTOM`, line weight `0.9`, scale `0.4`, color `0xFF00FF`.
- ARC BYLAYER uses layer styles:
  - `LayerArcBylayer` -> line type `PHANTOM2`, line weight `0.6`, scale `0.9`, color `0xC0C0C0`.
- TEXT BYBLOCK uses INSERT style:
  - `LayerTextByblock` -> line type `DASHDOTX`, line weight `0.3`, scale `2.2`, color `0xFF0000`.
- SPLINE BYLAYER uses layer styles:
  - `LayerSplineBylayer` -> line type `CENTERX`, line weight `0.45`, scale `0.8`, color `0xFFFFFF`.
- Missing layer entry falls back to defaults:
  - `LayerMissing` -> line type empty, line weight `0.0`, scale `0.0`, color `0x0`.
- Layer 0 inherits its layer style:
  - `0` -> line type `HIDDEN2`, line weight `0.55`, scale `1.7`, color `0x808080`.
- Explicit entity styles override both INSERT and layer:
  - `LayerExplicit` -> line type `HIDDEN`, line weight `0.8`, scale `2.5`, color `0x0000FF`.

## Status
- PASS (manual).
- Notes: Executed in `build_vcpkg` after adding layer table + style precedence coverage.
