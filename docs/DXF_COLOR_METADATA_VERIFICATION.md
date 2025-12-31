# DXF Color Metadata Verification

## Build
```
cmake --build build_vcpkg --target cadgf_dxf_importer_plugin test_dxf_importer_blocks
```

## Test
```
./build_vcpkg/tests/tools/test_dxf_importer_blocks \
  ./build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
  tests/plugin_data/importer_blocks.dxf
```

## Result
- PASS (exit code 0)
- `test_dxf_importer_blocks` now covers both document meta keys and C API getters.
