# Step 33: Canvas Cache API Cleanup — Design

## Goal
- Prevent direct mutation of Canvas render cache outside Document.

## Changes
1. Remove the public `CanvasWidget::updatePolylinePoints(...)` API.
2. Add a short note that Canvas caches are derived from Document only.

## Files
- `editor/qt/src/canvas.hpp`
- `editor/qt/src/canvas.cpp`
