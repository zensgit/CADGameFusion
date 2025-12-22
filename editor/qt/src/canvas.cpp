#include "canvas.hpp"
#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "snap/snap_settings.hpp"

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
    if (pan_ == QPointF(0, 0)) {
        pan_ = QPointF(width() / 2.0, height() / 2.0);
    }
}

void CanvasWidget::resizeEvent(QResizeEvent* event) {
    QWidget::resizeEvent(event);
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

void CanvasWidget::setSnapSettings(SnapSettings* settings) {
    snap_settings_ = settings;
}

const core::Entity* CanvasWidget::entityFor(EntityId id) const {
    if (!m_doc || id == 0) return nullptr;
    return m_doc->get_entity(id);
}

const core::Layer* CanvasWidget::layerFor(int layerId) const {
    if (!m_doc) return nullptr;
    return m_doc->get_layer(layerId);
}

bool CanvasWidget::isEntityVisible(const core::Entity& entity) const {
    if (!entity.visible) return false;
    const auto* layer = layerFor(entity.layerId);
    if (layer && !layer->visible) return false;
    return true;
}

QColor CanvasWidget::resolveEntityColor(const core::Entity& entity) const {
    uint32_t color = entity.color;
    if (color == 0) {
        const auto* layer = layerFor(entity.layerId);
        if (layer) {
            color = layer->color;
        } else {
            color = 0xDCDCE6u;
        }
    }
    return QColor((color >> 16) & 0xFF, (color >> 8) & 0xFF, color & 0xFF);
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

void CanvasWidget::clear() {
    polylines_.clear();
    triVerts_.clear();
    triIndices_.clear();
    selected_entities_.clear();
    triSelected_ = false;
    selection_active_ = false;
    selection_dragging_ = false;
    m_currentSnap.active = false;
    update();
}

void CanvasWidget::setSelection(const QList<qulonglong>& entityIds) {
    selected_entities_.clear();
    for (qulonglong id : entityIds) {
        if (id != 0) {
            selected_entities_.insert(static_cast<EntityId>(id));
        }
    }
    triSelected_ = false;
    update();
}

QList<qulonglong> CanvasWidget::selectEntitiesInWorldRect(const QRectF& rect, bool crossing) {
    QList<qulonglong> ids;
    selected_entities_.clear();
    triSelected_ = false;

    QRectF norm = rect.normalized();
    if (!norm.isValid()) {
        update();
        emit selectionChanged(ids);
        return ids;
    }

    for (const auto& pv : polylines_) {
        const auto* entity = entityFor(pv.entityId);
        if (!entity) continue;
        if (!isEntityVisible(*entity)) continue;

        const bool hit = crossing ? norm.intersects(pv.aabb) : norm.contains(pv.aabb);
        if (!hit) continue;

        selected_entities_.insert(pv.entityId);
        ids.append(static_cast<qulonglong>(pv.entityId));
    }

    update();
    emit selectionChanged(ids);
    return ids;
}

QPointF CanvasWidget::worldToScreen(const QPointF& p) const {
    return QPointF(p.x() * scale_ + pan_.x(), p.y() * scale_ + pan_.y());
}

QPointF CanvasWidget::screenToWorld(const QPointF& p) const {
    return QPointF((p.x() - pan_.x()) / scale_, (p.y() - pan_.y()) / scale_);
}

SnapManager::SnapResult CanvasWidget::computeSnapAt(const QPointF& worldPos) {
    if (snap_settings_) {
        snap_manager_.setSnapEndpoints(snap_settings_->snapEndpoints());
        snap_manager_.setSnapMidpoints(snap_settings_->snapMidpoints());
        snap_manager_.setSnapGrid(snap_settings_->snapGrid());
    } else {
        snap_manager_.setSnapEndpoints(true);
        snap_manager_.setSnapMidpoints(true);
        snap_manager_.setSnapGrid(false);
    }
    snap_inputs_.clear();
    snap_inputs_.reserve(polylines_.size());
    for (const auto& pv : polylines_) {
        const auto* entity = entityFor(pv.entityId);
        const bool visible = entity && isEntityVisible(*entity);
        SnapManager::PolylineView view;
        view.points = &pv.pts;
        view.aabb = &pv.aabb;
        view.entityId = pv.entityId;
        view.visible = visible;
        snap_inputs_.append(view);
    }
    return snap_manager_.findSnap(snap_inputs_, scale_, worldPos);
}

QPointF CanvasWidget::snapWorldPosition(const QPointF& worldPos, bool* snapped) {
    const SnapManager::SnapResult res = computeSnapAt(worldPos);
    if (snapped) *snapped = res.active;
    return res.active ? res.pos : worldPos;
}

void CanvasWidget::selectAtPoint(const QPointF& mouseWorld) {
    triSelected_ = false;
    selected_entities_.clear();

    const double thPx = 12.0;
    const double thWorld = thPx / scale_;
    const double thWorldSq = thWorld * thWorld;
    EntityId hitId = 0;

    for (int pi = polylines_.size() - 1; pi >= 0; --pi) {
        const auto& pv = polylines_[pi];
        const auto* entity = entityFor(pv.entityId);
        if (!entity) continue;
        if (!isEntityVisible(*entity)) continue;

        if (!pv.aabb.adjusted(-thWorld, -thWorld, thWorld, thWorld).contains(mouseWorld)) {
            continue;
        }

        const auto& poly = pv.pts;
        for (int i = 0; i + 1 < poly.size(); ++i) {
            const QPointF& a = poly[i];
            const QPointF& b = poly[i + 1];
            QPointF ab = b - a;
            QPointF ap = mouseWorld - a;
            double lenSq = ab.x() * ab.x() + ab.y() * ab.y();
            double t = (lenSq < 1e-9) ? 0.0 : qBound(0.0, (ab.x() * ap.x() + ab.y() * ap.y()) / lenSq, 1.0);
            QPointF h = a + t * ab;
            double distSq = (h.x() - mouseWorld.x()) * (h.x() - mouseWorld.x()) +
                            (h.y() - mouseWorld.y()) * (h.y() - mouseWorld.y());

            if (distSq < thWorldSq) {
                hitId = pv.entityId;
                break;
            }
        }
        if (hitId != 0) break;
    }

    if (hitId != 0) {
        selected_entities_.insert(hitId);
        update();
        emit selectionChanged({static_cast<qulonglong>(hitId)});
        return;
    }

    if (!triVerts_.isEmpty() && !triIndices_.isEmpty()) {
        auto testEdge = [&](const QPointF& u, const QPointF& v, const QPointF& p){
            QPointF uv = v - u, up = p - u;
            double lenSq = uv.x() * uv.x() + uv.y() * uv.y();
            double t = (lenSq < 1e-9) ? 0.0 : qBound(0.0, (uv.x() * up.x() + uv.y() * up.y()) / lenSq, 1.0);
            QPointF h = u + t * uv;
            double distSq = (h.x() - p.x()) * (h.x() - p.x()) + (h.y() - p.y()) * (h.y() - p.y());
            return distSq < thWorldSq;
        };

        for (int i = 0; i + 2 < triIndices_.size(); i += 3) {
            QPointF a = triVerts_[triIndices_[i + 0]];
            QPointF b = triVerts_[triIndices_[i + 1]];
            QPointF c = triVerts_[triIndices_[i + 2]];
            if (testEdge(a, b, mouseWorld) || testEdge(b, c, mouseWorld) || testEdge(c, a, mouseWorld)) {
                triSelected_ = true;
                update();
                emit selectionChanged({});
                return;
            }
        }
    }

    update();
    emit selectionChanged({});
}

void CanvasWidget::paintEvent(QPaintEvent*) {
    QPainter pr(this);
    pr.fillRect(rect(), QColor(30,30,35));

    QTransform transform;
    transform.translate(pan_.x(), pan_.y());
    transform.scale(scale_, scale_);
    
    // 1. Draw Grid
    const double step = SnapManager::gridStepForScale(scale_);
    
    pr.save();
    pr.setTransform(transform);
    
    QPen gridPen(QColor(60,60,70)); 
    gridPen.setCosmetic(true); 
    gridPen.setWidthF(1.0);
    pr.setPen(gridPen);

    QPointF tl = screenToWorld(QPointF(0,0));
    QPointF br = screenToWorld(QPointF(width(), height()));
    double startX = std::floor(tl.x() / step) * step;
    double endX   = std::ceil(br.x() / step) * step;
    double startY = std::floor(tl.y() / step) * step;
    double endY   = std::ceil(br.y() / step) * step;

    for (double x = startX; x <= endX; x += step) pr.drawLine(QPointF(x, startY), QPointF(x, endY));
    for (double y = startY; y <= endY; y += step) pr.drawLine(QPointF(startX, y), QPointF(endX, y));

    QPen xPen(QColor(80,180,255), 1); xPen.setCosmetic(true); pr.setPen(xPen);
    pr.drawLine(QPointF(-100000, 0), QPointF(100000, 0));
    QPen yPen(QColor(255,120,120), 1); yPen.setCosmetic(true); pr.setPen(yPen);
    pr.drawLine(QPointF(0, -100000), QPointF(0, 100000));

    // 2. Draw Polylines
    pr.setRenderHint(QPainter::Antialiasing, true);
    for (int i=0; i<polylines_.size(); ++i) {
        const auto& pv = polylines_[i];
        const auto* entity = entityFor(pv.entityId);
        if (!entity) continue;
        if (!isEntityVisible(*entity)) continue;

        QPen pen(resolveEntityColor(*entity), 2);
        pen.setCosmetic(true);
        if (selected_entities_.contains(pv.entityId)) {
            pen.setColor(QColor(255,220,100));
            pen.setWidth(3);
        }
        pr.setPen(pen);
        pr.drawPath(pv.cachePath);
    }

    // 3. Draw Triangle Wireframe
    if (!triVerts_.isEmpty() && !triIndices_.isEmpty()) {
        QPen tpen(QColor(120,200,120), 1); 
        tpen.setCosmetic(true);
        if (triSelected_) tpen.setColor(QColor(255,180,60));
        pr.setPen(tpen);
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

    // 4. Draw Selection Rectangle (screen space)
    if (selection_dragging_) {
        QRectF rect(selection_start_screen_, selection_current_screen_);
        rect = rect.normalized();
        const bool crossing = selection_current_screen_.x() < selection_start_screen_.x();
        QColor border = crossing ? QColor(80, 200, 120) : QColor(80, 160, 255);
        QColor fill = border;
        fill.setAlpha(40);
        QPen selPen(border, 1.0, Qt::DashLine);
        selPen.setCosmetic(true);
        pr.setPen(selPen);
        pr.setBrush(fill);
        pr.drawRect(rect);
    }

    // 5. Draw Snap Marker (in screen space)
    if (m_currentSnap.active) {
        QPointF sPos = worldToScreen(m_currentSnap.pos);
        QPen sPen(QColor(255, 255, 0), 2); // Yellow
        pr.setPen(sPen);
        pr.setBrush(Qt::NoBrush);
        
        const double sz = 10.0;
        if (m_currentSnap.type == SnapManager::SnapType::Endpoint) {
            // Square
            pr.drawRect(QRectF(sPos.x()-sz/2, sPos.y()-sz/2, sz, sz));
        } else if (m_currentSnap.type == SnapManager::SnapType::Midpoint) {
            // Triangle
            QPolygonF tri;
            tri << QPointF(sPos.x(), sPos.y() - sz/2 - 2)
                << QPointF(sPos.x() - sz/2, sPos.y() + sz/2 + 2)
                << QPointF(sPos.x() + sz/2, sPos.y() + sz/2 + 2);
            pr.drawPolygon(tri);
        } else if (m_currentSnap.type == SnapManager::SnapType::Grid) {
            const double half = sz * 0.5;
            pr.drawLine(QPointF(sPos.x() - half, sPos.y()), QPointF(sPos.x() + half, sPos.y()));
            pr.drawLine(QPointF(sPos.x(), sPos.y() - half), QPointF(sPos.x(), sPos.y() + half));
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
    if (scale_ > 5000.0) scale_ = 5000.0;
    pan_ = mousePos - QPointF(wBefore.x()*scale_, wBefore.y()*scale_);
    update();
}

void CanvasWidget::mousePressEvent(QMouseEvent* e) {
    if (e->button() == Qt::MiddleButton || (e->button()==Qt::LeftButton && e->modifiers() & Qt::ShiftModifier)) {
        lastPos_ = e->pos();
    }
    
    const QPointF mouseScreen = e->position();

    if (e->button() == Qt::LeftButton && (e->modifiers() & Qt::AltModifier)) {
        triSelected_ = false;
        selection_active_ = false;
        selection_dragging_ = false;
        m_currentSnap.active = false;
        const QPointF mouseWorld = screenToWorld(e->position());
        const QPointF pickWorld = snapWorldPosition(mouseWorld);
        selectGroupAtWorld(pickWorld);
        return;
    }

    if (e->button() == Qt::LeftButton && !(e->modifiers() & (Qt::AltModifier | Qt::ShiftModifier))) {
        selection_active_ = true;
        selection_dragging_ = false;
        selection_start_screen_ = mouseScreen;
        selection_current_screen_ = mouseScreen;
        m_currentSnap.active = false;
        update();
        return;
    }
}

void CanvasWidget::mouseMoveEvent(QMouseEvent* e) {
    if (e->buttons() & Qt::MiddleButton || (e->buttons() & Qt::LeftButton && e->modifiers() & Qt::ShiftModifier)) {
        const QPoint d = e->pos() - lastPos_;
        pan_ += QPointF(d.x(), d.y());
        lastPos_ = e->pos();
        update();
    } else if (selection_active_ && (e->buttons() & Qt::LeftButton) &&
               !(e->modifiers() & (Qt::AltModifier | Qt::ShiftModifier))) {
        selection_current_screen_ = e->position();
        if (!selection_dragging_) {
            const QPointF delta = selection_current_screen_ - selection_start_screen_;
            if (std::abs(delta.x()) > 4.0 || std::abs(delta.y()) > 4.0) {
                selection_dragging_ = true;
            }
        }
        if (selection_dragging_) {
            update();
        }
    } else {
        // Snap logic
        QPointF mouseScreen = e->position();
        QPointF mouseWorld = screenToWorld(mouseScreen);
        SnapManager::SnapResult res = computeSnapAt(mouseWorld);
        
        bool changed = (res.active != m_currentSnap.active);
        if (res.active) {
            if (res.pos != m_currentSnap.pos || res.type != m_currentSnap.type) changed = true;
        }
        m_currentSnap = res;
        
        if (changed) update();
    }
}

void CanvasWidget::mouseReleaseEvent(QMouseEvent* e) {
    if (e->button() == Qt::LeftButton && selection_active_) {
        selection_current_screen_ = e->position();
        if (selection_dragging_) {
            QPointF startWorld = screenToWorld(selection_start_screen_);
            QPointF endWorld = screenToWorld(selection_current_screen_);
            QRectF worldRect(startWorld, endWorld);
            const bool crossing = selection_current_screen_.x() < selection_start_screen_.x();
            selectEntitiesInWorldRect(worldRect, crossing);
        } else {
            const QPointF mouseWorld = screenToWorld(selection_current_screen_);
            const QPointF pickWorld = snapWorldPosition(mouseWorld);
            selectAtPoint(pickWorld);
        }
        selection_active_ = false;
        selection_dragging_ = false;
        update();
        return;
    }
    QWidget::mouseReleaseEvent(e);
}

void CanvasWidget::keyPressEvent(QKeyEvent* e) {
    if (e->key() == Qt::Key_Delete || e->key() == Qt::Key_Backspace) {
        if (triSelected_) {
            triVerts_.clear();
            triIndices_.clear();
            triSelected_ = false;
            update();
            emit selectionChanged({});
            return;
        }
        emit deleteRequested(e->modifiers() & Qt::ShiftModifier);
    } else if (e->key() == Qt::Key_Escape) {
        triSelected_ = false;
        update();
        emit selectionChanged({});
    }
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

void CanvasWidget::selectGroupAtWorld(const QPointF& mouseWorld) {
    const double thPx = 12.0;
    const double thWorld = thPx / scale_;
    const double thWorldSq = thWorld * thWorld;

    for (int pi=polylines_.size()-1; pi>=0; --pi) {
        const auto& pv = polylines_[pi];
        if (!pv.aabb.adjusted(-thWorld, -thWorld, thWorld, thWorld).contains(mouseWorld)) continue;

        const auto* hitEntity = entityFor(pv.entityId);
        if (!hitEntity) continue;

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
                QList<qulonglong> ids;
                const int gid = hitEntity->groupId;
                if (gid != -1) {
                    for (const auto& other : polylines_) {
                        const auto* entity = entityFor(other.entityId);
                        if (entity && entity->groupId == gid) {
                            ids.append(static_cast<qulonglong>(entity->id));
                        }
                    }
                } else if (hitEntity->id != 0) {
                    ids.append(static_cast<qulonglong>(hitEntity->id));
                }
                selected_entities_.clear();
                for (qulonglong id : ids) {
                    selected_entities_.insert(static_cast<EntityId>(id));
                }
                update();
                emit selectionChanged(ids);
                return;
            }
        }
    }
    selected_entities_.clear();
    update();
    emit selectionChanged({});
}

void CanvasWidget::reloadFromDocument() {
    if (!m_doc) return;

    polylines_.clear();
    selected_entities_.clear();

    // Iterate over all entities in Document and create PolyVis for each
    const auto& entities = m_doc->entities();
    for (const auto& e : entities) {
        if (e.type != core::EntityType::Polyline) continue;
        if (!e.payload) continue;

        const auto* pl = static_cast<const core::Polyline*>(e.payload.get());
        if (!pl || pl->points.size() < 2) continue;

        PolyVis pv;
        pv.pts.reserve(static_cast<int>(pl->points.size()));
        for (const auto& pt : pl->points) {
            pv.pts.append(QPointF(pt.x, pt.y));
        }

        pv.entityId = e.id;

        updatePolyCache(pv);
        polylines_.append(pv);
    }

    update();
    emit selectionChanged({});
}

QVector<CanvasWidget::PolylineState> CanvasWidget::polylineStates() const {
    QVector<PolylineState> states;
    states.reserve(polylines_.size());
    for (const auto& pv : polylines_) {
        PolylineState state;
        state.entityId = pv.entityId;
        const auto* entity = entityFor(pv.entityId);
        if (entity) {
            state.visible = entity->visible;
            state.groupId = entity->groupId;
            state.layerId = entity->layerId;
            state.color = resolveEntityColor(*entity);
        } else {
            state.visible = false;
            state.groupId = -1;
            state.layerId = 0;
            state.color = QColor(220, 220, 230);
        }
        state.pointCount = pv.pts.size();
        states.append(state);
    }
    return states;
}
