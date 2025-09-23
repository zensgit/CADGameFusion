# Core C API v1 — Draft Spec

Purpose
- Provide a stable C ABI for engines/tools (Unity, CLI) over the C++ core.

Principles
- C89-compatible headers, `extern "C"` guards.
- Opaque handles for documents and geometry; no STL in headers.
- Versioned API: `core_c_get_version()`, feature bitmask.
- Clear error codes; no exceptions across the ABI boundary.

Types
- `typedef void* core_doc_t;` — opaque document handle
- `typedef int32_t core_err_t;` — error codes (0=OK, >0 errors)
- `typedef struct { float x, y; } core_vec2_t;`
- `typedef struct { const core_vec2_t* pts; int count; } core_ring_view_t;`

Version/feature
- `uint32_t core_c_get_version(void);`
- `uint32_t core_c_get_features(void);` // bit0=EARCUT, bit1=CLIPPER2, etc.

Lifecycle
- `core_doc_t core_doc_create(void);`
- `void core_doc_destroy(core_doc_t d);`
- `core_err_t core_doc_clear(core_doc_t d);`

Editing (MVP)
- `core_err_t core_doc_add_polyline(core_doc_t d, const core_vec2_t* pts, int n);`
- `core_err_t core_doc_add_polygon(core_doc_t d, const core_vec2_t* pts, int n);`
- `core_err_t core_doc_offset(core_doc_t d, float dist);` // offsets last polygon
- `core_err_t core_doc_boolean_union(core_doc_t d);` // union last two polygons

Triangulation
- `core_err_t core_triangulate_rings(const core_ring_view_t* rings, int ring_count, const char* out_path);`
- `core_err_t core_triangulate_flat(const float* xy, int count, const int* ring_counts, int ring_count, const char* out_path);`

Export/Import
- `core_err_t core_doc_export_json(core_doc_t d, const char* dir);`
- `core_err_t core_doc_export_gltf(core_doc_t d, const char* dir);`
- `core_err_t core_doc_import_json(core_doc_t d, const char* path);`

Errors
- `#define CORE_OK 0`
- `#define CORE_EINVAL 1`
- `#define CORE_EIO 2`
- `#define CORE_EUNIMPL 3`

Notes
- Keep binary‑compatible; extend via new functions and feature bits.
- Document ring winding (outer CCW, holes CW) and closure assumptions.

