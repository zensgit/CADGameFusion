#include "panels/transform_panel.hpp"

#include <QDoubleSpinBox>
#include <QFormLayout>
#include <QGroupBox>
#include <QHBoxLayout>
#include <QLabel>
#include <QPushButton>
#include <QVBoxLayout>
#include <QWidget>

TransformPanel::TransformPanel(QWidget* parent) : QDockWidget("Transform", parent) {
    auto* content = new QWidget(this);
    auto* layout = new QVBoxLayout(content);
    layout->setContentsMargins(6, 6, 6, 6);
    layout->setSpacing(6);

    // Centroid display
    m_centroidLabel = new QLabel("Center: --");
    layout->addWidget(m_centroidLabel);

    // Move section
    auto* moveBox = new QGroupBox("Move");
    auto* moveForm = new QFormLayout(moveBox);
    m_dx = new QDoubleSpinBox;
    m_dx->setRange(-1e6, 1e6);
    m_dx->setDecimals(2);
    m_dx->setValue(0);
    moveForm->addRow("dX:", m_dx);
    m_dy = new QDoubleSpinBox;
    m_dy->setRange(-1e6, 1e6);
    m_dy->setDecimals(2);
    m_dy->setValue(0);
    moveForm->addRow("dY:", m_dy);
    m_moveBtn = new QPushButton("Apply Move");
    moveForm->addRow(m_moveBtn);
    layout->addWidget(moveBox);

    // Rotate section
    auto* rotBox = new QGroupBox("Rotate");
    auto* rotForm = new QFormLayout(rotBox);
    m_angle = new QDoubleSpinBox;
    m_angle->setRange(-360, 360);
    m_angle->setDecimals(1);
    m_angle->setValue(90);
    m_angle->setSuffix(QStringLiteral("\u00B0"));
    rotForm->addRow("Angle:", m_angle);
    m_rotateBtn = new QPushButton("Apply Rotate");
    rotForm->addRow(m_rotateBtn);
    layout->addWidget(rotBox);

    // Scale section
    auto* scaleBox = new QGroupBox("Scale");
    auto* scaleForm = new QFormLayout(scaleBox);
    m_factor = new QDoubleSpinBox;
    m_factor->setRange(0.01, 100.0);
    m_factor->setDecimals(3);
    m_factor->setValue(1.5);
    m_factor->setSingleStep(0.1);
    scaleForm->addRow("Factor:", m_factor);
    m_scaleBtn = new QPushButton("Apply Scale");
    scaleForm->addRow(m_scaleBtn);
    layout->addWidget(scaleBox);

    layout->addStretch();
    setWidget(content);

    // Connections
    connect(m_moveBtn, &QPushButton::clicked, this, [this]{
        emit moveRequested(m_dx->value(), m_dy->value());
    });
    connect(m_rotateBtn, &QPushButton::clicked, this, [this]{
        emit rotateRequested(m_angle->value());
    });
    connect(m_scaleBtn, &QPushButton::clicked, this, [this]{
        emit scaleRequested(m_factor->value());
    });

    setHasSelection(false);
}

void TransformPanel::setCentroid(const QPointF& centroid) {
    m_centroidLabel->setText(QString("Center: (%1, %2)")
        .arg(centroid.x(), 0, 'f', 2)
        .arg(centroid.y(), 0, 'f', 2));
}

void TransformPanel::setHasSelection(bool has) {
    m_moveBtn->setEnabled(has);
    m_rotateBtn->setEnabled(has);
    m_scaleBtn->setEnabled(has);
    if (!has) m_centroidLabel->setText("Center: --");
}
