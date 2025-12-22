# Step 20: Property Panel Auto-Sync — Design

## Goals
- Keep PropertyPanel visibility state in sync with Document metadata changes.
- Avoid manual UI refresh logic in MainWindow.

## Changes
1. **PropertyPanel observer** (`editor/qt/include/panels/property_panel.hpp`, `editor/qt/src/panels/property_panel.cpp`)
   - PropertyPanel implements `DocumentObserver` and tracks the Document pointer.
   - On entity metadata changes affecting the current selection, it recomputes the visibility tri-state.
2. **MainWindow wiring** (`editor/qt/src/mainwindow.cpp`)
   - PropertyPanel receives the Document pointer and handles visibility state internally.
3. **Qt test build fix** (`tests/qt/CMakeLists.txt`)
   - Added core include path and link for the property panel test.

## Rationale
Visibility changes (including undo/redo) should reflect immediately in the property UI without
forcing selection changes or manual refresh calls.
