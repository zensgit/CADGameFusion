#include "core/core_c_api.h"
#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "core/ops2d.hpp"
#include "core/version.hpp"

#include <algorithm>
#include <cstring>

using namespace core;

struct core_document { Document impl; };

extern "C" {

CORE_API const char* core_get_version() {
    return core::version_string();
}

CORE_API unsigned int core_get_feature_flags() {
    unsigned int flags = 0u;
#if defined(USE_EARCUT)
    flags |= 1u << 0;
#endif
#if defined(USE_CLIPPER2)
    flags |= 1u << 1;
#endif
    return flags;
}

CORE_API core_document* core_document_create() {
    return new core_document{Document{}};
}

CORE_API void core_document_destroy(core_document* doc) {
    delete doc;
}

CORE_API core_entity_id core_document_add_polyline(core_document* doc, const core_vec2* pts, int n) {
    if (!doc || !pts || n <= 1) return 0;
    Polyline pl;
    pl.points.reserve(static_cast<size_t>(n));
    for (int i=0;i<n;i++) pl.points.push_back(Vec2{pts[i].x, pts[i].y});
    return doc->impl.add_polyline(pl);
}

CORE_API core_entity_id core_document_add_polyline_ex(core_document* doc, const core_vec2* pts, int n,
                                                      const char* name_utf8, int layer_id) {
    if (!doc || !pts || n <= 1) return 0;
    Polyline pl;
    pl.points.reserve(static_cast<size_t>(n));
    for (int i=0;i<n;i++) pl.points.push_back(Vec2{pts[i].x, pts[i].y});
    return doc->impl.add_polyline(pl, name_utf8 ? name_utf8 : "", layer_id);
}

CORE_API int core_document_remove_entity(core_document* doc, core_entity_id id) {
    if (!doc) return 0;
    return doc->impl.remove_entity(id) ? 1 : 0;
}

static bool copy_utf8(const std::string& s, char* out, int out_cap, int* out_required_bytes) {
    const int required = static_cast<int>(s.size()) + 1; // include NUL
    if (out_required_bytes) *out_required_bytes = required;

    if (!out || out_cap <= 0) return true; // query only

    const int copy_len = std::min(static_cast<int>(s.size()), out_cap - 1);
    if (copy_len > 0) std::memcpy(out, s.data(), static_cast<size_t>(copy_len));
    out[copy_len] = '\0';

    return out_cap >= required;
}

CORE_API int core_document_get_layer_count(const core_document* doc, int* out_count) {
    if (!doc || !out_count) return 0;
    *out_count = static_cast<int>(doc->impl.layers().size());
    return 1;
}

CORE_API int core_document_get_layer_id_at(const core_document* doc, int index, int* out_layer_id) {
    if (!doc || !out_layer_id || index < 0) return 0;
    const auto& layers = doc->impl.layers();
    if (static_cast<size_t>(index) >= layers.size()) return 0;
    *out_layer_id = layers[static_cast<size_t>(index)].id;
    return 1;
}

CORE_API int core_document_get_layer_info(const core_document* doc, int layer_id, core_layer_info* out_info) {
    if (!doc || !out_info) return 0;
    const auto* layer = doc->impl.get_layer(layer_id);
    if (!layer) return 0;
    out_info->id = layer->id;
    out_info->color = static_cast<unsigned int>(layer->color);
    out_info->visible = layer->visible ? 1 : 0;
    out_info->locked = layer->locked ? 1 : 0;
    return 1;
}

CORE_API int core_document_get_layer_name(const core_document* doc, int layer_id,
                                          char* out_name_utf8, int out_name_capacity,
                                          int* out_required_bytes) {
    if (!doc) return 0;
    const auto* layer = doc->impl.get_layer(layer_id);
    if (!layer) return 0;
    const bool ok = copy_utf8(layer->name, out_name_utf8, out_name_capacity, out_required_bytes);
    return ok ? 1 : 0;
}

CORE_API int core_document_add_layer(core_document* doc, const char* name_utf8, unsigned int color, int* out_layer_id) {
    if (!doc || !out_layer_id) return 0;
    *out_layer_id = doc->impl.add_layer(name_utf8 ? name_utf8 : "", static_cast<uint32_t>(color));
    return (*out_layer_id >= 0) ? 1 : 0;
}

CORE_API int core_document_set_layer_visible(core_document* doc, int layer_id, int visible) {
    if (!doc) return 0;
    auto* layer = doc->impl.get_layer(layer_id);
    if (!layer) return 0;
    layer->visible = (visible != 0);
    return 1;
}

CORE_API int core_document_set_layer_locked(core_document* doc, int layer_id, int locked) {
    if (!doc) return 0;
    auto* layer = doc->impl.get_layer(layer_id);
    if (!layer) return 0;
    layer->locked = (locked != 0);
    return 1;
}

CORE_API int core_document_set_layer_color(core_document* doc, int layer_id, unsigned int color) {
    if (!doc) return 0;
    auto* layer = doc->impl.get_layer(layer_id);
    if (!layer) return 0;
    layer->color = static_cast<uint32_t>(color);
    return 1;
}

CORE_API int core_document_get_entity_count(const core_document* doc, int* out_count) {
    if (!doc || !out_count) return 0;
    *out_count = static_cast<int>(doc->impl.entities().size());
    return 1;
}

CORE_API int core_document_get_entity_id_at(const core_document* doc, int index, core_entity_id* out_entity_id) {
    if (!doc || !out_entity_id || index < 0) return 0;
    const auto& ents = doc->impl.entities();
    if (static_cast<size_t>(index) >= ents.size()) return 0;
    *out_entity_id = static_cast<core_entity_id>(ents[static_cast<size_t>(index)].id);
    return 1;
}

static const Entity* find_entity(const Document& d, core_entity_id id) {
    const auto& ents = d.entities();
    for (const auto& e : ents) {
        if (e.id == static_cast<EntityId>(id)) return &e;
    }
    return nullptr;
}

CORE_API int core_document_get_entity_info(const core_document* doc, core_entity_id id, core_entity_info* out_info) {
    if (!doc || !out_info) return 0;
    const auto* e = find_entity(doc->impl, id);
    if (!e) return 0;
    out_info->id = static_cast<core_entity_id>(e->id);
    out_info->type = CORE_ENTITY_TYPE_POLYLINE; // currently only polyline exists in Document
    out_info->layer_id = e->layerId;
    out_info->visible = e->visible ? 1 : 0;
    out_info->group_id = e->groupId;
    out_info->color = static_cast<unsigned int>(e->color);
    return 1;
}

CORE_API int core_document_get_entity_name(const core_document* doc, core_entity_id id,
                                           char* out_name_utf8, int out_name_capacity,
                                           int* out_required_bytes) {
    if (!doc) return 0;
    const auto* e = find_entity(doc->impl, id);
    if (!e) return 0;
    const bool ok = copy_utf8(e->name, out_name_utf8, out_name_capacity, out_required_bytes);
    return ok ? 1 : 0;
}

CORE_API int core_document_get_polyline_points(const core_document* doc, core_entity_id id,
                                               core_vec2* out_pts, int out_pts_capacity,
                                               int* out_required_points) {
    if (!doc || !out_required_points) return 0;
    const auto* e = find_entity(doc->impl, id);
    if (!e || e->type != EntityType::Polyline || !e->payload) return 0;

    const auto* pl = static_cast<const Polyline*>(e->payload.get());
    if (!pl) return 0;

    const int count = static_cast<int>(pl->points.size());
    *out_required_points = count;

    if (!out_pts || out_pts_capacity <= 0) return 1; // query only
    if (out_pts_capacity < count) return 0;

    for (int i = 0; i < count; ++i) out_pts[i] = core_vec2{pl->points[static_cast<size_t>(i)].x, pl->points[static_cast<size_t>(i)].y};
    return 1;
}

CORE_API int core_document_set_entity_visible(core_document* doc, core_entity_id id, int visible) {
    if (!doc) return 0;
    return doc->impl.set_entity_visible(static_cast<EntityId>(id), visible != 0) ? 1 : 0;
}

CORE_API int core_document_set_entity_color(core_document* doc, core_entity_id id, unsigned int color) {
    if (!doc) return 0;
    return doc->impl.set_entity_color(static_cast<EntityId>(id), static_cast<uint32_t>(color)) ? 1 : 0;
}

CORE_API int core_document_set_entity_group_id(core_document* doc, core_entity_id id, int group_id) {
    if (!doc) return 0;
    return doc->impl.set_entity_group_id(static_cast<EntityId>(id), group_id) ? 1 : 0;
}

} // extern C

