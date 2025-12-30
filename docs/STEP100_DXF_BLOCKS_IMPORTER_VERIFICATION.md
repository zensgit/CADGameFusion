# DXF Importer Blocks Verification

## Scope
- Parse BLOCKS + INSERT for minimal block flattening.
- Ensure inserts produce transformed entities with correct layers.

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
- 8 entities imported from INSERTs (5 LINE + 1 CIRCLE + 1 LWPOLYLINE + 1 ARC).
- LINE transformed to (5,5)->(5,9) on `LayerBlock`.
- Nested LINE transformed to (5,9)->(5,11) on `LayerNestedInsert`.
- CIRCLE transformed to center (3,7), radius 1.0 on `LayerInsert`.
- BYBLOCK styles applied:
  - LINE uses `CENTER` line type, color `0xFF0000`, line weight `0.5`.
  - Nested LINE uses `DASHED` line type, color `0x00FF00`, line weight `0.2`.
- Style precedence coverage:
  - BYBLOCK w/ missing INSERT style falls back to layer: `LayerByblockNoInsert` -> `DASHDOT`, `0.7`, color `0xFFFF00`.
  - BYLAYER resolves to layer style: `LayerBylayer` -> `CENTER2`, `0.25`, color `0x00FFFF`.
  - Explicit entity style overrides INSERT+layer: `LayerExplicit` -> `HIDDEN`, `0.8`, color `0x0000FF`.
  - LWPOLYLINE BYBLOCK uses INSERT style: `LayerPolyByblock` -> `PHANTOM`, `0.9`, color `0xFF00FF`.
  - ARC BYLAYER uses layer style: `LayerArcBylayer` -> `PHANTOM2`, `0.6`, color `0xC0C0C0`.
- Group IDs:
  - LINE and CIRCLE share the same group id.
  - Nested LINE has a different group id.

## Status
- PASS (manual).
- Notes: Build + test executed in `build_vcpkg` after adding nested BLOCKS/INSERT flattening.
