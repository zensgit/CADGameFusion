#include "live_export_manager.hpp"
#include "export/export_helpers.hpp"
#include "exporter.hpp"

#include <QDir>
#include <QTimer>

LiveExportManager::LiveExportManager(QObject* parent) : QObject(parent) {
    m_debounce = new QTimer(this);
    m_debounce->setSingleShot(true);
    m_debounce->setInterval(300);
    connect(m_debounce, &QTimer::timeout, this, &LiveExportManager::doExport);
}

LiveExportManager::~LiveExportManager() {
    if (m_doc) m_doc->remove_observer(this);
}

void LiveExportManager::setDocument(core::Document* doc) {
    if (m_doc) m_doc->remove_observer(this);
    m_doc = doc;
    if (m_doc) m_doc->add_observer(this);
}

void LiveExportManager::setExportDir(const QString& dir) {
    m_exportDir = dir;
}

void LiveExportManager::setEnabled(bool enabled) {
    m_enabled = enabled;
    if (!enabled && m_debounce->isActive()) {
        m_debounce->stop();
    }
}

void LiveExportManager::on_document_changed(const core::Document& doc, const core::DocumentChangeEvent&) {
    if (&doc != m_doc) return;
    if (!m_enabled) return;
    scheduleExport();
}

void LiveExportManager::scheduleExport() {
    if (!m_enabled || m_exportDir.isEmpty()) return;
    m_debounce->start(); // restarts if already running (debounce)
}

void LiveExportManager::doExport() {
    if (!m_doc || m_exportDir.isEmpty()) return;

    auto items = export_helpers::collectExportItems(*m_doc);
    if (items.isEmpty()) return;

    QDir baseDir(m_exportDir);
    if (!baseDir.exists()) {
        emit exportFailed("Export directory does not exist: " + m_exportDir);
        return;
    }

    double unitScale = m_doc->settings().unit_scale;
    auto result = exportScene(items, baseDir, ExportJSON | ExportGLTF, unitScale);

    if (result.ok) {
        emit exported(result.sceneDir);
    } else {
        emit exportFailed(result.error);
    }
}
