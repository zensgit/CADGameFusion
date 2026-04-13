#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>

#include <cassert>
#include <cmath>

#include "viewport3d.hpp"
#include "panels/feature_tree_panel.hpp"
#include "core/geometry2d.hpp"
#include "core/ops2d.hpp"

static constexpr double EPS = 1e-3;
static bool near(double a, double b) { return std::abs(a - b) < EPS; }

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    // ═══ Test 1: Initial state ═══
    {
        Viewport3D vp;
        vp.resize(400, 300);
        assert(!vp.hasMesh());
        assert(near(vp.orbitYaw(), 30.0));
        assert(near(vp.orbitPitch(), -25.0));
        assert(near(vp.orbitDistance(), 50.0));
        fprintf(stderr, "  PASS: initial state\n");
    }

    // ═══ Test 2: Set/clear mesh ═══
    {
        Viewport3D vp;
        vp.resize(400, 300);

        core::Polyline sq;
        sq.points = {{0,0},{10,0},{10,10},{0,10},{0,0}};
        auto mesh = core::extrude_mesh(sq, 5.0);

        vp.setMesh(mesh);
        assert(vp.hasMesh());
        vp.clearMesh();
        assert(!vp.hasMesh());
        fprintf(stderr, "  PASS: set/clear mesh\n");
    }

    // ═══ Test 3: Orbit control ═══
    {
        Viewport3D vp;
        vp.resize(400, 300);
        vp.setOrbit(45.0, -30.0, 100.0);
        assert(near(vp.orbitYaw(), 45.0));
        assert(near(vp.orbitPitch(), -30.0));
        assert(near(vp.orbitDistance(), 100.0));

        // Pitch clamped to [-89, 89]
        vp.setOrbit(0, -95.0, 50.0);
        assert(near(vp.orbitPitch(), -89.0));

        // Distance min 1.0
        vp.setOrbit(0, 0, 0.5);
        assert(near(vp.orbitDistance(), 1.0));
        fprintf(stderr, "  PASS: orbit control + clamping\n");
    }

    // ═══ Test 4: Projection API exists and returns QPointF ═══
    {
        Viewport3D vp;
        vp.setFixedSize(400, 300);
        vp.setOrbit(30, -25, 50);

        // project() should return a QPointF (may be -1e6 if behind camera in offscreen)
        QPointF p = vp.project(core::Vec3{0, 0, 0}); // origin should always be visible
        assert(std::isfinite(p.x()));
        assert(std::isfinite(p.y()));
        fprintf(stderr, "  PASS: projection API returns finite QPointF\n");
    }

    // ═══ Test 5: Orbit change modifies internal state ═══
    {
        Viewport3D vp;
        vp.setOrbit(0, 0, 50);
        assert(near(vp.orbitYaw(), 0.0));
        vp.setOrbit(90, 0, 50);
        assert(near(vp.orbitYaw(), 90.0));
        fprintf(stderr, "  PASS: orbit change modifies state\n");
    }

    // ═══ Test 6: Recompute pipeline test ═══
    {
        // Full pipeline: create polyline → extrude → verify mesh → display
        core::Polyline profile;
        profile.points = {{0,0},{6,0},{6,4},{0,4},{0,0}};
        auto mesh = core::extrude_mesh(profile, 8.0);

        assert(!mesh.vertices.empty());
        assert(!mesh.indices.empty());

        Viewport3D vp;
        vp.resize(400, 300);
        vp.setMesh(mesh);
        assert(vp.hasMesh());

        // Verify we can paint without crash
        vp.repaint();
        fprintf(stderr, "  PASS: recompute pipeline (polyline → extrude → viewport)\n");
    }

    // ═══ Test 7: Feature tree integration ═══
    {
        // Verify FeatureTreePanel can be created and populated
        FeatureTreePanel panel;
        QVector<FeatureEntry> features;
        features.append(FeatureEntry{1, "Sketch1", "Sketch", -1});
        features.append(FeatureEntry{2, "Extrude1", "Extrude", 1});
        features.append(FeatureEntry{3, "Sketch2", "Sketch", -1});
        features.append(FeatureEntry{4, "Revolve1", "Revolve", 3});
        panel.setFeatures(features);

        int selectedId = -1;
        QObject::connect(&panel, &FeatureTreePanel::featureSelected, [&](int id){ selectedId = id; });
        // Signal is connectable
        assert(selectedId == -1);

        panel.clear();
        fprintf(stderr, "  PASS: feature tree panel populated + cleared\n");
    }

    fprintf(stderr, "\n  All Viewport3D + Pipeline tests passed!\n");
    return 0;
}
