#include "canvas.hpp"

#include <QPainter>
#include <QPainterPath>
#include <QMouseEvent>
#include <QWheelEvent>
#include <QKeyEvent>
#include <QDebug>
#include <cmath>

CanvasWidget::CanvasWidget(QWidget* parent) : QWidget(parent) {
    setMouseTracking(true);
    setAutoFillBackground(true);
}

void CanvasWidget::addPolyline(const QVector<QPointF>& poly) {
    polylines_.push_back({poly, QColor(220,220,230), -1});
    update();
}

void CanvasWidget::addPolylineColored(const QVector<QPointF>& poly, const QColor& color, int groupId) {
    polylines_.push_back({poly, color, groupId});
    update();
}

void CanvasWidget::clear() {
    polylines_.clear();
    triVerts_.clear();
    triIndices_.clear();
    selected_ = -1;  // Also clear selection
    update();
}

QPointF CanvasWidget::worldToScreen(const QPointF& p) const {
    return QPointF(p.x() * scale_ + pan_.x(), p.y() * scale_ + pan_.y());
}

QPointF CanvasWidget::screenToWorld(const QPointF& p) const {
    return QPointF((p.x() - pan_.x()) / scale_, (p.y() - pan_.y()) / scale_);
}

void CanvasWidget::paintEvent(QPaintEvent*) {
    QPainter pr(this);
    pr.fillRect(rect(), QColor(30,30,35));

    // draw grid
    QPen gridPen(QColor(60,60,70)); gridPen.setCosmetic(true); pr.setPen(gridPen);
    const double step = 50.0 * scale_;
    for (double x = std::fmod(pan_.x(), step); x < width(); x += step)
        pr.drawLine(QPointF(x, 0), QPointF(x, height()));
    for (double y = std::fmod(pan_.y(), step); y < height(); y += step)
        pr.drawLine(QPointF(0, y), QPointF(width(), y));

    // axis
    QPen xPen(QColor(80,180,255), 1); xPen.setCosmetic(true); pr.setPen(xPen);
    pr.drawLine(worldToScreen(QPointF(-10000,0)), worldToScreen(QPointF(10000,0)));
    QPen yPen(QColor(255,120,120), 1); yPen.setCosmetic(true); pr.setPen(yPen);
    pr.drawLine(worldToScreen(QPointF(0,-10000)), worldToScreen(QPointF(0,10000)));

    // polylines
    pr.setRenderHint(QPainter::Antialiasing, true);
    for (int i=0;i<polylines_.size();++i) {
        const auto& pv = polylines_[i];
        const auto& poly = pv.pts;
        if (poly.size() < 2) continue;
        QPainterPath path;
        path.moveTo(worldToScreen(poly[0]));
        for (int j=1;j<poly.size();++j) path.lineTo(worldToScreen(poly[j]));
        QPen pen(pv.color, 2); pen.setCosmetic(true);
        if (i==selected_) {
            pen.setColor(QColor(255,220,100));
            pen.setWidth(3);
        }
        pr.setPen(pen);
        pr.drawPath(path);
    }

    // triangle wireframe
    if (!triVerts_.isEmpty() && !triIndices_.isEmpty()) {
        QPen tpen(QColor(120,200,120), 1); tpen.setCosmetic(true);
        if (triSelected_) tpen.setColor(QColor(255,180,60));
        pr.setPen(tpen);
        for (int i=0;i+2<triIndices_.size(); i+=3) {
            auto a = worldToScreen(triVerts_[triIndices_[i+0]]);
            auto b = worldToScreen(triVerts_[triIndices_[i+1]]);
            auto c = worldToScreen(triVerts_[triIndices_[i+2]]);
            pr.drawLine(a,b); pr.drawLine(b,c); pr.drawLine(c,a);
        }
    }
}

