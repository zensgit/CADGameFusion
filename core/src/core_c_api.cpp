#include "core/core_c_api.h"
#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "core/ops2d.hpp"

using namespace core;

struct core_document { Document impl; };

extern "C" {

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
