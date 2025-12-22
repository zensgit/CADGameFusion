# Step 19: Selection Auto-Sync Test — Design

## Goals
- Verify selection updates when a selected entity is removed from the Document.
- Ensure Canvas emits `selectionChanged` without manual reload calls.

## Changes
1. **Qt test coverage** (`tests/qt/test_qt_document_commands.cpp`)
   - Added a selection removal scenario that listens for `selectionChanged`.
   - Asserts the selection drops the removed entity and keeps the remaining one.

## Rationale
Selection should stay consistent with Document state when entities are removed.
This guards against regressions in the observer-driven sync path.
