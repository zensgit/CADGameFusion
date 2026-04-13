# M2 (UX & Engine Interop) — Design Document

## Overview

M2 enhances the CADGameFusion Qt editor with measurement tools, live Unity preview, align/distribute operations, visual gizmo handles, and infrastructure polish. Implementation spans 4 phases over 4 weeks.

## Prerequisites

- M1 feature-complete: selection, snap, move, rotate (free+90), scale, group/ungroup, status bar, numeric panel, JSON/glTF/DXF export, 14/14 Qt tests passing
- Unity adapter with WatchAndReload.cs (file watcher) and C# bindings
- Core with Vec2, Polyline, boolean/offset/triangulate, constraint solver, C API

## Architecture Decisions

### Tool Abstraction

All new interactive features (measure, gizmo) are implemented as `Tool` subclasses rather than adding more state machines to Canvas. The existing move/rotate/scale interactions remain as hardcoded Canvas behavior (default mode), while new tools are activated via toolbar or keyboard shortcuts.

```
CanvasWidget
  ├─ m_activeTool (Tool*)
  ├─ Default behavior (move/rotate/scale when no tool active)
  └─ Tool dispatch: tool->handleEvent() called before default handlers
```

### Live Preview Loop

Qt editor auto-exports to a directory on document change. Unity's existing WatchAndReload.cs detects new scene files and reloads. No IPC needed — file system is the communication channel.

```
Qt Editor ─→ LiveExportManager ─→ exportScene(JSON+glTF) ─→ filesystem
Unity     ─→ WatchAndReload.cs ─→ polls scene_* dirs     ─→ loads meshes
```

---

## Phase 1: Live Preview Loop + Layer Lock

### LiveExportManager

- QObject + DocumentObserver
- 300ms debounce timer to batch rapid changes
- Calls existing `exportScene()` (JSON+glTF) to configured directory
- Toggle via File menu "Live Preview" action
- Directory persisted in QSettings

### Layer Lock UI

- LayerPanel adds "Lock" column with QCheckBox per layer
- Core already has `Layer::locked` field and `Document::set_layer_locked()`
- Canvas adds `isEntityLocked()` check — blocks move/rotate/scale on locked entities
- Selection still works on locked entities (visual feedback)

### Files

| File | Change |
|------|--------|
| `include/live_export_manager.hpp` | New |
| `src/live_export_manager.cpp` | New |
| `src/panels/layer_panel.hpp/cpp` | Add Lock column + signal |
| `src/canvas.cpp` | Add isEntityLocked check |
| `src/mainwindow.hpp/cpp` | Wire LiveExport + Lock |

---

## Phase 2: Measurement Tool + Rulers/Guides

### Tool Base Class

```cpp
class Tool {
    virtual bool mousePressEvent(QMouseEvent*) { return false; }
    virtual bool mouseMoveEvent(QMouseEvent*) { return false; }
    virtual bool mouseReleaseEvent(QMouseEvent*) { return false; }
    virtual bool keyPressEvent(QKeyEvent*) { return false; }
    virtual void paint(QPainter&, double scale, QPointF pan) {}
    virtual QString name() const = 0;
};
```

Canvas integration: `if (m_activeTool && m_activeTool->handleEvent(e)) return;`

### MeasureTool

- State machine: Idle → PickingSecond (click A, move, click B)
- Displays: dashed line + distance text + angle text
- Snaps to entity points via SnapManager
- Shortcut: M to activate, Escape to deactivate

### GuideManager

- Stores horizontal/vertical guide lines
- Integrates with SnapManager (new SnapType::Guide)
- Created by double-clicking ruler area
- Rendered as cyan dashed lines spanning viewport

### Rulers

- 20px strips along top and left edges
- Tick marks at grid spacing with numeric labels
- Dynamic step based on zoom level

---

## Phase 3: Align/Distribute + Transform Pivot

### AlignPanel

QDockWidget with 8 buttons:
- Align: Left, Center-H, Right, Top, Center-V, Bottom
- Distribute: Horizontal, Vertical

Each operation creates an undoable Command that computes per-entity AABB, determines target position, and applies translation.

### Transform Pivot

Extends TransformPanel with pivot mode selector:
- Centroid (default, current behavior)
- Origin (0,0)
- BBox Center
- Custom (user-specified X,Y)

Canvas renders pivot marker (cross + circle) and uses selected pivot for rotate/scale center.

---

## Phase 4: Gizmo Handles + Polish

### GizmoTool

Active automatically when entities are selected. Draws manipulation handles:
- **Move**: X-axis red arrow, Y-axis green arrow, center blue square
- **Rotate**: Circular arc at 40px screen radius from pivot
- **Scale**: Four corner squares at selection AABB

All handles drawn in screen space (constant pixel size). Hit-testing at 12px tolerance. Drag produces move/rotate/scale signals connected to existing Commands.

### Polish

- Status bar shows active tool name
- Guide persistence in .cgf project files
- Keyboard shortcut consistency: V=select, M=measure, G=gizmo, R=rotate

---

## New File Summary

| File | Phase | Purpose |
|------|-------|---------|
| `include/live_export_manager.hpp` + `src/` | 1 | Auto-export to Unity |
| `include/tools/tool.hpp` | 2 | Tool abstraction |
| `include/tools/measure_tool.hpp` + `src/` | 2 | Distance/angle measurement |
| `include/guide_manager.hpp` + `src/` | 2 | Reference guide lines |
| `include/panels/align_panel.hpp` + `src/` | 3 | Align/distribute operations |
| `include/tools/gizmo_tool.hpp` + `src/` | 4 | Visual manipulation handles |

## Dependency Graph

```
Phase 1 ──────────── Independent (do first)
Phase 2A (Tool) ───┐
Phase 2B-C ────────┤
Phase 3 ───────────┤── Independent of Phase 2
Phase 4 ───────────┘── Depends on Phase 2A + Phase 3B
```

## Deferred to M3/M4

- Dimension constraints (solver UI integration)
- Code signing / nightly artifact pipeline
- Unity EditorWindow custom C# panel
- Lasso selection
