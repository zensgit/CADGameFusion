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

#include "snap_manager.hpp"

class QPainterPath;
class QRectF;
class SnapSettings;

namespace core {
class Document;
struct Entity;
struct Layer;
}

using EntityId = uint64_t; // Mirror core::EntityId

class CanvasWidget : public QWidget {
    Q_OBJECT
public:
    struct PolyVis {
        QVector<QPointF> pts;
        EntityId entityId{0}; // PR5: 0 = not bound to Document entity
        // Cache
        QPainterPath cachePath;
        QRectF aabb;
    };

    struct PolylineState {
        EntityId entityId{0};
        bool visible{true};
        int groupId{-1};
        int layerId{0};
        QColor color;
        int pointCount{0};
    };

    explicit CanvasWidget(QWidget* parent = nullptr);
    void setDocument(core::Document* doc);
    void setSnapSettings(SnapSettings* settings);
    void reloadFromDocument(); // PR5: rebuild Canvas from Document (single source of truth)
    QVector<PolylineState> polylineStates() const;

    void clear();
    void addTriMesh(const QVector<QPointF>& vertices, const QVector<unsigned int>& indices);
    // Tri mesh accessors (for undoable commands)
    const QVector<QPointF>& triVerts() const { return triVerts_; }
    const QVector<unsigned int>& triIndices() const { return triIndices_; }
    void setTriMesh(const QVector<QPointF>& vertices, const QVector<unsigned int>& indices);
    void clearTriMesh();
    void setSelection(const QList<qulonglong>& entityIds);
    QList<qulonglong> selectEntitiesInWorldRect(const QRectF& rect, bool crossing);

signals:
    void selectionChanged(const QList<qulonglong>& entityIds);
    void deleteRequested(bool allSimilar);

protected:
    void paintEvent(QPaintEvent*) override;
    void wheelEvent(QWheelEvent*) override;
    void mousePressEvent(QMouseEvent*) override;
    void mouseMoveEvent(QMouseEvent*) override;
    void mouseReleaseEvent(QMouseEvent*) override;
    void keyPressEvent(QKeyEvent*) override;
    void showEvent(QShowEvent*) override;
    void resizeEvent(QResizeEvent*) override;

private:
    QPointF worldToScreen(const QPointF& p) const;
    QPointF screenToWorld(const QPointF& p) const;
    void updatePolyCache(PolyVis& pv);
    void selectGroup(const QPoint& pos);  // Alt+Click to select entire group
    void selectAtPoint(const QPointF& worldPos);
    const core::Entity* entityFor(EntityId id) const;
    const core::Layer* layerFor(int layerId) const;
    bool isEntityVisible(const core::Entity& entity) const;
    QColor resolveEntityColor(const core::Entity& entity) const;

    double scale_ { 1.0 }; // pixels per world unit
    QPointF pan_ { 0.0, 0.0 }; // in pixels
    QPoint lastPos_ {};
    SnapManager snap_manager_;
    SnapManager::SnapResult m_currentSnap;
    // storage for polylines
    QVector<PolyVis> polylines_;
    QVector<SnapManager::PolylineView> snap_inputs_;
    QSet<EntityId> selected_entities_;
    bool triSelected_ { false };
    QVector<QPointF> triVerts_;
    QVector<unsigned int> triIndices_;
    bool selection_active_ { false };
    bool selection_dragging_ { false };
    QPointF selection_start_screen_;
    QPointF selection_current_screen_;
    core::Document* m_doc{nullptr};
    SnapSettings* snap_settings_{nullptr};
};
