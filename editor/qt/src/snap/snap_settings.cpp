#include "snap/snap_settings.hpp"

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
