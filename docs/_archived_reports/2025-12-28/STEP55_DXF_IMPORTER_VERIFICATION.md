# Step 55: DXF Importer Plugin - Verification

## Local Build
```bash
cmake --build build_vcpkg -j --target cadgf_dxf_importer_plugin plugin_import_demo
```

## Tests
```bash
ctest --test-dir build_vcpkg -R plugin_import_demo_dxf_run -V
```

## Results
- `plugin_import_demo_dxf_run`: PASS
