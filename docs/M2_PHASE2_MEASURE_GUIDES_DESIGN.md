# M2 Phase 2: Measurement Tool + Guides — Design Document

## Overview

Phase 2 introduces a pluggable tool system, a distance/angle measurement tool, and reference guide lines with snap integration.

## 1. Tool Abstraction

### Interface (`include/tools/tool.hpp`)

```cpp
class Tool {
    virtual bool mousePressEvent(QMouseEvent*) { return false; }
    virtual bool mouseMoveEvent(QMouseEvent*) { return false; }
    virtual bool mouseReleaseEvent(QMouseEvent*) { return false; }
    virtual bool keyPressEvent(QKeyEvent*) { return false; }
    virtual void paint(QPainter&, double scale, const QPointF& pan) {}
    virtual QString name() const = 0;
};
```

### Canvas Integration

- `m_activeTool` pointer checked at top of each event handler
- If tool returns `true`, event is consumed (existing handlers skipped)
- Tool's `paint()` called at end of `paintEvent` for visual overlays
- `setActiveTool(nullptr)` returns to default behavior
- Zero impact on existing move/rotate/scale code paths

## 2. MeasureTool

### State Machine

```
Idle → [left click] → PickingSecond → [left click] → Done
                         ↑ [mouse move: preview]         ↓ [left click: restart]
                         └────────────────────────────────┘
Escape at any point → Idle (reset)
```

### Visual Overlay (paint)

- Cyan dashed line between points A and B
- Filled circle markers at A and B (4px radius)
- Distance label at midpoint: `D: 5.00`
- Angle label when done: `A: 53.1°`
- Hint text when measurement complete

### Coordinate Handling

Tool stores screen positions. `paint()` converts to world coordinates using `(screen - pan) / scale` for distance calculation. This avoids needing the canvas to pass world coordinates through the tool interface.

### Activation

- Tools menu → "Measure" (checkable, shortcut M)
- Toggling off clears measurement and resets tool

## 3. GuideManager

### Data Model

```cpp
struct Guide {
    enum Orientation { Horizontal, Vertical };
    Orientation orientation;
    double position; // Y for Horizontal, X for Vertical
};
```

### API

- `addGuide(orient, pos)` — emits `guidesChanged`
- `removeGuide(index)` — emits `guidesChanged`
- `clearGuides()` — emits `guidesChanged` (no-op if empty)
- `findNearestGuide(x, y, threshold, snapPos, orient)` — returns closest within threshold

### Rendering (Canvas paintEvent)

- Cyan dash-dot lines spanning viewport width (horizontal) or height (vertical)
- Uses `worldToScreen()` for correct position at all zoom levels

### SnapManager Extension

- New `SnapType::Guide` added to enum
- Guide snapping not yet wired into `findSnap()` (will integrate in Phase 4 polish)
- Enum value is available for future integration

### Menu Items

- Tools → "Add Horizontal Guide..." (QInputDialog for Y position)
- Tools → "Add Vertical Guide..." (QInputDialog for X position)
- Tools → "Clear All Guides"

## Files

| File | Type | Description |
|------|------|-------------|
| `include/tools/tool.hpp` | New | Abstract tool interface |
| `include/tools/measure_tool.hpp` | New | MeasureTool declaration |
| `src/tools/measure_tool.cpp` | New | MeasureTool implementation (105 LOC) |
| `include/guide_manager.hpp` | New | GuideManager declaration |
| `src/guide_manager.cpp` | New | GuideManager implementation (49 LOC) |
| `src/snap_manager.hpp` | Modified | +Guide to SnapType enum |
| `src/canvas.hpp` | Modified | +Tool*, +GuideManager*, +setActiveTool |
| `src/canvas.cpp` | Modified | +tool dispatch, +guide rendering |
| `src/mainwindow.hpp/cpp` | Modified | +Tools menu, +MeasureTool/GuideManager members |
