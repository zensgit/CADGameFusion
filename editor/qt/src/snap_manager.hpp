#pragma once

#include <QPointF>
#include <QRectF>
#include <QVector>
#include <cstdint>

class SnapManager {
public:
    enum class SnapType { None, Endpoint, Midpoint };
    struct SnapResult {
        bool active{false};
        QPointF pos;
        SnapType type{SnapType::None};
    };

    struct PolylineView {
        const QVector<QPointF>* points{nullptr};
        const QRectF* aabb{nullptr};
        uint64_t entityId{0};
        bool visible{false};
    };

    void setSnapRadiusPixels(double px) { snapRadiusPx_ = px; }
    double snapRadiusPixels() const { return snapRadiusPx_; }

    SnapResult findSnap(const QVector<PolylineView>& polylines,
                        double scale,
                        const QPointF& queryPosWorld) const;

private:
    double snapRadiusPx_{12.0};
};
