// Minimal 2D geometry API for skeleton
#pragma once

#include <vector>
#include <cstdint>
#include <string>
#include <optional>

namespace core {

struct Vec2 { double x{}, y{}; };

struct Point {
    Vec2 p{};
};

struct Line {
    Vec2 a{};
    Vec2 b{};
};

struct Arc {
    Vec2 center{};
    double radius{0.0};
    double start_angle{0.0};
    double end_angle{0.0};
    int clockwise{0};
};

struct Circle {
    Vec2 center{};
    double radius{0.0};
};

struct Ellipse {
    Vec2 center{};
    double rx{0.0};
    double ry{0.0};
    double rotation{0.0};
    double start_angle{0.0};
    double end_angle{0.0};
};

struct Spline {
    int degree{3};
    std::vector<Vec2> control_points;
    std::vector<double> knots;
};

struct Text {
    Vec2 pos{};
    double height{0.0};
    double rotation{0.0};
    std::string text;
};

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

// 3D geometry foundation types (P3.5)
struct Vec3 {
    double x{0.0};
    double y{0.0};
    double z{0.0};
};

struct Line3D {
    Vec3 a{};
    Vec3 b{};
};

struct Plane {
    Vec3 origin{};
    Vec3 normal{0.0, 0.0, 1.0};
};

// 3D constraint kinds (future P3.5 solver extension)
enum class Constraint3DKind {
    Unknown = 0,
    FixedPoint3D,
    PointOnPlane,
    PointOnLine3D,
    Parallel3D,
    Perpendicular3D,
    Distance3D,
    Angle3D,
    Coincident3D,
    Coplanar,
    Coaxial
};

struct Constraint3DSpec {
    std::string type;
    std::vector<std::string> params; // named parameter references
    std::optional<double> value;
};

} // namespace core
