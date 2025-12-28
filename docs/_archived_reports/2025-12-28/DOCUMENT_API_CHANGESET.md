# Document + C API Changeset (P0/P1)

This document is the implementable changeset derived from
`docs/ENTITY_CONSTRAINT_MAPPING.md` and
`docs/DOCUMENT_API_INCREMENTAL_SPEC.md`. It lists concrete API additions and
file-level change points.

## P0 API Additions (minimum viable 2D)

### New C++ Document entry points (internal)

Add to `core/include/core/document.hpp`:

- `EntityId add_point(const Vec2& p, const std::string& name = "", int layerId = 0);`
- `EntityId add_line(const Line& l, const std::string& name = "", int layerId = 0);`
- `EntityId add_arc(const Arc& a, const std::string& name = "", int layerId = 0);`
- `EntityId add_circle(const Circle& c, const std::string& name = "", int layerId = 0);`
- `bool set_point(EntityId id, const Vec2& p);`
- `bool set_line(EntityId id, const Line& l);`
- `bool set_arc(EntityId id, const Arc& a);`
- `bool set_circle(EntityId id, const Circle& c);`
- Typed getters for editor/CLI:
  - `const Point* get_point(EntityId id) const;`
  - `const Line* get_line(EntityId id) const;`
  - `const Arc* get_arc(EntityId id) const;`
  - `const Circle* get_circle(EntityId id) const;`

### New C structs + API functions (stable ABI)

Add to `core/include/core/core_c_api.h` (append-only):

```
typedef struct core_point { core_vec2 p; } core_point;
typedef struct core_line { core_vec2 a; core_vec2 b; } core_line;
typedef struct core_arc {
  core_vec2 center;
  double radius;
  double start_angle;
  double end_angle;
  int clockwise; // 0/1
} core_arc;
typedef struct core_circle { core_vec2 center; double radius; } core_circle;
```

Entity type constants:

```
#define CORE_ENTITY_TYPE_POINT 1
#define CORE_ENTITY_TYPE_LINE 2
#define CORE_ENTITY_TYPE_ARC 3
#define CORE_ENTITY_TYPE_CIRCLE 4
```

Functions (core_ + cadgf_ aliases):

```
CORE_API core_entity_id core_document_add_point(core_document* doc, const core_point* p,
                                                const char* name_utf8, int layer_id);
CORE_API core_entity_id core_document_add_line(core_document* doc, const core_line* l,
                                               const char* name_utf8, int layer_id);
CORE_API core_entity_id core_document_add_arc(core_document* doc, const core_arc* a,
                                              const char* name_utf8, int layer_id);
CORE_API core_entity_id core_document_add_circle(core_document* doc, const core_circle* c,
                                                 const char* name_utf8, int layer_id);

CORE_API int core_document_get_point(const core_document* doc, core_entity_id id, core_point* out_p);
CORE_API int core_document_get_line(const core_document* doc, core_entity_id id, core_line* out_l);
CORE_API int core_document_get_arc(const core_document* doc, core_entity_id id, core_arc* out_a);
CORE_API int core_document_get_circle(const core_document* doc, core_entity_id id, core_circle* out_c);

CORE_API int core_document_set_point(core_document* doc, core_entity_id id, const core_point* p);
CORE_API int core_document_set_line(core_document* doc, core_entity_id id, const core_line* l);
CORE_API int core_document_set_arc(core_document* doc, core_entity_id id, const core_arc* a);
CORE_API int core_document_set_circle(core_document* doc, core_entity_id id, const core_circle* c);
```

Notes:
- `core_document_get_entity_info(_v2)` must return new `type` values.
- Provide `cadgf_*` aliases for all functions and structs.

## P1 API Additions (practical 2D)

### New C++ Document entry points (internal)

Add to `core/include/core/document.hpp`:

- `EntityId add_ellipse(const Ellipse& e, const std::string& name = "", int layerId = 0);`
- `EntityId add_spline(const Spline& s, const std::string& name = "", int layerId = 0);`
- `EntityId add_text(const Text& t, const std::string& name = "", int layerId = 0);`
- `bool set_ellipse(EntityId id, const Ellipse& e);`
- `bool set_spline(EntityId id, const Spline& s);`
- `bool set_text(EntityId id, const Text& t);`

### New C structs + API functions (stable ABI)

Add to `core/include/core/core_c_api.h` (append-only):

```
typedef struct core_ellipse {
  core_vec2 center;
  double rx;
  double ry;
  double rotation;
  double start_angle;
  double end_angle;
} core_ellipse;
```

Entity type constants:

```
#define CORE_ENTITY_TYPE_ELLIPSE 5
#define CORE_ENTITY_TYPE_SPLINE 6
#define CORE_ENTITY_TYPE_TEXT 7
#define CORE_ENTITY_TYPE_HATCH 8
```

Functions (core_ + cadgf_ aliases):

