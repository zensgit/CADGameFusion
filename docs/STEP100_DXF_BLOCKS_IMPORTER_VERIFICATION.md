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
- 3 entities imported from the INSERT (LINE + nested LINE + CIRCLE).
- LINE transformed to (5,5)->(5,9) on `LayerBlock`.
- Nested LINE transformed to (5,9)->(5,11) on `LayerNestedInsert`.
- CIRCLE transformed to center (3,7), radius 1.0 on `LayerInsert`.
- BYBLOCK styles applied:
  - LINE uses `CENTER` line type and color `0xFF0000`.
  - Nested LINE uses `DASHED` line type and color `0x00FF00`.
- Group IDs:
  - LINE and CIRCLE share the same group id.
  - Nested LINE has a different group id.

## Status
- PASS (manual).
- Notes: Build + test executed in `build_vcpkg` after adding nested BLOCKS/INSERT flattening.
