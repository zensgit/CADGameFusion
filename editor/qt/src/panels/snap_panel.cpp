#include "editor/qt/include/panels/snap_panel.hpp"
#include "editor/qt/include/snap/snap_settings.hpp"

#include <QCheckBox>
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

    lay->addWidget(endpoints_);
    lay->addWidget(midpoints_);
    lay->addWidget(grid_);
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
    updating_ = false;
}
