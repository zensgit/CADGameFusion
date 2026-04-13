# M3 Phase 3+4: 3D Viewport + Recompute Pipeline — Design Document

## 1. Viewport3D

### Architecture Decision: QPainter Software Rendering

Chose QPainter-based wireframe rendering over QOpenGLWidget because:
- No OpenGL dependency — works in offscreen mode for automated testing
- Simpler integration with existing QWidget-based editor
- Sufficient for wireframe 3D visualization of extruded meshes
- Can be upgraded to OpenGL later without changing the interface

### Projection Pipeline

```
World (Vec3) → Camera Space → NDC → Screen (QPointF)

Camera position: orbit(yaw, pitch, distance) → spherical coordinates
View matrix: forward/right/up vectors from orbit angles
Perspective: tan(fov/2) based projection
NDC [-1,1] → screen pixels
```

### Camera Controls

| Input | Action |
|-------|--------|
| Left drag | Orbit (yaw ± 0.5°/px, pitch ± 0.5°/px) |
| Middle drag | Zoom (distance ± 0.2/px) |
| Scroll wheel | Zoom (×0.9 per notch) |

Pitch clamped to [-89°, 89°], distance minimum 1.0.

### Rendering Layers

1. Background (dark gray)
2. World axes (X=red, Y=green, Z=blue, 5 units)
3. Mesh wireframe (light gray, all triangle edges)
4. HUD (vertex/triangle count, orbit parameters)

## 2. Extrude Pipeline

### Flow

```
User selects polyline in 2D canvas
  → Tools → "Extrude Selection" (E key)
    → QInputDialog for height
      → core::extrude_mesh(polyline, height)
        → Viewport3D::setMesh(TriMesh3D)
        → FeatureTreePanel::setFeatures([Sketch, Extrude])
        → Status bar shows vertex/triangle count
```

### Feature Tree Integration

When extruding, the feature tree is populated with:
- Parent: Sketch (from selected entity name)
- Child: Extrude (with height parameter)

## 3. FeatureTreePanel Wiring

- Created in MainWindow, docked left (below LayerPanel)
- Viewport3D docked at bottom
- Selection signal connected but feature editing deferred to M4

## Files

| File | Type | Lines |
|------|------|-------|
| `include/viewport3d.hpp` | New | 45 |
| `src/viewport3d.cpp` | New | 140 |
| `src/mainwindow.hpp/cpp` | Modified | +Viewport3D/FeatureTree members, extrude action |
| `CMakeLists.txt` | Modified | +viewport3d files |
| `tests/qt/test_qt_viewport3d.cpp` | New | 130 (7 tests) |
