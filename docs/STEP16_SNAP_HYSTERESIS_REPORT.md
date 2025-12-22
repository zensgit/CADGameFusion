# Step 16: Snap Hysteresis for Move — Report

## Summary
- Dragging now locks to a snap target and releases only after exceeding a threshold.
- This reduces jitter during move while preserving snap accuracy.

## Scope
1. **Move snap lock** (`editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`)
   - Added lock state fields for snap target during drag.
   - Added `moveTargetWorldWithSnap()` for lock + release threshold logic.
2. **Threshold behavior** (`editor/qt/src/canvas.cpp`)
   - Release radius uses `snapRadiusPixels * 1.5` (world-space).

## Files Updated
- `editor/qt/src/canvas.hpp`
- `editor/qt/src/canvas.cpp`
- `docs/STEP16_SNAP_HYSTERESIS_DESIGN.md`
- `docs/STEP16_SNAP_HYSTERESIS_VERIFICATION.md`

## Verification
Commands executed:
1. `cmake --build build_vcpkg -j --target test_qt_canvas_box_select`
2. `ctest --test-dir build_vcpkg -R qt_canvas_box_select_run -V`
3. `ctest --test-dir build_vcpkg -V`

Result: PASS (Qt suite including canvas selection test).
