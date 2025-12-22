# Step 27: C API Metadata Setters Coverage — Verification

## Commands Executed
1. `cmake --build build_vcpkg -j --target core_tests_c_api_document_query`
2. `ctest --test-dir build_vcpkg -R core_tests_c_api_document_query -V`
3. `ctest --test-dir build_vcpkg -V`

## Result
- PASS
