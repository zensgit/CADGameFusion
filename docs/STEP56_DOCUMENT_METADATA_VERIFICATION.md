# Step 56: Document Metadata - Verification

## Build
```bash
cmake --build build_vcpkg -j
```

## Tests
```bash
ctest --test-dir build_vcpkg -R core_tests_document_metadata -V
ctest --test-dir build_vcpkg -R core_tests_c_api_document_query -V
```

## Results
- `core_tests_document_metadata`: PASS
- `core_tests_c_api_document_query`: PASS
