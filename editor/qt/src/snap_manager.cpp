#include "snap_manager.hpp"

#include <algorithm>
#include <cmath>

namespace {

bool line_segment_intersection(const QPointF& a0,
                               const QPointF& a1,
                               const QPointF& b0,
                               const QPointF& b1,
                               QPointF* out) {
    const double s1x = a1.x() - a0.x();
    const double s1y = a1.y() - a0.y();
    const double s2x = b1.x() - b0.x();
    const double s2y = b1.y() - b0.y();
    const double den = (-s2x * s1y + s1x * s2y);
    if (std::abs(den) < 1e-12) return false;

    const double s = (-s1y * (a0.x() - b0.x()) + s1x * (a0.y() - b0.y())) / den;
    const double t = ( s2x * (a0.y() - b0.y()) - s2y * (a0.x() - b0.x())) / den;
    if (s < 0.0 || s > 1.0 || t < 0.0 || t > 1.0) return false;

    if (out) {
        *out = QPointF(a0.x() + (t * s1x), a0.y() + (t * s1y));
    }
    return true;
}

} // namespace

double SnapManager::gridStepForScale(double scale, double targetPixelSpacing) {
    if (scale <= 0.0) scale = 1.0;
    if (targetPixelSpacing <= 0.0) return 1.0;
    const double rawStep = targetPixelSpacing / scale;
    if (rawStep <= 0.0) return 1.0;
    const double logStep = std::log10(rawStep);
    const double floorLog = std::floor(logStep);
    const double base = std::pow(10.0, floorLog);
    double step = base;
    const double residue = rawStep / base;
    if (residue >= 5.0) step *= 5.0;
    else if (residue >= 2.0) step *= 2.0;
    return step;
}

SnapManager::SnapResult SnapManager::findSnap(const QVector<PolylineView>& polylines,
                                              double scale,
                                              const QPointF& queryPosWorld) const {
    struct SegmentRef {
        QPointF a;
        QPointF b;
        uint64_t entityId{0};
    };

    SnapResult best;
    best.active = false;

    if (!snapEndpoints_ && !snapMidpoints_ && !snapCenters_ && !snapIntersections_ && !snapGrid_) {
        return best;
    }

    if (scale <= 0.0) scale = 1.0;
    const double snapWorld = snapRadiusPx_ / scale;
    double minDSq = snapWorld * snapWorld;
    const QRectF queryRect(queryPosWorld.x() - snapWorld,
                           queryPosWorld.y() - snapWorld,
                           snapWorld * 2.0,
                           snapWorld * 2.0);
    QVector<SegmentRef> segments;
    segments.reserve(polylines.size() * 3);
    bool intersection_overloaded = false;
    const int kMaxIntersectionSegments = 2000;
    const double rectLeft = queryRect.left();
    const double rectRight = queryRect.right();
    const double rectTop = queryRect.top();
    const double rectBottom = queryRect.bottom();

    for (const auto& pv : polylines) {
        if (!pv.visible) continue;
        if (!pv.points || !pv.aabb) continue;

        const bool insideCandidate = pv.aabb->intersects(queryRect);
        if (!insideCandidate) continue;

        const auto& pts = *pv.points;
        if (pts.size() < 2) continue;

        if (snapIntersections_ && !intersection_overloaded) {
            for (int i = 0; i + 1 < pts.size(); ++i) {
                const QPointF& a = pts[i];
                const QPointF& b = pts[i + 1];
                const double segMinX = std::min(a.x(), b.x());
                const double segMaxX = std::max(a.x(), b.x());
                const double segMinY = std::min(a.y(), b.y());
                const double segMaxY = std::max(a.y(), b.y());
                if (segMaxX < rectLeft || segMinX > rectRight || segMaxY < rectTop || segMinY > rectBottom) {
                    continue;
                }

                SegmentRef seg;
                seg.a = a;
                seg.b = b;
                seg.entityId = pv.entityId;
                segments.push_back(seg);

                if (segments.size() >= kMaxIntersectionSegments) {
                    // Avoid O(N^2) blow-ups (e.g. zoomed-out view) by disabling intersection snap.
                    intersection_overloaded = true;
                    segments.clear();
                    break;
                }
            }
        }

        if (snapEndpoints_ && insideCandidate) {
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

        if (snapMidpoints_ && insideCandidate) {
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

        if (snapCenters_ && insideCandidate) {
            const QPointF center((pv.aabb->left() + pv.aabb->right()) * 0.5,
                                 (pv.aabb->top() + pv.aabb->bottom()) * 0.5);
            const double dx = center.x() - queryPosWorld.x();
            const double dy = center.y() - queryPosWorld.y();
            const double dSq = dx * dx + dy * dy;
            if (dSq < minDSq) {
                minDSq = dSq;
                best.active = true;
                best.pos = center;
                best.type = SnapType::Center;
            }
        }
    }

    if (snapIntersections_ && !intersection_overloaded && segments.size() > 1) {
        for (int i = 0; i < segments.size(); ++i) {
            for (int j = i + 1; j < segments.size(); ++j) {
                if (segments[i].entityId == segments[j].entityId) continue;
                QPointF hit;
                if (!line_segment_intersection(segments[i].a, segments[i].b, segments[j].a, segments[j].b, &hit)) continue;
                const double dx = hit.x() - queryPosWorld.x();
                const double dy = hit.y() - queryPosWorld.y();
                const double dSq = dx * dx + dy * dy;
                if (dSq < minDSq) {
                    minDSq = dSq;
                    best.active = true;
                    best.pos = hit;
                    best.type = SnapType::Intersection;
                }
            }
        }
    }

    if (snapGrid_) {
        const double step = gridStepForScale(scale, gridPixelSpacingPx_);
        if (step > 0.0) {
            const double gx = std::round(queryPosWorld.x() / step) * step;
            const double gy = std::round(queryPosWorld.y() / step) * step;
            const double dx = gx - queryPosWorld.x();
            const double dy = gy - queryPosWorld.y();
            const double dSq = dx * dx + dy * dy;
            if (dSq < minDSq) {
                minDSq = dSq;
                best.active = true;
                best.pos = QPointF(gx, gy);
                best.type = SnapType::Grid;
            }
        }
    }

    return best;
}
