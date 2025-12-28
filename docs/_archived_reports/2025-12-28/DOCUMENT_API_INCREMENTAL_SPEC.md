# Document and C API Incremental Spec (P0-P1)

This spec defines the minimal, append-only changes to CADGameFusion
Document and C ABI to cover core 2D entities and sketch constraints.
It builds on `docs/ENTITY_CONSTRAINT_MAPPING.md`.

## Goals

- Add core 2D entity types required for CAD workflows and DXF import.
- Keep C ABI stable (append-only changes in `core_c_api.h`).
- Provide a clean path to constraints that reference sub-entity points.
- Keep changes small enough to ship incrementally.

## Non-goals

- Full 3D kernel or B-Rep.
- Full DXF dimension/style fidelity (later phase).
- Breaking changes to existing C API or JSON outputs.

## Phase Targets

P0 (minimum viable 2D):
- Point, Line, Arc, Circle, Polyline (existing).
- Coincident constraint + basic 2D constraints.

P1 (practical 2D drawing):
- Ellipse, Spline, Text, Hatch (optional).
- DistanceX/DistanceY, Angle, Tangent, Radius/Diameter constraints.

## C++ Document Model Changes (core/include/core/document.hpp)

### Entity Types

Extend `EntityType`:
- Point
- Line
- Arc
- Circle
- Polyline (existing)
- Ellipse (P1)
- Spline (P1)
- Text (P1)
- Hatch (P1, optional)
- Dimension (P2, placeholder)
- BlockInstance (P2, placeholder)

### Entity Payload Variant

Replace `std::shared_ptr<void> payload` with a tagged variant:

- `Point { Vec2 p; }`
- `Line { Vec2 a; Vec2 b; }`
- `Arc { Vec2 center; double radius; double start_angle; double end_angle; int clockwise; }`
- `Circle { Vec2 center; double radius; }`
- `Polyline { std::vector<Vec2> points; }` (existing)
- `Ellipse { Vec2 center; double rx; double ry; double rotation; double start_angle; double end_angle; }` (P1)
- `Spline { int degree; std::vector<Vec2> control_points; std::vector<double> knots; }` (P1)
- `Text { Vec2 pos; double height; double rotation; std::string text; }` (P1)

### Per-entity style fields

Add optional fields to `Entity` for drawing fidelity:

- `std::string line_type;`  // empty = inherit
- `double line_weight;`     // <= 0 = inherit
- `double line_type_scale;` // 0 = default

### Sub-entity reference for constraints

Introduce a stable reference type:

- `enum class PointRole { None, Start, End, Mid, Center, ControlPoint };`
- `struct ElementRef { EntityId id; PointRole role; int index; };`

`index` is used for polylines/splines (control point index).

## C API Changes (core/include/core/core_c_api.h)

Append-only new types and functions.

### New POD structs

- `core_point { core_vec2 p; }`
- `core_line { core_vec2 a; core_vec2 b; }`
- `core_arc { core_vec2 center; double radius; double start_angle; double end_angle; int clockwise; }`
- `core_circle { core_vec2 center; double radius; }`
- `core_ellipse { core_vec2 center; double rx; double ry; double rotation; double start_angle; double end_angle; }`

### New entity types

Extend entity type constants:
- `CORE_ENTITY_TYPE_POINT`
- `CORE_ENTITY_TYPE_LINE`
- `CORE_ENTITY_TYPE_ARC`
- `CORE_ENTITY_TYPE_CIRCLE`
- `CORE_ENTITY_TYPE_ELLIPSE`
- `CORE_ENTITY_TYPE_SPLINE`
- `CORE_ENTITY_TYPE_TEXT`
- `CORE_ENTITY_TYPE_HATCH`

### New C API functions (append-only)

P0:
- `core_document_add_point`
- `core_document_add_line`
- `core_document_add_arc`
- `core_document_add_circle`
- `core_document_get_point`
- `core_document_get_line`
- `core_document_get_arc`
- `core_document_get_circle`

P1:
- `core_document_add_ellipse`
- `core_document_get_ellipse`
- `core_document_add_text`
- `core_document_get_text` (two-call for UTF-8 text)

Style (P1):
- `core_document_set_entity_line_type`
- `core_document_get_entity_line_type` (two-call UTF-8)
- `core_document_set_entity_line_weight`
- `core_document_get_entity_line_weight`
- `core_document_set_entity_line_type_scale`
- `core_document_get_entity_line_type_scale`

Note: `cadgf_*` aliases should be added in the same pattern as existing APIs.

## JSON Output Update (tools/convert_cli.cpp)

Extend JSON export for new entity types:

Example (line):
```
{"id": 12, "type": "line", "layer_id": 0, "name": "", "line": [[x0,y0],[x1,y1]]}
```

Example (arc):
```
{"id": 13, "type": "arc", "layer_id": 0, "name": "", "arc": {"c":[x,y],"r":1.0,"a0":0.0,"a1":1.57}}
```

## DXF Import Implications

Minimum DXF entity mapping for P0:
- LINE -> Line
- ARC -> Arc
- CIRCLE -> Circle
- LWPOLYLINE -> Polyline (already)

P1 mapping:
- ELLIPSE -> Ellipse
- SPLINE -> Spline (or polyline approximation)
- TEXT/MTEXT -> Text
- HATCH -> Hatch (optional)

## Compatibility

- ABI: append-only changes; do not change existing structs.
- API: keep existing functions and names.
- JSON: add new entity objects, keep existing fields.

## Suggested Implementation Order

1) Add new Entity types and payload variant.
2) Add C API add/get functions for P0 entities.
3) Update convert_cli JSON output to include new entity types.
4) Expand DXF importer to LINE/ARC/CIRCLE.
5) Add constraints referencing `ElementRef` (P0: coincident).
6) Extend for P1 entities and constraints.
