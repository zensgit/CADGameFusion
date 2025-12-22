# Step 27: C API Metadata Setters Coverage — Report

## Summary
- Added coverage for layer metadata setters and entity metadata setters in the C API test.
- Verified updates via existing C API query functions.

## Scope
1. **C API test expansion** (`tests/core/test_c_api_document_query.cpp`)
   - Layer setters: visible/locked/color.
   - Entity setters: visible/color/group.

## Files Updated
- `tests/core/test_c_api_document_query.cpp`
- `docs/STEP27_C_API_METADATA_SETTERS_DESIGN.md`
- `docs/STEP27_C_API_METADATA_SETTERS_VERIFICATION.md`
- `docs/LOCAL_VERIFICATION_REPORT.md`

## Verification
Commands executed:
1. `cmake --build build_vcpkg -j --target core_tests_c_api_document_query`
2. `ctest --test-dir build_vcpkg -R core_tests_c_api_document_query -V`
3. `ctest --test-dir build_vcpkg -V`

Result: PASS.
