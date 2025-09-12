// Minimal 2D geometry API for skeleton
#pragma once

#include <vector>
#include <cstdint>

namespace core {

struct Vec2 { double x{}, y{}; };

struct Polyline {
    std::vector<Vec2> points; // closed if first==last
};

struct TriMesh2D {
    std::vector<Vec2> vertices;
    std::vector<uint32_t> indices; // 3 per triangle
};

// Very small helpers (placeholders for real algorithms)
double length(const Vec2& a, const Vec2& b);

// Triangulate a simple convex polygon (fan) – placeholder
TriMesh2D triangulate_convex(const Polyline& poly);

} // namespace core

