# Entity and Constraint Mapping (CADGameFusion)

This document maps entity types and constraint types from reference CAD code
to CADGameFusion's current and target model. It is based on code inspection
under `references/`.

## Sources (code references)

- CADGameFusion
  - `core/include/core/document.hpp`
  - `core/include/core/core_c_api.h`
  - `core/src/solver.cpp`
- FreeCAD
  - `references/freecad/src/Mod/Sketcher/App/Sketch.h` (GeoType)
  - `references/freecad/src/Mod/Sketcher/App/Constraint.h` (ConstraintType)
  - `references/freecad/src/App/Document.h` (Document properties)
- LibreCAD
  - `references/librecad/librecad/src/lib/engine/rs.h` (RS2::EntityType)
  - `references/librecad/librecad/src/lib/engine/document/rs_document.h`
  - `references/librecad/librecad/src/lib/engine/document/entities/rs_entity.h`

## CADGameFusion Baseline (current)

- Entities: `Polyline` only.
- Layers: `Layer {id, name, color, visible, locked}`.
- Per-entity metadata: `visible`, `groupId`, `color`.
- Constraints: solver recognizes `horizontal`, `vertical`, `distance`,
  `parallel`, `perpendicular`, `equal` (string types).
- Stable ABI: C API in `core_c_api.h` exposes polyline-only operations.

## Entity Mapping (reference -> CADGameFusion)

Priority legend:
- P0: Minimum viable for 2D CAD + DXF import
- P1: Next for practical CAD workflows
- P2: Advanced or specialized
- P3: Long-term or optional

### Core 2D primitives

- Point
  - FreeCAD: `Sketch::Point`
  - LibreCAD: `EntityPoint`
  - CADGF target: `Point {x,y}`
  - Priority: P0

- Line
  - FreeCAD: `Sketch::Line`
  - LibreCAD: `EntityLine`
  - CADGF target: `Line {p0, p1}`
  - Priority: P0

- Arc
  - FreeCAD: `Sketch::Arc`
  - LibreCAD: `EntityArc`
  - CADGF target: `Arc {center, radius, startAngle, endAngle}` or `Arc {p0,p1,mid}`
  - Priority: P0

- Circle
  - FreeCAD: `Sketch::Circle`
  - LibreCAD: `EntityCircle`
  - CADGF target: `Circle {center, radius}`
  - Priority: P0

- Ellipse
  - FreeCAD: `Sketch::Ellipse`
  - LibreCAD: `EntityEllipse`
  - CADGF target: `Ellipse {center, rx, ry, rotation}`
  - Priority: P1

- Polyline
  - FreeCAD: not a Sketcher primitive
  - LibreCAD: `EntityPolyline`
  - CADGF target: already implemented
  - Priority: P0 (already)

- Spline / BSpline
  - FreeCAD: `Sketch::BSpline`
  - LibreCAD: `EntitySpline`, `EntitySplinePoints`
  - CADGF target: `Spline {controlPoints, degree, knots}` or approximate to polyline
  - Priority: P1

### Conic extensions (advanced sketch)

- Arc of Ellipse / Hyperbola / Parabola
  - FreeCAD: `ArcOfEllipse`, `ArcOfHyperbola`, `ArcOfParabola`
  - LibreCAD: `EntityHyperbola`, `EntityParabola`
  - CADGF target: conic arcs or approximate to spline/polyline
  - Priority: P2

### Filled geometry and regions

- Hatch
  - FreeCAD: via Part/Sketcher (not a base GeoType)
  - LibreCAD: `EntityHatch`
  - CADGF target: `Hatch {loops, pattern, angle, scale}`
  - Priority: P1 (useful for area/region)

- Solid (2D)
  - LibreCAD: `EntitySolid`
  - CADGF target: `Solid {loop}` or map to hatch/filled polyline
  - Priority: P1

### Text and annotation

- Text / MText
  - FreeCAD: label/annotations in App/Gui modules
  - LibreCAD: `EntityText`, `EntityMText`
  - CADGF target: `Text {string, pos, height, rotation, style}`
  - Priority: P1 (for drawing outputs)

### Dimensions (annotation)

LibreCAD exposes a full dimension taxonomy:
`EntityDimAligned`, `EntityDimLinear`, `EntityDimRadial`, `EntityDimDiametric`,
`EntityDimAngular`, `EntityDimArc`, `EntityDimOrdinate`, `EntityDimLeader`,
`EntityTolerance`, `EntityDimArrowBlock`.

CADGF target:
- A `Dimension` entity with subtype and references to geometry points/edges.
- Minimal fields: `dimType`, `refA`, `refB`, `text`, `style`.
- Priority: P2 (after primitives + text)

### Blocks / Inserts / Images

- Blocks and inserts
  - LibreCAD: `EntityBlock`, `EntityInsert`
  - CADGF target: `BlockDef` + `BlockInstance {transform}`
  - Priority: P2 (needed for DXF block support)

- Image
  - LibreCAD: `EntityImage`
  - CADGF target: `Image {path, origin, size, rotation}`
  - Priority: P3

## Constraint Mapping (FreeCAD -> CADGameFusion)

FreeCAD constraint list (from `Sketcher::ConstraintType`):
`Coincident, Horizontal, Vertical, Parallel, Tangent, Distance, DistanceX,
DistanceY, Angle, Perpendicular, Radius, Equal, PointOnObject, Symmetric,
InternalAlignment, SnellsLaw, Block, Diameter, Weight`.

CADGF solver current types: `horizontal`, `vertical`, `distance`, `parallel`,
`perpendicular`, `equal`.

Mapping and priority:

- Coincident -> `coincident` (new)
  - Priority: P0
  - Reason: essential for sketch connectivity

- Horizontal / Vertical -> existing
  - Priority: P0 (already)

- Parallel / Perpendicular -> existing
  - Priority: P0 (already)

- Distance -> existing
  - Priority: P0 (already)

- DistanceX / DistanceY -> `distance_x`, `distance_y`
  - Priority: P1

- Angle -> `angle`
  - Priority: P1

- Tangent -> `tangent`
  - Priority: P1

- Radius / Diameter -> `radius`, `diameter`
  - Priority: P1

- Equal -> `equal` (already)
  - Priority: P1

- PointOnObject -> `point_on_object`
  - Priority: P1

- Symmetric -> `symmetric`
  - Priority: P2

- InternalAlignment -> `internal_alignment`
  - Priority: P2 (for conic and spline internals)

- Block / SnellsLaw / Weight
  - Priority: P3 (specialized)

## Implications for CADGameFusion Data Model

To support the mapping above, CADGF needs:

- Entity payloads (replace `shared_ptr<void>` with a tagged variant).
- Sub-entity references for constraints:
  - Example: `EntityRef {entityId, pointRole}` where pointRole is
    `start`, `end`, `mid`, `center`, `controlPoint`, etc.
  - This mirrors FreeCAD's `GeoElementId` concept.
- Dimension entity references to geometry endpoints/edges.
- Optional blocks with transforms for DXF block import.

## Licensing Note (reference only)

- FreeCAD: LGPL 2.1
- LibreCAD: GPLv2

These are safe for architectural reference, but avoid direct code reuse
inside CADGameFusion core unless license strategy is explicitly decided.
