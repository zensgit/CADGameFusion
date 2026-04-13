#include "tools/gizmo_tool.hpp"

#include <QPainter>
#include <QMouseEvent>
#include <cmath>

static constexpr double kHandleSize = 8.0;
static constexpr double kArrowLen = 30.0;
static constexpr double kRotateRadius = 40.0;
static constexpr double kHitThreshold = 12.0;

void GizmoTool::setSelection(const QRectF& selBBox, const QPointF& pivot) {
    m_hasSelection = true;
    m_selBBox = selBBox;
    m_pivot = pivot;
}

void GizmoTool::clearSelection() {
    m_hasSelection = false;
    m_activeHandle = HandleType::None;
}

GizmoTool::HandleType GizmoTool::hitTest(const QPointF& screenPos, double scale, const QPointF& pan) const {
    if (!m_hasSelection) return HandleType::None;

    QPointF pivotS = worldToScreen(m_pivot, scale, pan);
    double dx = screenPos.x() - pivotS.x();
    double dy = screenPos.y() - pivotS.y();
    double dist = std::sqrt(dx*dx + dy*dy);

    // Rotate arc: ring at kRotateRadius ± threshold
    if (std::abs(dist - kRotateRadius) < kHitThreshold) {
        return HandleType::RotateArc;
    }

    // Move X arrow: along +X from pivot, within threshold
    if (dy > -kHitThreshold && dy < kHitThreshold && dx > 0 && dx < kArrowLen + kHitThreshold) {
        return HandleType::MoveX;
    }

    // Move Y arrow: along -Y (screen up) from pivot
    if (dx > -kHitThreshold && dx < kHitThreshold && dy < 0 && dy > -(kArrowLen + kHitThreshold)) {
        return HandleType::MoveY;
    }

    // Center square: move XY
    if (std::abs(dx) < kHandleSize && std::abs(dy) < kHandleSize) {
        return HandleType::MoveXY;
    }

    // Scale corners: check AABB corners
    QPointF corners[4] = {
        worldToScreen(m_selBBox.topLeft(), scale, pan),
        worldToScreen(m_selBBox.topRight(), scale, pan),
        worldToScreen(m_selBBox.bottomLeft(), scale, pan),
        worldToScreen(m_selBBox.bottomRight(), scale, pan),
    };
    for (const auto& c : corners) {
        if (std::abs(screenPos.x() - c.x()) < kHandleSize &&
            std::abs(screenPos.y() - c.y()) < kHandleSize) {
            return HandleType::ScaleCorner;
        }
    }

    return HandleType::None;
}

bool GizmoTool::mousePressEvent(QMouseEvent* e) {
    if (!m_hasSelection || e->button() != Qt::LeftButton) return false;

    auto ht = hitTest(e->position(), m_lastScale, m_lastPan);
    if (ht == HandleType::None) return false;

    m_activeHandle = ht;
    m_dragStart = e->position();
    return true;
}

bool GizmoTool::mouseMoveEvent(QMouseEvent* e) {
    if (m_activeHandle == HandleType::None) return false;
    // Drag in progress — actual transform applied on release
    return true;
}

bool GizmoTool::mouseReleaseEvent(QMouseEvent* e) {
    if (m_activeHandle == HandleType::None) return false;

    QPointF delta = e->position() - m_dragStart;
    QPointF worldDelta = delta / m_lastScale;
    QPointF pivotS = worldToScreen(m_pivot, m_lastScale, m_lastPan);

    switch (m_activeHandle) {
        case HandleType::MoveX:
            if (m_onMove) m_onMove(QPointF(worldDelta.x(), 0));
            break;
        case HandleType::MoveY:
            if (m_onMove) m_onMove(QPointF(0, worldDelta.y()));
            break;
        case HandleType::MoveXY:
            if (m_onMove) m_onMove(worldDelta);
            break;
        case HandleType::RotateArc: {
            double startAngle = std::atan2(m_dragStart.y() - pivotS.y(), m_dragStart.x() - pivotS.x());
            double endAngle = std::atan2(e->position().y() - pivotS.y(), e->position().x() - pivotS.x());
            double angleDeg = (endAngle - startAngle) * 180.0 / M_PI;
            if (m_onRotate) m_onRotate(angleDeg, m_pivot);
            break;
        }
        case HandleType::ScaleCorner: {
            double startDist = std::sqrt(std::pow(m_dragStart.x()-pivotS.x(),2) + std::pow(m_dragStart.y()-pivotS.y(),2));
            double endDist = std::sqrt(std::pow(e->position().x()-pivotS.x(),2) + std::pow(e->position().y()-pivotS.y(),2));
            double factor = (startDist > 1.0) ? endDist / startDist : 1.0;
            if (m_onScale) m_onScale(factor, m_pivot);
            break;
        }
        default: break;
    }

    m_activeHandle = HandleType::None;
    return true;
}

void GizmoTool::paint(QPainter& painter, double scale, const QPointF& pan) {
    m_lastScale = scale;
    m_lastPan = pan;
    if (!m_hasSelection) return;

    QPointF pivotS = worldToScreen(m_pivot, scale, pan);

    // Move X arrow (red)
    painter.setPen(QPen(QColor(220, 60, 60), 2));
    painter.drawLine(pivotS, pivotS + QPointF(kArrowLen, 0));
    // Arrowhead
    painter.drawLine(pivotS + QPointF(kArrowLen, 0), pivotS + QPointF(kArrowLen-6, -4));
    painter.drawLine(pivotS + QPointF(kArrowLen, 0), pivotS + QPointF(kArrowLen-6, 4));

    // Move Y arrow (green, screen up = -Y)
    painter.setPen(QPen(QColor(60, 200, 60), 2));
    painter.drawLine(pivotS, pivotS + QPointF(0, -kArrowLen));
    painter.drawLine(pivotS + QPointF(0, -kArrowLen), pivotS + QPointF(-4, -kArrowLen+6));
    painter.drawLine(pivotS + QPointF(0, -kArrowLen), pivotS + QPointF(4, -kArrowLen+6));

    // Center square (blue)
    painter.setPen(QPen(QColor(80, 120, 255), 1));
    painter.setBrush(QColor(80, 120, 255, 80));
    painter.drawRect(QRectF(pivotS.x()-kHandleSize/2, pivotS.y()-kHandleSize/2, kHandleSize, kHandleSize));

    // Rotate arc (orange, partial circle)
    painter.setPen(QPen(QColor(255, 180, 60), 1, Qt::DashLine));
    painter.setBrush(Qt::NoBrush);
    painter.drawEllipse(pivotS, kRotateRadius, kRotateRadius);

    // Scale corner handles (white squares at AABB corners)
    painter.setPen(QPen(QColor(255, 255, 255), 1));
    painter.setBrush(QColor(255, 255, 255, 100));
    QPointF corners[4] = {
        worldToScreen(m_selBBox.topLeft(), scale, pan),
        worldToScreen(m_selBBox.topRight(), scale, pan),
        worldToScreen(m_selBBox.bottomLeft(), scale, pan),
        worldToScreen(m_selBBox.bottomRight(), scale, pan),
    };
    for (const auto& c : corners) {
        painter.drawRect(QRectF(c.x()-kHandleSize/2, c.y()-kHandleSize/2, kHandleSize, kHandleSize));
    }
}
