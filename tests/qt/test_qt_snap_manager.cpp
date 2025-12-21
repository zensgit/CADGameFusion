#include <QtCore/QPointF>
#include <QtCore/QRectF>
#include <QtCore/QVector>

#include <cassert>
#include <cmath>

#include "snap_manager.hpp"

static bool nearPoint(const QPointF& a, const QPointF& b, double eps = 1e-6) {
    return std::abs(a.x() - b.x()) < eps && std::abs(a.y() - b.y()) < eps;
}

int main() {
    SnapManager manager;

    QVector<QPointF> pts;
    pts << QPointF(0.0, 0.0) << QPointF(1.0, 0.0) << QPointF(1.0, 1.0);
    QRectF aabb(QPointF(0.0, 0.0), QPointF(1.0, 1.0));

    SnapManager::PolylineView view;
    view.points = &pts;
    view.aabb = &aabb;
    view.entityId = 1;
    view.visible = true;

    QVector<SnapManager::PolylineView> polylines;
    polylines.append(view);

    auto res = manager.findSnap(polylines, 100.0, QPointF(0.02, 0.01));
    assert(res.active);
    assert(res.type == SnapManager::SnapType::Endpoint);
    assert(nearPoint(res.pos, QPointF(0.0, 0.0), 1e-3));

    res = manager.findSnap(polylines, 100.0, QPointF(0.55, 0.02));
    assert(res.active);
    assert(res.type == SnapManager::SnapType::Midpoint);
    assert(nearPoint(res.pos, QPointF(0.5, 0.0), 1e-3));

    manager.setSnapEndpoints(false);
    manager.setSnapMidpoints(true);
    res = manager.findSnap(polylines, 100.0, QPointF(0.02, 0.01));
    assert(!res.active);
    res = manager.findSnap(polylines, 100.0, QPointF(0.55, 0.02));
    assert(res.active);
    assert(res.type == SnapManager::SnapType::Midpoint);

    manager.setSnapMidpoints(false);
    res = manager.findSnap(polylines, 100.0, QPointF(0.55, 0.02));
    assert(!res.active);

    polylines[0].visible = false;
    manager.setSnapEndpoints(true);
    manager.setSnapMidpoints(true);
    res = manager.findSnap(polylines, 100.0, QPointF(0.02, 0.01));
    assert(!res.active);

    return 0;
}