void CanvasWidget::wheelEvent(QWheelEvent* e) {
    const double delta = e->angleDelta().y() / 120.0;
    const double factor = std::pow(1.1, delta);
    const QPointF mousePos = e->position();
    const QPointF wBefore = screenToWorld(mousePos);
    scale_ *= factor;
    if (scale_ < 0.05) scale_ = 0.05;
    if (scale_ > 50.0) scale_ = 50.0;
    // keep mouse world position fixed
    pan_ = mousePos - QPointF(wBefore.x()*scale_, wBefore.y()*scale_);
    update();
}

void CanvasWidget::mousePressEvent(QMouseEvent* e) {
    if (e->button() == Qt::MiddleButton || (e->button()==Qt::LeftButton && e->modifiers() & Qt::ShiftModifier)) {
        lastPos_ = e->pos();
    }
    if (e->button() == Qt::LeftButton && (e->modifiers() & Qt::AltModifier)) {
        // Alt+Click: Select entire group
        selectGroup(e->pos());
        return;
    }
    if (e->button() == Qt::LeftButton && !(e->modifiers() & (Qt::AltModifier | Qt::ShiftModifier))) {
        // Improved hit test: pick the topmost (last drawn) segment within threshold
        selected_ = -1;
        triSelected_ = false;
        const double th = 12.0; // pixels
        
        qDebug() << "Mouse click at" << e->pos() << ", searching" << polylines_.size() << "polylines";
        
        // Search from back to front (topmost first)
        for (int pi=polylines_.size()-1; pi>=0; --pi) {
            const auto& poly = polylines_[pi].pts;
            bool found = false;
            
            for (int i=0;i+1<poly.size();++i) {
                QPointF a = worldToScreen(poly[i]);
                QPointF b = worldToScreen(poly[i+1]);
                // point-line distance
                QPointF p = e->pos();
                QPointF ab = b-a, ap = p-a;
                double t = qBound(0.0, (ab.x()*ap.x()+ab.y()*ap.y())/(ab.x()*ab.x()+ab.y()*ab.y()+1e-9), 1.0);
                QPointF h = a + t*ab;
                double d = std::sqrt((h.x()-p.x())*(h.x()-p.x()) + (h.y()-p.y())*(h.y()-p.y()));
                if (d < th) { 
                    selected_ = pi;
                    qDebug() << "Selected polyline" << pi << "at distance" << d;
                    found = true;
                    break;
                }
            }
            if (found) {
                update(); 
                return;
            }
        }
        // If no polyline matched, test triangle wireframe as a group
        if (!triVerts_.isEmpty() && !triIndices_.isEmpty()) {
            auto testEdge = [&](const QPointF& u, const QPointF& v, const QPointF& p){
                QPointF uv = v-u, up = p-u;
                double t = qBound(0.0, (uv.x()*up.x()+uv.y()*up.y())/(uv.x()*uv.x()+uv.y()*uv.y()+1e-9), 1.0);
                QPointF h = u + t*uv;
                double d2 = (h.x()-p.x())*(h.x()-p.x()) + (h.y()-p.y())*(h.y()-p.y());
                return d2 < th*th;
            };
            const QPointF p = e->pos();
            for (int i=0;i+2<triIndices_.size(); i+=3) {
                QPointF a = worldToScreen(triVerts_[triIndices_[i+0]]);
                QPointF b = worldToScreen(triVerts_[triIndices_[i+1]]);
                QPointF c = worldToScreen(triVerts_[triIndices_[i+2]]);
                if (testEdge(a,b,p) || testEdge(b,c,p) || testEdge(c,a,p)) { triSelected_ = true; update(); return; }
            }
        }
        qDebug() << "No polyline/tri selected";
        update();
    }
}

void CanvasWidget::mouseMoveEvent(QMouseEvent* e) {
    if (e->buttons() & Qt::MiddleButton || (e->buttons() & Qt::LeftButton && e->modifiers() & Qt::ShiftModifier)) {
        const QPoint d = e->pos() - lastPos_;
        pan_ += QPointF(d.x(), d.y());
        lastPos_ = e->pos();
        update();
    }
}

