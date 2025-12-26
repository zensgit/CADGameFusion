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
// - ABI evolution is append-only within a major version; use cadgf_get_abi_version().
typedef uint64_t core_entity_id;

typedef struct core_vec2 { double x; double y; } core_vec2;
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
typedef struct core_ellipse {
    core_vec2 center;
    double rx;
    double ry;
    double rotation;
    double start_angle;
    double end_angle;
} core_ellipse;

typedef struct core_document core_document;

// CADGameFusion C API aliases (preferred external naming)
typedef core_entity_id cadgf_entity_id;
typedef core_vec2      cadgf_vec2;
typedef core_point     cadgf_point;
typedef core_line      cadgf_line;
typedef core_arc       cadgf_arc;
typedef core_circle    cadgf_circle;
typedef core_ellipse   cadgf_ellipse;
typedef core_document  cadgf_document;

// Entity types (stable numeric values)
#define CORE_ENTITY_TYPE_POLYLINE 0
#define CORE_ENTITY_TYPE_POINT 1
#define CORE_ENTITY_TYPE_LINE 2
#define CORE_ENTITY_TYPE_ARC 3
#define CORE_ENTITY_TYPE_CIRCLE 4
#define CORE_ENTITY_TYPE_ELLIPSE 5
#define CORE_ENTITY_TYPE_SPLINE 6
#define CORE_ENTITY_TYPE_TEXT 7
#define CORE_ENTITY_TYPE_HATCH 8
#define CADGF_ENTITY_TYPE_POLYLINE CORE_ENTITY_TYPE_POLYLINE
#define CADGF_ENTITY_TYPE_POINT CORE_ENTITY_TYPE_POINT
#define CADGF_ENTITY_TYPE_LINE CORE_ENTITY_TYPE_LINE
#define CADGF_ENTITY_TYPE_ARC CORE_ENTITY_TYPE_ARC
#define CADGF_ENTITY_TYPE_CIRCLE CORE_ENTITY_TYPE_CIRCLE
#define CADGF_ENTITY_TYPE_ELLIPSE CORE_ENTITY_TYPE_ELLIPSE
#define CADGF_ENTITY_TYPE_SPLINE CORE_ENTITY_TYPE_SPLINE
#define CADGF_ENTITY_TYPE_TEXT CORE_ENTITY_TYPE_TEXT
#define CADGF_ENTITY_TYPE_HATCH CORE_ENTITY_TYPE_HATCH

// POD info structs (cross-language friendly). Names are queried via two-call APIs below.
typedef struct core_layer_info {
    int id;
    unsigned int color; // 0xRRGGBB
    int visible;        // 0/1
    int locked;         // 0/1
} core_layer_info;

// Extended layer info (v2): additive fields for layer state.
typedef struct core_layer_info_v2 {
    int id;
    unsigned int color; // 0xRRGGBB
    int visible;        // 0/1
    int locked;         // 0/1
    int printable;      // 0/1
    int frozen;         // 0/1
    int construction;   // 0/1
} core_layer_info_v2;

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
typedef core_layer_info_v2 cadgf_layer_info_v2;
typedef core_entity_info cadgf_entity_info;
typedef core_entity_info_v2 cadgf_entity_info_v2;

// Return convention
// Most API functions return int: 1 on success, 0 on failure.
#define CORE_SUCCESS 1
#define CORE_FAILURE 0
#define CADGF_SUCCESS CORE_SUCCESS
#define CADGF_FAILURE CORE_FAILURE

// Version & feature flags
// ABI level (increment on breaking changes)
#define CORE_ABI_VERSION 1
#define CADGF_ABI_VERSION CORE_ABI_VERSION
CORE_API int core_get_abi_version();
CADGF_API int cadgf_get_abi_version();
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
CORE_API core_entity_id core_document_add_point(core_document* doc, const core_point* p,
                                                const char* name_utf8, int layer_id);
CORE_API core_entity_id core_document_add_line(core_document* doc, const core_line* l,
                                               const char* name_utf8, int layer_id);
CORE_API core_entity_id core_document_add_arc(core_document* doc, const core_arc* a,
                                              const char* name_utf8, int layer_id);
