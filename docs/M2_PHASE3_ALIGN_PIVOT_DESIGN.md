# M2 Phase 3: Align/Distribute + Transform Pivot — Design Document

## 1. AlignPanel

### UI Layout

```
┌─────────────────────┐
│ Align               │
│ [Left][CenterH][Right] │
│ [Top] [CenterV][Bottom] │
├─────────────────────┤
│ Distribute          │
│ [Horizontal][Vertical] │
└─────────────────────┘
```

### Align Algorithm

For each align type, compute the global AABB of all selected entities, then shift each entity so its local AABB edge/center matches the target:

| Type | Target | Formula |
|------|--------|---------|
| Left | Global minX | dx = globalMinX - entityMinX |
| CenterH | Global centerX | dx = globalCenterX - entityCenterX |
| Right | Global maxX | dx = globalMaxX - entityMaxX |
| Top | Global minY | dy = globalMinY - entityMinY |
| CenterV | Global centerY | dy = globalCenterY - entityCenterY |
| Bottom | Global maxY | dy = globalMaxY - entityMaxY |

### Distribute Algorithm

1. Compute center position of each entity's AABB along the axis
2. Sort by center position
3. First and last entities stay fixed
4. Intermediate entities spaced equally: `target = first + step * index`
5. `step = (last - first) / (count - 1)`

### Commands

- `AlignEntitiesCommand`: stores before-points, applies alignment in execute(), restores in undo()
- `DistributeEntitiesCommand`: same pattern, sorts and redistributes

Both require 2+ entities (align) or 3+ entities (distribute).

## 2. Transform Pivot

### Pivot Modes

| Mode | Value | Behavior |
|------|-------|----------|
| Centroid | 0 | Average of all selected points (default) |
| Origin | 1 | (0, 0) |
| BBox Center | 2 | Center of selection's axis-aligned bounding box |
| Custom | 3 | User-specified X, Y coordinates |

### UI Integration

TransformPanel adds a "Pivot" group box with:
- QComboBox for mode selection
- QDoubleSpinBox for custom X/Y (enabled only in Custom mode)
- Signal: `pivotChanged(int mode, QPointF customPos)`

### Canvas Integration

- `setPivotMode(int, QPointF)` stores mode and custom point
- `computePivot()` returns the correct pivot based on mode + selection
- paintEvent renders magenta cross+circle at pivot position when entities selected

### Files

| File | Change |
|------|--------|
| `include/panels/align_panel.hpp` | New (22 lines) |
| `src/panels/align_panel.cpp` | New (48 lines) |
| `include/panels/transform_panel.hpp` | +PivotMode enum, +pivot members |
| `src/panels/transform_panel.cpp` | +Pivot group box, +pivot methods |
| `src/canvas.hpp` | +setPivotMode, +computePivot, +pivot state |
| `src/canvas.cpp` | +setPivotMode/computePivot impl, +pivot marker |
| `src/mainwindow.hpp/cpp` | +AlignPanel member, +connections |
