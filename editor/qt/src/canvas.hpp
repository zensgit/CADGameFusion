#pragma once

#include <QWidget>
#include <QVector>
#include <QPointF>
#include <QColor>
#include <QList>

class CanvasWidget : public QWidget {
    Q_OBJECT
public:
    struct PolyVis { QVector<QPointF> pts; QColor color; int groupId; bool visible{true}; };

    explicit CanvasWidget(QWidget* parent = nullptr);
    void addPolyline(const QVector<QPointF>& poly);
    void addPolylineColored(const QVector<QPointF>& poly, const QColor& color, int groupId = -1);
    void clear();
    void addTriMesh(const QVector<QPointF>& vertices, const QVector<unsigned int>& indices);
    // Tri mesh accessors (for undoable commands)
    const QVector<QPointF>& triVerts() const { return triVerts_; }
    const QVector<unsigned int>& triIndices() const { return triIndices_; }
    void setTriMesh(const QVector<QPointF>& vertices, const QVector<unsigned int>& indices);
    void clearTriMesh();
    void removeSelected();
    int  newGroupId();
    int removeAllSimilar();  // Returns number of removed items
    int polylineCount() const { return polylines_.size(); }
    void removePolylineAt(int index);
    bool polylineAt(int index, PolyVis& out) const;
    void insertPolylineAt(int index, const PolyVis& pv);
    void setPolylineVisible(int index, bool vis);
    int selectedIndex() const { return selected_; }
    QVector<PolyVis> snapshotPolylines() const { return polylines_; }
    void restorePolylines(const QVector<PolyVis>& polys);

    const QVector<PolyVis>& polylinesData() const { return polylines_; }
    int selectedGroupId() const;
    void selectGroup(const QPoint& pos);  // Alt+Click to select entire group

signals:
    void selectionChanged(const QList<int>& indices);

protected:
    void paintEvent(QPaintEvent*) override;
    void wheelEvent(QWheelEvent*) override;
    void mousePressEvent(QMouseEvent*) override;
    void mouseMoveEvent(QMouseEvent*) override;
    void keyPressEvent(QKeyEvent*) override;
    void showEvent(QShowEvent*) override;
    void resizeEvent(QResizeEvent*) override;

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
