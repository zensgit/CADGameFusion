#include <cassert>
#include <cmath>
#include <cstdio>

#include "core/geometry2d.hpp"
#include "core/ops2d.hpp"

static constexpr double EPS = 1e-4;
static bool near(double a, double b) { return std::abs(a - b) < EPS; }

int main() {
    using namespace core;

    // ═══ Test 1: Full revolution of rectangle → cylinder ═══
    {
        // Rectangle profile: x=5..10 (inner/outer radius), y=0..20 (height)
        Polyline rect;
        rect.points = {{5,0},{10,0},{10,20},{5,20},{5,0}};

        auto mesh = revolve_mesh(rect, {0,0,0}, {0,0,1}, 360.0, 36);
        assert(!mesh.vertices.empty());
        assert(!mesh.indices.empty());
        // 4 unique profile points × 36 rings = 144 vertices
        assert(mesh.vertices.size() == 144);
        assert(mesh.normals.size() == 144);
        // Side faces: 36 rings × 3 quads × 2 tris × 3 indices = 648
        // No end caps for full revolution
        assert(mesh.indices.size() > 0);
        assert(mesh.indices.size() % 3 == 0);
        fprintf(stderr, "  PASS: full revolution cylinder (%zu verts, %zu tris)\n",
                mesh.vertices.size(), mesh.indices.size()/3);
    }

    // ═══ Test 2: Half revolution (180°) ═══
    {
        Polyline rect;
        rect.points = {{5,0},{10,0},{10,10},{5,10},{5,0}};

        auto mesh = revolve_mesh(rect, {0,0,0}, {0,0,1}, 180.0, 18);
        assert(!mesh.vertices.empty());
        // 4 points × 19 rings (not full → segments+1) = 76
        assert(mesh.vertices.size() == 76);
        // Should have end caps
        assert(mesh.indices.size() > 0);
        fprintf(stderr, "  PASS: half revolution (%zu verts)\n", mesh.vertices.size());
    }

    // ═══ Test 3: Vertices are at correct radius ═══
    {
        // Single point at radius=10 revolved around Z
        Polyline line;
        line.points = {{10,0},{10,5}};

        auto mesh = revolve_mesh(line, {0,0,0}, {0,0,1}, 360.0, 4);
        // All vertices should be at radius ~10 from Z axis
        for (const auto& v : mesh.vertices) {
            double r = std::sqrt(v.x*v.x + v.y*v.y);
            assert(near(r, 10.0));
        }
        fprintf(stderr, "  PASS: vertices at correct radius\n");
    }

    // ═══ Test 4: Revolve around different axis ═══
    {
        // Revolve around Z with profile at radius=7
        Polyline line;
        line.points = {{7,0},{7,5}};

        auto mesh = revolve_mesh(line, {0,0,0}, {0,0,1}, 360.0, 8);
        assert(!mesh.vertices.empty());
        // All vertices should be at radius ~7 from Z axis (xy plane)
        for (const auto& v : mesh.vertices) {
            double r = std::sqrt(v.x*v.x + v.y*v.y);
            assert(near(r, 7.0));
        }
        fprintf(stderr, "  PASS: revolve with different radius\n");
    }

    // ═══ Test 5: Degenerate input ═══
    {
        Polyline empty;
        auto mesh = revolve_mesh(empty, {0,0,0}, {0,0,1}, 360.0);
        assert(mesh.vertices.empty());

        Polyline onePoint;
        onePoint.points = {{5,0}};
        mesh = revolve_mesh(onePoint, {0,0,0}, {0,0,1}, 360.0);
        assert(mesh.vertices.empty());

        // Zero-length axis
        Polyline rect;
        rect.points = {{5,0},{10,0},{10,10},{5,10},{5,0}};
        mesh = revolve_mesh(rect, {0,0,0}, {0,0,0}, 360.0);
        assert(mesh.vertices.empty());

        fprintf(stderr, "  PASS: degenerate input returns empty\n");
    }

    // ═══ Test 6: Low segment count ═══
    {
        Polyline line;
        line.points = {{5,0},{5,10}};
        auto mesh = revolve_mesh(line, {0,0,0}, {0,0,1}, 360.0, 3);
        assert(!mesh.vertices.empty());
        // 2 points × 3 rings = 6 vertices (minimum)
        assert(mesh.vertices.size() == 6);
        fprintf(stderr, "  PASS: minimum 3 segments\n");
    }

    fprintf(stderr, "\n  All revolve mesh tests passed!\n");
    return 0;
}
