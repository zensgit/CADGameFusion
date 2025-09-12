#include "canvas.hpp"

#include <QPainter>
#include <QPainterPath>
#include <QMouseEvent>
#include <QWheelEvent>

CanvasWidget::CanvasWidget(QWidget* parent) : QWidget(parent) {
    setMouseTracking(true);
    setAutoFillBackground(true);
}

void CanvasWidget::addPolyline(const QVector<QPointF>& poly) {
    polylines_.push_back({poly, QColor(220,220,230)});
    update();
}

void CanvasWidget::addPolylineColored(const QVector<QPointF>& poly, const QColor& color) {
    polylines_.push_back({poly, color});
    update();
}

void CanvasWidget::clear() {
    polylines_.clear();
    triVerts_.clear();
    triIndices_.clear();
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
    pr.setPen(QColor(60,60,70));
    const double grid = 50.0 * scale_ / scale_; // world 50 units
    const double step = 50.0 * scale_;
    for (double x = std::fmod(pan_.x(), step); x < width(); x += step)
        pr.drawLine(QPointF(x, 0), QPointF(x, height()));
    for (double y = std::fmod(pan_.y(), step); y < height(); y += step)
        pr.drawLine(QPointF(0, y), QPointF(width(), y));

    // axis
    pr.setPen(QPen(QColor(80,180,255), 1));
    pr.drawLine(worldToScreen(QPointF(-10000,0)), worldToScreen(QPointF(10000,0)));
    pr.setPen(QPen(QColor(255,120,120), 1));
    pr.drawLine(worldToScreen(QPointF(0,-10000)), worldToScreen(QPointF(0,10000)));

    // polylines
    pr.setRenderHint(QPainter::Antialiasing, true);
    pr.setPen(QPen(QColor(220,220,230), 2));
    for (int i=0;i<polylines_.size();++i) {
        const auto& pv = polylines_[i];
        const auto& poly = pv.pts;
        if (poly.size() < 2) continue;
        QPainterPath path;
        path.moveTo(worldToScreen(poly[0]));
        for (int i=1;i<poly.size();++i) path.lineTo(worldToScreen(poly[i]));
        QPen pen(pv.color, 2);
        if (i==selected_) pen.setColor(QColor(255,220,100));
        pr.setPen(pen);
        pr.drawPath(path);
    }

    // triangle wireframe
    if (!triVerts_.isEmpty() && !triIndices_.isEmpty()) {
        pr.setPen(QPen(QColor(120,200,120), 1));
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
    const QPointF wAfter = screenToWorld(mousePos);
    // keep mouse world position stable
    pan_ += (wAfter - wBefore) * scale_;
    update();
}

void CanvasWidget::mousePressEvent(QMouseEvent* e) {
    if (e->button() == Qt::MiddleButton || (e->button()==Qt::LeftButton && e->modifiers() & Qt::AltModifier)) {
        lastPos_ = e->pos();
    }
    if (e->button() == Qt::LeftButton && !(e->modifiers() & Qt::AltModifier)) {
        // naive hit test: pick first segment within threshold
        selected_ = -1;
        const double th = 6.0; // pixels
        for (int pi=0; pi<polylines_.size(); ++pi) {
            const auto& poly = polylines_[pi].pts;
            for (int i=0;i+1<poly.size();++i) {
                QPointF a = worldToScreen(poly[i]);
                QPointF b = worldToScreen(poly[i+1]);
                // point-line distance
                QPointF p = e->pos();
                QPointF ab = b-a, ap = p-a;
                double t = qBound(0.0, (ab.x()*ap.x()+ab.y()*ap.y())/(ab.x()*ab.x()+ab.y()*ab.y()+1e-9), 1.0);
                QPointF h = a + t*ab;
                double d2 = (h.x()-p.x())*(h.x()-p.x()) + (h.y()-p.y())*(h.y()-p.y());
                if (d2 < th*th) { selected_ = pi; update(); return; }
            }
        }
        update();
    }
}

void CanvasWidget::mouseMoveEvent(QMouseEvent* e) {
    if (e->buttons() & Qt::MiddleButton || (e->buttons() & Qt::LeftButton && e->modifiers() & Qt::AltModifier)) {
        const QPoint d = e->pos() - lastPos_;
        pan_ += QPointF(d.x(), d.y());
        lastPos_ = e->pos();
        update();
    }
}

void CanvasWidget::keyPressEvent(QKeyEvent* e) {
    if (e->key() == Qt::Key_Delete || e->key()==Qt::Key_Backspace) {
        removeSelected();
    }
}

void CanvasWidget::removeSelected() {
    if (selected_>=0 && selected_<polylines_.size()) {
        polylines_.removeAt(selected_);
        selected_ = -1;
        update();
    }
}

void CanvasWidget::addTriMesh(const QVector<QPointF>& vertices, const QVector<unsigned int>& indices) {
    triVerts_ = vertices;
    triIndices_ = indices;
    update();
}
