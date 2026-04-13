#pragma once

#include <QObject>
#include <QString>
#include "core/document.hpp"

class QTimer;

class LiveExportManager : public QObject, public core::DocumentObserver {
    Q_OBJECT
public:
    explicit LiveExportManager(QObject* parent = nullptr);
    ~LiveExportManager() override;

    void setDocument(core::Document* doc);
    void setExportDir(const QString& dir);
    void setEnabled(bool enabled);
    bool isEnabled() const { return m_enabled; }
    QString exportDir() const { return m_exportDir; }

signals:
    void exported(const QString& sceneDir);
    void exportFailed(const QString& error);

private:
    void on_document_changed(const core::Document& doc, const core::DocumentChangeEvent& event) override;
    void scheduleExport();
    void doExport();

    core::Document* m_doc{nullptr};
    QString m_exportDir;
    bool m_enabled{false};
    QTimer* m_debounce{nullptr};
};
