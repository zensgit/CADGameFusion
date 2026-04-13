#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>

#include <cassert>
#include <cmath>

#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "canvas.hpp"

static constexpr double EPS = 1e-6;
static bool near(double a, double b) { return std::abs(a - b) < EPS; }

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    // ═══ Test 1: Default pivot is centroid ═══
    {
        core::Document doc;
        CanvasWidget canvas;
        canvas.setDocument(&doc);

        core::Polyline pl;
        pl.points = {{0,0},{4,0},{4,4},{0,4},{0,0}};
        auto id = doc.add_polyline(pl, "sq");

        canvas.setSelectionFromModel({static_cast<qulonglong>(id)});
        QPointF pivot = canvas.computePivot();
        // Centroid of 5 points (including closing): (0+4+4+0+0)/5=1.6, (0+0+4+4+0)/5=1.6
        assert(near(pivot.x(), 1.6));
        assert(near(pivot.y(), 1.6));
        fprintf(stderr, "  PASS: default pivot = centroid\n");
    }

    // ═══ Test 2: Origin pivot ═══
    {
        core::Document doc;
        CanvasWidget canvas;
        canvas.setDocument(&doc);

        core::Polyline pl;
        pl.points = {{10,10},{20,10},{20,20},{10,20},{10,10}};
        auto id = doc.add_polyline(pl, "sq");
        canvas.setSelectionFromModel({static_cast<qulonglong>(id)});

        canvas.setPivotMode(1); // Origin
        QPointF pivot = canvas.computePivot();
        assert(near(pivot.x(), 0.0));
        assert(near(pivot.y(), 0.0));
        fprintf(stderr, "  PASS: origin pivot = (0,0)\n");
    }

    // ═══ Test 3: BBox center pivot ═══
    {
        core::Document doc;
        CanvasWidget canvas;
        canvas.setDocument(&doc);

        core::Polyline pl;
        pl.points = {{2,3},{8,3},{8,7},{2,7},{2,3}};
        auto id = doc.add_polyline(pl, "rect");
        canvas.setSelectionFromModel({static_cast<qulonglong>(id)});

        canvas.setPivotMode(2); // BBoxCenter
        QPointF pivot = canvas.computePivot();
        assert(near(pivot.x(), 5.0)); // (2+8)/2
        assert(near(pivot.y(), 5.0)); // (3+7)/2
        fprintf(stderr, "  PASS: bbox center pivot\n");
    }

    // ═══ Test 4: Custom pivot ═══
    {
        core::Document doc;
        CanvasWidget canvas;
        canvas.setDocument(&doc);

        core::Polyline pl;
        pl.points = {{0,0},{10,0},{10,10},{0,10},{0,0}};
        auto id = doc.add_polyline(pl, "sq");
        canvas.setSelectionFromModel({static_cast<qulonglong>(id)});

        canvas.setPivotMode(3, QPointF(42.0, 99.0)); // Custom
        QPointF pivot = canvas.computePivot();
        assert(near(pivot.x(), 42.0));
        assert(near(pivot.y(), 99.0));
        fprintf(stderr, "  PASS: custom pivot\n");
    }

    // ═══ Test 5: Centroid vs BBoxCenter differ for non-uniform points ═══
    {
        core::Document doc;
        CanvasWidget canvas;
        canvas.setDocument(&doc);

        // Triangle: (0,0), (10,0), (1,1), (0,0) — centroid != bbox center
        core::Polyline pl;
        pl.points = {{0,0},{10,0},{1,1},{0,0}};
        auto id = doc.add_polyline(pl, "tri");
        canvas.setSelectionFromModel({static_cast<qulonglong>(id)});

        canvas.setPivotMode(0); // Centroid
        QPointF centroid = canvas.computePivot();

        canvas.setPivotMode(2); // BBoxCenter
        QPointF bbox = canvas.computePivot();

        // BBox center: ((0+10)/2, (0+1)/2) = (5, 0.5)
        assert(near(bbox.x(), 5.0));
        assert(near(bbox.y(), 0.5));
        // Centroid: (0+10+1+0)/4=2.75, (0+0+1+0)/4=0.25
        assert(near(centroid.x(), 2.75));
        assert(near(centroid.y(), 0.25));
        // They differ
        assert(!near(centroid.x(), bbox.x()));
        fprintf(stderr, "  PASS: centroid != bbox center for non-uniform\n");
    }

    fprintf(stderr, "\n  All Pivot tests passed!\n");
    return 0;
}
