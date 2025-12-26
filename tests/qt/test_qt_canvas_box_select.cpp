#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>
#include <QtCore/QList>
#include <QtGui/QMouseEvent>

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

static QMouseEvent makeMouseEvent(QEvent::Type type,
                                  const QPointF& pos,
                                  Qt::MouseButton button,
                                  Qt::MouseButtons buttons,
                                  Qt::KeyboardModifiers modifiers) {
    return QMouseEvent(type, pos, pos, pos, button, buttons, modifiers);
}

struct TestCanvas : public CanvasWidget {
    using CanvasWidget::mousePressEvent;
    using CanvasWidget::mouseMoveEvent;
    using CanvasWidget::mouseReleaseEvent;
};

static const core::Polyline* polylineFor(const core::Document& doc, core::EntityId id) {
    const auto* e = doc.get_entity(id);
    if (!e) return nullptr;
    return std::get_if<core::Polyline>(&e->payload);
}

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    core::Document doc;
    TestCanvas canvas;
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

    auto moveId = doc.add_polyline(makeRect(0, 0, 1, 1), "move");
    auto snapId = doc.add_polyline(makeRect(10, 0, 11, 1), "snap");
    assert(moveId > 0);
    assert(snapId > 0);

    canvas.reloadFromDocument();
    canvas.setSelectionFromModel({static_cast<qulonglong>(moveId)});

    settings.setSnapEndpoints(true);
    settings.setSnapMidpoints(false);
    settings.setSnapGrid(false);
    settings.setSnapRadiusPixels(10.0);

    QMouseEvent press = makeMouseEvent(QEvent::MouseButtonPress, QPointF(0.0, 0.0),
                                       Qt::LeftButton, Qt::LeftButton, Qt::NoModifier);
    canvas.mousePressEvent(&press);

    QMouseEvent move1 = makeMouseEvent(QEvent::MouseMove, QPointF(9.5, 0.0),
                                       Qt::NoButton, Qt::LeftButton, Qt::NoModifier);
    canvas.mouseMoveEvent(&move1);
    const auto* moved1 = polylineFor(doc, moveId);
    assert(moved1);
    assert(std::abs(moved1->points[0].x - 10.0) < 1e-6);

    QMouseEvent move2 = makeMouseEvent(QEvent::MouseMove, QPointF(20.0, 0.0),
                                       Qt::NoButton, Qt::LeftButton, Qt::NoModifier);
    canvas.mouseMoveEvent(&move2);
    const auto* moved2 = polylineFor(doc, moveId);
    assert(moved2);
    assert(std::abs(moved2->points[0].x - 10.0) < 1e-6);

    QMouseEvent move3 = makeMouseEvent(QEvent::MouseMove, QPointF(30.0, 0.0),
                                       Qt::NoButton, Qt::LeftButton, Qt::NoModifier);
    canvas.mouseMoveEvent(&move3);
    const auto* moved3 = polylineFor(doc, moveId);
    assert(moved3);
    assert(std::abs(moved3->points[0].x - 30.0) < 1e-6);

    QMouseEvent release = makeMouseEvent(QEvent::MouseButtonRelease, QPointF(30.0, 0.0),
                                         Qt::LeftButton, Qt::NoButton, Qt::NoModifier);
    canvas.mouseReleaseEvent(&release);

    assert(doc.set_entity_visible(id1, false));
    canvas.reloadFromDocument();
    ids = canvas.selectEntitiesInWorldRect(windowRect, true);
    assert(!ids.contains(static_cast<qulonglong>(id1)));

    return 0;
}
