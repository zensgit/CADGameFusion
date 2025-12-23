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
#include "core/document.hpp"

class QPainterPath;
class QRectF;
class SnapSettings;

using EntityId = uint64_t; // Mirror core::EntityId

class CanvasWidget : public QWidget, public core::DocumentObserver {
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
    ~CanvasWidget() override;
    void setDocument(core::Document* doc);
    void setSnapSettings(SnapSettings* settings);
    SnapSettings* snapSettings() const { return snap_settings_; }
    void reloadFromDocument(); // PR5: rebuild Canvas from Document (single source of truth)
    QPointF snapWorldPosition(const QPointF& worldPos, bool* snapped = nullptr);

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
    void moveEntitiesRequested(const QList<qulonglong>& entityIds,
                               const QVector<QVector<QPointF>>& beforePoints,
                               const QPointF& delta);

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
    struct MoveEntity {
        EntityId id{0};
        QVector<QPointF> points;
    };

    void scheduleUpdate();
    void scheduleSelectionChanged();
    QPointF worldToScreen(const QPointF& p) const;
    QPointF screenToWorld(const QPointF& p) const;
    SnapManager::SnapResult computeSnapAt(const QPointF& worldPos, bool excludeSelection);
    QPointF snapWorldPositionInternal(const QPointF& worldPos, bool* snapped, bool excludeSelection);
    QPointF moveTargetWorldWithSnap(const QPointF& mouseWorld, SnapManager::SnapResult* outSnap);
    void updatePolyCache(PolyVis& pv);
    bool syncPolylineFromDocument(EntityId id);
    bool removePolyline(EntityId id);
    QList<qulonglong> selectionList() const;
    void on_document_changed(const core::Document& doc, const core::DocumentChangeEvent& event) override;
    void selectGroupAtWorld(const QPointF& worldPos);  // Alt+Click to select entire group
    void selectAtPoint(const QPointF& worldPos);
    EntityId hitEntityAtWorld(const QPointF& worldPos) const;
    const core::Entity* entityFor(EntityId id) const;
    const core::Layer* layerFor(int layerId) const;
    bool isEntityVisible(const core::Entity& entity) const;
    QColor resolveEntityColor(const core::Entity& entity) const;
    QVector<PolylineState> polylineStates() const; // debug-only: derived from Document + cache

    double scale_ { 1.0 }; // pixels per world unit
    QPointF pan_ { 0.0, 0.0 }; // in pixels
    QPoint lastPos_ {};
    SnapManager snap_manager_;
    SnapManager::SnapResult m_currentSnap;
    // Render cache derived from Document (do not mutate externally).
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
    bool move_active_{false};
    bool move_dragging_{false};
    bool move_snap_locked_{false};
    QPointF move_snap_locked_pos_;
    SnapManager::SnapType move_snap_locked_type_{SnapManager::SnapType::None};
    QPointF move_start_screen_;
    QPointF move_start_world_;
    QPointF move_anchor_world_;
    QPointF move_last_delta_;
    QVector<MoveEntity> move_entities_;
    bool update_pending_{false};
    bool selection_change_pending_{false};
    core::Document* m_doc{nullptr};
    SnapSettings* snap_settings_{nullptr};
};
