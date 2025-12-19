#pragma once

#ifdef _WIN32
#  ifdef CORE_BUILD
#    define CORE_API __declspec(dllexport)
#  else
#    define CORE_API __declspec(dllimport)
#  endif
#else
#  define CORE_API
#endif

#ifndef CADGF_API
#  define CADGF_API CORE_API
#endif

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// ABI stability boundary:
// - cadgf_* C API exported from core_c is the stable external surface.
// - C++ APIs (core::Document, etc.) are internal and not ABI-stable across DLL/DSO.
// - ABI evolution is append-only within a major version; use cadgf_get_version().
typedef uint64_t core_entity_id;

typedef struct core_vec2 { double x; double y; } core_vec2;

typedef struct core_document core_document;

// CADGameFusion C API aliases (preferred external naming)
typedef core_entity_id cadgf_entity_id;
typedef core_vec2      cadgf_vec2;
typedef core_document  cadgf_document;

// Entity types (stable numeric values)
#define CORE_ENTITY_TYPE_POLYLINE 0
#define CADGF_ENTITY_TYPE_POLYLINE CORE_ENTITY_TYPE_POLYLINE

// POD info structs (cross-language friendly). Names are queried via two-call APIs below.
typedef struct core_layer_info {
    int id;
    unsigned int color; // 0xRRGGBB
    int visible;        // 0/1
    int locked;         // 0/1
} core_layer_info;

typedef struct core_entity_info {
    core_entity_id id;
    int type;      // CORE_ENTITY_TYPE_*
    int layer_id;
} core_entity_info;

// Extended entity info (v2): additive fields for editor metadata.
typedef struct core_entity_info_v2 {
    core_entity_id id;
    int type;           // CORE_ENTITY_TYPE_*
    int layer_id;
    int visible;        // 0/1
    int group_id;       // -1 = ungrouped
    unsigned int color; // 0xRRGGBB, 0 = inherit from layer
} core_entity_info_v2;

typedef core_layer_info  cadgf_layer_info;
typedef core_entity_info cadgf_entity_info;
typedef core_entity_info_v2 cadgf_entity_info_v2;

// Return convention
// Most API functions return int: 1 on success, 0 on failure.
#define CORE_SUCCESS 1
#define CORE_FAILURE 0
#define CADGF_SUCCESS CORE_SUCCESS
#define CADGF_FAILURE CORE_FAILURE

// Version & feature flags
// Returns semantic version string, e.g., "0.1.0" (static storage)
CORE_API const char* core_get_version();
// Bitflags describing compiled features (earcut/clipper2, etc.)
// bit 0: USE_EARCUT, bit 1: USE_CLIPPER2
CORE_API unsigned int core_get_feature_flags();
// Feature flag helpers
#define CORE_FEATURE_EARCUT   (1u << 0)
#define CORE_FEATURE_CLIPPER2 (1u << 1)
#define CADGF_FEATURE_EARCUT CORE_FEATURE_EARCUT
#define CADGF_FEATURE_CLIPPER2 CORE_FEATURE_CLIPPER2

// CADGameFusion preferred API names (ABI-level aliases, exported as symbols)
CADGF_API const char* cadgf_get_version();
CADGF_API unsigned int cadgf_get_feature_flags();

CORE_API core_document* core_document_create();
CORE_API void core_document_destroy(core_document* doc);

// Adds a simple polyline entity; points length n
CORE_API core_entity_id core_document_add_polyline(core_document* doc, const core_vec2* pts, int n);
// Adds a polyline with optional name and layer binding.
CORE_API core_entity_id core_document_add_polyline_ex(core_document* doc, const core_vec2* pts, int n,
                                                      const char* name_utf8, int layer_id);
CORE_API int core_document_remove_entity(core_document* doc, core_entity_id id);

CADGF_API cadgf_document* cadgf_document_create();
CADGF_API void cadgf_document_destroy(cadgf_document* doc);
CADGF_API cadgf_entity_id cadgf_document_add_polyline(cadgf_document* doc, const cadgf_vec2* pts, int n);
CADGF_API cadgf_entity_id cadgf_document_add_polyline_ex(cadgf_document* doc, const cadgf_vec2* pts, int n,
                                                         const char* name_utf8, int layer_id);
CADGF_API int cadgf_document_remove_entity(cadgf_document* doc, cadgf_entity_id id);