```
CORE_API core_entity_id core_document_add_ellipse(core_document* doc, const core_ellipse* e,
                                                  const char* name_utf8, int layer_id);
CORE_API int core_document_get_ellipse(const core_document* doc, core_entity_id id, core_ellipse* out_e);
CORE_API int core_document_set_ellipse(core_document* doc, core_entity_id id, const core_ellipse* e);

CORE_API core_entity_id core_document_add_text(core_document* doc, const core_vec2* pos,
                                               double height, double rotation,
                                               const char* text_utf8,
                                               const char* name_utf8, int layer_id);
CORE_API int core_document_get_text(core_document* doc, core_entity_id id,
                                    core_vec2* out_pos, double* out_height, double* out_rotation,
                                    char* out_text_utf8, int out_text_capacity,
                                    int* out_required_bytes);

CORE_API core_entity_id core_document_add_spline(core_document* doc,
                                                 const core_vec2* control_pts, int control_count,
                                                 const double* knots, int knot_count,
                                                 int degree, const char* name_utf8, int layer_id);
CORE_API int core_document_get_spline(const core_document* doc, core_entity_id id,
                                      core_vec2* out_control_pts, int out_control_capacity,
                                      int* out_required_control_pts,
                                      double* out_knots, int out_knot_capacity,
                                      int* out_required_knots,
                                      int* out_degree);
```

## Per-entity style fields (P1)

Add to `core/include/core/document.hpp` `Entity`:

- `std::string line_type;`
- `double line_weight{0.0};`
- `double line_type_scale{0.0};`

Add to `core/include/core/core_c_api.h`:

```
CORE_API int core_document_set_entity_line_type(core_document* doc, core_entity_id id, const char* line_type_utf8);
CORE_API int core_document_get_entity_line_type(const core_document* doc, core_entity_id id,
                                                char* out_utf8, int out_cap, int* out_required);
CORE_API int core_document_set_entity_line_weight(core_document* doc, core_entity_id id, double weight);
CORE_API int core_document_get_entity_line_weight(const core_document* doc, core_entity_id id, double* out_weight);
CORE_API int core_document_set_entity_line_type_scale(core_document* doc, core_entity_id id, double scale);
CORE_API int core_document_get_entity_line_type_scale(const core_document* doc, core_entity_id id, double* out_scale);
```

## Constraints (P0/P1 delta)

Update `core/include/core/solver.hpp` and `core/src/solver.cpp`:

- Add constraint string constants for:
  - `coincident` (P0)
  - `distance_x`, `distance_y`, `angle`, `tangent`, `radius`, `diameter` (P1)
- Extend residual evaluation to match the new types.

Introduce a sub-entity reference concept in C++ (internal):

- `enum class PointRole { None, Start, End, Mid, Center, ControlPoint };`
- `struct ElementRef { EntityId id; PointRole role; int index; };`

This is needed for constraints like coincident/point-on-object.

## JSON Export Adjustments (tools/convert_cli.cpp)

Extend output to include new entity shapes:

- `point`: `{ "point": [x, y] }`
- `line`: `{ "line": [[x0,y0],[x1,y1]] }`
- `arc`: `{ "arc": {"c":[x,y],"r":r,"a0":a0,"a1":a1,"cw":0} }`
- `circle`: `{ "circle": {"c":[x,y],"r":r} }`
- `ellipse`: `{ "ellipse": {"c":[x,y],"rx":rx,"ry":ry,"rot":rot,"a0":a0,"a1":a1} }`
- `text`: `{ "text": {"pos":[x,y],"h":h,"rot":rot,"value":"..."} }`
- `spline`: `{ "spline": {"degree":d,"control":[...],"knots":[...] } }`

glTF mesh:
- Use polyline approximation for arcs/circles/ellipses/splines
  (coarse P0, configurable later).

## DXF Importer Adjustments (plugins/dxf_importer_plugin.cpp)

P0:
- Add parsing for LINE, ARC, CIRCLE.
- Map layer names -> CADGF layers (existing logic).

P1:
- Add ELLIPSE, SPLINE, TEXT/MTEXT (optional).

## File-Level Changes (exact targets)

Core:

- `core/include/core/geometry2d.hpp`
  - Add `Point`, `Line`, `Arc`, `Circle`, `Ellipse`, `Spline`, `Text` structs.
- `core/include/core/document.hpp`
  - Extend `EntityType`, replace payload with tagged variant.
  - Add new add/get/set methods listed above.
  - Add per-entity line style fields.
- `core/src/document.cpp`
  - Implement new entity creation and setters.
  - Update change notifications for geometry changes.
- `core/include/core/core_c_api.h`
  - Add new entity type constants, structs, and functions.
- `core/src/core_c_api.cpp`
  - Implement new C API functions and type mapping.

Tools/plugins:

- `tools/convert_cli.cpp`
  - JSON and glTF output for new entity types.
- `plugins/dxf_importer_plugin.cpp`
  - Add LINE/ARC/CIRCLE parsing for P0.

Tests:

- `tests/core/test_document_entities.cpp`
  - Update to use new typed getters (payload no longer raw).
- `tests/core/test_c_api_document_query.cpp`
  - Add cases for new entity types.

## Compatibility Guardrails

- Keep C ABI append-only; do not reorder or remove fields.
- Keep existing JSON schema fields; add new per-entity fields only.
- Keep `cadgf_*` aliases in lockstep with `core_*`.
