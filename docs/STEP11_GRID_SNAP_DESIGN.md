# Step 11: Grid Snap — Design

## Goals
- Implement grid snapping based on the same grid spacing used for rendering.
- Keep snap priority: endpoints/midpoints win unless grid is closer.
- Expose the grid snap as a real (non-preview) toggle in the UI.

## Changes
1. **Grid step helper** (`editor/qt/src/snap_manager.hpp`, `editor/qt/src/snap_manager.cpp`)
   - Add `SnapManager::gridStepForScale()` to compute 1/2/5 grid steps from scale.
2. **Grid snap type** (`editor/qt/src/snap_manager.hpp`, `editor/qt/src/snap_manager.cpp`)
   - Add `SnapType::Grid` and evaluate grid snap after geometry snaps.
3. **Canvas grid alignment + marker** (`editor/qt/src/canvas.cpp`)
   - Draw grid using the shared grid step helper.
   - Render a plus marker for grid snaps.
4. **Snap panel label** (`editor/qt/src/panels/snap_panel.cpp`)
   - Update grid label to reflect implemented snapping.
5. **Tests** (`tests/qt/test_qt_snap_manager.cpp`)
   - Add grid snap coverage and ensure grid does not interfere with other cases.

## Rationale
Grid snapping needs to share the exact spacing rules used in rendering to avoid
visual mismatch. Centralizing the step logic in `SnapManager` keeps Canvas and
snap selection aligned while preserving snap priority.