// Document queries (enumeration, UTF-8 names)
// All returned strings are UTF-8.
// Two-call pattern for names:
//  1) Call with out_name_utf8=nullptr/out_name_capacity=0 to query required bytes (including NUL)
//  2) Allocate buffer and call again to copy; returns 1 on full copy
CORE_API int core_document_get_layer_count(const core_document* doc, int* out_count);
CORE_API int core_document_get_layer_id_at(const core_document* doc, int index, int* out_layer_id);
CORE_API int core_document_get_layer_info(const core_document* doc, int layer_id, core_layer_info* out_info);
CORE_API int core_document_get_layer_name(const core_document* doc, int layer_id,
                                          char* out_name_utf8, int out_name_capacity,
                                          int* out_required_bytes);
CORE_API int core_document_add_layer(core_document* doc, const char* name_utf8, unsigned int color, int* out_layer_id);
CORE_API int core_document_set_layer_visible(core_document* doc, int layer_id, int visible);
CORE_API int core_document_set_layer_locked(core_document* doc, int layer_id, int locked);
CORE_API int core_document_set_layer_color(core_document* doc, int layer_id, unsigned int color);

CORE_API int core_document_get_entity_count(const core_document* doc, int* out_count);
CORE_API int core_document_get_entity_id_at(const core_document* doc, int index, core_entity_id* out_entity_id);
CORE_API int core_document_get_entity_info(const core_document* doc, core_entity_id id, core_entity_info* out_info);
CORE_API int core_document_get_entity_info_v2(const core_document* doc, core_entity_id id, core_entity_info_v2* out_info);
CORE_API int core_document_get_entity_name(const core_document* doc, core_entity_id id,
                                           char* out_name_utf8, int out_name_capacity,
                                           int* out_required_bytes);
// Two-call pattern for polyline points:
//  1) Call with out_pts=nullptr/out_pts_capacity=0 to query point count
//  2) Allocate out_pts[point_count] and call again
CORE_API int core_document_get_polyline_points(const core_document* doc, core_entity_id id,
                                               core_vec2* out_pts, int out_pts_capacity,
                                               int* out_required_points);

// Entity property setters (PR4: single source of truth)
CORE_API int core_document_set_entity_visible(core_document* doc, core_entity_id id, int visible);
CORE_API int core_document_set_entity_color(core_document* doc, core_entity_id id, unsigned int color);
CORE_API int core_document_set_entity_group_id(core_document* doc, core_entity_id id, int group_id);

CADGF_API int cadgf_document_get_layer_count(const cadgf_document* doc, int* out_count);
CADGF_API int cadgf_document_get_layer_id_at(const cadgf_document* doc, int index, int* out_layer_id);
CADGF_API int cadgf_document_get_layer_info(const cadgf_document* doc, int layer_id, cadgf_layer_info* out_info);
CADGF_API int cadgf_document_get_layer_name(const cadgf_document* doc, int layer_id,
                                            char* out_name_utf8, int out_name_capacity,
                                            int* out_required_bytes);
CADGF_API int cadgf_document_add_layer(cadgf_document* doc, const char* name_utf8, unsigned int color, int* out_layer_id);
CADGF_API int cadgf_document_set_layer_visible(cadgf_document* doc, int layer_id, int visible);
CADGF_API int cadgf_document_set_layer_locked(cadgf_document* doc, int layer_id, int locked);
CADGF_API int cadgf_document_set_layer_color(cadgf_document* doc, int layer_id, unsigned int color);

CADGF_API int cadgf_document_get_entity_count(const cadgf_document* doc, int* out_count);
CADGF_API int cadgf_document_get_entity_id_at(const cadgf_document* doc, int index, cadgf_entity_id* out_entity_id);
CADGF_API int cadgf_document_get_entity_info(const cadgf_document* doc, cadgf_entity_id id, cadgf_entity_info* out_info);
CADGF_API int cadgf_document_get_entity_info_v2(const cadgf_document* doc, cadgf_entity_id id, cadgf_entity_info_v2* out_info);
CADGF_API int cadgf_document_get_entity_name(const cadgf_document* doc, cadgf_entity_id id,
                                             char* out_name_utf8, int out_name_capacity,
                                             int* out_required_bytes);
