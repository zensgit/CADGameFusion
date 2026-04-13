#pragma once

#include "tools/tool.hpp"
#include <QPointF>
#include <QString>

class SnapManager;

class MeasureTool : public Tool {
public:
    // Provide world↔screen conversion callbacks
    using WorldToScreen = QPointF(*)(const QPointF&, double, const QPointF&);

    void setSnapManager(SnapManager* sm) { m_snap = sm; }
    void setScale(double s) { m_scale = s; }

    bool mousePressEvent(QMouseEvent* e) override;
    bool mouseMoveEvent(QMouseEvent* e) override;
    bool keyPressEvent(QKeyEvent* e) override;
    void paint(QPainter& painter, double scale, const QPointF& pan) override;
    QString name() const override { return "Measure"; }

    // Query current measurement
    bool hasMeasurement() const { return m_state == Done; }
    double distance() const { return m_distance; }
    double angle() const { return m_angleDeg; }
    QPointF pointA() const { return m_pointA; }
    QPointF pointB() const { return m_pointB; }

    void reset();

private:
    enum State { Idle, PickingSecond, Done };
    State m_state{Idle};
    QPointF m_pointA;
    QPointF m_pointB;
    double m_distance{0.0};
    double m_angleDeg{0.0};
    double m_scale{1.0};
    SnapManager* m_snap{nullptr};
};
