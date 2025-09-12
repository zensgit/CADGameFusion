# Design Notes

This document tracks key design choices and areas to revisit as the project evolves.

## Architecture
- Core library (C++): geometry/ops/doc/commands; pure logic, no UI/engine deps.
- C API wrapper (`core_c`): stable ABI surface for engines/tools.
- Frontends: Qt editor (desktop), adapters (Unity/Unreal), scripts (future: Python).
- Data: internal doc (params + shapes), exports (glTF meshes + JSON aux data).

## 2D Ops
- Triangulation: earcut (header-only). Future: multi-rings/holes fully wired.
- Boolean/Offset: Clipper2 with configurable join types; input normalization (close rings, orientation).
- Tolerances: keep epsilon centralized; avoid hardcoding in algorithms.

## Editor UX
- Canvas uses cosmetic pens so line width is zoom-invariant.
- Hit-testing: back-to-front scan with pixel thresholds; future: quadtree acceleration.
- Grouping semantics: each action gets a groupId; delete-single vs delete-similar behaviors.

## 3D Evolution (preview)
- Sketches: 2D constraints + dimensions; references to 3D planes, axes.
- Features: start with mesh-based extrude/revolve; evaluate OCCT for B-Rep path.
- Visualization: simple GL widget or Qt+bgfx; selection/highlight pipeline.

## Interop
- Unity: P/Invoke into `core_c`; file-based hot reload to start; later IPC.
- Unreal: C++ module directly linking core; Blueprint nodes for common ops.
- Formats: glTF for meshes, JSON for collision/nav; preserve instancing and units.

## Testing & Stability
- Golden geometry tests; fuzz for boolean/offset; CI artifacts for regression.
- Error handling: return codes in C API; detailed logs in core (later).

## Performance
- Dirty-prop and incremental recompute in doc graph (future).
- Spatial structures (BVH/quadtree) for selection and culling.

## Open Questions
- Stable topology IDs across edits (naming, references).
- Undo/redo model across core and frontends (command journaling).
- Scripting surface (Python): which subset and lifetime rules.

