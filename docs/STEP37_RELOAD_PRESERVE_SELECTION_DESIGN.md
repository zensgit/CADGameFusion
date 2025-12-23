# Step 37: Reload Preserve Selection — Design

## Goal
- Keep SelectionModel-driven selection intact across `CanvasWidget::reloadFromDocument()`.

## Changes
1. Preserve the previous selection if entity IDs still exist in the Document.
2. Emit `selectionChanged` only when the selection actually changes.
3. Extend test-only access to read Canvas selection for verification.
4. Update the audit checklist to mark completion.

## Files
- `editor/qt/src/canvas.cpp`
- `editor/qt/src/canvas.hpp`
- `tests/qt/test_qt_document_commands.cpp`
- `docs/TECH_DEBT_DOCUMENT_CANVAS_AUDIT.md`