CADGF_API int cadgf_document_get_polyline_points(const cadgf_document* doc, cadgf_entity_id id,
                                                 cadgf_vec2* out_pts, int out_pts_capacity,
                                                 int* out_required_points);

// Entity property setters (PR4: single source of truth)
CADGF_API int cadgf_document_set_entity_visible(cadgf_document* doc, cadgf_entity_id id, int visible);
CADGF_API int cadgf_document_set_entity_color(cadgf_document* doc, cadgf_entity_id id, unsigned int color);
CADGF_API int cadgf_document_set_entity_group_id(cadgf_document* doc, cadgf_entity_id id, int group_id);

// Triangulation C API (stateless)
// Two-call pattern:
//  1) Call with indices=nullptr to query index_count (output)
//  2) Allocate indices buffer and call again to fill
// Winding convention (recommended):
//  - CCW for outer rings, CW for holes
// Returns 1 on success, 0 on failure.
CORE_API int core_triangulate_polygon(const core_vec2* pts, int n,
                                      unsigned int* indices, int* index_count);

// Triangulate multiple rings (outer + holes). Points are flattened; ring_counts holds
// the number of points for each ring (including closing point if present).
// Recommended winding: outer CCW, holes CW. Rings should be non-self-intersecting.
CORE_API int core_triangulate_polygon_rings(const core_vec2* pts,
                                            const int* ring_counts,
                                            int ring_count,
                                            unsigned int* indices,
                                            int* index_count);

CADGF_API int cadgf_triangulate_polygon(const cadgf_vec2* pts, int n,
                                        unsigned int* indices, int* index_count);
CADGF_API int cadgf_triangulate_polygon_rings(const cadgf_vec2* pts,
                                              const int* ring_counts,
                                              int ring_count,
                                              unsigned int* indices,
                                              int* index_count);

// Boolean & Offset (single-contour helpers)
// op: 0=union, 1=difference, 2=intersection, 3=xor
// Two-call pattern:
//  - Call with out_pts=null or out_counts=null to query poly_count & total_pts
//  - Then allocate arrays and call again to fill
CORE_API int core_boolean_op_single(const core_vec2* subj, int subj_n,
                                    const core_vec2* clip, int clip_n,
                                    int op,
                                    core_vec2* out_pts, int* out_counts,
                                    int* poly_count, int* total_pts);

CORE_API int core_offset_single(const core_vec2* poly, int n, double delta,
                                core_vec2* out_pts, int* out_counts,
                                int* poly_count, int* total_pts);

// Boolean & Offset for multiple rings (outer + holes), flattened input
// fill_rule: 0=NonZero, 1=EvenOdd; join_type: 0=Miter,1=Round,2=Bevel
CORE_API int core_boolean_op_multi(const core_vec2* subj_pts, const int* subj_counts, int subj_ring_count,
                                   const core_vec2* clip_pts, const int* clip_counts, int clip_ring_count,
                                   int op, int fill_rule,
                                   core_vec2* out_pts, int* out_counts, int* poly_count, int* total_pts);

CORE_API int core_offset_multi(const core_vec2* pts, const int* ring_counts, int ring_count,
                               double delta, int join_type, double miter_limit,
                               core_vec2* out_pts, int* out_counts, int* poly_count, int* total_pts);

CADGF_API int cadgf_boolean_op_single(const cadgf_vec2* subj, int subj_n,
                                      const cadgf_vec2* clip, int clip_n,
                                      int op,
                                      cadgf_vec2* out_pts, int* out_counts,
                                      int* poly_count, int* total_pts);

CADGF_API int cadgf_offset_single(const cadgf_vec2* poly, int n, double delta,
                                  cadgf_vec2* out_pts, int* out_counts,
                                  int* poly_count, int* total_pts);

CADGF_API int cadgf_boolean_op_multi(const cadgf_vec2* subj_pts, const int* subj_counts, int subj_ring_count,
                                     const cadgf_vec2* clip_pts, const int* clip_counts, int clip_ring_count,
                                     int op, int fill_rule,
                                     cadgf_vec2* out_pts, int* out_counts, int* poly_count, int* total_pts);

CADGF_API int cadgf_offset_multi(const cadgf_vec2* pts, const int* ring_counts, int ring_count,
                                 double delta, int join_type, double miter_limit,
                                 cadgf_vec2* out_pts, int* out_counts, int* poly_count, int* total_pts);

#ifdef __cplusplus
}
#endif
