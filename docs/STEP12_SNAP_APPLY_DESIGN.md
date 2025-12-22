# Step 12: Snap Apply to Selection — Design

## Goals
- Apply snap results to point-based selection operations (click and Alt+click).
- Provide a reusable snap helper for future tools/commands.
- Keep snap calculation consistent with the existing SnapManager and settings.

## Changes
1. **Canvas snap helper** (`editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`)
   - Add `snapWorldPosition()` for snap-aware world positions.
   - Centralize snap computation in `computeSnapAt()` to avoid duplicated logic.
2. **Selection uses snap** (`editor/qt/src/canvas.cpp`)
   - Click selection uses snapped world position when snap is active.
   - Alt+click group selection uses snapped world position.
3. **Tests** (`tests/qt/test_qt_canvas_box_select.cpp`)
   - Extend the canvas selection test to validate snap-applied positions.

## Rationale
Snapping is only meaningful if it influences actual operations. Applying snap to
selection clicks is the smallest real behavior change that matches the current
feature set, while the helper enables future point-based tools without duplicating
snap setup logic.
