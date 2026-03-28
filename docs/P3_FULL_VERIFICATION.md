# P3 Future Items — Full Verification Record

## Date: 2026-03-28

## Summary
All five P3 items implemented and verified. These extend the FreeCAD-referenced plan from P0-P2 (completed earlier today) into the long-term architecture layer.

---

## P3.1: BFGS Solver ✅

**Files**: `core/include/core/solver.hpp`, `core/src/solver.cpp`

**Architecture**:
- `BFGSSolver` class implementing `ISolver` — quasi-Newton method using gradient (J^T r) via finite differences
- Minimizes F(x) = 0.5 * ||r(x)||^2 without explicit Jacobian
- BFGS inverse Hessian update (Sherman-Morrison-Woodbury)
- Backtracking line search with Armijo condition
- Available via `createSolver(SolverAlgorithm::BFGS)`
- Shared `residual_for_constraint()` function extracted for all three solver implementations

**FreeCAD ref**: `src/Mod/Sketcher/App/planegcs/GCS.cpp:1948`

**Test results** (4 cases):
```
horizontal: ok=1 err=4.9e-09
distance: ok=1 err=1.1e-08 dist=5
fixed_point: ok=1 p0.x=7 p0.y=3
point_on_line: ok=1 err=4.7e-08
BFGS solver: ALL GREEN
```

---

## P3.2: Dependency Graph + Topological Recompute ✅

**Files**: `core/include/core/document.hpp`, `core/src/document.cpp`

**Architecture**:
- `DependencyGraph` class: directed source→dependent edges, BFS cycle detection, Kahn's topological sort
- `Document` integration: `dependency_graph()`, `set_recompute_callback()`, `recompute(changedIds)`, `recompute_all()`

**FreeCAD ref**: `src/App/Document.cpp recompute()`

**Test results** (6 cases): basic edges, cycle detection, topological order, remove entity, document recompute, recompute_all — ALL GREEN

---

## P3.3: Constraint Visualization Foundation ✅

**Files**: `tools/web_viewer/state/documentState.js`

**Architecture**:
- `getConstraintVisualHints()` method on document state
- Resolves constraint refs (e.g. `"1.start_x"`) to entity coordinates `{x, y, entityId}`
- Returns array of `{id, type, refs, points}` hint objects for rendering overlays
- Supports line (start/end), arc/circle (center) coordinate extraction

**FreeCAD ref**: `src/Mod/Sketcher/Gui/` (visualization layer)

**Verification**: 290/290 JS tests pass (no regression)

---

## P3.4: Cross-Document Transactions ✅

**Files**: `core/include/core/document.hpp`, `core/src/document.cpp`

**Architecture**:
- `TransactionGroup` class — coordinates undo/redo across multiple `Document*` instances
- API: `addDocument()`, `removeDocument()`, `beginGroup(label)`, `commitGroup()`, `rollbackGroup()`, `undoGroup()`, `redoGroup()`
- Non-copyable, null-safe, idempotent registration

**FreeCAD ref**: `src/App/Document.h` cross-document transaction support

**Verification**: Builds clean, no regression

---

## P3.5: 3D Constraint Solver Foundation Types ✅

**Files**: `core/include/core/geometry2d.hpp`

**Types added**:
- `Vec3` — 3D point/vector
- `Line3D` — 3D line segment
- `Plane` — origin + normal
- `Constraint3DKind` enum — 10 values: FixedPoint3D, PointOnPlane, PointOnLine3D, Parallel3D, Perpendicular3D, Distance3D, Angle3D, Coincident3D, Coplanar, Coaxial
- `Constraint3DSpec` — type string + params + optional value

**FreeCAD ref**: `src/Mod/Assembly/App/`

**Verification**: Builds clean (all C++ targets compile)

---

## Test Summary

| Suite | Count | Status |
|---|---|---|
| Solver constraints (14 types) | 77 | ✅ |
| BFGS solver | 4 | ✅ |
| Dependency graph | 6 | ✅ |
| JS editor tests | 290 | ✅ |
| C++ build (all targets) | 5 | ✅ |

## Commits
```
b765df3 feat: P3.1 BFGS solver, P3.3 constraint viz, P3.4 cross-doc tx, P3.5 3D types
a7c91a6 docs: P3.2 dependency graph verification
efe53ab feat: dependency graph + topological recompute (P3.2)
```

## Complete Plan Status (P0-P3)

| Item | Status |
|---|---|
| P0.1 TinyGLTF build fix | ✅ |
| P0.2 suggestFilletRadius | ✅ |
| P0.3 Vertex-pick fillet | ✅ |
| P0.4 DXF import statistics | ✅ |
| P1.1 DogLeg solver + LM fallback | ✅ |
| P1.2 Partitioned solving | ✅ |
| P1.3 5 new constraint types | ✅ |
| P1.4 beforeChange signal | ✅ |
| P1.5 Editor DXF import bridge | ✅ |
| P2.1 Transaction undo | ✅ |
| P2.2 QR DOF | ✅ |
| P2.3 Constraint transfer | ✅ |
| P2.4 Block INSERT refs | ✅ |
| P2.5 DWG converter cascade | ✅ |
| P3.1 BFGS solver | ✅ |
| P3.2 Dependency graph | ✅ |
| P3.3 Constraint visualization | ✅ |
| P3.4 Cross-document transactions | ✅ |
| P3.5 3D solver foundation | ✅ |

**19/19 items complete.**
