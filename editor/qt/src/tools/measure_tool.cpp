#include "tools/measure_tool.hpp"

#include <QPainter>
#include <QMouseEvent>
#include <QKeyEvent>
#include <cmath>

void MeasureTool::reset() {
    m_state = Idle;
    m_distance = 0.0;
    m_angleDeg = 0.0;
}

bool MeasureTool::mousePressEvent(QMouseEvent* e) {
    if (e->button() != Qt::LeftButton) return false;

    // Convert screen to world: pos = (screen - pan) / scale
    // We receive scale and pan in paint(), but for mouse events we need them too.
    // The canvas will set m_scale before calling us.
    // For now, we store screen pos and convert in paint using the provided scale/pan.
    // Actually, let's store the world position directly. Canvas should convert before calling.

    // This tool works with screen positions - canvas converts in its event handlers.
    // We'll store screen positions and convert in paint().
    QPointF screenPos = e->position();

    if (m_state == Idle) {
        m_pointA = screenPos;
        m_pointB = screenPos;
        m_state = PickingSecond;
        return true;
    } else if (m_state == PickingSecond) {
        m_pointB = screenPos;
        // Compute distance in screen space - will be converted to world in paint
        m_state = Done;
        return true;
    } else { // Done - start new measurement
        m_pointA = screenPos;
        m_pointB = screenPos;
        m_state = PickingSecond;
        return true;
    }
}

bool MeasureTool::mouseMoveEvent(QMouseEvent* e) {
    if (m_state == PickingSecond) {
        m_pointB = e->position();
        return true; // consume to trigger repaint
    }
    return false;
}

bool MeasureTool::keyPressEvent(QKeyEvent* e) {
    if (e->key() == Qt::Key_Escape) {
        reset();
        return true;
    }
    return false;
}

void MeasureTool::paint(QPainter& painter, double scale, const QPointF& pan) {
    if (m_state == Idle) return;

    // Convert screen points to world for distance calculation
    QPointF worldA = (m_pointA - pan) / scale;
    QPointF worldB = (m_pointB - pan) / scale;

    double dx = worldB.x() - worldA.x();
    double dy = worldB.y() - worldA.y();
    m_distance = std::sqrt(dx * dx + dy * dy);
    m_angleDeg = std::atan2(dy, dx) * 180.0 / M_PI;

    // Draw measurement line
    QPen measPen(QColor(0, 200, 255), 1, Qt::DashDotLine);
    measPen.setCosmetic(true);
    painter.setPen(measPen);
    painter.drawLine(m_pointA, m_pointB);

    // Draw endpoint markers
    painter.setBrush(QColor(0, 200, 255));
    painter.drawEllipse(m_pointA, 4, 4);
    painter.drawEllipse(m_pointB, 4, 4);

    // Draw distance label at midpoint
    QPointF mid = (m_pointA + m_pointB) / 2.0;
    painter.setPen(QColor(255, 255, 255));
    QFont font = painter.font();
    font.setPointSize(10);
    painter.setFont(font);

    QString label = QString("D: %1").arg(m_distance, 0, 'f', 2);
    if (m_state == Done) {
        label += QString("  A: %1\u00B0").arg(m_angleDeg, 0, 'f', 1);
    }
    painter.drawText(mid + QPointF(8, -8), label);

    // If done, draw a small "click to re-measure" hint
    if (m_state == Done) {
        painter.setPen(QColor(180, 180, 180));
        QFont hintFont = painter.font();
        hintFont.setPointSize(8);
        painter.setFont(hintFont);
        painter.drawText(mid + QPointF(8, 6), "(click to re-measure)");
    }
}
