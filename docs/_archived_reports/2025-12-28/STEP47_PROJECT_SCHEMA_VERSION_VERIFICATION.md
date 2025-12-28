# Step 47: Project Schema Versioning - Verification

## Local Build
```bash
cmake --build build_vcpkg -j --target test_qt_project_roundtrip test_qt_project_legacy_load
```

## Tests
```bash
ctest --test-dir build_vcpkg -R qt_project_roundtrip_run -V
ctest --test-dir build_vcpkg -R qt_project_legacy_load_run -V
```

## Results
- `qt_project_roundtrip_run`: PASS
- `qt_project_legacy_load_run`: PASS
