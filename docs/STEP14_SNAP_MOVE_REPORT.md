# Step 14: Snap-Aware Move — Report

## Summary
- Dragging selected polylines now applies snap to the move target.
- Move commits as a single undoable command with delta-based replay.
- Selection remains intact via incremental Canvas updates.

## Scope
1. **Canvas move handling** (`editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`)
   - Move state tracking, snap exclusion for selection, and incremental updates.
2. **Undoable move command** (`editor/qt/src/mainwindow.cpp`)
   - Captures original points and delta, applies/undoes via Document.
3. **Helpers** (`editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`)
   - `updatePolylinePoints()` to keep caches in sync without clearing selection.

## Files Updated
- `editor/qt/src/canvas.hpp`
- `editor/qt/src/canvas.cpp`
- `editor/qt/src/mainwindow.cpp`
- `docs/STEP14_SNAP_MOVE_DESIGN.md`
- `docs/STEP14_SNAP_MOVE_VERIFICATION.md`

## Verification
Commands executed:
1. `ctest --test-dir build_vcpkg -R qt_canvas_box_select_run -V`
2. `ctest --test-dir build_vcpkg -V`

Result: PASS (Qt suite including canvas selection test).
