#include "canvas.hpp"
#include "core/document.hpp"

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

void CanvasWidget::showEvent(QShowEvent* event) {
    QWidget::showEvent(event);
    // Center the origin when widget is first shown
    if (pan_ == QPointF(0, 0)) {
        pan_ = QPointF(width() / 2.0, height() / 2.0);
    }
}

void CanvasWidget::resizeEvent(QResizeEvent* event) {
    QWidget::resizeEvent(event);
    // Adjust pan to keep origin centered when resizing
    if (event->oldSize().isValid() && event->oldSize() != QSize(-1, -1)) {
        QPointF oldCenter(event->oldSize().width() / 2.0, event->oldSize().height() / 2.0);
        QPointF newCenter(width() / 2.0, height() / 2.0);
        pan_ += (newCenter - oldCenter);
    }
}

void CanvasWidget::setDocument(core::Document* doc) {
    m_doc = doc;
    update();
}

void CanvasWidget::updatePolyCache(PolyVis& pv) {
    pv.cachePath = QPainterPath();
    if (pv.pts.size() < 2) {
        pv.aabb = QRectF();
        return;
    }
    pv.cachePath.moveTo(pv.pts[0]);
    for (int i = 1; i < pv.pts.size(); ++i) {
        pv.cachePath.lineTo(pv.pts[i]);
    }
    // Compute AABB from points directly (more accurate/faster than path.boundingRect sometimes)
    qreal minX = pv.pts[0].x(), maxX = minX;
    qreal minY = pv.pts[0].y(), maxY = minY;
    for (const auto& p : pv.pts) {
        if (p.x() < minX) minX = p.x();
        if (p.x() > maxX) maxX = p.x();
        if (p.y() < minY) minY = p.y();
        if (p.y() > maxY) maxY = p.y();
    }
    pv.aabb = QRectF(QPointF(minX, minY), QPointF(maxX, maxY));
}

void CanvasWidget::addPolyline(const QVector<QPointF>& poly, int layerId) {
    PolyVis pv{poly, QColor(220,220,230), -1, true, layerId};
    updatePolyCache(pv);
    polylines_.push_back(pv);
    update();
    emit selectionChanged({});
}

