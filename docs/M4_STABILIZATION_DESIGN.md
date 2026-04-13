# M4 Stabilization — Design Document

## Overview

M4 focuses on code quality, robustness, and architecture cleanup after the rapid M1-M3 feature development.

## 1. Viewport3D Projection Fix

### Problem
Original projection used incorrect forward/right/up vector derivation from orbit angles. The `camZ` sign convention was inverted, causing points to be clipped as "behind camera" when they were actually in front.

### Fix
Rewrote projection using proper look-at camera matrix:
- Camera position: spherical coordinates from orbit (yaw, pitch, distance)
- Forward: normalized vector from camera to origin
- Right: cross(forward, world_up), normalized
- Up: cross(right, forward)
- `camZ` positive = in front of camera (correct convention)
- Behind-camera threshold: `camZ < 0.01`

## 2. Earcut Integration for Extrude

### Problem
`extrude_mesh()` used fan triangulation for top/bottom faces, which only works for convex profiles. Concave profiles (L-shapes, etc.) produced incorrect triangles.

### Fix
Added conditional earcut integration:
```cpp
#if defined(USE_EARCUT)
    // Proper concave triangulation via mapbox::earcut
#else
    // Fan fallback (convex only)
#endif
```
The lambda `triangulateFace(baseIdx, flipWinding)` encapsulates both paths, with winding reversal for bottom face normal direction.

## 3. Command Class Extraction

### Problem
`mainwindow.cpp` contained inline Command structs (Move, Rotate, Scale, Group, Ungroup) defined inside lambda bodies, making them hard to test independently and bloating the file.

### Fix
Created `include/command/commands.hpp` with `editor_commands` namespace containing all shared Command classes:
- `MoveEntitiesCommand`
- `RotateEntitiesCommand`
- `ScaleEntitiesCommand`
- `GroupEntitiesCommand`
- `UngroupEntitiesCommand`

Plus helper: `applyPoints(doc, id, pts)` for code reuse.

These can now be used in tests without duplicating command logic.

## 4. Robustness Test Suite

10 edge-case tests covering:
- Zero/negative extrude height
- Concave profiles (L-shape)
- Minimum profile (triangle)
- Duplicate closing points
- Non-closed polylines
- Large profiles (100-point circle)
- Normal vector unit length verification
- signed_area / ensure_orientation
- close_ring / remove_near_duplicates

## Files

| File | Type | Description |
|------|------|-------------|
| `editor/qt/src/viewport3d.cpp` | Modified | Rewritten projection math |
| `core/src/ops2d.cpp` | Modified | Earcut face triangulation |
| `editor/qt/include/command/commands.hpp` | New | Extracted Command classes |
| `tests/core/test_robustness.cpp` | New | 10 edge-case tests |
