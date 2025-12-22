# Step 23: Document Notify Guards Tests — Verification

## Commands Executed
1. `cmake --build build_vcpkg -j --target core_tests_document_notifications`
2. `ctest --test-dir build_vcpkg -R core_tests_document_notifications -V`
3. `ctest --test-dir build_vcpkg -V`

## Result
- PASS
