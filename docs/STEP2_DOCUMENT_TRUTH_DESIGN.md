# Step 2: Document-as-Truth Audit — Design

## Goals
- Ensure export flows consume `core::Document` data directly (no Canvas/presentation copies).
- Provide reusable helpers that any UI code can call to collect export items, keeping the logic centralized and source-of-truth aware.
- Add regression coverage so future changes cannot “forget” to read metadata from Document (layers, colors, groups).

## Changes
1. **Export Helpers Module**
   - Introduced `editor/qt/include/export/export_helpers.hpp` + `editor/qt/src/export/export_helpers.cpp`.
   - Encapsulates the logic that was previously a set of `static` functions in `MainWindow` (collecting rings, resolving layer metadata, inferring selection group id).
   - The helper only reads from `core::Document` and does not touch Canvas-specific caches, reinforcing the stability boundary.
2. **MainWindow Integration**
   - `exportSceneAction` and `exportWithOptions` now call `export_helpers::collectExportItems` / `selectionGroupId` instead of manual loops.
   - The group filtering is handled purely by Document data (pass group id or -1 for all).
3. **Qt Regression Test**
   - Added `tests/qt/test_qt_export_helpers.cpp`, which creates a Document with layers, group assignments, and per-entity colors, then asserts that `collectExportItems` returns the expected metadata.
   - Verifies that `selectionGroupId` only returns a valid id when every selected entity belongs to the same group.
4. **CI Coverage**
   - Added the new test target to `tests/qt/CMakeLists.txt` and `.github/workflows/qt-tests-trial.yml` so every Qt CI run executes it.

## Future Considerations
- Similar helpers can be added for other Document-driven flows (e.g., undo serialization, importers) to keep logic centralized.
- Plugin host demo should consume these helpers when exporting Document subsets.
