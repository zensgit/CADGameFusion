#include <cassert>
#include <cmath>
#include <cstdio>
#include <vector>

#include "core/geometry2d.hpp"
#include "core/ops2d.hpp"

static constexpr double EPS = 1e-6;
static bool near(double a, double b) { return std::abs(a - b) < EPS; }

int main() {
    using namespace core;

    // ═══ Test 1: Extrude zero-height → empty mesh ═══
    {
        Polyline sq;
        sq.points = {{0,0},{1,0},{1,1},{0,1},{0,0}};
        auto mesh = extrude_mesh(sq, 0.0);
        // Zero height should still produce geometry (top == bottom)
        // Sides degenerate but face triangulation works
        assert(!mesh.vertices.empty());
        fprintf(stderr, "  PASS: extrude zero height\n");
    }

    // ═══ Test 2: Extrude negative height ═══
    {
        Polyline sq;
        sq.points = {{0,0},{1,0},{1,1},{0,1},{0,0}};
        auto mesh = extrude_mesh(sq, -5.0);
        // Should work with negative height (extrude downward)
        assert(!mesh.vertices.empty());
        // Top face at z=-5
        bool hasNeg = false;
        for (const auto& v : mesh.vertices)
            if (v.z < -0.1) hasNeg = true;
        assert(hasNeg);
        fprintf(stderr, "  PASS: extrude negative height\n");
    }

    // ═══ Test 3: Extrude concave L-shape (fan fallback) ═══
    {
        Polyline lshape;
        lshape.points = {{0,0},{4,0},{4,2},{2,2},{2,4},{0,4},{0,0}};
        auto mesh = extrude_mesh(lshape, 3.0);
        assert(!mesh.vertices.empty());
        assert(!mesh.indices.empty());
        // 6 unique points → should have vertices
        assert(mesh.vertices.size() >= 12); // at least top+bottom
        fprintf(stderr, "  PASS: extrude concave L-shape\n");
    }

    // ═══ Test 4: Extrude single triangle (minimum profile) ═══
    {
        Polyline tri;
        tri.points = {{0,0},{1,0},{0.5,1},{0,0}};
        auto mesh = extrude_mesh(tri, 2.0);
        assert(!mesh.vertices.empty());
        assert(mesh.indices.size() % 3 == 0); // always multiple of 3
        fprintf(stderr, "  PASS: minimum profile (triangle)\n");
    }

    // ═══ Test 5: Extrude with duplicate closing point ═══
    {
        Polyline sq;
        sq.points = {{0,0},{5,0},{5,5},{0,5},{0,0},{0,0}}; // double closing
        auto mesh = extrude_mesh(sq, 1.0);
        assert(!mesh.vertices.empty());
        fprintf(stderr, "  PASS: duplicate closing point\n");
    }

    // ═══ Test 6: Extrude non-closed polyline ═══
    {
        Polyline open;
        open.points = {{0,0},{3,0},{3,3}}; // not closed
        auto mesh = extrude_mesh(open, 5.0);
        // Should still produce geometry (3 points is enough)
        assert(!mesh.vertices.empty());
        fprintf(stderr, "  PASS: non-closed polyline\n");
    }

    // ═══ Test 7: Very large profile ═══
    {
        Polyline big;
        for (int i = 0; i < 100; ++i) {
            double angle = 2.0 * M_PI * i / 100;
            big.points.push_back({std::cos(angle) * 100, std::sin(angle) * 100});
        }
        big.points.push_back(big.points.front()); // close
        auto mesh = extrude_mesh(big, 50.0);
        assert(mesh.vertices.size() > 200);
        assert(mesh.indices.size() > 600);
        fprintf(stderr, "  PASS: large profile (100 points)\n");
    }

    // ═══ Test 8: Normals are unit length ═══
    {
        Polyline sq;
        sq.points = {{0,0},{1,0},{1,1},{0,1},{0,0}};
        auto mesh = extrude_mesh(sq, 1.0);
        for (const auto& n : mesh.normals) {
            double len = std::sqrt(n.x*n.x + n.y*n.y + n.z*n.z);
            assert(near(len, 1.0));
        }
        fprintf(stderr, "  PASS: normals are unit length\n");
    }

    // ═══ Test 9: Signed area / orientation helpers ═══
    {
        std::vector<Vec2> ccw = {{0,0},{1,0},{1,1},{0,1}};
        assert(signed_area(ccw) > 0); // CCW → positive

        std::vector<Vec2> cw = {{0,0},{0,1},{1,1},{1,0}};
        assert(signed_area(cw) < 0); // CW → negative

        ensure_orientation(cw, true); // force CCW
        assert(signed_area(cw) > 0);
        fprintf(stderr, "  PASS: signed_area + ensure_orientation\n");
    }

    // ═══ Test 10: close_ring + remove_near_duplicates ═══
    {
        std::vector<Vec2> ring = {{0,0},{1,0},{1,1}};
        close_ring(ring);
        assert(ring.size() == 4);
        assert(near(ring.back().x, ring.front().x));
        assert(near(ring.back().y, ring.front().y));

        std::vector<Vec2> dups = {{0,0},{0,0},{1,0},{1,0},{1,1}};
        remove_near_duplicates(dups);
        assert(dups.size() == 3);
        fprintf(stderr, "  PASS: close_ring + remove_near_duplicates\n");
    }

    fprintf(stderr, "\n  All M4 robustness tests passed!\n");
    return 0;
}
