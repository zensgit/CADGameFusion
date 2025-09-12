#pragma once

#include <vector>
#include "core/geometry2d.hpp"

namespace core {

// Triangulate a simple polygon; uses earcut if enabled, otherwise convex fan fallback.
TriMesh2D triangulate_polygon(const std::vector<Vec2>& poly);

// Triangulate multiple rings: rings[0] is outer (CCW), rings[1..] are holes (CW)
// Returns empty indices if unsupported by backend.
TriMesh2D triangulate_rings(const std::vector<std::vector<Vec2>>& rings);

// Boolean ops (stubs unless CLIPPER2 is enabled at build time)
enum class BoolOp { Union, Difference, Intersection, Xor };

// Returns a list of closed polylines (outer + holes not modeled in this stub)
std::vector<Polyline> boolean_op(const std::vector<Polyline>& subject,
                                 const std::vector<Polyline>& clip,
                                 BoolOp op);

// Offset (buffer) polygons by delta; join/mitre options can be added later.
std::vector<Polyline> offset(const std::vector<Polyline>& polys, double delta);

// Multi-ring boolean: subject and clip are sets of closed rings (outer and holes as separate rings)
std::vector<Polyline> boolean_op_multi(const std::vector<std::vector<Vec2>>& subj_rings,
                                       const std::vector<std::vector<Vec2>>& clip_rings,
                                       BoolOp op,
                                       int fill_rule /*0=NonZero,1=EvenOdd*/);

// Multi-ring offset
std::vector<Polyline> offset_multi(const std::vector<std::vector<Vec2>>& rings,
                                   double delta,
                                   int join_type /*0=Miter,1=Round,2=Bevel*/,
                                   double miter_limit);

// Normalization helpers (2D)
void close_ring(std::vector<Vec2>& ring);
void remove_near_duplicates(std::vector<Vec2>& ring, double eps = 1e-9);
double signed_area(const std::vector<Vec2>& ring);
void ensure_orientation(std::vector<Vec2>& ring, bool ccw);

} // namespace core
