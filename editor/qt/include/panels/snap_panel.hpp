#pragma once

#include <QDockWidget>

class QCheckBox;
class SnapSettings;

class SnapPanel : public QDockWidget {
    Q_OBJECT
public:
    explicit SnapPanel(QWidget* parent = nullptr);
    void setSettings(SnapSettings* settings);

private:
    void updateFromSettings();

    SnapSettings* settings_{nullptr};
    QCheckBox* endpoints_{nullptr};
    QCheckBox* midpoints_{nullptr};
    QCheckBox* grid_{nullptr};
    bool updating_{false};
};
