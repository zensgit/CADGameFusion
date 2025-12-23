# Step 30: Document Layer Behavior Test — Verification

## Commands Executed
1. `cmake --build build_vcpkg -j --target core_tests_document_layers`
2. `ctest --test-dir build_vcpkg -R core_tests_document_layers -V`

## Result
- PASS
