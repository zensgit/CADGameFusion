#pragma once

#include <QObject>

class SnapSettings : public QObject {
    Q_OBJECT
public:
    explicit SnapSettings(QObject* parent = nullptr);

    bool snapEndpoints() const { return snapEndpoints_; }
    bool snapMidpoints() const { return snapMidpoints_; }
    bool snapCenters() const { return snapCenters_; }
    bool snapIntersections() const { return snapIntersections_; }
    bool objectSnapEnabled() const { return snapEndpoints_ || snapMidpoints_ || snapCenters_ || snapIntersections_; }
    bool orthoEnabled() const { return orthoEnabled_; }
    bool snapGrid() const { return snapGrid_; }
    double snapRadiusPixels() const { return snapRadiusPixels_; }
    double gridPixelSpacing() const { return gridPixelSpacing_; }

    void setSnapEndpoints(bool enabled);
    void setSnapMidpoints(bool enabled);
    void setSnapCenters(bool enabled);
    void setSnapIntersections(bool enabled);
    void setObjectSnapEnabled(bool enabled);
    void setOrthoEnabled(bool enabled);
    void setSnapGrid(bool enabled);
    void setSnapRadiusPixels(double px);
    void setGridPixelSpacing(double px);

signals:
    void settingsChanged();

private:
    bool snapEndpoints_{true};
    bool snapMidpoints_{true};
    bool snapCenters_{true};
    bool snapIntersections_{true};
    bool orthoEnabled_{false};
    bool snapGrid_{false};
    double snapRadiusPixels_{12.0};
    double gridPixelSpacing_{50.0};
};
