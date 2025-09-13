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
    void addPolylineColored(const QVector<QPointF>& poly, const QColor& color, int groupId = -1);
    void clear();
    void addTriMesh(const QVector<QPointF>& vertices, const QVector<unsigned int>& indices);
    void removeSelected();
    int  newGroupId();
    int removeAllSimilar();  // Returns number of removed items

    struct PolyVis { QVector<QPointF> pts; QColor color; int groupId; };
    const QVector<PolyVis>& polylinesData() const { return polylines_; }
    int selectedGroupId() const;
    void selectGroup(const QPoint& pos);  // Alt+Click to select entire group

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
    // storage for polylines
    QVector<PolyVis> polylines_;
    int selected_ { -1 };
    bool triSelected_ { false };
    int  nextGroupId_ { 1 };
    QVector<QPointF> triVerts_;
    QVector<unsigned int> triIndices_;
};
