# Step 35: SelectionModel Ownership — Design

## Goal
- Clarify SelectionModel as the single selection source of truth.
- Ensure Canvas selection is only a view sync path.

## Changes
1. Rename `CanvasWidget::setSelection(...)` to `setSelectionFromModel(...)`.
2. Update call sites to use the renamed method.
3. Update the audit checklist to record completion.

## Files
- `editor/qt/src/canvas.hpp`
- `editor/qt/src/canvas.cpp`
- `editor/qt/src/mainwindow.cpp`
- `tests/qt/test_qt_document_commands.cpp`
- `tests/qt/test_qt_canvas_box_select.cpp`
- `docs/TECH_DEBT_DOCUMENT_CANVAS_AUDIT.md`
