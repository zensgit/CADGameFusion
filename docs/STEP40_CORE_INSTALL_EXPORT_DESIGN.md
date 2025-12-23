# Step 40: Core Install/Export Targets - Design

## Goal
- Provide install/export targets for `core` and `core_c`.
- Add a `core_headers` interface target for public includes.
- Enable `find_package(CADGameFusion CONFIG)` with exported targets.

## Changes
1. Add `core_headers` interface target and link it from `core`.
2. Install/export `core`, `core_c`, and `core_headers` targets plus headers.
3. Add `CADGameFusionConfig.cmake` for package config.

## Files
- `core/CMakeLists.txt`
- `CMakeLists.txt`
- `cmake/CADGameFusionConfig.cmake.in`
- `docs/CMAKE_TARGET_SPLIT_v0.6.md`
