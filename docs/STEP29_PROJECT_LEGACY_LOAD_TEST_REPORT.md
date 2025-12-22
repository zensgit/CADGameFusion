# Step 29: Project Legacy Load Test — Report

## Summary
- Added a Qt test to verify legacy (v0.2) project load metadata parsing.
- Registered the test in CTest.

## Scope
1. **Legacy load test** (`tests/qt/test_qt_project_legacy_load.cpp`)
   - Asserts visibility/groupId/color parsing from legacy polylines.
2. **CTest registration** (`tests/qt/CMakeLists.txt`)
   - Adds `qt_project_legacy_load_run`.

## Files Updated
- `tests/qt/test_qt_project_legacy_load.cpp`
- `tests/qt/CMakeLists.txt`
- `docs/STEP29_PROJECT_LEGACY_LOAD_TEST_DESIGN.md`
- `docs/STEP29_PROJECT_LEGACY_LOAD_TEST_VERIFICATION.md`
- `docs/LOCAL_VERIFICATION_REPORT.md`

## Verification
Commands executed:
1. `cmake --build build_vcpkg -j --target test_qt_project_legacy_load`
2. `ctest --test-dir build_vcpkg -R qt_project_legacy_load_run -V`
3. `ctest --test-dir build_vcpkg -V`

Result: PASS.
