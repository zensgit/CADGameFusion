#pragma once

#include "tools/tool.hpp"
#include <QPointF>
#include <QRectF>
#include <QSet>
#include <QVector>
#include <cstdint>
#include <functional>

class GizmoTool : public Tool {
public:
    enum class HandleType { None, MoveX, MoveY, MoveXY, RotateArc, ScaleCorner };

    using MoveCallback = std::function<void(QPointF delta)>;
    using RotateCallback = std::function<void(double angleDeg, QPointF center)>;
    using ScaleCallback = std::function<void(double factor, QPointF center)>;

    void setCallbacks(MoveCallback mv, RotateCallback rot, ScaleCallback sc) {
        m_onMove = std::move(mv); m_onRotate = std::move(rot); m_onScale = std::move(sc);
    }

    void setSelection(const QRectF& selBBox, const QPointF& pivot);
    void clearSelection();
    bool hasSelection() const { return m_hasSelection; }

    bool mousePressEvent(QMouseEvent* e) override;
    bool mouseMoveEvent(QMouseEvent* e) override;
    bool mouseReleaseEvent(QMouseEvent* e) override;
    void paint(QPainter& painter, double scale, const QPointF& pan) override;
    QString name() const override { return "Gizmo"; }

    HandleType hitTest(const QPointF& screenPos, double scale, const QPointF& pan) const;

private:
    QPointF worldToScreen(const QPointF& w, double scale, const QPointF& pan) const {
        return w * scale + pan;
    }
    QPointF screenToWorld(const QPointF& s, double scale, const QPointF& pan) const {
        return (s - pan) / scale;
    }

    bool m_hasSelection{false};
    QRectF m_selBBox;
    QPointF m_pivot;
    HandleType m_activeHandle{HandleType::None};
    QPointF m_dragStart; // screen
    double m_lastScale{1.0};
    QPointF m_lastPan;

    MoveCallback m_onMove;
    RotateCallback m_onRotate;
    ScaleCallback m_onScale;
};