CORE_API core_entity_id core_document_add_circle(core_document* doc, const core_circle* c,
                                                 const char* name_utf8, int layer_id);
CORE_API core_entity_id core_document_add_ellipse(core_document* doc, const core_ellipse* e,
                                                  const char* name_utf8, int layer_id);
CORE_API core_entity_id core_document_add_text(core_document* doc, const core_vec2* pos,
                                               double height, double rotation,
                                               const char* text_utf8,
                                               const char* name_utf8, int layer_id);
CORE_API core_entity_id core_document_add_spline(core_document* doc,
                                                 const core_vec2* control_pts, int control_count,
                                                 const double* knots, int knot_count,
                                                 int degree, const char* name_utf8, int layer_id);
CORE_API int core_document_remove_entity(core_document* doc, core_entity_id id);

CADGF_API cadgf_document* cadgf_document_create();
CADGF_API void cadgf_document_destroy(cadgf_document* doc);
CADGF_API cadgf_entity_id cadgf_document_add_polyline(cadgf_document* doc, const cadgf_vec2* pts, int n);
CADGF_API cadgf_entity_id cadgf_document_add_polyline_ex(cadgf_document* doc, const cadgf_vec2* pts, int n,
                                                         const char* name_utf8, int layer_id);
CADGF_API cadgf_entity_id cadgf_document_add_point(cadgf_document* doc, const cadgf_point* p,
                                                   const char* name_utf8, int layer_id);
CADGF_API cadgf_entity_id cadgf_document_add_line(cadgf_document* doc, const cadgf_line* l,
                                                  const char* name_utf8, int layer_id);
CADGF_API cadgf_entity_id cadgf_document_add_arc(cadgf_document* doc, const cadgf_arc* a,
                                                 const char* name_utf8, int layer_id);
CADGF_API cadgf_entity_id cadgf_document_add_circle(cadgf_document* doc, const cadgf_circle* c,
                                                    const char* name_utf8, int layer_id);
CADGF_API cadgf_entity_id cadgf_document_add_ellipse(cadgf_document* doc, const cadgf_ellipse* e,
                                                     const char* name_utf8, int layer_id);
CADGF_API cadgf_entity_id cadgf_document_add_text(cadgf_document* doc, const cadgf_vec2* pos,
                                                  double height, double rotation,
                                                  const char* text_utf8,
                                                  const char* name_utf8, int layer_id);
CADGF_API cadgf_entity_id cadgf_document_add_spline(cadgf_document* doc,
                                                    const cadgf_vec2* control_pts, int control_count,
                                                    const double* knots, int knot_count,
                                                    int degree, const char* name_utf8, int layer_id);
CADGF_API int cadgf_document_remove_entity(cadgf_document* doc, cadgf_entity_id id);

// Document queries (enumeration, UTF-8 names)
// All returned strings are UTF-8.
// Two-call pattern for names:
//  1) Call with out_name_utf8=nullptr/out_name_capacity=0 to query required bytes (including NUL)
//  2) Allocate buffer and call again to copy; returns 1 on full copy
CORE_API int core_document_get_layer_count(const core_document* doc, int* out_count);
CORE_API int core_document_get_layer_id_at(const core_document* doc, int index, int* out_layer_id);
CORE_API int core_document_get_layer_info(const core_document* doc, int layer_id, core_layer_info* out_info);
CORE_API int core_document_get_layer_info_v2(const core_document* doc, int layer_id, core_layer_info_v2* out_info);
CORE_API int core_document_get_layer_name(const core_document* doc, int layer_id,
                                          char* out_name_utf8, int out_name_capacity,
                                          int* out_required_bytes);
CORE_API int core_document_add_layer(core_document* doc, const char* name_utf8, unsigned int color, int* out_layer_id);
CORE_API int core_document_set_layer_visible(core_document* doc, int layer_id, int visible);
CORE_API int core_document_set_layer_locked(core_document* doc, int layer_id, int locked);
CORE_API int core_document_set_layer_printable(core_document* doc, int layer_id, int printable);
CORE_API int core_document_set_layer_frozen(core_document* doc, int layer_id, int frozen);
CORE_API int core_document_set_layer_construction(core_document* doc, int layer_id, int construction);
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
// Updates a polyline's points; returns 1 on success, 0 on failure.
CORE_API int core_document_set_polyline_points(core_document* doc, core_entity_id id,
                                               const core_vec2* pts, int n);
