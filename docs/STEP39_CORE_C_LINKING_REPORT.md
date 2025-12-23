# Step 39: core_c Linking Cleanup - Report

## Summary
- Made `core_c` expose `core` as a transitive dependency.
- Linked the Qt editor to `core_c` only to avoid explicit dual linking.
- Updated the CMake target split guidance.

## Files Updated
- `core/CMakeLists.txt`
- `editor/qt/CMakeLists.txt`
- `docs/CMAKE_TARGET_SPLIT_v0.6.md`
- `docs/STEP39_CORE_C_LINKING_DESIGN.md`
- `docs/STEP39_CORE_C_LINKING_REPORT.md`
- `docs/STEP39_CORE_C_LINKING_VERIFICATION.md`
- `docs/LOCAL_VERIFICATION_REPORT.md`

## Verification
- `cmake --build build_vcpkg -j --target editor_qt`
