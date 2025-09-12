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

std::vector<Polyline> boolean_op(const std::vector<Polyline>& subject,
                                 const std::vector<Polyline>& clip,
                                 BoolOp op) {
    std::vector<Polyline> out;
#if defined(USE_CLIPPER2)
    PathsD subj, clp;
    auto toPath = [](const Polyline& pl){
        PathD path; path.reserve(pl.points.size());
        for (auto& p : pl.points) path.push_back(PointD(p.x, p.y));
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
    PathsD solution = BooleanOp(ct, FillRule::NonZero, subj, clp);
    for (auto& path : solution) {
        Polyline pl;
        pl.points.reserve(path.size());
        for (auto& q : path) pl.points.push_back(Vec2{q.x, q.y});
        if (!pl.points.empty()) pl.points.push_back(pl.points.front()); // close
        out.push_back(std::move(pl));
    }
#endif
    return out;
}

std::vector<Polyline> offset(const std::vector<Polyline>& polys, double delta) {
    std::vector<Polyline> out;
#if defined(USE_CLIPPER2)
    PathsD src;
    for (auto& s : polys) {
        PathD path; path.reserve(s.points.size());
        for (auto& p : s.points) path.push_back(PointD(p.x, p.y));
        src.push_back(std::move(path));
    }
    ClipperOffset co;
    PathsD res = co.Execute(src, delta, JoinType::Round, EndType::Polygon);
    for (auto& path : res) {
        Polyline pl;
        pl.points.reserve(path.size());
        for (auto& q : path) pl.points.push_back(Vec2{q.x, q.y});
        if (!pl.points.empty()) pl.points.push_back(pl.points.front());
        out.push_back(std::move(pl));
    }
#endif
    return out;
}

} // namespace core
