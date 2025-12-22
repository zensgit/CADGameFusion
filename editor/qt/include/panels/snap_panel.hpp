#pragma once

#include <QDockWidget>

class QCheckBox;
class QDoubleSpinBox;
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
    QDoubleSpinBox* radius_{nullptr};
    QDoubleSpinBox* gridSpacing_{nullptr};
    bool updating_{false};
};
