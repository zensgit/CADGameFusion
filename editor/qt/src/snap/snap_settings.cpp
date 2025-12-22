#include "snap/snap_settings.hpp"

#include <algorithm>
#include <cmath>

SnapSettings::SnapSettings(QObject* parent)
    : QObject(parent) {}

void SnapSettings::setSnapEndpoints(bool enabled) {
    if (snapEndpoints_ == enabled) return;
    snapEndpoints_ = enabled;
    emit settingsChanged();
}

void SnapSettings::setSnapMidpoints(bool enabled) {
    if (snapMidpoints_ == enabled) return;
    snapMidpoints_ = enabled;
    emit settingsChanged();
}

void SnapSettings::setSnapGrid(bool enabled) {
    if (snapGrid_ == enabled) return;
    snapGrid_ = enabled;
    emit settingsChanged();
}

void SnapSettings::setSnapRadiusPixels(double px) {
    if (px < 1.0) px = 1.0;
    if (std::abs(snapRadiusPixels_ - px) < 1e-6) return;
    snapRadiusPixels_ = px;
    emit settingsChanged();
}

void SnapSettings::setGridPixelSpacing(double px) {
    if (px < 5.0) px = 5.0;
    if (std::abs(gridPixelSpacing_ - px) < 1e-6) return;
    gridPixelSpacing_ = px;
    emit settingsChanged();
}
