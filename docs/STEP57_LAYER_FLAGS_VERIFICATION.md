# Step 57: Layer Flags - Verification

## Build
```bash
cmake --build build_vcpkg -j
```

## Tests
```bash
ctest --test-dir build_vcpkg -R core_tests_document_layers -V
ctest --test-dir build_vcpkg -R core_tests_c_api_document_query -V
```

## Results
- `core_tests_document_layers`: PASS
- `core_tests_c_api_document_query`: PASS
