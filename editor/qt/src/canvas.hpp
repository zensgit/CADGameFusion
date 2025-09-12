#pragma once

#include <QWidget>
#include <QVector>
#include <QPointF>
#include <QColor>

class CanvasWidget : public QWidget {
    Q_OBJECT
public:
    explicit CanvasWidget(QWidget* parent = nullptr);
    void addPolyline(const QVector<QPointF>& poly);
    void addPolylineColored(const QVector<QPointF>& poly, const QColor& color);
    void clear();
    void addTriMesh(const QVector<QPointF>& vertices, const QVector<unsigned int>& indices);
    void removeSelected();

protected:
    void paintEvent(QPaintEvent*) override;
    void wheelEvent(QWheelEvent*) override;
    void mousePressEvent(QMouseEvent*) override;
    void mouseMoveEvent(QMouseEvent*) override;
    void keyPressEvent(QKeyEvent*) override;

private:
    QPointF worldToScreen(const QPointF& p) const;
    QPointF screenToWorld(const QPointF& p) const;

    double scale_ { 1.0 }; // pixels per world unit
    QPointF pan_ { 0.0, 0.0 }; // in pixels
    QPoint lastPos_ {};
    struct PolyVis { QVector<QPointF> pts; QColor color; };
    QVector<PolyVis> polylines_;
    int selected_ { -1 };
    QVector<QPointF> triVerts_;
    QVector<unsigned int> triIndices_;
};
