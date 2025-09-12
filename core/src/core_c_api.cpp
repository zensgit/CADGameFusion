#include "core/core_c_api.h"
#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "core/ops2d.hpp"
#include "core/version.hpp"

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

CORE_API int core_document_remove_entity(core_document* doc, core_entity_id id) {
    if (!doc) return 0;
    return doc->impl.remove_entity(id) ? 1 : 0;
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
