#pragma once

#include <QWidget>
#include <QVector>
#include <QPointF>
#include <cstdint>

#include "core/geometry2d.hpp"

class Viewport3D : public QWidget {
    Q_OBJECT
public:
    explicit Viewport3D(QWidget* parent = nullptr);

    void setMesh(const core::TriMesh3D& mesh);
    void clearMesh();
    bool hasMesh() const { return !m_verts.empty(); }

    // Camera orbit
    double orbitYaw() const { return m_yaw; }
    double orbitPitch() const { return m_pitch; }
    double orbitDistance() const { return m_dist; }
    void setOrbit(double yaw, double pitch, double dist);

    // Project 3D → 2D screen
    QPointF project(const core::Vec3& p) const;

protected:
    void paintEvent(QPaintEvent*) override;
    void mousePressEvent(QMouseEvent*) override;
    void mouseMoveEvent(QMouseEvent*) override;
    void wheelEvent(QWheelEvent*) override;

private:
    std::vector<core::Vec3> m_verts;
    std::vector<uint32_t> m_indices;

    // Orbit camera
    double m_yaw{30.0};     // degrees
    double m_pitch{-25.0};  // degrees
    double m_dist{50.0};    // distance from origin
    double m_fov{60.0};     // vertical FOV degrees

    QPoint m_lastPos;
};
