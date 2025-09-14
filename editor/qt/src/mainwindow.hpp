#pragma once

#include <QMainWindow>
#include "core/document.hpp"

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
    void exportSceneActionImpl(int kinds);
    void exportWithOptions();
private:
    QListWidget* list_{};
    // Persistent document context (for settings like unit scale)
    core::Document m_document;
};
