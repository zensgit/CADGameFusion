#pragma once

#include <QMainWindow>

class QListWidget;

class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    explicit MainWindow(QWidget* parent = nullptr);
private slots:
    void addSamplePolyline();
    void triangulateSample();
    void demoBoolean();
    void demoOffset();
    void showAboutCore();
    void exportSceneAction();
private:
    QListWidget* list_{};
};
