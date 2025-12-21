# Step 10: Snap Settings UI + Toggles — Design

## Goals
- Expose snap options (endpoints, midpoints, grid placeholder) via UI.
- Keep Canvas focused on rendering/interaction; UI state lives outside Canvas.
- Allow SnapManager to respect per-option toggles.

## Changes
1. **SnapSettings** (`editor/qt/include/snap/snap_settings.hpp`, `editor/qt/src/snap/snap_settings.cpp`)
   - Central store for snap toggles with a single `settingsChanged` signal.
2. **SnapPanel UI** (`editor/qt/include/panels/snap_panel.hpp`, `editor/qt/src/panels/snap_panel.cpp`)
   - Dock widget with checkboxes for endpoints/midpoints/grid preview.
3. **Canvas integration** (`editor/qt/src/canvas.hpp`, `editor/qt/src/canvas.cpp`)
   - Canvas reads SnapSettings and configures SnapManager before snapping.
4. **SnapManager flags** (`editor/qt/src/snap_manager.hpp`, `editor/qt/src/snap_manager.cpp`)
   - Adds toggle flags and returns inactive when all snap modes are disabled.
5. **Tests**
   - Expanded `tests/qt/test_qt_snap_manager.cpp` for toggle behavior.
   - Added `tests/qt/test_qt_snap_settings.cpp` for settings updates.
   - CI build list updated.

## Rationale
Snap options are part of editor UX, not Canvas internals. A settings object and UI panel
decouple state from rendering and prepare for grid snapping in later iterations.
