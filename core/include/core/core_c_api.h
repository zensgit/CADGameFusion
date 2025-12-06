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

// Return convention
// Most API functions return int: 1 on success, 0 on failure.
#define CORE_SUCCESS 1
#define CORE_FAILURE 0

// Version & feature flags
// Returns semantic version string, e.g., "0.1.0" (static storage)
CORE_API const char* core_get_version();
// Bitflags describing compiled features (earcut/clipper2, etc.)
// bit 0: USE_EARCUT, bit 1: USE_CLIPPER2
CORE_API unsigned int core_get_feature_flags();
// Feature flag helpers
#define CORE_FEATURE_EARCUT   (1u << 0)
#define CORE_FEATURE_CLIPPER2 (1u << 1)

CORE_API core_document* core_document_create();
CORE_API void core_document_destroy(core_document* doc);

// Adds a simple polyline entity; points length n
CORE_API core_entity_id core_document_add_polyline(core_document* doc, const core_vec2* pts, int n);
CORE_API int core_document_remove_entity(core_document* doc, core_entity_id id);

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
