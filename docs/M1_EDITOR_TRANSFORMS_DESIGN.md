# M1 Editor Transform Tools — Design Document

## Overview

This document describes the design and implementation of the M1 (2D MVP) editor transform tools added to CADGameFusion's Qt editor: **Rotate**, **Scale**, **Group/Ungroup**, **Status Bar Metrics**, and **Numeric Transform Panel**.

## Architecture

### Signal-Command Pattern

All transforms follow the established editor architecture:

```
Canvas (user interaction)
  ├─ keyPressEvent / mouseMoveEvent
  ├─ Compute centroid + before-points
  └─ emit signal(entityIds, beforePoints, params)
        │
MainWindow (command creation)
  ├─ Connect signal → create Command struct
  ├─ Command.execute(): transform points, call doc.set_polyline_points()
  ├─ Command.undo(): restore before-points
  └─ Push to QUndoStack via CommandManager
        │
Document (source of truth)
  └─ Observer notifications → Canvas re-renders
```

### In-Place Geometry Transformation

All transforms modify entity coordinates directly via `Document::set_polyline_points()`, consistent with the existing Move command. No transform matrix is stored per-entity — undo relies on captured before-points.

## Components

### 1. Rotate Transform

**Files**: `canvas.cpp`, `canvas.hpp`, `mainwindow.cpp`

**Trigger**: `R` key with entities selected

**Algorithm**:
- Compute centroid of all selected entities' points
- Apply 2D rotation matrix around centroid:
  ```
  x' = cx + (x-cx)*cos(θ) - (y-cy)*sin(θ)
  y' = cy + (x-cx)*sin(θ) + (y-cy)*cos(θ)
  ```
- Default angle: 90° CCW (keyboard), arbitrary via TransformPanel

**Signal**: `rotateEntitiesRequested(entityIds, beforePoints, angleDeg, center)`

**Command**: `RotateEntitiesCommand` — stores before-points, angle, center; undo restores before-points exactly.

### 2. Scale Transform

**Files**: `canvas.cpp`, `canvas.hpp`, `mainwindow.cpp`

**Trigger**: `+` key (1.5x), `-` key (0.667x) with entities selected

**Algorithm**:
- Compute centroid of all selected entities' points
- Scale each point relative to centroid:
  ```
  x' = cx + (x-cx) * factor
  y' = cy + (y-cy) * factor
  ```

**Signal**: `scaleEntitiesRequested(entityIds, beforePoints, factor, center)`

**Command**: `ScaleEntitiesCommand` — same undo pattern as rotate.

### 3. Group / Ungroup

**Files**: `mainwindow.cpp`, `mainwindow.hpp`

**Triggers**: `Ctrl+G` (group), `Ctrl+Shift+G` (ungroup)

**Implementation**:
- **Group**: `alloc_group_id()` → `set_entity_group_id(eid, newGroupId)` for all selected
- **Ungroup**: `set_entity_group_id(eid, -1)` for all selected
- Both capture `oldGroupIds` per-entity for undo

**Commands**: `GroupEntitiesCommand`, `UngroupEntitiesCommand`

### 4. Status Bar Metrics

**Files**: `canvas.cpp`, `canvas.hpp`, `mainwindow.cpp`, `mainwindow.hpp`

**Signals** (emitted from `mouseMoveEvent`):
- `cursorWorldPositionChanged(double x, double y)` — every mouse move
- `snapStateChanged(int snapType)` — when snap state changes

**Widgets** (permanent status bar labels):
- `m_coordLabel` — `X: 123.45  Y: 678.90`
- `m_selCountLabel` — `Sel: 3` (updated on selection change)
- `m_snapTypeLabel` — `Snap: Endpoint` / `Snap: --`

### 5. Numeric Transform Panel

**Files**: `transform_panel.hpp`, `transform_panel.cpp`, `mainwindow.cpp`, `CMakeLists.txt`

**Widget**: `TransformPanel` (QDockWidget, right dock area)

**Sections**:
| Section | Input | Default | Range |
|---------|-------|---------|-------|
| Move | dX, dY (QDoubleSpinBox) | 0.0 | ±1e6 |
| Rotate | Angle (QDoubleSpinBox) | 90° | ±360° |
| Scale | Factor (QDoubleSpinBox) | 1.5 | 0.01–100 |

**Signals**: `moveRequested(dx, dy)`, `rotateRequested(angleDeg)`, `scaleRequested(factor)`

Each signal is connected to a command that creates the appropriate Command struct and pushes to QUndoStack.

**Selection awareness**: Panel updates centroid display and enables/disables buttons based on SelectionModel state.

### 6. Bug Fix: m_undoStack / m_cmdMgr Initialization

**Root cause**: `MainWindow::MainWindow()` had a placeholder comment `// ... (existing code) ...` where `m_undoStack` and `m_cmdMgr` should have been initialized. Both were `nullptr`, causing SIGSEGV (exit 139) on any command push.

**Fix**: Added initialization at the top of the constructor:
```cpp
m_undoStack = new QUndoStack(this);
m_cmdMgr = new CommandManager(this);
m_cmdMgr->setUndoStack(m_undoStack);
```

### 7. Pre-existing Test Fixes (4 tests)

| Test | Root Cause | Fix |
|------|-----------|-----|
| `qt_document_commands` | `selectionChanged` not emitted when selected entity removed | Canvas now removes from `selected_entities_` and emits signal in `on_document_changed(EntityRemoved)` |
| `qt_canvas_box_select` | Non-selected entity shadowing selected entity in hit-test | Added fallback hit-test against selected entities when primary hit returns non-selected |
| `qt_snap_manager` | Center snap (closer) overriding grid snap in test | Test now disables center/intersection snap before grid-only test |
| `qt_property_panel` | `setChecked(false)` on already-unchecked checkbox = no signal | Test ensures checkbox is checked before toggling to unchecked |

## File Change Summary

| File | Change Type | Lines |
|------|------------|-------|
| `editor/qt/src/canvas.hpp` | Modified | +8 (4 signals) |
| `editor/qt/src/canvas.cpp` | Modified | +81 (key handlers, signals, hit-test fix, selection fix) |
| `editor/qt/src/mainwindow.hpp` | Modified | +9 (members) |
| `editor/qt/src/mainwindow.cpp` | Modified | +314 (commands, connections, status bar, panel) |
| `editor/qt/include/panels/transform_panel.hpp` | New | 32 lines |
| `editor/qt/src/panels/transform_panel.cpp` | New | 93 lines |
| `editor/qt/CMakeLists.txt` | Modified | +3 (transform_panel files) |
| `tests/qt/test_qt_m1_transforms.cpp` | New | 466 lines |
| `tests/qt/CMakeLists.txt` | Modified | +22 (test target) |
| `tests/qt/test_qt_document_commands.cpp` | Modified | +2 |
| `tests/qt/test_qt_property_panel.cpp` | Modified | +5 |
| `tests/qt/test_qt_snap_manager.cpp` | Modified | +2 |

## Keyboard Shortcuts

| Key | Action | Requires Selection |
|-----|--------|-------------------|
| R | Rotate 90° CCW | Yes |
| + / = | Scale up 1.5x | Yes |
| - | Scale down 0.667x | Yes |
| Ctrl+G | Group entities | Yes (2+) |
| Ctrl+Shift+G | Ungroup entities | Yes |
| Delete | Delete entity | Yes |
| Shift+Delete | Delete group/similar | Yes |
| Escape | Deselect all | No |