void CanvasWidget::addPolylineColored(const QVector<QPointF>& poly, const QColor& color, int groupId, int layerId) {
    PolyVis pv{poly, color, groupId, true, layerId};
    updatePolyCache(pv);
    polylines_.push_back(pv);
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

    // Setup transform
    QTransform transform;
    transform.translate(pan_.x(), pan_.y());
    transform.scale(scale_, scale_);
    
    // 1. Draw Grid (Adaptive)
    // We want grid lines approx every 25-80 pixels on screen
    // base step in world units = 50.0 (from original code), let's make it power of 10
    double targetPixelSpacing = 50.0;
    // solve: worldStep * scale_ ~= targetPixelSpacing
    // worldStep ~= targetPixelSpacing / scale_
    double rawStep = targetPixelSpacing / scale_;
    double logStep = std::log10(rawStep);
    double floorLog = std::floor(logStep);
    double base = std::pow(10.0, floorLog);
    double step = base;
    
    // refine step to be 1x, 2x, or 5x of base
    double residue = rawStep / base;
    if (residue >= 5.0) step *= 5.0;
    else if (residue >= 2.0) step *= 2.0;
    
    // Draw grid in world coordinates using transform
    pr.save();
    pr.setTransform(transform);
    
    QPen gridPen(QColor(60,60,70)); 
    gridPen.setCosmetic(true); 
    gridPen.setWidthF(1.0); // Make sure it's 1px
    pr.setPen(gridPen);

    // Visible world bounds
    QPointF tl = screenToWorld(QPointF(0,0));
    QPointF br = screenToWorld(QPointF(width(), height()));
    
    // Expand slightly to avoid clipping artifacts
    double startX = std::floor(tl.x() / step) * step;
    double endX   = std::ceil(br.x() / step) * step;
    double startY = std::floor(tl.y() / step) * step;
    double endY   = std::ceil(br.y() / step) * step;

    for (double x = startX; x <= endX; x += step)
        pr.drawLine(QPointF(x, startY), QPointF(x, endY));
    for (double y = startY; y <= endY; y += step)
        pr.drawLine(QPointF(startX, y), QPointF(endX, y));

    // Axis
    QPen xPen(QColor(80,180,255), 1); xPen.setCosmetic(true); pr.setPen(xPen);
    pr.drawLine(QPointF(-100000, 0), QPointF(100000, 0));
    QPen yPen(QColor(255,120,120), 1); yPen.setCosmetic(true); pr.setPen(yPen);
    pr.drawLine(QPointF(0, -100000), QPointF(0, 100000));

    // 2. Draw Polylines (Cached)
    pr.setRenderHint(QPainter::Antialiasing, true);
    for (int i=0; i<polylines_.size(); ++i) {
        const auto& pv = polylines_[i];
        if (!pv.visible) continue;
        
        if (m_doc) {
            auto* layer = m_doc->get_layer(pv.layerId);
            if (layer && !layer->visible) continue;
        }

        QPen pen(pv.color, 2); 
        pen.setCosmetic(true);
        if (i == selected_) {
            pen.setColor(QColor(255,220,100));
            pen.setWidth(3);
        }
        pr.setPen(pen);
        pr.drawPath(pv.cachePath);
    }

    // 3. Draw Triangle Wireframe (Immediate mode for now, could be cached too if large)
    if (!triVerts_.isEmpty() && !triIndices_.isEmpty()) {
        QPen tpen(QColor(120,200,120), 1); 
        tpen.setCosmetic(true);
        if (triSelected_) tpen.setColor(QColor(255,180,60));
        pr.setPen(tpen);
        
        // Draw lines directly (drawLines is faster than loop)
        QVector<QLineF> lines;
        lines.reserve(triIndices_.size());
        for (int i=0; i+2<triIndices_.size(); i+=3) {
            QPointF a = triVerts_[triIndices_[i+0]];
            QPointF b = triVerts_[triIndices_[i+1]];
            QPointF c = triVerts_[triIndices_[i+2]];
            lines.append(QLineF(a, b));
            lines.append(QLineF(b, c));
            lines.append(QLineF(c, a));
        }
        pr.drawLines(lines);
    }
    
    pr.restore();
}

void CanvasWidget::wheelEvent(QWheelEvent* e) {
    const double delta = e->angleDelta().y() / 120.0;
    const double factor = std::pow(1.1, delta);
    const QPointF mousePos = e->position();
    const QPointF wBefore = screenToWorld(mousePos);
    scale_ *= factor;
    if (scale_ < 0.05) scale_ = 0.05;
    if (scale_ > 5000.0) scale_ = 5000.0; // Increased max zoom
    // keep mouse world position fixed
    pan_ = mousePos - QPointF(wBefore.x()*scale_, wBefore.y()*scale_);
    update();
}

