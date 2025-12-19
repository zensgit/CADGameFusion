#pragma once

#include <QWidget>
#include <QVector>
#include <QPointF>
#include <QColor>
#include <QList>
#include <QSet>
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

    void clear();
    void addTriMesh(const QVector<QPointF>& vertices, const QVector<unsigned int>& indices);
    // Tri mesh accessors (for undoable commands)
    const QVector<QPointF>& triVerts() const { return triVerts_; }
    const QVector<unsigned int>& triIndices() const { return triIndices_; }
    void setTriMesh(const QVector<QPointF>& vertices, const QVector<unsigned int>& indices);
    void clearTriMesh();
    int  newGroupId();
    void setSelection(const QList<qulonglong>& entityIds);

signals:
    void selectionChanged(const QList<qulonglong>& entityIds);
    void deleteRequested(bool allSimilar);

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
    void selectGroup(const QPoint& pos);  // Alt+Click to select entire group

    double scale_ { 1.0 }; // pixels per world unit
    QPointF pan_ { 0.0, 0.0 }; // in pixels
    QPoint lastPos_ {};
    SnapResult m_currentSnap;
    // storage for polylines
    QVector<PolyVis> polylines_;
    QSet<EntityId> selected_entities_;
    bool triSelected_ { false };
    int  nextGroupId_ { 1 };
    QVector<QPointF> triVerts_;
    QVector<unsigned int> triIndices_;
    core::Document* m_doc{nullptr};
};
