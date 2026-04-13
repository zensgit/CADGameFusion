#include "viewport3d.hpp"

#include <QPainter>
#include <QMouseEvent>
#include <QWheelEvent>
#include <cmath>
#include <algorithm>

static constexpr double kDegToRad = M_PI / 180.0;

Viewport3D::Viewport3D(QWidget* parent) : QWidget(parent) {
    setMinimumSize(200, 200);
    setFocusPolicy(Qt::StrongFocus);
}

void Viewport3D::setMesh(const core::TriMesh3D& mesh) {
    m_verts = mesh.vertices;
    m_indices = mesh.indices;
    update();
}

void Viewport3D::clearMesh() {
    m_verts.clear();
    m_indices.clear();
    update();
}

void Viewport3D::setOrbit(double yaw, double pitch, double dist) {
    m_yaw = yaw;
    m_pitch = std::clamp(pitch, -89.0, 89.0);
    m_dist = std::max(1.0, dist);
    update();
}

QPointF Viewport3D::project(const core::Vec3& p) const {
    // Camera position from orbit (spherical → cartesian)
    double yawR = m_yaw * kDegToRad;
    double pitchR = m_pitch * kDegToRad;
    double camPosX = m_dist * std::cos(pitchR) * std::sin(yawR);
    double camPosY = m_dist * std::sin(pitchR);
    double camPosZ = m_dist * std::cos(pitchR) * std::cos(yawR);

    // Forward vector: camera → target (origin)
    double len = m_dist;
    if (len < 1e-12) len = 1.0;
    double fwdX = -camPosX / len;
    double fwdY = -camPosY / len;
    double fwdZ = -camPosZ / len;

    // Right vector: forward × world_up(0,1,0), then normalize
    // right = forward × (0,1,0)
    double rX = fwdZ;  // fwdY*0 - fwdZ*0 ... wait, cross(fwd, up)
    // cross(fwd, (0,1,0)) = (fwdZ*0 - fwdY*0, ... no, let me be explicit:
    // cross(a,b) = (a.y*b.z - a.z*b.y, a.z*b.x - a.x*b.z, a.x*b.y - a.y*b.x)
    // cross(fwd, (0,1,0)) = (fwdY*0 - fwdZ*1, fwdZ*0 - fwdX*0, fwdX*1 - fwdY*0)
    //                      = (-fwdZ, 0, fwdX)
    rX = -fwdZ;
    double rY = 0.0;
    double rZ = fwdX;
    double rLen = std::sqrt(rX*rX + rZ*rZ);
    if (rLen > 1e-12) { rX /= rLen; rZ /= rLen; }
    else { rX = 1; rZ = 0; } // degenerate case (looking straight up/down)

    // Up vector: right × forward
    double uX = rY*fwdZ - rZ*fwdY;
    double uY = rZ*fwdX - rX*fwdZ;
    double uZ = rX*fwdY - rY*fwdX;

    // Vector from camera to point
    double dx = p.x - camPosX;
    double dy = p.y - camPosY;
    double dz = p.z - camPosZ;

    // Camera-space coordinates (right=X, up=Y, forward=Z into screen)
    double camX = rX*dx + rY*dy + rZ*dz;
    double camY = uX*dx + uY*dy + uZ*dz;
    double camZ = fwdX*dx + fwdY*dy + fwdZ*dz;  // positive = in front

    // Perspective projection
    int w = std::max(1, width());
    int h = std::max(1, height());
    double aspect = static_cast<double>(w) / h;
    double tanFov = std::tan(m_fov * kDegToRad * 0.5);

    if (camZ < 0.01) {
        // Behind camera
        return QPointF(-1e6, -1e6);
    }

    double ndcX = camX / (camZ * tanFov * aspect);
    double ndcY = camY / (camZ * tanFov);

    // NDC [-1,1] → screen
    double screenX = (ndcX * 0.5 + 0.5) * w;
    double screenY = (-ndcY * 0.5 + 0.5) * h;

    return QPointF(screenX, screenY);
}

void Viewport3D::paintEvent(QPaintEvent*) {
    QPainter pr(this);
    pr.setRenderHint(QPainter::Antialiasing);

    // Background
    pr.fillRect(rect(), QColor(35, 35, 40));

    // Draw world axes
    auto drawAxis = [&](core::Vec3 end, QColor color) {
        QPointF o = project({0,0,0});
        QPointF e = project(end);
        pr.setPen(QPen(color, 1));
        pr.drawLine(o, e);
    };
    drawAxis({5, 0, 0}, QColor(220, 60, 60));   // X red
    drawAxis({0, 5, 0}, QColor(60, 200, 60));   // Y green
    drawAxis({0, 0, 5}, QColor(80, 120, 255));  // Z blue

    if (m_verts.empty() || m_indices.empty()) {
        pr.setPen(QColor(120, 120, 120));
        pr.drawText(rect(), Qt::AlignCenter, "No 3D mesh\n(extrude a sketch to see)");
        return;
    }

    // Draw mesh wireframe
    pr.setPen(QPen(QColor(200, 200, 220), 1));
    for (size_t i = 0; i + 2 < m_indices.size(); i += 3) {
        QPointF p0 = project(m_verts[m_indices[i]]);
        QPointF p1 = project(m_verts[m_indices[i+1]]);
        QPointF p2 = project(m_verts[m_indices[i+2]]);

        // Skip triangles behind camera
        if (p0.x() < -1e5 || p1.x() < -1e5 || p2.x() < -1e5) continue;

        pr.drawLine(p0, p1);
        pr.drawLine(p1, p2);
        pr.drawLine(p2, p0);
    }

    // HUD: mesh info
    pr.setPen(QColor(160, 160, 160));
    pr.drawText(10, 20, QString("Verts: %1  Tris: %2")
        .arg(m_verts.size()).arg(m_indices.size() / 3));
    pr.drawText(10, 36, QString("Orbit: yaw=%1 pitch=%2 dist=%3")
        .arg(m_yaw, 0, 'f', 1).arg(m_pitch, 0, 'f', 1).arg(m_dist, 0, 'f', 1));
}

void Viewport3D::mousePressEvent(QMouseEvent* e) {
    m_lastPos = e->pos();
}

void Viewport3D::mouseMoveEvent(QMouseEvent* e) {
    QPoint delta = e->pos() - m_lastPos;
    m_lastPos = e->pos();

    if (e->buttons() & Qt::LeftButton) {
        // Orbit
        m_yaw += delta.x() * 0.5;
        m_pitch = std::clamp(m_pitch + delta.y() * 0.5, -89.0, 89.0);
        update();
    } else if (e->buttons() & Qt::MiddleButton) {
        // Pan (simplified - just adjusts distance)
        m_dist = std::max(1.0, m_dist - delta.y() * 0.2);
        update();
    }
}

void Viewport3D::wheelEvent(QWheelEvent* e) {
    double delta = e->angleDelta().y() / 120.0;
    m_dist = std::max(1.0, m_dist * std::pow(0.9, delta));
    update();
}
