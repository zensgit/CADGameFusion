# Step 13: Polyline Update API — Report

## Summary
- Added a Document API to update polyline geometry in-place.
- Exposed the new capability in the stable C API.
- Extended core tests to verify geometry updates end-to-end.

## Scope
1. **Document API** (`core/include/core/document.hpp`, `core/src/document.cpp`)
   - New `set_polyline_points()` method for in-place geometry updates.
2. **C API wrappers** (`core/include/core/core_c_api.h`, `core/src/core_c_api.cpp`)
   - New `core_document_set_polyline_points()` / `cadgf_document_set_polyline_points()` exports.
3. **Tests** (`tests/core/test_document_entities.cpp`, `tests/core/test_c_api_document_query.cpp`)
   - Validate round-trip updates via C++ and C API.

## Files Updated
- `core/include/core/document.hpp`
- `core/src/document.cpp`
- `core/include/core/core_c_api.h`
- `core/src/core_c_api.cpp`
- `tests/core/test_document_entities.cpp`
- `tests/core/test_c_api_document_query.cpp`
- `docs/STEP13_POLYLINE_UPDATE_API_DESIGN.md`
- `docs/STEP13_POLYLINE_UPDATE_API_VERIFICATION.md`

## Verification
Commands executed:
1. `cmake --build build_vcpkg -j --target core_tests_document_entities core_tests_c_api_document_query test_qt_canvas_box_select`
2. `ctest --test-dir build_vcpkg -R core_tests_document_entities -V`
3. `ctest --test-dir build_vcpkg -R core_tests_c_api_document_query -V`

Result: PASS (Document + C API update tests).
