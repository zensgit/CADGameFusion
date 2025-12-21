#pragma once

#include <QObject>

class SnapSettings : public QObject {
    Q_OBJECT
public:
    explicit SnapSettings(QObject* parent = nullptr);

    bool snapEndpoints() const { return snapEndpoints_; }
    bool snapMidpoints() const { return snapMidpoints_; }
    bool snapGrid() const { return snapGrid_; }

    void setSnapEndpoints(bool enabled);
    void setSnapMidpoints(bool enabled);
    void setSnapGrid(bool enabled);

signals:
    void settingsChanged();

private:
    bool snapEndpoints_{true};
    bool snapMidpoints_{true};
    bool snapGrid_{false};
};
