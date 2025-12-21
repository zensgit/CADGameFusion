# Step 8: SnapManager Refactor — Design

## Goals
- Extract snap detection into a dedicated class to reduce CanvasWidget complexity.
- Keep behavior identical (endpoint + midpoint snapping, visibility filtering).
- Add a focused unit test for snap logic.

## Changes
1. **SnapManager class** (`editor/qt/src/snap_manager.hpp`, `editor/qt/src/snap_manager.cpp`)
   - Encapsulates snap radius configuration and snap query logic.
   - Accepts polyline views (points + AABB + visibility) supplied by CanvasWidget.
2. **Canvas integration** (`editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`)
   - Replaces inlined snap logic with `SnapManager::findSnap`.
   - Builds lightweight `PolylineView` inputs from cached polylines.
3. **Qt test** (`tests/qt/test_qt_snap_manager.cpp`)
   - Verifies endpoint and midpoint snapping and visibility filtering.
4. **CMake/CI**
   - Adds SnapManager sources to editor/test targets and CI build list.

## Rationale
Snap handling was tightly coupled to CanvasWidget. Isolating it improves testability and makes future
snap types (grid, intersection) easier to add without expanding CanvasWidget further.
