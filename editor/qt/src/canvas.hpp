#pragma once

#include <QWidget>
#include <QVector>
#include <QPointF>
#include <QColor>
#include <QList>
#include <QPainterPath>
#include <QRectF>
#include <cstdint>

class QPainterPath;
class QRectF;

namespace core { class Document; }

using EntityId = uint64_t; // Mirror core::EntityId

class CanvasWidget : public QWidget {
    Q_OBJECT
public:
    enum class SnapType { None, Endpoint, Midpoint };
    struct SnapResult {
        bool active{false};
        QPointF pos;
        SnapType type{SnapType::None};
    };

    struct PolyVis {
        QVector<QPointF> pts;
        QColor color;
        int groupId;
        bool visible{true};
        int layerId{0}; // Layer association
        EntityId entityId{0}; // PR5: 0 = not bound to Document entity
        // Cache
        QPainterPath cachePath;
        QRectF aabb;
    };

    explicit CanvasWidget(QWidget* parent = nullptr);
    void setDocument(core::Document* doc);
    void reloadFromDocument(); // PR5: rebuild Canvas from Document (single source of truth)
    EntityId entityIdAt(int index) const; // PR5: get EntityId for polyline at index

    void addPolyline(const QVector<QPointF>& poly, int layerId = 0);
    void addPolylineColored(const QVector<QPointF>& poly, const QColor& color, int groupId = -1, int layerId = 0);
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
    void updatePolyCache(PolyVis& pv);
    SnapResult findSnapPoint(const QPointF& queryPosWorld);

    double scale_ { 1.0 }; // pixels per world unit
    QPointF pan_ { 0.0, 0.0 }; // in pixels
    QPoint lastPos_ {};
    SnapResult m_currentSnap;
    // storage for polylines
    QVector<PolyVis> polylines_;
    int selected_ { -1 };
    bool triSelected_ { false };
    int  nextGroupId_ { 1 };
    QVector<QPointF> triVerts_;
    QVector<unsigned int> triIndices_;
    core::Document* m_doc{nullptr};
};