# Step 14: Snap-Aware Move — Design

## Goals
- Allow dragging selected polylines with snap applied to the move target.
- Preserve undo/redo by committing a single move command on release.
- Avoid self-snapping by excluding the current selection from snap inputs.

## Changes
1. **Canvas move state** (`editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`)
   - Added move tracking (anchor, delta, selected geometry snapshot).
   - Centralized snap computation with optional selection exclusion.
   - Dragging uses snap for the move target and updates Document + Canvas preview.
2. **Move command** (`editor/qt/src/mainwindow.cpp`)
   - New move command captures original points and delta, applies/undoes via Document.
3. **Canvas update helper** (`editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`)
   - `updatePolylinePoints()` updates caches without clearing selection.

## Rationale
Dragging is the first editing operation that must respect snap positions. Excluding
selected entities from snap prevents self-snapping, while committing a single
command on release keeps undo clean and deterministic.
