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

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef uint64_t core_entity_id;

typedef struct core_vec2 { double x; double y; } core_vec2;

typedef struct core_document core_document;

// Version & feature flags
// Returns semantic version string, e.g., "0.1.0" (static storage)
CORE_API const char* core_get_version();
// Bitflags describing compiled features (earcut/clipper2, etc.)
// bit 0: USE_EARCUT, bit 1: USE_CLIPPER2
CORE_API unsigned int core_get_feature_flags();

CORE_API core_document* core_document_create();
CORE_API void core_document_destroy(core_document* doc);

// Adds a simple polyline entity; points length n
CORE_API core_entity_id core_document_add_polyline(core_document* doc, const core_vec2* pts, int n);
CORE_API int core_document_remove_entity(core_document* doc, core_entity_id id);

// Triangulation C API (stateless)
// First call with indices=nullptr to query index_count; then allocate and call again.
// Returns 1 on success, 0 on failure.
CORE_API int core_triangulate_polygon(const core_vec2* pts, int n,
                                      unsigned int* indices, int* index_count);

// Triangulate multiple rings (outer + holes). Points are flattened; ring_counts has
// the number of points for each ring (including closing point if present).
CORE_API int core_triangulate_polygon_rings(const core_vec2* pts,
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

#ifdef __cplusplus
}
#endif
