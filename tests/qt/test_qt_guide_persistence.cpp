#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>
#include <QtCore/QTemporaryFile>

#include <cassert>
#include <cmath>

#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "canvas.hpp"
#include "snap/snap_settings.hpp"
#include "project/project.hpp"
#include "guide_manager.hpp"

static constexpr double EPS = 1e-6;
static bool near(double a, double b) { return std::abs(a - b) < EPS; }

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    // ═══ Test 1: Save and load guides ═══
    {
        QTemporaryFile tmpFile;
        tmpFile.setAutoRemove(true);
        tmpFile.open();
        QString path = tmpFile.fileName();
        tmpFile.close();

        // Save with guides
        {
            core::Document doc;
            core::Polyline pl;
            pl.points = {{0,0},{1,0},{1,1},{0,0}};
            doc.add_polyline(pl, "test");

            CanvasWidget canvas;
            canvas.setDocument(&doc);
            SnapSettings snap;
            canvas.setSnapSettings(&snap);

            auto* gm = new GuideManager(&canvas);
            canvas.setGuideManager(gm);
            gm->addGuide(Guide::Horizontal, 100.0);
            gm->addGuide(Guide::Vertical, 50.0);
            gm->addGuide(Guide::Horizontal, 200.0);

            Project proj;
            assert(proj.save(path, doc, &canvas));
        }

        // Load and verify guides restored
        {
            core::Document doc;
            CanvasWidget canvas;
            canvas.setDocument(&doc);
            SnapSettings snap;
            canvas.setSnapSettings(&snap);

            auto* gm = new GuideManager(&canvas);
            canvas.setGuideManager(gm);

            Project proj;
            assert(proj.load(path, doc, &canvas));

            assert(gm->guideCount() == 3);
            assert(gm->guides()[0].orientation == Guide::Horizontal);
            assert(near(gm->guides()[0].position, 100.0));
            assert(gm->guides()[1].orientation == Guide::Vertical);
            assert(near(gm->guides()[1].position, 50.0));
            assert(gm->guides()[2].orientation == Guide::Horizontal);
            assert(near(gm->guides()[2].position, 200.0));
        }
        fprintf(stderr, "  PASS: guides roundtrip through save/load\n");
    }

    // ═══ Test 2: Empty guides — no crash ═══
    {
        QTemporaryFile tmpFile;
        tmpFile.setAutoRemove(true);
        tmpFile.open();
        QString path = tmpFile.fileName();
        tmpFile.close();

        {
            core::Document doc;
            CanvasWidget canvas;
            canvas.setDocument(&doc);
            SnapSettings snap;
            canvas.setSnapSettings(&snap);
            // No GuideManager — should still save fine
            Project proj;
            assert(proj.save(path, doc, &canvas));
        }
        {
            core::Document doc;
            CanvasWidget canvas;
            canvas.setDocument(&doc);
            SnapSettings snap;
            canvas.setSnapSettings(&snap);
            auto* gm = new GuideManager(&canvas);
            canvas.setGuideManager(gm);
            Project proj;
            assert(proj.load(path, doc, &canvas));
            assert(gm->guideCount() == 0);
        }
        fprintf(stderr, "  PASS: empty guides no crash\n");
    }

    // ═══ Test 3: Guides cleared before load ═══
    {
        QTemporaryFile tmpFile;
        tmpFile.setAutoRemove(true);
        tmpFile.open();
        QString path = tmpFile.fileName();
        tmpFile.close();

        // Save with 1 guide
        {
            core::Document doc;
            CanvasWidget canvas;
            canvas.setDocument(&doc);
            SnapSettings snap;
            canvas.setSnapSettings(&snap);
            auto* gm = new GuideManager(&canvas);
            canvas.setGuideManager(gm);
            gm->addGuide(Guide::Vertical, 42.0);
            Project proj;
            assert(proj.save(path, doc, &canvas));
        }

        // Load into canvas that already has guides — should replace
        {
            core::Document doc;
            CanvasWidget canvas;
            canvas.setDocument(&doc);
            SnapSettings snap;
            canvas.setSnapSettings(&snap);
            auto* gm = new GuideManager(&canvas);
            canvas.setGuideManager(gm);
            gm->addGuide(Guide::Horizontal, 999.0); // pre-existing
            gm->addGuide(Guide::Horizontal, 888.0); // pre-existing

            Project proj;
            assert(proj.load(path, doc, &canvas));
            assert(gm->guideCount() == 1);
            assert(near(gm->guides()[0].position, 42.0));
        }
        fprintf(stderr, "  PASS: guides cleared before load\n");
    }

    fprintf(stderr, "\n  All Guide Persistence tests passed!\n");
    return 0;
}