void CanvasWidget::keyPressEvent(QKeyEvent* e) {
    if (e->key() == Qt::Key_Delete || e->key() == Qt::Key_Backspace) {
        if (e->modifiers() & Qt::ShiftModifier) {
            // Shift+Delete: Remove all similar
            removeAllSimilar();
        } else {
            // Delete: Remove selected
            removeSelected();
        }
    } else if (e->key() == Qt::Key_A && (e->modifiers() & Qt::ControlModifier)) {
        // Ctrl+A: Select all (future feature)
        qDebug() << "Ctrl+A pressed (select all - not implemented yet)";
    } else if (e->key() == Qt::Key_Escape) {
        // Escape: Deselect
        selected_ = -1;
        update();
    }
}

void CanvasWidget::removeSelected() {
    if (triSelected_) {
        // Delete only the triangle wireframe as a whole
        triVerts_.clear();
        triIndices_.clear();
        triSelected_ = false;
        update();
        return;
    }
    if (selected_>=0 && selected_<polylines_.size()) {
        qDebug() << "Removing single polyline at index" << selected_;
        polylines_.removeAt(selected_); // Single deletion: do not remove whole group here
        selected_ = -1;
        update();
    } else {
        qDebug() << "No polyline selected (selected_=" << selected_ << ")";
    }
}

int CanvasWidget::removeAllSimilar() {
    if (selected_ < 0 || selected_ >= polylines_.size()) {
        qDebug() << "No polyline selected for similar deletion";
        return 0;
    }
    int removedCount = 0;
    int gid = polylines_[selected_].groupId;
    if (gid != -1) {
        // Prefer group-based deletion when available
        QVector<int> idx;
        for (int i=0;i<polylines_.size();++i) if (polylines_[i].groupId == gid) idx.push_back(i);
        for (int k=idx.size()-1; k>=0; --k) { polylines_.removeAt(idx[k]); removedCount++; }
        qDebug() << "Removed group" << gid << ", count=" << removedCount;
    } else {
        // Fallback: remove by color
        QColor targetColor = polylines_[selected_].color;
        for (int i = polylines_.size() - 1; i >= 0; --i) {
            if (polylines_[i].color == targetColor) {
                polylines_.removeAt(i);
                removedCount++;
            }
        }
        qDebug() << "Removed" << removedCount << "polylines with color" << targetColor;
    }

    selected_ = -1;
    update();
    return removedCount;
}

void CanvasWidget::addTriMesh(const QVector<QPointF>& vertices, const QVector<unsigned int>& indices) {
    triVerts_ = vertices;
    triIndices_ = indices;
    update();
}

int CanvasWidget::newGroupId() { return nextGroupId_++; }

void CanvasWidget::selectGroup(const QPoint& pos) {
    const double th = 12.0; // pixels
    
    // Find any polyline at this position
    for (int pi=polylines_.size()-1; pi>=0; --pi) {
        const auto& poly = polylines_[pi].pts;
        
        for (int i=0;i+1<poly.size();++i) {
            QPointF a = worldToScreen(poly[i]);
            QPointF b = worldToScreen(poly[i+1]);
            QPointF p = pos;
            QPointF ab = b-a, ap = p-a;
            double t = qBound(0.0, (ab.x()*ap.x()+ab.y()*ap.y())/(ab.x()*ab.x()+ab.y()*ab.y()+1e-9), 1.0);
            QPointF h = a + t*ab;
            double d = std::sqrt((h.x()-p.x())*(h.x()-p.x()) + (h.y()-p.y())*(h.y()-p.y()));
            if (d < th) {
                // Found a hit - select the first polyline in this group
                int gid = polylines_[pi].groupId;
                if (gid != -1) {
                    // Find the first polyline in this group
                    for (int j=0; j<polylines_.size(); ++j) {
                        if (polylines_[j].groupId == gid) {
                            selected_ = j;
                            qDebug() << "Alt+Click selected group" << gid << ", first polyline at index" << j;
                            update();
                            return;
                        }
                    }
                } else {
                    // No group, just select this one
                    selected_ = pi;
                    qDebug() << "Alt+Click selected single polyline" << pi << "(no group)";
                }
                update();
                return;
            }
        }
    }
    qDebug() << "Alt+Click found no polyline";
}
