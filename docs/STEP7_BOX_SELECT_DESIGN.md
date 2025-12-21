# Step 7: Box Select (Window/Crossing) — Design

## Goals
- Add rectangle box selection to the Qt canvas with window vs crossing semantics.
- Keep Document as the single source of truth; selection is UI-only.
- Ensure selection respects entity and layer visibility.

## Changes
1. **Canvas selection drag** (`editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`)
   - Track selection drag start/end in screen space.
   - On release: left→right = window select (contain), right→left = crossing select (intersect).
   - Refactor click selection into `selectAtPoint` and box selection into `selectEntitiesInWorldRect`.
2. **Selection UI**
   - Draw a dashed selection rectangle in screen space with different colors for window vs crossing.
3. **Qt test**
   - Added `tests/qt/test_qt_canvas_box_select.cpp` to validate window/crossing behavior and visibility filtering.
   - CMake + workflow updated to build the new test target.

## Rationale
Box selection is a core editor interaction and removes the largest remaining UX gap in Phase 2.
The implementation stays within the UI layer and preserves the Document as the authoritative data model.
