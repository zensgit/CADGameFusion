# M3 (3D Primer) — Design Document

## Overview

M3 introduces 3D capabilities: sketch/feature data model, extrude mesh generation, feature tree panel, and 3D types foundation. This is Phase 1+2 of the M3 roadmap (6 weeks total).

## Architecture

### Parametric Modeling Pipeline

```
Sketch (2D profile + constraints)
  → Solver resolves constraints (existing 14-type solver)
    → Feature (Extrude/Revolve) with parameters
      → extrude_mesh() generates TriMesh3D
        → Export to glTF / Unity
```

### Dependency Graph Integration (existing)

```
DependencyGraph: Sketch → Feature → Mesh
  - When sketch geometry changes, feature recomputes
  - Topological order ensures correct recompute sequence
  - RecomputeCallback mechanism drives updates
```

## New Core Types (`geometry2d.hpp`)

### 3D Mesh

```cpp
struct TriMesh3D {
    std::vector<Vec3> vertices;
    std::vector<Vec3> normals;     // per-vertex
    std::vector<uint32_t> indices; // 3 per triangle
};
```

### Sketch & Feature

```cpp
enum class SketchPlaneType { XY, XZ, YZ, Custom };
struct SketchPlane { SketchPlaneType type; Plane custom; };

enum class FeatureKind { None, Extrude, Revolve };
struct ExtrudeParams { double height{10.0}; bool symmetric{false}; };
struct RevolveParams { Vec3 axisOrigin; Vec3 axisDirection; double angleDeg{360.0}; };
```

### Pre-existing 3D Foundation

- `Vec3 { x, y, z }` — already existed
- `Line3D { a, b }` — already existed
- `Plane { origin, normal }` — already existed
- `Constraint3DKind` — 10 types (FixedPoint3D, PointOnPlane, etc.)

## Extrude Mesh Generation (`ops2d.cpp`)

### Algorithm

```
Input: closed 2D Polyline + height
Output: TriMesh3D

1. Remove closing point if present
2. Create bottom ring (z=0) with normals (0,0,-1)
3. Create top ring (z=height) with normals (0,0,1)
4. Bottom face: fan triangulation (reversed winding)
5. Top face: fan triangulation
6. Side faces: per-edge quad (4 vertices, 2 triangles)
   - Normal: cross(edge, Z) for outward-facing
```

### Vertex Count

For n profile points: `2n + 4n = 6n` vertices (top+bottom+sides)

### Limitations (M3 scope)

- Fan triangulation only works for convex profiles (earcut integration deferred)
- No boolean operations on 3D solids
- No fillet/chamfer on extruded edges
- Revolve mesh generation deferred to Phase 3-4

## Feature Tree Panel

### UI

```
┌─────────────────────────┐
│ Feature Tree             │
│ ├─ Sketch1    [Sketch]   │
│ │  └─ Extrude1 [Extrude] │
│ └─ Sketch2    [Sketch]   │
└─────────────────────────┘
```

### Data Model

```cpp
struct FeatureEntry {
    int id;
    QString name;
    QString kind;     // "Sketch", "Extrude", "Revolve"
    int parentId{-1}; // -1 = root
};
```

### Signals

- `featureSelected(int id)` — single click
- `featureDoubleClicked(int id)` — double click (enter edit mode)

## Files

| File | Type | Lines | Description |
|------|------|-------|-------------|
| `core/include/core/geometry2d.hpp` | Modified | +37 | TriMesh3D, SketchPlane, FeatureKind, Extrude/RevolveParams |
| `core/src/ops2d.cpp` | Modified | +75 | extrude_mesh() implementation |
| `editor/qt/include/panels/feature_tree_panel.hpp` | New | 31 | FeatureTreePanel declaration |
| `editor/qt/src/panels/feature_tree_panel.cpp` | New | 57 | FeatureTreePanel implementation |
| `tests/core/test_extrude_mesh.cpp` | New | 139 | 6 extrude + type tests |

## M3 Phase Roadmap

| Phase | Content | Status |
|-------|---------|--------|
| **1+2** | **3D types + extrude + feature tree** | **DONE** |
| 3 | 3D viewport (QOpenGLWidget, orbit camera) | Planned |
| 4 | Recompute pipeline (sketch→feature→mesh) + constraint UI | Planned |

## Deferred to Phase 3-4

- QOpenGLWidget 3D viewport with orbit/pan/zoom
- Revolve mesh generation
- Constraint UI (wire solver to editor)
- Sketch editing mode (enter/exit sketch)
- 3D export (glTF with 3D mesh)
- Section view
