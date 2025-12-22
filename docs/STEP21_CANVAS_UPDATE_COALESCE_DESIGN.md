# Step 21: Canvas Update Coalescing — Design

## Goals
- Reduce redundant `update()` calls when many Document events arrive.
- Coalesce selection change signals triggered by removals.

## Changes
1. **Canvas update scheduling** (`editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`)
   - Added `scheduleUpdate()` to queue a single repaint per event loop.
   - Geometry/meta updates now call the scheduler instead of immediate `update()`.
2. **Selection change coalescing** (`editor/qt/src/canvas.cpp`)
   - Added `scheduleSelectionChanged()` to emit once after multiple removals.

## Rationale
Document observers can emit multiple events in a short time (batch deletes/undo). Coalescing
reduces redundant repaints and selection signals while preserving final state correctness.
