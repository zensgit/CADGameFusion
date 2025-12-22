#pragma once

#include <QPointF>
#include <QRectF>
#include <QVector>
#include <cstdint>

class SnapManager {
public:
    enum class SnapType { None, Endpoint, Midpoint, Grid };
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
    void setSnapEndpoints(bool enabled) { snapEndpoints_ = enabled; }
    void setSnapMidpoints(bool enabled) { snapMidpoints_ = enabled; }
    void setSnapGrid(bool enabled) { snapGrid_ = enabled; }
    void setGridPixelSpacing(double px) { gridPixelSpacingPx_ = px; }
    bool snapEndpoints() const { return snapEndpoints_; }
    bool snapMidpoints() const { return snapMidpoints_; }
    bool snapGrid() const { return snapGrid_; }
    double gridPixelSpacing() const { return gridPixelSpacingPx_; }

    static double gridStepForScale(double scale, double targetPixelSpacing = 50.0);

    SnapResult findSnap(const QVector<PolylineView>& polylines,
                        double scale,
                        const QPointF& queryPosWorld) const;

private:
    double snapRadiusPx_{12.0};
    bool snapEndpoints_{true};
    bool snapMidpoints_{true};
    bool snapGrid_{false};
    double gridPixelSpacingPx_{50.0};
};
