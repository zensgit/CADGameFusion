#pragma once

#include <memory>

#include <QMainWindow>
#include <QUndoStack>
#include "core/document.hpp"
class CommandManager;
class QMenu;
class QAction;
class Project;
class LayerPanel;

class QListWidget;

namespace cadgf { class PluginRegistry; }
struct core_document;
typedef core_document cadgf_document;
struct cadgf_exporter_api_v1;

class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    explicit MainWindow(QWidget* parent = nullptr);
    ~MainWindow() override;
private slots:
    void newFile();
    void openFile();
    void saveFile();
    void saveFileAs();
    void addSamplePolyline();
    void triangulateSample();
    void demoBoolean();
    void demoOffset();
    void showAboutCore();
    void exportSceneAction();
    void exportSceneActionImpl(int kinds);
    void exportWithOptions();
    void loadPlugin();
protected:
    void closeEvent(QCloseEvent* event) override;
private:
    bool maybeSave();
    void setCurrentFile(const QString& fileName);
    void markDirty();
    void markClean();
    bool isDirtyState() const; // fallback check using undo stack
    // Recent files helpers
    void loadRecentFiles();
    void saveRecentFiles();
    void updateRecentFilesMenu();
    void addToRecentFiles(const QString& path);
    bool openProjectFile(const QString& path, bool fromRecent=false);
    void maybeAutoRestore();

    bool performSave(const QString& path, bool updateCurrent);
    void rebuildPluginExportMenu();
    void exportViaPlugin(const cadgf_exporter_api_v1* exporter);
    bool buildCadgfDocumentFromDocument(cadgf_document* doc, QString* error) const;

    QListWidget* list_{};
    LayerPanel* m_layerPanel{nullptr};
    // Persistent document context (for settings like unit scale)
    core::Document m_document;
    QList<qulonglong> m_selection;
    QUndoStack* m_undoStack{nullptr};
    CommandManager* m_cmdMgr{nullptr};

    QString m_currentFile;
    bool m_isDirty{false};
    Project* m_project{nullptr};
    // Recent files
    QStringList m_recentFiles;
    QMenu* m_recentMenu{nullptr};
    static constexpr int kMaxRecent = 8;

    // Plugins (C ABI)
    QMenu* m_pluginsMenu{nullptr};
    QMenu* m_pluginExportMenu{nullptr};
    QAction* m_loadPluginAct{nullptr};
    std::unique_ptr<cadgf::PluginRegistry> m_pluginRegistry;
};