CORE_API int core_document_get_point(const core_document* doc, core_entity_id id, core_point* out_p);
CORE_API int core_document_get_line(const core_document* doc, core_entity_id id, core_line* out_l);
CORE_API int core_document_get_arc(const core_document* doc, core_entity_id id, core_arc* out_a);
CORE_API int core_document_get_circle(const core_document* doc, core_entity_id id, core_circle* out_c);
CORE_API int core_document_get_ellipse(const core_document* doc, core_entity_id id, core_ellipse* out_e);
CORE_API int core_document_get_text(const core_document* doc, core_entity_id id,
                                    core_vec2* out_pos, double* out_height, double* out_rotation,
                                    char* out_text_utf8, int out_text_capacity,
                                    int* out_required_bytes);
CORE_API int core_document_get_spline(const core_document* doc, core_entity_id id,
                                      core_vec2* out_control_pts, int out_control_capacity,
                                      int* out_required_control_pts,
                                      double* out_knots, int out_knot_capacity,
                                      int* out_required_knots,
                                      int* out_degree);
CORE_API int core_document_set_point(core_document* doc, core_entity_id id, const core_point* p);
CORE_API int core_document_set_line(core_document* doc, core_entity_id id, const core_line* l);
CORE_API int core_document_set_arc(core_document* doc, core_entity_id id, const core_arc* a);
CORE_API int core_document_set_circle(core_document* doc, core_entity_id id, const core_circle* c);
CORE_API int core_document_set_ellipse(core_document* doc, core_entity_id id, const core_ellipse* e);

// Entity property setters (PR4: single source of truth)
CORE_API int core_document_set_entity_visible(core_document* doc, core_entity_id id, int visible);
CORE_API int core_document_set_entity_color(core_document* doc, core_entity_id id, unsigned int color);
CORE_API int core_document_set_entity_group_id(core_document* doc, core_entity_id id, int group_id);
CORE_API int core_document_set_entity_line_type(core_document* doc, core_entity_id id, const char* line_type_utf8);
CORE_API int core_document_get_entity_line_type(const core_document* doc, core_entity_id id,
                                                char* out_utf8, int out_cap, int* out_required);
CORE_API int core_document_set_entity_line_weight(core_document* doc, core_entity_id id, double weight);
CORE_API int core_document_get_entity_line_weight(const core_document* doc, core_entity_id id, double* out_weight);
CORE_API int core_document_set_entity_line_type_scale(core_document* doc, core_entity_id id, double scale);
CORE_API int core_document_get_entity_line_type_scale(const core_document* doc, core_entity_id id, double* out_scale);
// Allocate a new group id (>=1). Returns -1 on failure.
CORE_API int core_document_alloc_group_id(core_document* doc);
// Document settings
CORE_API double core_document_get_unit_scale(const core_document* doc);
CORE_API int core_document_set_unit_scale(core_document* doc, double unit_scale);

// Document metadata (UTF-8, two-call pattern for getters)
CORE_API int core_document_get_label(const core_document* doc, char* out_utf8, int out_cap, int* out_required_bytes);
CORE_API int core_document_set_label(core_document* doc, const char* label_utf8);
CORE_API int core_document_get_author(const core_document* doc, char* out_utf8, int out_cap, int* out_required_bytes);
CORE_API int core_document_set_author(core_document* doc, const char* author_utf8);
CORE_API int core_document_get_company(const core_document* doc, char* out_utf8, int out_cap, int* out_required_bytes);
CORE_API int core_document_set_company(core_document* doc, const char* company_utf8);
CORE_API int core_document_get_comment(const core_document* doc, char* out_utf8, int out_cap, int* out_required_bytes);
CORE_API int core_document_set_comment(core_document* doc, const char* comment_utf8);
CORE_API int core_document_get_created_at(const core_document* doc, char* out_utf8, int out_cap, int* out_required_bytes);
CORE_API int core_document_set_created_at(core_document* doc, const char* created_at_utf8);
CORE_API int core_document_get_modified_at(const core_document* doc, char* out_utf8, int out_cap, int* out_required_bytes);
CORE_API int core_document_set_modified_at(core_document* doc, const char* modified_at_utf8);
CORE_API int core_document_get_unit_name(const core_document* doc, char* out_utf8, int out_cap, int* out_required_bytes);
CORE_API int core_document_set_unit_name(core_document* doc, const char* unit_name_utf8);