extern "C" {

CORE_API int core_triangulate_polygon(const core_vec2* pts, int n,
                                      unsigned int* indices, int* index_count) {
    if (!pts || n < 3 || !index_count) return 0;
    std::vector<Vec2> poly;
    poly.reserve(static_cast<size_t>(n));
    for (int i=0;i<n;i++) poly.push_back(Vec2{pts[i].x, pts[i].y});
    TriMesh2D m = triangulate_polygon(poly);
    if (m.indices.empty()) { *index_count = 0; return 0; }
    *index_count = static_cast<int>(m.indices.size());
    if (!indices) return 1; // query only
    for (size_t i=0;i<m.indices.size();++i) indices[i] = m.indices[i];
    return 1;
}

} // extern C

extern "C" {

static core::BoolOp to_boolop(int op) {
    switch (op) {
        case 0: return core::BoolOp::Union;
        case 1: return core::BoolOp::Difference;
        case 2: return core::BoolOp::Intersection;
        case 3: return core::BoolOp::Xor;
        default: return core::BoolOp::Union;
    }
}

CORE_API int core_boolean_op_single(const core_vec2* subj, int subj_n,
                                    const core_vec2* clip, int clip_n,
                                    int op,
                                    core_vec2* out_pts, int* out_counts,
                                    int* poly_count, int* total_pts) {
    if (!subj || subj_n < 3 || !clip || clip_n < 3 || !poly_count || !total_pts) return 0;
    Polyline s; s.points.reserve(subj_n);
    for (int i=0;i<subj_n;i++) s.points.push_back(Vec2{subj[i].x, subj[i].y});
    Polyline c; c.points.reserve(clip_n);
    for (int i=0;i<clip_n;i++) c.points.push_back(Vec2{clip[i].x, clip[i].y});
    std::vector<Polyline> res = boolean_op({s}, {c}, to_boolop(op));
    int pc = static_cast<int>(res.size());
    int tp = 0; for (auto& pl : res) tp += static_cast<int>(pl.points.size());
    *poly_count = pc; *total_pts = tp;
    if (!out_pts || !out_counts) return pc > 0 ? 1 : 0;
    int offset = 0;
    for (int i=0;i<pc;i++) {
        out_counts[i] = static_cast<int>(res[i].points.size());
        for (auto& p : res[i].points) {
            out_pts[offset++] = core_vec2{p.x, p.y};
        }
    }
    return pc > 0 ? 1 : 0;
}

CORE_API int core_offset_single(const core_vec2* poly, int n, double delta,
                                core_vec2* out_pts, int* out_counts,
                                int* poly_count, int* total_pts) {
    if (!poly || n < 3 || !poly_count || !total_pts) return 0;
    Polyline p; p.points.reserve(n);
    for (int i=0;i<n;i++) p.points.push_back(Vec2{poly[i].x, poly[i].y});
    std::vector<Polyline> res = offset({p}, delta);
    int pc = static_cast<int>(res.size());
    int tp = 0; for (auto& pl : res) tp += static_cast<int>(pl.points.size());
    *poly_count = pc; *total_pts = tp;
    if (!out_pts || !out_counts) return pc > 0 ? 1 : 0;
    int offsetIdx = 0;
    for (int i=0;i<pc;i++) {
        out_counts[i] = static_cast<int>(res[i].points.size());
        for (auto& q : res[i].points) out_pts[offsetIdx++] = core_vec2{q.x, q.y};
    }
    return pc > 0 ? 1 : 0;
}

} // extern C

