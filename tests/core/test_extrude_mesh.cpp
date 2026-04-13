#include <cassert>
#include <cmath>
#include <cstdio>

#include "core/geometry2d.hpp"
#include "core/ops2d.hpp"

static constexpr double EPS = 1e-9;
static bool near(double a, double b) { return std::abs(a - b) < EPS; }

int main() {
    using namespace core;

    // ═══ Test 1: Extrude a triangle ═══
    {
        Polyline tri;
        tri.points = {{0,0}, {4,0}, {2,3}, {0,0}}; // closed triangle
        auto mesh = extrude_mesh(tri, 5.0);

        // 3 unique profile points → 6 face vertices (top+bottom) + 3*4 side = 18
        // Bottom: 3, Top: 3, Sides: 3 quads * 4 verts = 12 → total 18
        assert(mesh.vertices.size() == 18);
        assert(mesh.normals.size() == 18);

        // Bottom face: n-2 = 1 triangle → 3 indices
        // Top face: 1 triangle → 3 indices
        // Sides: 3 quads * 2 tris * 3 = 18 indices
        // Total: 3 + 3 + 18 = 24
        assert(mesh.indices.size() == 24);

        // Bottom vertices at z=0
        assert(near(mesh.vertices[0].z, 0.0));
        assert(near(mesh.vertices[1].z, 0.0));
        assert(near(mesh.vertices[2].z, 0.0));

        // Top vertices at z=5
        assert(near(mesh.vertices[3].z, 5.0));
        assert(near(mesh.vertices[4].z, 5.0));
        assert(near(mesh.vertices[5].z, 5.0));

        fprintf(stderr, "  PASS: extrude triangle\n");
    }

    // ═══ Test 2: Extrude a square ═══
    {
        Polyline sq;
        sq.points = {{0,0}, {10,0}, {10,10}, {0,10}, {0,0}};
        auto mesh = extrude_mesh(sq, 20.0);

        // 4 unique points → 8 face verts + 4*4 side = 24
        assert(mesh.vertices.size() == 24);

        // Bottom: 2 tris → 6 indices
        // Top: 2 tris → 6 indices
        // Sides: 4 quads * 6 = 24
        // Total: 36
        assert(mesh.indices.size() == 36);

        // Check all bottom verts at z=0, all top at z=20
        for (int i = 0; i < 4; ++i) {
            assert(near(mesh.vertices[i].z, 0.0));
            assert(near(mesh.vertices[i + 4].z, 20.0));
        }
        fprintf(stderr, "  PASS: extrude square\n");
    }

    // ═══ Test 3: Normals sanity check ═══
    {
        Polyline sq;
        sq.points = {{0,0}, {1,0}, {1,1}, {0,1}, {0,0}};
        auto mesh = extrude_mesh(sq, 1.0);

        // Bottom face normals should be (0,0,-1)
        for (int i = 0; i < 4; ++i) {
            assert(near(mesh.normals[i].x, 0.0));
            assert(near(mesh.normals[i].y, 0.0));
            assert(near(mesh.normals[i].z, -1.0));
        }
        // Top face normals should be (0,0,1)
        for (int i = 4; i < 8; ++i) {
            assert(near(mesh.normals[i].x, 0.0));
            assert(near(mesh.normals[i].y, 0.0));
            assert(near(mesh.normals[i].z, 1.0));
        }
        fprintf(stderr, "  PASS: normals correct\n");
    }

    // ═══ Test 4: Empty/degenerate profile ═══
    {
        Polyline empty;
        auto mesh = extrude_mesh(empty, 10.0);
        assert(mesh.vertices.empty());
        assert(mesh.indices.empty());

        Polyline twoPoint;
        twoPoint.points = {{0,0}, {1,0}};
        mesh = extrude_mesh(twoPoint, 10.0);
        assert(mesh.vertices.empty());
        fprintf(stderr, "  PASS: degenerate profile returns empty\n");
    }

    // ═══ Test 5: TriMesh3D / Vec3 / Plane types exist ═══
    {
        Vec3 v{1.0, 2.0, 3.0};
        assert(near(v.x, 1.0) && near(v.y, 2.0) && near(v.z, 3.0));

        Plane p;
        assert(near(p.normal.z, 1.0)); // default XY plane

        TriMesh3D m;
        assert(m.vertices.empty());

        SketchPlane sp;
        assert(sp.type == SketchPlaneType::XY);

        ExtrudeParams ep;
        assert(near(ep.height, 10.0));

        RevolveParams rp;
        assert(near(rp.angleDeg, 360.0));

        assert(static_cast<int>(FeatureKind::Extrude) == 1);
        assert(static_cast<int>(FeatureKind::Revolve) == 2);

        fprintf(stderr, "  PASS: M3 types compile and have correct defaults\n");
    }

    // ═══ Test 6: SketchPlane types ═══
    {
        assert(static_cast<int>(SketchPlaneType::XY) == 0);
        assert(static_cast<int>(SketchPlaneType::XZ) == 1);
        assert(static_cast<int>(SketchPlaneType::YZ) == 2);
        assert(static_cast<int>(SketchPlaneType::Custom) == 3);
        fprintf(stderr, "  PASS: SketchPlane types\n");
    }

    fprintf(stderr, "\n  All M3 extrude/types tests passed!\n");
    return 0;
}
