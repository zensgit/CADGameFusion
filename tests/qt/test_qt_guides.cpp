#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>

#include <cassert>
#include <cmath>

#include "guide_manager.hpp"
#include "snap_manager.hpp"

static constexpr double EPS = 1e-9;
static bool near(double a, double b) { return std::abs(a - b) < EPS; }

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    // ═══ Test 1: Empty by default ═══
    {
        GuideManager mgr;
        assert(mgr.guideCount() == 0);
        assert(mgr.guides().isEmpty());
        fprintf(stderr, "  PASS: empty by default\n");
    }

    // ═══ Test 2: Add guides ═══
    {
        GuideManager mgr;
        int signalCount = 0;
        QObject::connect(&mgr, &GuideManager::guidesChanged, [&signalCount]{ ++signalCount; });

        mgr.addGuide(Guide::Horizontal, 100.0);
        assert(mgr.guideCount() == 1);
        assert(mgr.guides()[0].orientation == Guide::Horizontal);
        assert(near(mgr.guides()[0].position, 100.0));
        assert(signalCount == 1);

        mgr.addGuide(Guide::Vertical, 50.0);
        assert(mgr.guideCount() == 2);
        assert(signalCount == 2);
        fprintf(stderr, "  PASS: add guides + signals\n");
    }

    // ═══ Test 3: Remove guide ═══
    {
        GuideManager mgr;
        mgr.addGuide(Guide::Horizontal, 10.0);
        mgr.addGuide(Guide::Vertical, 20.0);
        mgr.addGuide(Guide::Horizontal, 30.0);
        assert(mgr.guideCount() == 3);

        mgr.removeGuide(1); // remove vertical at 20.0
        assert(mgr.guideCount() == 2);
        assert(near(mgr.guides()[0].position, 10.0));
        assert(near(mgr.guides()[1].position, 30.0));
        fprintf(stderr, "  PASS: remove guide\n");
    }

    // ═══ Test 4: Clear guides ═══
    {
        GuideManager mgr;
        mgr.addGuide(Guide::Horizontal, 10.0);
        mgr.addGuide(Guide::Vertical, 20.0);

        int signalCount = 0;
        QObject::connect(&mgr, &GuideManager::guidesChanged, [&signalCount]{ ++signalCount; });

        mgr.clearGuides();
        assert(mgr.guideCount() == 0);
        assert(signalCount == 1);

        // Clear on empty does not signal
        mgr.clearGuides();
        assert(signalCount == 1);
        fprintf(stderr, "  PASS: clear guides\n");
    }

    // ═══ Test 5: findNearestGuide — horizontal ═══
    {
        GuideManager mgr;
        mgr.addGuide(Guide::Horizontal, 100.0); // Y = 100

        QPointF snap;
        Guide::Orientation orient;
        // Query near Y=101, threshold=5 → should find
        bool found = mgr.findNearestGuide(50.0, 101.0, 5.0, snap, orient);
        assert(found);
        assert(orient == Guide::Horizontal);
        assert(near(snap.x(), 50.0)); // X unchanged
        assert(near(snap.y(), 100.0)); // snapped to guide

        // Query far from guide → should not find
        found = mgr.findNearestGuide(50.0, 200.0, 5.0, snap, orient);
        assert(!found);
        fprintf(stderr, "  PASS: findNearestGuide horizontal\n");
    }

    // ═══ Test 6: findNearestGuide — vertical ═══
    {
        GuideManager mgr;
        mgr.addGuide(Guide::Vertical, 50.0); // X = 50

        QPointF snap;
        Guide::Orientation orient;
        bool found = mgr.findNearestGuide(51.0, 200.0, 5.0, snap, orient);
        assert(found);
        assert(orient == Guide::Vertical);
        assert(near(snap.x(), 50.0)); // snapped to guide
        assert(near(snap.y(), 200.0)); // Y unchanged
        fprintf(stderr, "  PASS: findNearestGuide vertical\n");
    }

    // ═══ Test 7: findNearestGuide — closest wins ═══
    {
        GuideManager mgr;
        mgr.addGuide(Guide::Horizontal, 100.0);
        mgr.addGuide(Guide::Horizontal, 102.0);

        QPointF snap;
        Guide::Orientation orient;
        // Query Y=101.5, both within threshold=5
        // 102 is closer (0.5 away vs 1.5 away)
        bool found = mgr.findNearestGuide(0, 101.5, 5.0, snap, orient);
        assert(found);
        assert(near(snap.y(), 102.0));
        fprintf(stderr, "  PASS: closest guide wins\n");
    }

    // ═══ Test 8: SnapManager Guide type exists ═══
    {
        // Just verify the enum value compiles
        auto t = SnapManager::SnapType::Guide;
        assert(t != SnapManager::SnapType::None);
        fprintf(stderr, "  PASS: SnapType::Guide exists\n");
    }

    fprintf(stderr, "\n  All Guide tests passed!\n");
    return 0;
}