CORE_API int core_document_get_meta_count(const core_document* doc, int* out_count);
CORE_API int core_document_get_meta_key_at(const core_document* doc, int index,
                                           char* out_key_utf8, int out_key_capacity,
                                           int* out_required_bytes);
CORE_API int core_document_get_meta_value(const core_document* doc, const char* key_utf8,
                                          char* out_value_utf8, int out_value_capacity,
                                          int* out_required_bytes);
CORE_API int core_document_set_meta_value(core_document* doc, const char* key_utf8, const char* value_utf8);
CORE_API int core_document_remove_meta_value(core_document* doc, const char* key_utf8);

CADGF_API int cadgf_document_get_layer_count(const cadgf_document* doc, int* out_count);
CADGF_API int cadgf_document_get_layer_id_at(const cadgf_document* doc, int index, int* out_layer_id);
CADGF_API int cadgf_document_get_layer_info(const cadgf_document* doc, int layer_id, cadgf_layer_info* out_info);
CADGF_API int cadgf_document_get_layer_info_v2(const cadgf_document* doc, int layer_id, cadgf_layer_info_v2* out_info);
CADGF_API int cadgf_document_get_layer_name(const cadgf_document* doc, int layer_id,
                                            char* out_name_utf8, int out_name_capacity,
                                            int* out_required_bytes);
CADGF_API int cadgf_document_add_layer(cadgf_document* doc, const char* name_utf8, unsigned int color, int* out_layer_id);
CADGF_API int cadgf_document_set_layer_visible(cadgf_document* doc, int layer_id, int visible);
CADGF_API int cadgf_document_set_layer_locked(cadgf_document* doc, int layer_id, int locked);
CADGF_API int cadgf_document_set_layer_printable(cadgf_document* doc, int layer_id, int printable);
CADGF_API int cadgf_document_set_layer_frozen(cadgf_document* doc, int layer_id, int frozen);
CADGF_API int cadgf_document_set_layer_construction(cadgf_document* doc, int layer_id, int construction);
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
CADGF_API int cadgf_document_set_polyline_points(cadgf_document* doc, cadgf_entity_id id,
                                                 const cadgf_vec2* pts, int n);
CADGF_API int cadgf_document_get_point(const cadgf_document* doc, cadgf_entity_id id, cadgf_point* out_p);
CADGF_API int cadgf_document_get_line(const cadgf_document* doc, cadgf_entity_id id, cadgf_line* out_l);
CADGF_API int cadgf_document_get_arc(const cadgf_document* doc, cadgf_entity_id id, cadgf_arc* out_a);
CADGF_API int cadgf_document_get_circle(const cadgf_document* doc, cadgf_entity_id id, cadgf_circle* out_c);
CADGF_API int cadgf_document_get_ellipse(const cadgf_document* doc, cadgf_entity_id id, cadgf_ellipse* out_e);
CADGF_API int cadgf_document_get_text(const cadgf_document* doc, cadgf_entity_id id,
                                      cadgf_vec2* out_pos, double* out_height, double* out_rotation,
                                      char* out_text_utf8, int out_text_capacity,
                                      int* out_required_bytes);
CADGF_API int cadgf_document_get_spline(const cadgf_document* doc, cadgf_entity_id id,
                                        cadgf_vec2* out_control_pts, int out_control_capacity,
                                        int* out_required_control_pts,
                                        double* out_knots, int out_knot_capacity,
                                        int* out_required_knots,
                                        int* out_degree);
CADGF_API int cadgf_document_set_point(cadgf_document* doc, cadgf_entity_id id, const cadgf_point* p);
CADGF_API int cadgf_document_set_line(cadgf_document* doc, cadgf_entity_id id, const cadgf_line* l);
CADGF_API int cadgf_document_set_arc(cadgf_document* doc, cadgf_entity_id id, const cadgf_arc* a);
CADGF_API int cadgf_document_set_circle(cadgf_document* doc, cadgf_entity_id id, const cadgf_circle* c);
CADGF_API int cadgf_document_set_ellipse(cadgf_document* doc, cadgf_entity_id id, const cadgf_ellipse* e);

