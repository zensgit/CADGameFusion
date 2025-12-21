# Step 9: SelectionModel Refactor — Design

## Goals
- Centralize selection state outside Canvas/MainWindow to reduce coupling.
- Provide a single selection source for property panel, export, and delete flows.
- Avoid selection feedback loops while keeping Canvas highlights in sync.

## Changes
1. **SelectionModel** (`editor/qt/include/selection/selection_model.hpp`, `editor/qt/src/selection/selection_model.cpp`)
   - Stores current selection and emits `selectionChanged` on updates.
2. **MainWindow integration** (`editor/qt/src/mainwindow.cpp`, `editor/qt/src/mainwindow.hpp`)
   - Canvas selection updates the model; model updates property panel and Canvas highlight.
   - Export and delete paths read from the SelectionModel instead of local state.
3. **Qt test**
   - Added `tests/qt/test_qt_selection_model.cpp` to verify signal emission and no-op updates.
4. **CMake/CI**
   - Added new test target and included SelectionModel sources.

## Rationale
Selection was duplicated across Canvas and MainWindow. A dedicated model clarifies ownership
and makes future selection-related features (filters, groups) easier to add.
