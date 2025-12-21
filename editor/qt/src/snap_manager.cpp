#include "snap_manager.hpp"

#include <algorithm>
#include <cmath>

SnapManager::SnapResult SnapManager::findSnap(const QVector<PolylineView>& polylines,
                                              double scale,
                                              const QPointF& queryPosWorld) const {
    SnapResult best;
    best.active = false;

    if (!snapEndpoints_ && !snapMidpoints_ && !snapGrid_) {
        return best;
    }

    if (scale <= 0.0) scale = 1.0;
    const double snapWorld = snapRadiusPx_ / scale;
    double minDSq = snapWorld * snapWorld;
    const QRectF queryRect(queryPosWorld.x() - snapWorld,
                           queryPosWorld.y() - snapWorld,
                           snapWorld * 2.0,
                           snapWorld * 2.0);

    for (const auto& pv : polylines) {
        if (!pv.visible) continue;
        if (!pv.points || !pv.aabb) continue;
        if (!pv.aabb->intersects(queryRect)) continue;

        const auto& pts = *pv.points;
        if (pts.size() < 2) continue;

        if (snapEndpoints_) {
            // Check vertices (Endpoints)
            for (const auto& pt : pts) {
                const double dx = pt.x() - queryPosWorld.x();
                const double dy = pt.y() - queryPosWorld.y();
                const double dSq = dx * dx + dy * dy;
                if (dSq < minDSq) {
                    minDSq = dSq;
                    best.active = true;
                    best.pos = pt;
                    best.type = SnapType::Endpoint;
                }
            }
        }

        if (snapMidpoints_) {
            // Check midpoints
            for (int i = 0; i + 1 < pts.size(); ++i) {
                const QPointF mid = (pts[i] + pts[i + 1]) * 0.5;
                const double dx = mid.x() - queryPosWorld.x();
                const double dy = mid.y() - queryPosWorld.y();
                const double dSq = dx * dx + dy * dy;
                if (dSq < minDSq) {
                    minDSq = dSq;
                    best.active = true;
                    best.pos = mid;
                    best.type = SnapType::Midpoint;
                }
            }
        }
    }

    return best;
}
