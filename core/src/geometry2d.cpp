#include "core/geometry2d.hpp"
#include <cmath>

namespace core {

double length(const Vec2& a, const Vec2& b) {
    const double dx = a.x - b.x;
    const double dy = a.y - b.y;
    return std::sqrt(dx*dx + dy*dy);
}

TriMesh2D triangulate_convex(const Polyline& poly) {
    TriMesh2D m;
    if (poly.points.size() < 3) return m;
    // Fan triangulation around vertex 0
    m.vertices = poly.points;
    const uint32_t n = static_cast<uint32_t>(poly.points.size());
    for (uint32_t i = 1; i + 1 < n; ++i) {
        m.indices.push_back(0);
        m.indices.push_back(i);
        m.indices.push_back(i+1);
    }
    return m;
}

} // namespace core

