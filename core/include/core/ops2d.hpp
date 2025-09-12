#pragma once

#include <vector>
#include "core/geometry2d.hpp"

namespace core {

// Triangulate a simple polygon; uses earcut if enabled, otherwise convex fan fallback.
TriMesh2D triangulate_polygon(const std::vector<Vec2>& poly);

// Boolean ops (stubs unless CLIPPER2 is enabled at build time)
enum class BoolOp { Union, Difference, Intersection, Xor };

// Returns a list of closed polylines (outer + holes not modeled in this stub)
std::vector<Polyline> boolean_op(const std::vector<Polyline>& subject,
                                 const std::vector<Polyline>& clip,
                                 BoolOp op);

// Offset (buffer) polygons by delta; join/mitre options can be added later.
std::vector<Polyline> offset(const std::vector<Polyline>& polys, double delta);

} // namespace core