// Entity property setters (PR4: single source of truth)
CADGF_API int cadgf_document_set_entity_visible(cadgf_document* doc, cadgf_entity_id id, int visible);
CADGF_API int cadgf_document_set_entity_color(cadgf_document* doc, cadgf_entity_id id, unsigned int color);
CADGF_API int cadgf_document_set_entity_group_id(cadgf_document* doc, cadgf_entity_id id, int group_id);
CADGF_API int cadgf_document_set_entity_line_type(cadgf_document* doc, cadgf_entity_id id, const char* line_type_utf8);
CADGF_API int cadgf_document_get_entity_line_type(const cadgf_document* doc, cadgf_entity_id id,
                                                  char* out_utf8, int out_cap, int* out_required);
CADGF_API int cadgf_document_set_entity_line_weight(cadgf_document* doc, cadgf_entity_id id, double weight);
CADGF_API int cadgf_document_get_entity_line_weight(const cadgf_document* doc, cadgf_entity_id id, double* out_weight);
CADGF_API int cadgf_document_set_entity_line_type_scale(cadgf_document* doc, cadgf_entity_id id, double scale);
CADGF_API int cadgf_document_get_entity_line_type_scale(const cadgf_document* doc, cadgf_entity_id id, double* out_scale);
// Allocate a new group id (>=1). Returns -1 on failure.
CADGF_API int cadgf_document_alloc_group_id(cadgf_document* doc);
// Document settings
CADGF_API double cadgf_document_get_unit_scale(const cadgf_document* doc);
CADGF_API int cadgf_document_set_unit_scale(cadgf_document* doc, double unit_scale);

CADGF_API int cadgf_document_get_label(const cadgf_document* doc, char* out_utf8, int out_cap, int* out_required_bytes);
CADGF_API int cadgf_document_set_label(cadgf_document* doc, const char* label_utf8);
CADGF_API int cadgf_document_get_author(const cadgf_document* doc, char* out_utf8, int out_cap, int* out_required_bytes);
CADGF_API int cadgf_document_set_author(cadgf_document* doc, const char* author_utf8);
CADGF_API int cadgf_document_get_company(const cadgf_document* doc, char* out_utf8, int out_cap, int* out_required_bytes);
CADGF_API int cadgf_document_set_company(cadgf_document* doc, const char* company_utf8);
CADGF_API int cadgf_document_get_comment(const cadgf_document* doc, char* out_utf8, int out_cap, int* out_required_bytes);
CADGF_API int cadgf_document_set_comment(cadgf_document* doc, const char* comment_utf8);
CADGF_API int cadgf_document_get_created_at(const cadgf_document* doc, char* out_utf8, int out_cap, int* out_required_bytes);
CADGF_API int cadgf_document_set_created_at(cadgf_document* doc, const char* created_at_utf8);
CADGF_API int cadgf_document_get_modified_at(const cadgf_document* doc, char* out_utf8, int out_cap, int* out_required_bytes);
CADGF_API int cadgf_document_set_modified_at(cadgf_document* doc, const char* modified_at_utf8);
CADGF_API int cadgf_document_get_unit_name(const cadgf_document* doc, char* out_utf8, int out_cap, int* out_required_bytes);
CADGF_API int cadgf_document_set_unit_name(cadgf_document* doc, const char* unit_name_utf8);

CADGF_API int cadgf_document_get_meta_count(const cadgf_document* doc, int* out_count);
CADGF_API int cadgf_document_get_meta_key_at(const cadgf_document* doc, int index,
                                             char* out_key_utf8, int out_key_capacity,
                                             int* out_required_bytes);
CADGF_API int cadgf_document_get_meta_value(const cadgf_document* doc, const char* key_utf8,
                                            char* out_value_utf8, int out_value_capacity,
                                            int* out_required_bytes);
CADGF_API int cadgf_document_set_meta_value(cadgf_document* doc, const char* key_utf8, const char* value_utf8);
CADGF_API int cadgf_document_remove_meta_value(cadgf_document* doc, const char* key_utf8);

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
