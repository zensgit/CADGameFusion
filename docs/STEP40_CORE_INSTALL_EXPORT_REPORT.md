# Step 40: Core Install/Export Targets - Report

## Summary
- Added `core_headers` interface target and wired it into `core`.
- Installed/exported `core`, `core_c`, and `core_headers` with headers.
- Added `CADGameFusionConfig.cmake` for package config.

## Files Updated
- `core/CMakeLists.txt`
- `CMakeLists.txt`
- `cmake/CADGameFusionConfig.cmake.in`
- `docs/CMAKE_TARGET_SPLIT_v0.6.md`
- `docs/STEP40_CORE_INSTALL_EXPORT_DESIGN.md`
- `docs/STEP40_CORE_INSTALL_EXPORT_REPORT.md`
- `docs/STEP40_CORE_INSTALL_EXPORT_VERIFICATION.md`
- `docs/LOCAL_VERIFICATION_REPORT.md`

## Verification
- `cmake --build build_vcpkg -j --target core_c`
- `cmake --install build_vcpkg --prefix build_vcpkg/install`