void CanvasWidget::mousePressEvent(QMouseEvent* e) {
    if (e->button() == Qt::MiddleButton || (e->button()==Qt::LeftButton && e->modifiers() & Qt::ShiftModifier)) {
        lastPos_ = e->pos();
    }
    
    QPointF mouseScreen = e->position();
    QPointF mouseWorld = screenToWorld(mouseScreen);

    if (e->button() == Qt::LeftButton && (e->modifiers() & Qt::AltModifier)) {
        // Alt+Click: Select entire group
        selectGroup(e->pos());
        return;
    }
    
    if (e->button() == Qt::LeftButton && !(e->modifiers() & (Qt::AltModifier | Qt::ShiftModifier))) {
        selected_ = -1;
        triSelected_ = false;
        
        // Threshold in pixels -> threshold in world units
        const double thPx = 12.0; 
        const double thWorld = thPx / scale_;
        const double thWorldSq = thWorld * thWorld;

        // Search from back to front
        for (int pi = polylines_.size() - 1; pi >= 0; --pi) {
            const auto& pv = polylines_[pi];
            if (!pv.visible) continue;
            
            // 1. AABB Check (Pre-filter)
            // Expand AABB by threshold
            if (!pv.aabb.adjusted(-thWorld, -thWorld, thWorld, thWorld).contains(mouseWorld)) {
                continue;
            }

            // 2. Detailed segment check
            const auto& poly = pv.pts;
            bool found = false;
            for (int i = 0; i + 1 < poly.size(); ++i) {
                const QPointF& a = poly[i];
                const QPointF& b = poly[i+1];
                
                // Point to segment distance squared
                QPointF ab = b - a;
                QPointF ap = mouseWorld - a;
                double lenSq = ab.x()*ab.x() + ab.y()*ab.y();
                double t = (lenSq < 1e-9) ? 0.0 : qBound(0.0, (ab.x()*ap.x() + ab.y()*ap.y()) / lenSq, 1.0);
                QPointF h = a + t * ab;
                double distSq = (h.x()-mouseWorld.x())*(h.x()-mouseWorld.x()) + (h.y()-mouseWorld.y())*(h.y()-mouseWorld.y());
                
                if (distSq < thWorldSq) {
                    selected_ = pi;
                    found = true;
                    break;
                }
            }
            if (found) {
                update();
                emit selectionChanged({selected_});
                return;
            }
        }

        // Triangle mesh hit test
        if (!triVerts_.isEmpty() && !triIndices_.isEmpty()) {
             auto testEdge = [&](const QPointF& u, const QPointF& v, const QPointF& p){
                QPointF uv = v-u, up = p-u;
                double lenSq = uv.x()*uv.x() + uv.y()*uv.y();
                double t = (lenSq < 1e-9) ? 0.0 : qBound(0.0, (uv.x()*up.x() + uv.y()*up.y()) / lenSq, 1.0);
                QPointF h = u + t*uv;
                double distSq = (h.x()-p.x())*(h.x()-p.x()) + (h.y()-p.y())*(h.y()-p.y());
                return distSq < thWorldSq;
            };
            
            for (int i=0; i+2<triIndices_.size(); i+=3) {
                QPointF a = triVerts_[triIndices_[i+0]];
                QPointF b = triVerts_[triIndices_[i+1]];
                QPointF c = triVerts_[triIndices_[i+2]];
                if (testEdge(a,b,mouseWorld) || testEdge(b,c,mouseWorld) || testEdge(c,a,mouseWorld)) { 
                    triSelected_ = true; 
                    update(); 
                    return; 
                }
            }
        }

        update();
        emit selectionChanged({});
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
            removeAllSimilar();
        } else {
            removeSelected();
        }
    } else if (e->key() == Qt::Key_Escape) {
        selected_ = -1;
        update();
    }
}

void CanvasWidget::removeSelected() {
    if (triSelected_) {
        triVerts_.clear();
        triIndices_.clear();
        triSelected_ = false;
        update();
        return;
    }
    if (selected_>=0 && selected_<polylines_.size()) {
        polylines_.removeAt(selected_);
        selected_ = -1;
        update();
        emit selectionChanged({});
    }
}

int CanvasWidget::removeAllSimilar() {
    if (selected_ < 0 || selected_ >= polylines_.size()) return 0;
    
    int removedCount = 0;
    int gid = polylines_[selected_].groupId;
    
    if (gid != -1) {
        QVector<int> idx;
        for (int i=0;i<polylines_.size();++i) if (polylines_[i].groupId == gid) idx.push_back(i);
        for (int k=idx.size()-1; k>=0; --k) { polylines_.removeAt(idx[k]); removedCount++; }
    } else {
        QColor targetColor = polylines_[selected_].color;
        for (int i = polylines_.size() - 1; i >= 0; --i) {
            if (polylines_[i].color == targetColor) {
                polylines_.removeAt(i);
                removedCount++;
            }
        }
    }

    selected_ = -1;
    update();
    emit selectionChanged({});
    return removedCount;
}