extern "C" {

CORE_API int core_triangulate_polygon_rings(const core_vec2* pts,
                                            const int* ring_counts,
                                            int ring_count,
                                            unsigned int* indices,
                                            int* index_count) {
    if (!pts || !ring_counts || ring_count <= 0 || !index_count) return 0;
    std::vector<std::vector<Vec2>> rings;
    rings.reserve(static_cast<size_t>(ring_count));
    int offset = 0;
    for (int r=0; r<ring_count; ++r) {
        int cnt = ring_counts[r];
        if (cnt < 3) return 0;
        std::vector<Vec2> ring;
        ring.reserve(static_cast<size_t>(cnt));
        for (int i=0;i<cnt;i++) ring.push_back(Vec2{pts[offset+i].x, pts[offset+i].y});
        rings.push_back(std::move(ring));
        offset += cnt;
    }
    TriMesh2D m = triangulate_rings(rings);
    if (m.indices.empty()) { *index_count = 0; return 0; }
    *index_count = static_cast<int>(m.indices.size());
    if (!indices) return 1;
    for (size_t i=0;i<m.indices.size();++i) indices[i] = m.indices[i];
    return 1;
}

CORE_API int core_boolean_op_multi(const core_vec2* subj_pts, const int* subj_counts, int subj_ring_count,
                                   const core_vec2* clip_pts, const int* clip_counts, int clip_ring_count,
                                   int op, int fill_rule,
                                   core_vec2* out_pts, int* out_counts, int* poly_count, int* total_pts) {
    if (!subj_pts || !subj_counts || subj_ring_count<=0 || !clip_pts || !clip_counts || clip_ring_count<=0 || !poly_count || !total_pts) return 0;
    std::vector<std::vector<Vec2>> s;
    std::vector<std::vector<Vec2>> c;
    int off = 0;
    for (int r=0;r<subj_ring_count;++r) { int cnt=subj_counts[r]; std::vector<Vec2> ring; ring.reserve(cnt); for (int i=0;i<cnt;i++) ring.push_back(Vec2{subj_pts[off+i].x, subj_pts[off+i].y}); s.push_back(std::move(ring)); off+=cnt; }
    off = 0;
    for (int r=0;r<clip_ring_count;++r) { int cnt=clip_counts[r]; std::vector<Vec2> ring; ring.reserve(cnt); for (int i=0;i<cnt;i++) ring.push_back(Vec2{clip_pts[off+i].x, clip_pts[off+i].y}); c.push_back(std::move(ring)); off+=cnt; }
    auto res = boolean_op_multi(s, c, to_boolop(op), fill_rule);
    int pc = static_cast<int>(res.size());
    int tp = 0; for (auto& pl : res) tp += static_cast<int>(pl.points.size());
    *poly_count = pc; *total_pts = tp;
    if (!out_pts || !out_counts) return pc > 0 ? 1 : 0;
    int pos=0;
    for (int i=0;i<pc;i++) { out_counts[i] = static_cast<int>(res[i].points.size()); for (auto& p : res[i].points) out_pts[pos++] = core_vec2{p.x, p.y}; }
    return pc > 0 ? 1 : 0;
}

CORE_API int core_offset_multi(const core_vec2* pts, const int* ring_counts, int ring_count,
                               double delta, int join_type, double miter_limit,
                               core_vec2* out_pts, int* out_counts, int* poly_count, int* total_pts) {
    if (!pts || !ring_counts || ring_count<=0 || !poly_count || !total_pts) return 0;
    std::vector<std::vector<Vec2>> rings;
    rings.reserve(static_cast<size_t>(ring_count));
    int off=0;
    for (int r=0;r<ring_count;++r) { int cnt=ring_counts[r]; std::vector<Vec2> ring; ring.reserve(cnt); for (int i=0;i<cnt;i++) ring.push_back(Vec2{pts[off+i].x, pts[off+i].y}); rings.push_back(std::move(ring)); off+=cnt; }
    auto res = offset_multi(rings, delta, join_type, miter_limit);
    int pc = static_cast<int>(res.size());
    int tp = 0; for (auto& pl : res) tp += static_cast<int>(pl.points.size());
    *poly_count = pc; *total_pts = tp;
    if (!out_pts || !out_counts) return pc > 0 ? 1 : 0;
    int pos=0;
    for (int i=0;i<pc;i++) { out_counts[i] = static_cast<int>(res[i].points.size()); for (auto& p : res[i].points) out_pts[pos++] = core_vec2{p.x, p.y}; }
    return pc > 0 ? 1 : 0;
}

} // extern C

