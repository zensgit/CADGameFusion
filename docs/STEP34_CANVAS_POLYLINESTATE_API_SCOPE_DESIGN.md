# Step 34: Canvas PolylineState API Scope — Design

## Goal
- Prevent Canvas from acting as a public data source by restricting cache-derived APIs.

## Changes
1. Keep `CanvasWidget::polylineStates()` private; expose it to tests via `CanvasTestAccess` when `CADGF_QT_TEST_ACCESS` is defined.
2. Update the audit checklist to record completion.

## Files
- `editor/qt/src/canvas.hpp`
- `tests/qt/test_qt_document_commands.cpp`
- `tests/qt/CMakeLists.txt`
- `docs/TECH_DEBT_DOCUMENT_CANVAS_AUDIT.md`
