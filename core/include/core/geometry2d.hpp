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

// ─── 3D Mesh (M3) ───

struct TriMesh3D {
    std::vector<Vec3> vertices;
    std::vector<Vec3> normals; // per-vertex normals (same count as vertices)
    std::vector<uint32_t> indices; // 3 per triangle
};

// ─── Sketch & Feature types (M3) ───

enum class SketchPlaneType { XY, XZ, YZ, Custom };

struct SketchPlane {
    SketchPlaneType type{SketchPlaneType::XY};
    Plane custom{}; // used only if type == Custom
};

enum class FeatureKind { None = 0, Extrude, Revolve };

struct ExtrudeParams {
    double height{10.0};
    bool symmetric{false}; // extrude in both directions
};

struct RevolveParams {
    Vec3 axisOrigin{};
    Vec3 axisDirection{0, 1, 0};
    double angleDeg{360.0};
};

// ─── Extrude mesh generation ───

// Extrude a 2D closed polyline along Z axis to produce a 3D mesh.
// The polyline must be closed (first == last point).
// Returns a TriMesh3D with top face, bottom face, and side quads.
TriMesh3D extrude_mesh(const Polyline& profile, double height);

// Revolve a 2D closed polyline around an axis to produce a 3D mesh.
// Profile assumed in XZ plane (x=radial distance, y=height along axis).
// axisOrigin + axisDir define the revolution axis.
// angleDeg: revolution angle (360 = full revolution).
// segments: number of angular steps.
TriMesh3D revolve_mesh(const Polyline& profile, const Vec3& axisOrigin,
                       const Vec3& axisDir, double angleDeg, int segments = 36);

} // namespace core
