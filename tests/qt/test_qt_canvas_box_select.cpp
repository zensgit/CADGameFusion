#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>
#include <QtCore/QList>

#include <cassert>
#include <cmath>

#include "canvas.hpp"
#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "snap/snap_settings.hpp"

static core::Polyline makeRect(double x0, double y0, double x1, double y1) {
    core::Polyline pl;
    pl.points = {
        {x0, y0},
        {x1, y0},
        {x1, y1},
        {x0, y1},
        {x0, y0}
    };
    return pl;
}

static bool nearPoint(const QPointF& a, const QPointF& b, double eps = 1e-6) {
    return std::abs(a.x() - b.x()) < eps && std::abs(a.y() - b.y()) < eps;
}

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    core::Document doc;
    CanvasWidget canvas;
    canvas.setDocument(&doc);

    auto id1 = doc.add_polyline(makeRect(0, 0, 1, 1), "one");
    auto id2 = doc.add_polyline(makeRect(5, 0, 6, 1), "two");
    assert(id1 > 0);
    assert(id2 > 0);

    canvas.reloadFromDocument();

    QRectF windowRect(-0.5, -0.5, 2.0, 2.0);
    auto ids = canvas.selectEntitiesInWorldRect(windowRect, false);
    assert(ids.size() == 1);
    assert(ids.contains(static_cast<qulonglong>(id1)));

    QRectF crossRect(4.5, -0.5, 1.0, 2.0);
    ids = canvas.selectEntitiesInWorldRect(crossRect, false);
    assert(ids.isEmpty());

    ids = canvas.selectEntitiesInWorldRect(crossRect, true);
    assert(ids.size() == 1);
    assert(ids.contains(static_cast<qulonglong>(id2)));

    SnapSettings settings;
    settings.setSnapEndpoints(true);
    settings.setSnapMidpoints(false);
    settings.setSnapGrid(false);
    canvas.setSnapSettings(&settings);
    bool snapped = false;
    QPointF snapPos = canvas.snapWorldPosition(QPointF(0.02, 0.01), &snapped);
    assert(snapped);
    assert(nearPoint(snapPos, QPointF(0.0, 0.0), 1e-3));

    settings.setSnapEndpoints(false);
    settings.setSnapMidpoints(false);
    settings.setSnapGrid(true);
    const double step = SnapManager::gridStepForScale(1.0);
    const QPointF gridQuery(step - 2.0, 9.0);
    const QPointF expected(std::round(gridQuery.x() / step) * step,
                           std::round(gridQuery.y() / step) * step);
    snapPos = canvas.snapWorldPosition(gridQuery, &snapped);
    assert(snapped);
    assert(nearPoint(snapPos, expected, 1e-3));

    assert(doc.set_entity_visible(id1, false));
    canvas.reloadFromDocument();
    ids = canvas.selectEntitiesInWorldRect(windowRect, true);
    assert(!ids.contains(static_cast<qulonglong>(id1)));

    return 0;
}