extern "C" {

CADGF_API const char* cadgf_get_version() { return core_get_version(); }
CADGF_API unsigned int cadgf_get_feature_flags() { return core_get_feature_flags(); }

CADGF_API cadgf_document* cadgf_document_create() { return core_document_create(); }
CADGF_API void cadgf_document_destroy(cadgf_document* doc) { core_document_destroy(doc); }

CADGF_API cadgf_entity_id cadgf_document_add_polyline(cadgf_document* doc, const cadgf_vec2* pts, int n) {
    return core_document_add_polyline(doc, pts, n);
}

CADGF_API cadgf_entity_id cadgf_document_add_polyline_ex(cadgf_document* doc, const cadgf_vec2* pts, int n,
                                                         const char* name_utf8, int layer_id) {
    return core_document_add_polyline_ex(doc, pts, n, name_utf8, layer_id);
}

CADGF_API int cadgf_document_remove_entity(cadgf_document* doc, cadgf_entity_id id) {
    return core_document_remove_entity(doc, id);
}

CADGF_API int cadgf_document_get_layer_count(const cadgf_document* doc, int* out_count) {
    return core_document_get_layer_count(doc, out_count);
}

CADGF_API int cadgf_document_get_layer_id_at(const cadgf_document* doc, int index, int* out_layer_id) {
    return core_document_get_layer_id_at(doc, index, out_layer_id);
}

CADGF_API int cadgf_document_get_layer_info(const cadgf_document* doc, int layer_id, cadgf_layer_info* out_info) {
    return core_document_get_layer_info(doc, layer_id, out_info);
}

CADGF_API int cadgf_document_get_layer_name(const cadgf_document* doc, int layer_id,
                                            char* out_name_utf8, int out_name_capacity,
                                            int* out_required_bytes) {
    return core_document_get_layer_name(doc, layer_id, out_name_utf8, out_name_capacity, out_required_bytes);
}

CADGF_API int cadgf_document_add_layer(cadgf_document* doc, const char* name_utf8, unsigned int color, int* out_layer_id) {
    return core_document_add_layer(doc, name_utf8, color, out_layer_id);
}

CADGF_API int cadgf_document_set_layer_visible(cadgf_document* doc, int layer_id, int visible) {
    return core_document_set_layer_visible(doc, layer_id, visible);
}

CADGF_API int cadgf_document_set_layer_locked(cadgf_document* doc, int layer_id, int locked) {
    return core_document_set_layer_locked(doc, layer_id, locked);
}

CADGF_API int cadgf_document_set_layer_color(cadgf_document* doc, int layer_id, unsigned int color) {
    return core_document_set_layer_color(doc, layer_id, color);
}

CADGF_API int cadgf_document_get_entity_count(const cadgf_document* doc, int* out_count) {
    return core_document_get_entity_count(doc, out_count);
}

CADGF_API int cadgf_document_get_entity_id_at(const cadgf_document* doc, int index, cadgf_entity_id* out_entity_id) {
    return core_document_get_entity_id_at(doc, index, out_entity_id);
}

CADGF_API int cadgf_document_get_entity_info(const cadgf_document* doc, cadgf_entity_id id, cadgf_entity_info* out_info) {
    return core_document_get_entity_info(doc, id, out_info);
}

CADGF_API int cadgf_document_get_entity_name(const cadgf_document* doc, cadgf_entity_id id,
                                             char* out_name_utf8, int out_name_capacity,
                                             int* out_required_bytes) {
    return core_document_get_entity_name(doc, id, out_name_utf8, out_name_capacity, out_required_bytes);
}

CADGF_API int cadgf_document_get_polyline_points(const cadgf_document* doc, cadgf_entity_id id,
                                                 cadgf_vec2* out_pts, int out_pts_capacity,
                                                 int* out_required_points) {
    return core_document_get_polyline_points(doc, id, out_pts, out_pts_capacity, out_required_points);
}

CADGF_API int cadgf_document_set_entity_visible(cadgf_document* doc, cadgf_entity_id id, int visible) {
    return core_document_set_entity_visible(doc, id, visible);
}

CADGF_API int cadgf_document_set_entity_color(cadgf_document* doc, cadgf_entity_id id, unsigned int color) {
    return core_document_set_entity_color(doc, id, color);
}

CADGF_API int cadgf_document_set_entity_group_id(cadgf_document* doc, cadgf_entity_id id, int group_id) {
    return core_document_set_entity_group_id(doc, id, group_id);
}

CADGF_API int cadgf_triangulate_polygon(const cadgf_vec2* pts, int n,
                                        unsigned int* indices, int* index_count) {
    return core_triangulate_polygon(pts, n, indices, index_count);
}

CADGF_API int cadgf_triangulate_polygon_rings(const cadgf_vec2* pts,
                                              const int* ring_counts,
                                              int ring_count,
                                              unsigned int* indices,
                                              int* index_count) {
    return core_triangulate_polygon_rings(pts, ring_counts, ring_count, indices, index_count);
}

CADGF_API int cadgf_boolean_op_single(const cadgf_vec2* subj, int subj_n,
                                      const cadgf_vec2* clip, int clip_n,
                                      int op,
                                      cadgf_vec2* out_pts, int* out_counts,
                                      int* poly_count, int* total_pts) {
    return core_boolean_op_single(subj, subj_n, clip, clip_n, op, out_pts, out_counts, poly_count, total_pts);
}

CADGF_API int cadgf_offset_single(const cadgf_vec2* poly, int n, double delta,
                                  cadgf_vec2* out_pts, int* out_counts,
                                  int* poly_count, int* total_pts) {
    return core_offset_single(poly, n, delta, out_pts, out_counts, poly_count, total_pts);
}

CADGF_API int cadgf_boolean_op_multi(const cadgf_vec2* subj_pts, const int* subj_counts, int subj_ring_count,
                                     const cadgf_vec2* clip_pts, const int* clip_counts, int clip_ring_count,
                                     int op, int fill_rule,
                                     cadgf_vec2* out_pts, int* out_counts, int* poly_count, int* total_pts) {
    return core_boolean_op_multi(subj_pts, subj_counts, subj_ring_count, clip_pts, clip_counts, clip_ring_count,
                                 op, fill_rule, out_pts, out_counts, poly_count, total_pts);
}

CADGF_API int cadgf_offset_multi(const cadgf_vec2* pts, const int* ring_counts, int ring_count,
                                 double delta, int join_type, double miter_limit,
                                 cadgf_vec2* out_pts, int* out_counts, int* poly_count, int* total_pts) {
    return core_offset_multi(pts, ring_counts, ring_count, delta, join_type, miter_limit,
                             out_pts, out_counts, poly_count, total_pts);
}

} // extern C
