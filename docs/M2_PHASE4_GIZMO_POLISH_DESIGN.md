# M2 Phase 4: Gizmo Handles + Polish — Design Document

## 1. GizmoTool

### Handle Types

| Handle | Visual | Color | Behavior |
|--------|--------|-------|----------|
| MoveX | Arrow → right | Red | Constrained X-axis drag |
| MoveY | Arrow → up | Green | Constrained Y-axis drag |
| MoveXY | Center square | Blue | Free XY drag |
| RotateArc | Dashed circle | Orange | Angle from drag arc |
| ScaleCorner | Corner squares | White | Uniform scale from distance ratio |

### Hit Testing

All handles drawn in screen space (constant pixel size). Hit detection uses:
- Center square: 8px half-size
- Arrows: along axis, 30px length, 12px threshold
- Rotate arc: 40px radius ring, 12px threshold
- Scale corners: AABB corners, 8px half-size

Priority order: RotateArc → MoveX → MoveY → MoveXY → ScaleCorner → None

### Callback System

```cpp
using MoveCallback = std::function<void(QPointF delta)>;
using RotateCallback = std::function<void(double angleDeg, QPointF center)>;
using ScaleCallback = std::function<void(double factor, QPointF center)>;
```

MainWindow sets callbacks that emit Canvas signals to create undoable commands.

### Auto-Activation

GizmoTool activates when selection is non-empty, deactivates when empty. If another tool (e.g., MeasureTool) is active, gizmo defers.

## 2. Guide Persistence

### JSON Format (in .cgf project file)

```json
{
  "editor": {
    "snap": { ... },
    "guides": [
      {"orientation": "H", "position": 100.0},
      {"orientation": "V", "position": 50.0}
    ]
  }
}
```

### Save/Load

- Save: `canvas->findChild<GuideManager*>()` → serialize to JSON array
- Load: clear existing guides, parse array, `addGuide()` for each

## Files

| File | Type | Lines |
|------|------|-------|
| `include/tools/gizmo_tool.hpp` | New | 57 |
| `src/tools/gizmo_tool.cpp` | New | 155 |
| `src/project/project.cpp` | Modified | +28 (guide serialize/deserialize) |
| `src/mainwindow.hpp/cpp` | Modified | +GizmoTool member, callbacks, selection wiring |
| `CMakeLists.txt` | Modified | +2 files |
