# Sprint: STL/OBJ + Revolve + Constraints + libdxfrw — Design Document

## Overview

Reference-project comparison (PlaneGCS, libdxfrw, SolveSpace) identified 4 high-value improvements. All implemented in parallel.

## Task A: STL/OBJ Export

Binary STL (80-byte header + triangle soup), ASCII STL, Wavefront OBJ with per-vertex normals. Works with any TriMesh3D (extrude, revolve, or future operations).

**Files**: `core/include/core/mesh_export.hpp`, `core/src/mesh_export.cpp`

## Task B: Revolve Mesh

Rodrigues' rotation formula generates ring vertices around arbitrary axis. Supports full (360°) and partial revolution with end caps. Configurable segment count.

```cpp
TriMesh3D revolve_mesh(const Polyline& profile, const Vec3& axisOrigin,
                       const Vec3& axisDir, double angleDeg, int segments = 36);
```

**Files**: `core/include/core/geometry2d.hpp`, `core/src/ops2d.cpp`

## Task C: Constraint Types 14→20

| New Type | Arity | Residual |
|----------|-------|----------|
| EqualLength | 8 | len(A) - len(B) |
| EqualRadius | 2 | r1 - r2 |
| PointOnCircle | 5 | dist(pt,center) - r |
| P2LDistance | 6 | signed_dist - value |
| ArcAngle | 2 | (end-start) - value |
| LengthRatio | 8 | len(A)/len(B) - ratio |

**Files**: `core/include/core/solver.hpp`, `core/src/solver.cpp`

## Task D: libdxfrw Integration

- Git submodule: `deps/libdxfrw` (LibreCAD/libdxfrw, GPL v2+)
- CadgfDrwAdapter: DRW_Interface → cadgf_document bridge
- Supports: Point, Line, Arc, Circle, Ellipse, LWPolyline, Text, MText
- Auto-layer creation from DXF layer table
- CMake: `add_subdirectory` with policy/warning suppression

**Files**: `plugins/dxf_libdxfrw_adapter.hpp/cpp`, `plugins/CMakeLists.txt`, `CMakeLists.txt`
