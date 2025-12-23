# Step 39: core_c Linking Cleanup - Design

## Goal
- Avoid explicit dual linking to `core` and `core_c` in the editor.
- Keep `core_c` as the thin C ABI wrapper that pulls `core` as a dependency.

## Changes
1. Link `core_c` to `core` as a PUBLIC dependency so downstream targets inherit it.
2. Update the Qt editor to link `core_c` only.
3. Clarify target usage in the v0.6 CMake target split note.

## Files
- `core/CMakeLists.txt`
- `editor/qt/CMakeLists.txt`
- `docs/CMAKE_TARGET_SPLIT_v0.6.md`
