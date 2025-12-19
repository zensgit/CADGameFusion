# Core C API v1 — Draft Spec

> Canonical reference (kept in sync with source):
> - `docs/API.md`
> - `core/include/core/core_c_api.h`
>
> Naming: prefer exported symbols with the stable prefix **`cadgf_*`**. Legacy **`core_*`** symbols are kept as compatibility aliases.

## Goals

- Provide a stable C ABI for engines/tools (Unity, CLI) over the C++ core.
- Avoid C++ ABI/CRT issues across DLL boundaries (especially Windows).
- No STL types, no exceptions across the ABI boundary.

## Conventions

- Headers: C-compatible with `extern "C"` guards.
- Return values: most functions return `int` (`1` success, `0` failure).
- Memory: caller-allocated buffers; use **two-call** query-then-fill where sizes are unknown.
- Coordinates: `double` (2D).
- Winding (recommended): outer rings CCW, holes CW.

## Implemented surface (today)

### Version & features

- `const char* cadgf_get_version(void);`
- `unsigned int cadgf_get_feature_flags(void);` (`CADGF_FEATURE_EARCUT`, `CADGF_FEATURE_CLIPPER2`)

### Document (minimal entity model)

- `cadgf_document* cadgf_document_create(void);`
- `void cadgf_document_destroy(cadgf_document* doc);`
- `cadgf_entity_id cadgf_document_add_polyline(_ex)(...);`
- `int cadgf_document_remove_entity(...);`
- `int cadgf_document_alloc_group_id(cadgf_document* doc);` (>=1, -1 on failure)
- Query APIs: layer/entity enumeration + UTF-8 name two-call patterns

### Geometry ops (stateless)

- Triangulation:
  - `int cadgf_triangulate_polygon(...);`
  - `int cadgf_triangulate_polygon_rings(...);` (earcut-only backend; fails if unavailable)
- Boolean/Offset:
  - `int cadgf_boolean_op_single/multi(...);`
  - `int cadgf_offset_single/multi(...);`

## Notes

- ABI evolution: keep v1 **append-only**; add new functions/types instead of changing existing layouts.
- If a backend is not compiled in (earcut/Clipper2), related functions may fail and feature flags must be checked at runtime.
