#include "editor/qt/include/panels/snap_panel.hpp"
#include "editor/qt/include/snap/snap_settings.hpp"

#include <QCheckBox>
#include <QDoubleSpinBox>
#include <QFormLayout>
#include <QVBoxLayout>
#include <QWidget>

SnapPanel::SnapPanel(QWidget* parent) : QDockWidget(parent) {
    setWindowTitle("Snap");

    auto* w = new QWidget(this);
    auto* lay = new QVBoxLayout(w);
    lay->setContentsMargins(8, 8, 8, 8);

    endpoints_ = new QCheckBox("Endpoints", w);
    midpoints_ = new QCheckBox("Midpoints", w);
    grid_ = new QCheckBox("Grid", w);
    radius_ = new QDoubleSpinBox(w);
    radius_->setDecimals(1);
    radius_->setSingleStep(1.0);
    radius_->setRange(1.0, 100.0);
    radius_->setSuffix(" px");
    gridSpacing_ = new QDoubleSpinBox(w);
    gridSpacing_->setDecimals(1);
    gridSpacing_->setSingleStep(5.0);
    gridSpacing_->setRange(5.0, 200.0);
    gridSpacing_->setSuffix(" px");

    lay->addWidget(endpoints_);
    lay->addWidget(midpoints_);
    lay->addWidget(grid_);
    auto* form = new QFormLayout();
    form->addRow("Snap Radius", radius_);
    form->addRow("Grid Spacing", gridSpacing_);
    lay->addLayout(form);
    lay->addStretch(1);

    connect(endpoints_, &QCheckBox::toggled, this, [this](bool checked){
        if (updating_ || !settings_) return;
        settings_->setSnapEndpoints(checked);
    });
    connect(midpoints_, &QCheckBox::toggled, this, [this](bool checked){
        if (updating_ || !settings_) return;
        settings_->setSnapMidpoints(checked);
    });
    connect(grid_, &QCheckBox::toggled, this, [this](bool checked){
        if (updating_ || !settings_) return;
        settings_->setSnapGrid(checked);
    });
    connect(radius_, qOverload<double>(&QDoubleSpinBox::valueChanged), this, [this](double value){
        if (updating_ || !settings_) return;
        settings_->setSnapRadiusPixels(value);
    });
    connect(gridSpacing_, qOverload<double>(&QDoubleSpinBox::valueChanged), this, [this](double value){
        if (updating_ || !settings_) return;
        settings_->setGridPixelSpacing(value);
    });

    w->setLayout(lay);
    setWidget(w);
}

void SnapPanel::setSettings(SnapSettings* settings) {
    if (settings_ == settings) return;
    settings_ = settings;
    updateFromSettings();
    if (settings_) {
        connect(settings_, &SnapSettings::settingsChanged, this, &SnapPanel::updateFromSettings);
    }
}

void SnapPanel::updateFromSettings() {
    if (!settings_) return;
    updating_ = true;
    endpoints_->setChecked(settings_->snapEndpoints());
    midpoints_->setChecked(settings_->snapMidpoints());
    grid_->setChecked(settings_->snapGrid());
    radius_->setValue(settings_->snapRadiusPixels());
    gridSpacing_->setValue(settings_->gridPixelSpacing());
    updating_ = false;
}
