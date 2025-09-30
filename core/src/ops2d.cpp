#include "core/ops2d.hpp"
#include <cmath>
#include <array>
#include <algorithm>

#if defined(USE_EARCUT)
#  include <mapbox/earcut.hpp>
#endif

#if defined(USE_CLIPPER2)
#  include <clipper2/clipper.h>
using namespace Clipper2Lib;
#endif

namespace core {

static std::vector<Vec2> normalize_contour(const std::vector<Vec2>& poly) {
    if (poly.size() >= 2) {
        const Vec2& a = poly.front();
        const Vec2& b = poly.back();
        if (std::abs(a.x - b.x) < 1e-12 && std::abs(a.y - b.y) < 1e-12) {
            return std::vector<Vec2>(poly.begin(), poly.end() - 1);
        }
    }
    return poly;
}

TriMesh2D triangulate_polygon(const std::vector<Vec2>& poly_in) {
    TriMesh2D m;
    auto poly = normalize_contour(poly_in);
    if (poly.size() < 3) return m;
#if defined(USE_EARCUT)
    using N = uint32_t;
    std::vector<std::vector<std::array<double,2>>> polygon;
    polygon.emplace_back();
    auto& ring = polygon.back();
    ring.reserve(poly.size());
    for (auto& p : poly) ring.push_back({p.x, p.y});
    auto indices = mapbox::earcut<N>(polygon);
    m.vertices = poly;
    m.indices.assign(indices.begin(), indices.end());
#else
    m.vertices.assign(poly.begin(), poly.end());
    const uint32_t n = static_cast<uint32_t>(poly.size());
    for (uint32_t i=1; i+1<n; ++i) {
        m.indices.push_back(0);
        m.indices.push_back(i);
        m.indices.push_back(i+1);
    }
#endif
    return m;
}

TriMesh2D triangulate_rings(const std::vector<std::vector<Vec2>>& rings_in) {
    TriMesh2D m;
    if (rings_in.empty()) return m;
#if defined(USE_EARCUT)
    using N = uint32_t;
    std::vector<std::vector<std::array<double,2>>> polygon;
    polygon.reserve(rings_in.size());
    // Flattened vertex list for output
    std::vector<Vec2> flat;
    for (const auto& ring : rings_in) {
        auto r = normalize_contour(ring);
        if (r.size() < 3) continue;
        polygon.emplace_back();
        auto& out = polygon.back();
        out.reserve(r.size());
        for (auto& p : r) { out.push_back({p.x, p.y}); flat.push_back(p); }
    }
    if (polygon.empty()) return m;
    auto indices = mapbox::earcut<N>(polygon);
    m.vertices = std::move(flat);
    m.indices.assign(indices.begin(), indices.end());
#endif
    return m;
}

std::vector<Polyline> boolean_op(const std::vector<Polyline>& subject,
                                 const std::vector<Polyline>& clip,
                                 BoolOp op) {
    std::vector<Polyline> out;
#if defined(USE_CLIPPER2)
    const double scale = 1000.0;  // Scale for integer coordinates
    Paths64 subj, clp;
    
    auto toPath = [scale](const Polyline& pl){
        Path64 path; path.reserve(pl.points.size());
        for (auto& p : pl.points) path.push_back(Point64(p.x * scale, p.y * scale));
        return path;
    };
    
    for (auto& s : subject) subj.push_back(toPath(s));
    for (auto& c : clip) clp.push_back(toPath(c));
    
    ClipType ct = ClipType::Union;
    switch (op) {
        case BoolOp::Union: ct = ClipType::Union; break;
        case BoolOp::Difference: ct = ClipType::Difference; break;
        case BoolOp::Intersection: ct = ClipType::Intersection; break;
        case BoolOp::Xor: ct = ClipType::Xor; break;
    }
    
    Paths64 solution = BooleanOp(ct, FillRule::NonZero, subj, clp);
    
    const double inv_scale = 1.0 / scale;
    for (auto& path : solution) {
        Polyline pl;
        pl.points.reserve(path.size());
        for (auto& q : path) pl.points.push_back(Vec2{q.x * inv_scale, q.y * inv_scale});
        if (!pl.points.empty()) pl.points.push_back(pl.points.front()); // close
        out.push_back(std::move(pl));
    }
#endif
    return out;
}

std::vector<Polyline> offset(const std::vector<Polyline>& polys, double delta) {
    std::vector<Polyline> out;
#if defined(USE_CLIPPER2)
    Paths64 src;
    for (auto& s : polys) {
        Path64 path; path.reserve(s.points.size());
        // Scale up for integer coordinates (Clipper2 uses integers)
        const double scale = 1000.0;
        for (auto& p : s.points) path.push_back(Point64(p.x * scale, p.y * scale));
        src.push_back(std::move(path));
    }
    
    ClipperOffset co;
    co.AddPaths(src, JoinType::Round, EndType::Polygon);
    
    Paths64 res;
    co.Execute(delta * 1000.0, res);  // Scale delta too
    
    const double inv_scale = 1.0 / 1000.0;
    for (auto& path : res) {
        Polyline pl;
        pl.points.reserve(path.size());
        for (auto& q : path) pl.points.push_back(Vec2{q.x * inv_scale, q.y * inv_scale});
        if (!pl.points.empty()) pl.points.push_back(pl.points.front());
        out.push_back(std::move(pl));
    }
#endif
    return out;
}

std::vector<Polyline> boolean_op_multi(const std::vector<std::vector<Vec2>>& subj_rings,
                                       const std::vector<std::vector<Vec2>>& clip_rings,
                                       BoolOp op,
                                       int fill_rule) {
    std::vector<Polyline> out;
#if defined(USE_CLIPPER2)
    PathsD subj, clp;
    auto addRings = [](PathsD& dst, const std::vector<std::vector<Vec2>>& src){
        for (const auto& ring : src) {
            auto r = normalize_contour(ring);
            if (r.size() < 3) continue;
            PathD path; path.reserve(r.size());
            for (auto& p : r) path.push_back(PointD(p.x, p.y));
            dst.push_back(std::move(path));
        }
    };
    addRings(subj, subj_rings);
    addRings(clp, clip_rings);
    ClipType ct = ClipType::Union;
    switch (op) {
        case BoolOp::Union: ct = ClipType::Union; break;
        case BoolOp::Difference: ct = ClipType::Difference; break;
        case BoolOp::Intersection: ct = ClipType::Intersection; break;
        case BoolOp::Xor: ct = ClipType::Xor; break;
    }
    FillRule fr = (fill_rule==1) ? FillRule::EvenOdd : FillRule::NonZero;
    PathsD solution = BooleanOp(ct, fr, subj, clp);
    for (auto& path : solution) {
        Polyline pl;
        pl.points.reserve(path.size()+1);
        for (auto& q : path) pl.points.push_back(Vec2{q.x, q.y});
        if (!pl.points.empty()) pl.points.push_back(pl.points.front());
        out.push_back(std::move(pl));
    }
#endif
    return out;
}

std::vector<Polyline> offset_multi(const std::vector<std::vector<Vec2>>& rings,
                                   double delta,
                                   int join_type,
                                   double miter_limit) {
    std::vector<Polyline> out;
#if defined(USE_CLIPPER2)
    const double scale = 1000.0;
    Paths64 src;
    for (const auto& ring : rings) {
        auto r = normalize_contour(ring);
        if (r.size() < 3) continue;
        Path64 path; path.reserve(r.size());
        for (auto& p : r) path.push_back(Point64(p.x * scale, p.y * scale));
        src.push_back(std::move(path));
    }
    ClipperOffset co;
    JoinType jt = JoinType::Round;
    switch (join_type) {
        case 0: jt = JoinType::Miter; break;
        case 1: jt = JoinType::Round; break;
        case 2: jt = JoinType::Square; break; // Clipper2 uses Square instead of Bevel
        default: jt = JoinType::Round; break;
    }
    co.MiterLimit(miter_limit);
    co.AddPaths(src, jt, EndType::Polygon);
    Paths64 res;
    co.Execute(delta * scale, res);
    const double inv_scale = 1.0 / scale;
    for (auto& path : res) {
        Polyline pl;
        pl.points.reserve(path.size()+1);
        for (auto& q : path) pl.points.push_back(Vec2{q.x * inv_scale, q.y * inv_scale});
        if (!pl.points.empty()) pl.points.push_back(pl.points.front());
        out.push_back(std::move(pl));
    }
#endif
    return out;
}

void close_ring(std::vector<Vec2>& ring) {
    if (ring.empty()) return;
    const Vec2& a = ring.front();
    const Vec2& b = ring.back();
    if (std::abs(a.x-b.x)>1e-12 || std::abs(a.y-b.y)>1e-12) ring.push_back(a);
}

void remove_near_duplicates(std::vector<Vec2>& ring, double eps) {
    if (ring.size() < 2) return;
    std::vector<Vec2> out;
    out.reserve(ring.size());
    auto near = [eps](const Vec2& u, const Vec2& v){ return std::abs(u.x-v.x)<=eps && std::abs(u.y-v.y)<=eps; };
    for (size_t i=0;i<ring.size();++i) {
        if (out.empty() || !near(out.back(), ring[i])) out.push_back(ring[i]);
    }
    ring.swap(out);
}

double signed_area(const std::vector<Vec2>& ring) {
    if (ring.size() < 3) return 0.0;
    double a = 0.0;
    size_t n = ring.size();
    for (size_t i=0,j=n-1; i<n; j=i++) {
        a += (ring[j].x * ring[i].y) - (ring[i].x * ring[j].y);
    }
    return 0.5 * a;
}

void ensure_orientation(std::vector<Vec2>& ring, bool ccw) {
    if (ring.size() < 3) return;
    // work on non-closed ring for orientation
    auto r = normalize_contour(ring);
    double a = signed_area(r);
    bool is_ccw = a > 0.0;
    if (is_ccw != ccw) {
        std::reverse(r.begin(), r.end());
    }
    ring = r;
}

} // namespace core
