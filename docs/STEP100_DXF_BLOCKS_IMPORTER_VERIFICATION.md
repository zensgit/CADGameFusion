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
- 2 entities imported from the INSERT (LINE + CIRCLE).
- LINE transformed to (5,5)->(5,9) on `LayerBlock`.
- CIRCLE transformed to center (3,7), radius 1.0 on `LayerInsert`.

## Status
- PASS (manual).
- Notes: Build + test executed in `build_vcpkg` after adding BLOCKS/INSERT flattening.