void CanvasWidget::addTriMesh(const QVector<QPointF>& vertices, const QVector<unsigned int>& indices) {
    triVerts_ = vertices;
    triIndices_ = indices;
    update();
    emit selectionChanged({});
}

void CanvasWidget::setTriMesh(const QVector<QPointF>& vertices, const QVector<unsigned int>& indices) {
    triVerts_ = vertices;
    triIndices_ = indices;
    triSelected_ = false;
    update();
    emit selectionChanged({});
}

void CanvasWidget::clearTriMesh() {
    triVerts_.clear();
    triIndices_.clear();
    triSelected_ = false;
    update();
    emit selectionChanged({});
}

int CanvasWidget::newGroupId() { return nextGroupId_++; }

int CanvasWidget::selectedGroupId() const {
    if (selected_>=0 && selected_<polylines_.size()) return polylines_[selected_].groupId;
    return -1;
}

void CanvasWidget::selectGroup(const QPoint& pos) {
    const double thPx = 12.0;
    const double thWorld = thPx / scale_;
    const double thWorldSq = thWorld * thWorld;
    QPointF mouseWorld = screenToWorld(pos);

    for (int pi=polylines_.size()-1; pi>=0; --pi) {
        const auto& pv = polylines_[pi];
        if (!pv.aabb.adjusted(-thWorld, -thWorld, thWorld, thWorld).contains(mouseWorld)) continue;

        const auto& poly = pv.pts;
        for (int i=0;i+1<poly.size();++i) {
            const QPointF& a = poly[i];
            const QPointF& b = poly[i+1];
            QPointF ab = b-a, ap = mouseWorld-a;
            double lenSq = ab.x()*ab.x()+ab.y()*ab.y();
            double t = (lenSq < 1e-9) ? 0.0 : qBound(0.0, (ab.x()*ap.x()+ab.y()*ap.y())/lenSq, 1.0);
            QPointF h = a + t*ab;
            double distSq = (h.x()-mouseWorld.x())*(h.x()-mouseWorld.x()) + (h.y()-mouseWorld.y())*(h.y()-mouseWorld.y());
            
            if (distSq < thWorldSq) {
                int gid = polylines_[pi].groupId;
                if (gid != -1) {
                    for (int j=0; j<polylines_.size(); ++j) {
                        if (polylines_[j].groupId == gid) {
                            selected_ = j;
                            update();
                            return;
                        }
                    }
                } else {
                    selected_ = pi;
                }
                update();
                return;
            }
        }
    }
}

void CanvasWidget::removePolylineAt(int index) {
    if (index >= 0 && index < polylines_.size()) {
        polylines_.removeAt(index);
        if (selected_ == index) selected_ = -1;
        update();
        emit selectionChanged({});
    }
}

bool CanvasWidget::polylineAt(int index, PolyVis& out) const {
    if (index >= 0 && index < polylines_.size()) { out = polylines_[index]; return true; }
    return false;
}

void CanvasWidget::insertPolylineAt(int index, const PolyVis& pv) {
    if (index < 0 || index > polylines_.size()) index = polylines_.size();
    PolyVis newPv = pv;
    updatePolyCache(newPv); // Ensure cache is valid
    polylines_.insert(index, newPv);
    update();
    emit selectionChanged({index});
}

void CanvasWidget::setPolylineVisible(int index, bool vis) {
    if (index>=0 && index<polylines_.size()) {
        polylines_[index].visible = vis;
        update();
    }
}

void CanvasWidget::restorePolylines(const QVector<PolyVis>& polys) {
    polylines_ = polys;
    // Rebuild cache for restored items just in case
    for(auto& pv : polylines_) {
        updatePolyCache(pv);
    }
    selected_ = -1;
    update();
    emit selectionChanged({});
}
