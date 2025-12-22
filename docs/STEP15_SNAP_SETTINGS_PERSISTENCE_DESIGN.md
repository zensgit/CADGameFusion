# Step 15: Snap Settings Config + Persistence — Design

## Goals
- Make snap radius and grid spacing configurable in the UI.
- Apply the settings to grid rendering and snap behavior.
- Persist snap settings in project files and restore on load.

## Changes
1. **Snap settings model** (`editor/qt/include/snap/snap_settings.hpp`, `editor/qt/src/snap/snap_settings.cpp`)
   - Added snap radius and grid spacing values with validation.
2. **Snap UI** (`editor/qt/include/panels/snap_panel.hpp`, `editor/qt/src/panels/snap_panel.cpp`)
   - Added numeric controls for radius and grid spacing.
3. **Snap application** (`editor/qt/src/canvas.cpp`, `editor/qt/src/snap_manager.hpp`, `editor/qt/src/snap_manager.cpp`)
   - Canvas applies radius and spacing to SnapManager and grid rendering.
   - SnapManager uses configurable spacing for grid snaps.
4. **Persistence** (`editor/qt/src/project/project.cpp`)
   - Project save/load stores snap settings under `editor.snap`.
5. **Tests** (`tests/qt/test_qt_snap_settings.cpp`, `tests/qt/test_qt_project_roundtrip.cpp`, `tests/qt/CMakeLists.txt`)
   - SnapSettings tests cover new fields.
   - Project roundtrip verifies snap settings persistence.

## Rationale
Snap behavior must be tunable per workflow. Persisting editor-level snap settings
with the project ensures consistent behavior across sessions without changing core
geometry data or the stable C API.
