# Step 34: Canvas PolylineState API Scope — Design

## Goal
- Prevent Canvas from acting as a public data source by restricting cache-derived APIs.

## Changes
1. Move `CanvasWidget::polylineStates()` to private scope and mark as debug-only.
2. Update the audit checklist to record completion.

## Files
- `editor/qt/src/canvas.hpp`
- `docs/TECH_DEBT_DOCUMENT_CANVAS_AUDIT.md`
