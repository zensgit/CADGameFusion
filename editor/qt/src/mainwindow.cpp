#include "mainwindow.hpp"

#include <QAction>
#include <QListWidget>
#include <QMenuBar>
#include <QStatusBar>
#include <QToolBar>
#include <QMessageBox>
#include <QFileDialog>
#include <QDir>
#include <QDialog>
#include <QFormLayout>
#include <QCheckBox>
#include <QComboBox>
#include <QDoubleSpinBox>
#include <QDialogButtonBox>
#include <QPushButton>
#include <QSettings>
#include <QDesktopServices>
#include <QUrl>
#include <QClipboard>
#include <QApplication>
#include <QCloseEvent>
#include <QFileInfo>
#include <QMenu>
#include <QTimer>
#include <QDebug>
#include <QSet>

#include "core/ops2d.hpp"
#include "core/version.hpp"
#include "core/core_c_api.h"
#include "canvas.hpp"
#include "editor/qt/include/export/export_helpers.hpp"
#include "exporter.hpp"
#include "export_dialog.hpp"
#include "command/command_manager.hpp"
#include "panels/property_panel.hpp"
#include "panels/layer_panel.hpp"
#include "panels/snap_panel.hpp"
#include "project/project.hpp"

#include "plugin_registry.hpp"

#include <unordered_map>
#include <vector>

static uint32_t effectiveEntityColor(const core::Document& doc, const core::Entity& e);
static int selectionGroupId(const core::Document& doc, const QList<qulonglong>& selection);
static QVector<core::EntityId> buildRemovalSet(const core::Document& doc,
                                               const QList<qulonglong>& selection,
                                               bool allSimilar);

MainWindow::~MainWindow() = default;

MainWindow::MainWindow(QWidget* parent) : QMainWindow(parent) {
    setWindowTitle("CADGameFusion - Qt Editor");

    // ... (existing code) ...

    auto* canvas = new CanvasWidget(this);
    canvas->setDocument(&m_document);
    setCentralWidget(canvas);

    // Layer dock
    m_layerPanel = new LayerPanel(this);
    addDockWidget(Qt::LeftDockWidgetArea, m_layerPanel);
    m_layerPanel->setDocument(&m_document);

    connect(m_layerPanel, &LayerPanel::layerVisibilityChanged, this, [this](int layerId, bool visible){
        if (!m_document.set_layer_visible(layerId, visible)) {
            statusBar()->showMessage("Layer not found", 1500);
            return;
        }
        markDirty();
    });
    connect(m_layerPanel, &LayerPanel::layerAdded, this, [this](const QString& name){
        int id = m_document.add_layer(name.toStdString());
        markDirty();
        statusBar()->showMessage(QString("Added layer id=%1").arg(id), 1500);
    });

    m_selectionModel = new SelectionModel(this);
    m_snapSettings = new SnapSettings(this);
    canvas->setSnapSettings(m_snapSettings);
    connect(m_snapSettings, &SnapSettings::settingsChanged, this, [canvas](){
        if (canvas) canvas->update();
    });

    m_snapPanel = new SnapPanel(this);
    addDockWidget(Qt::RightDockWidgetArea, m_snapPanel);
    m_snapPanel->setSettings(m_snapSettings);

    // Properties dock (initially shows empty selection)
    auto* prop = new PropertyPanel(this);
    addDockWidget(Qt::RightDockWidgetArea, prop);
    prop->setDocument(&m_document);
    prop->updateFromSelection({});
    
    // ... (existing code) ...
    connect(canvas, &CanvasWidget::selectionChanged, this, [this](const QList<qulonglong>& entityIds){
        if (m_selectionModel) m_selectionModel->setSelection(entityIds);
    });
    connect(canvas, &CanvasWidget::moveEntitiesRequested, this, [this](const QList<qulonglong>& entityIds,
                                                                              const QVector<QVector<QPointF>>& beforePoints,
                                                                              const QPointF& delta){
        if (entityIds.isEmpty() || beforePoints.size() != entityIds.size()) return;
        struct MoveEntitiesCommand : Command {
            core::Document* doc;
            QVector<EntityId> ids;
            QVector<QVector<QPointF>> before;
            QPointF delta;
            MoveEntitiesCommand(core::Document* d,
                                const QList<qulonglong>& inIds,
                                const QVector<QVector<QPointF>>& inBefore,
                                const QPointF& dlt)
                : doc(d), before(inBefore), delta(dlt) {
                ids.reserve(inIds.size());
                for (qulonglong id : inIds) {
                    ids.push_back(static_cast<EntityId>(id));
                }
            }
            void applyPoints(EntityId id, const QVector<QPointF>& pts) {
                if (!doc) return;
                core::Polyline pl;
                pl.points.reserve(static_cast<size_t>(pts.size()));
                for (const auto& pt : pts) {
                    pl.points.push_back(core::Vec2{pt.x(), pt.y()});
                }
                doc->set_polyline_points(id, pl);
            }
            void execute() override {
                if (before.size() != ids.size()) return;
                for (int i = 0; i < ids.size(); ++i) {
                    QVector<QPointF> moved;
                    moved.reserve(before[i].size());
                    for (const auto& pt : before[i]) {
                        moved.append(pt + delta);
                    }
                    applyPoints(ids[i], moved);
                }
            }
            void undo() override {
                if (before.size() != ids.size()) return;
                for (int i = 0; i < ids.size(); ++i) {
                    applyPoints(ids[i], before[i]);
                }
            }
            QString name() const override { return "Move Entities"; }
        };
        auto cmd = std::make_unique<MoveEntitiesCommand>(&m_document, entityIds, beforePoints, delta);
        m_cmdMgr->push(std::move(cmd));
        markDirty();
    });
    connect(m_selectionModel, &SelectionModel::selectionChanged, this, [this, prop, canvas](const QList<qulonglong>& entityIds){
        prop->updateFromSelection(entityIds);
        if (canvas) canvas->setSelection(entityIds);
    });
    connect(canvas, &CanvasWidget::deleteRequested, this, [this](bool allSimilar){
        const QList<qulonglong> selection = m_selectionModel ? m_selectionModel->selection() : QList<qulonglong>{};
        const QVector<core::EntityId> ids = buildRemovalSet(m_document, selection, allSimilar);
        if (ids.isEmpty()) return;
        struct RemoveEntitiesCommand : Command {
            core::Document* doc;
            QVector<core::Entity> removed;
            QVector<core::EntityId> ids;
            RemoveEntitiesCommand(core::Document* d, QVector<core::EntityId> removeIds)
                : doc(d), ids(std::move(removeIds)) {}
            void execute() override {
                if (!doc) return;
                removed.clear();
                removed.reserve(ids.size());
                for (core::EntityId id : ids) {
                    if (const auto* e = doc->get_entity(id)) {
                        removed.push_back(*e);
                        doc->remove_entity(id);
                    }
                }
            }
            void undo() override {
                if (!doc) return;
                for (const auto& e : removed) {
                    if (e.type != core::EntityType::Polyline || !e.payload) continue;
                    const auto* pl = static_cast<const core::Polyline*>(e.payload.get());
                    if (!pl) continue;
                    core::EntityId newId = doc->add_polyline(*pl, e.name, e.layerId);
                    doc->set_entity_visible(newId, e.visible);
                    doc->set_entity_group_id(newId, e.groupId);
                    doc->set_entity_color(newId, e.color);
                }
            }
            QString name() const override { return "Remove Entities"; }
        };
        m_cmdMgr->push(std::make_unique<RemoveEntitiesCommand>(&m_document, ids));
        markDirty();
    });
    connect(prop, &PropertyPanel::propertyEdited, [this](qulonglong entityId, const QString& key, const QVariant& value){
        // PR7: Commands operate on Document; Canvas observes Document changes.
        if (key == "visible") {
            EntityId eid = static_cast<EntityId>(entityId);
            if (eid == 0 || !m_document.get_entity(eid)) {
                statusBar()->showMessage("Entity not found in Document", 1500);
                return;
            }
            struct SetVisibleCommand : Command {
                core::Document* doc; EntityId eid; bool newVal; bool oldVal;
                SetVisibleCommand(core::Document* d, EntityId e, bool nv)
                    : doc(d), eid(e), newVal(nv), oldVal(true) {
                    if (doc) {
                        auto* entity = doc->get_entity(eid);
                        if (entity) oldVal = entity->visible;
                    }
                }
                void execute() override {
                    if (doc) doc->set_entity_visible(eid, newVal);
                }
                void undo() override {
                    if (doc) doc->set_entity_visible(eid, oldVal);
                }
                QString name() const override { return "Set Visible"; }
            };
            m_cmdMgr->push(std::make_unique<SetVisibleCommand>(&m_document, eid, value.toBool()));
        }
    });
    connect(prop, &PropertyPanel::propertyEditedBatch, [this](const QList<qulonglong>& entityIds, const QString& key, const QVariant& value){
        if (key != "visible" || entityIds.isEmpty()) return;
        // PR7: Batch commands operate on Document; Canvas observes Document changes.
        struct BatchSetVisibleDoc : Command {
            core::Document* doc;
            QVector<EntityId> entityIds; QVector<bool> oldVals; bool newVal;
            BatchSetVisibleDoc(core::Document* d, const QList<qulonglong>& ids, bool nv)
                : doc(d), newVal(nv) {
                QSet<EntityId> seen;
                for (qulonglong id : ids) {
                    EntityId eid = static_cast<EntityId>(id);
                    if (eid == 0 || seen.contains(eid)) continue;
                    seen.insert(eid);
                    auto* entity = d->get_entity(eid);
                    if (entity) {
                        entityIds.push_back(eid);
                        oldVals.push_back(entity->visible);
                    }
                }
            }
            void execute() override {
                for (EntityId eid : entityIds) doc->set_entity_visible(eid, newVal);
            }
            void undo() override {
                for (int i = 0; i < entityIds.size(); ++i) doc->set_entity_visible(entityIds[i], oldVals[i]);
            }
            QString name() const override { return "Set Visible (Batch)"; }
        };
        auto cmd = std::make_unique<BatchSetVisibleDoc>(&m_document, entityIds, value.toBool());
        if (cmd->entityIds.isEmpty()) {
            statusBar()->showMessage("No valid entities for visibility change", 1200);
            return;
        }
        m_cmdMgr->push(std::move(cmd));
    });

    // (tracking moved earlier)

    // File menu (first)
    auto* fileMenu = menuBar()->addMenu("File");
    m_recentMenu = fileMenu->addMenu("Open Recent");
    connect(m_recentMenu, &QMenu::triggered, this, [this](QAction* act){
        QString p = act->data().toString();
        if (!p.isEmpty()) openProjectFile(p, true);
    });
    auto* actNew = fileMenu->addAction("New");
    actNew->setShortcut(QKeySequence::New);
    connect(actNew, &QAction::triggered, this, &MainWindow::newFile);
    auto* actOpen = fileMenu->addAction("Open...");
    actOpen->setShortcut(QKeySequence::Open);
    connect(actOpen, &QAction::triggered, this, &MainWindow::openFile);
    auto* actSave = fileMenu->addAction("Save");
    actSave->setShortcut(QKeySequence::Save);
    connect(actSave, &QAction::triggered, this, &MainWindow::saveFile);
    auto* actSaveAs = fileMenu->addAction("Save As...");
    actSaveAs->setShortcut(QKeySequence::SaveAs);
    connect(actSaveAs, &QAction::triggered, this, &MainWindow::saveFileAs);
    fileMenu->addSeparator();
    auto* actExport = fileMenu->addAction("Export Scene (JSON+glTF)...");
    connect(actExport, &QAction::triggered, this, &MainWindow::exportSceneAction);
    auto* actExportJson = fileMenu->addAction("Export Scene (JSON only)...");
    connect(actExportJson, &QAction::triggered, [this]{ exportSceneActionImpl(ExportJSON); });
    auto* actExportGltf = fileMenu->addAction("Export Scene (glTF only)...");
    connect(actExportGltf, &QAction::triggered, [this]{ exportSceneActionImpl(ExportGLTF); });
    auto* actExportDxf = fileMenu->addAction("Export Scene (DXF only)...");
    connect(actExportDxf, &QAction::triggered, [this]{ exportSceneActionImpl(ExportDXF); });
    fileMenu->addSeparator();
    auto* actExportOpt = fileMenu->addAction("Export with Options...");
    connect(actExportOpt, &QAction::triggered, this, &MainWindow::exportWithOptions);

    fileMenu->addSeparator();
    m_pluginsMenu = fileMenu->addMenu("Plugins");
    m_loadPluginAct = m_pluginsMenu->addAction("Load Plugin...");
    connect(m_loadPluginAct, &QAction::triggered, this, &MainWindow::loadPlugin);
    m_pluginExportMenu = m_pluginsMenu->addMenu("Export via Plugin");
    rebuildPluginExportMenu();

    // Edit menu (Undo/Redo)
    auto* editMenu = menuBar()->addMenu("Edit");
    QAction* actUndo = editMenu->addAction("Undo");
    QAction* actRedo = editMenu->addAction("Redo");
    actUndo->setShortcut(QKeySequence::Undo);
    actRedo->setShortcut(QKeySequence::Redo);
    connect(actUndo, &QAction::triggered, [this]() {
        m_undoStack->undo();
        // Check clean state after undo
        if (m_undoStack->isClean()) {
            markClean();
        } else {
            markDirty();
        }
    });
    connect(actRedo, &QAction::triggered, [this]() {
        m_undoStack->redo();
        // Check clean state after redo
        if (m_undoStack->isClean()) {
            markClean();
        } else {
            markDirty();
        }
    });

    // Test action: push a dummy command to exercise undo/redo
    auto* actDummy = editMenu->addAction("Do Dummy Command");
    connect(actDummy, &QAction::triggered, [this]{
        struct DummyCmd : Command {
            int* counter;
            explicit DummyCmd(int* c) : counter(c) {}
            void execute() override { if (counter) (*counter)++; }
            void undo() override { if (counter) (*counter)--; }
            QString name() const override { return "Dummy"; }
        };
        static int s_counter = 0;
        m_cmdMgr->push(std::make_unique<DummyCmd>(&s_counter));
        statusBar()->showMessage(QString("Dummy executed, counter=%1").arg(s_counter), 1500);
        connect(m_cmdMgr, &CommandManager::commandExecuted, this, [this](const QString& n){ statusBar()->showMessage("Command: "+n, 800); });
    });

    // Help menu
    auto* helpMenu = menuBar()->addMenu("Help");
    auto* actAbout = helpMenu->addAction("About Core...");
    connect(actAbout, &QAction::triggered, this, &MainWindow::showAboutCore);

    statusBar()->showMessage("Ready | Delete=删单条, Shift+Delete=删同批次/同类, Clear All=清空");
    m_project = new Project();
    setCurrentFile("untitled.cgf");
    m_undoStack->setClean();
    markClean();
    loadRecentFiles();
    updateRecentFilesMenu();
    maybeAutoRestore();
}

// Persistence helpers
void MainWindow::markDirty() {
    qDebug() << "markDirty() called, m_isDirty was" << m_isDirty;
    m_isDirty = true;
    setWindowModified(true);
    // Update title to show asterisk
    QString shown = m_currentFile.isEmpty() ? "untitled.cgf" : QFileInfo(m_currentFile).fileName();
    QString newTitle = QString("%1* - CADGameFusion Editor").arg(shown);
    qDebug() << "Setting title to:" << newTitle;
    setWindowTitle(newTitle);
}

void MainWindow::markClean() {
    m_isDirty = false;
    setWindowModified(false);
    // Update title to remove asterisk
    QString shown = m_currentFile.isEmpty() ? "untitled.cgf" : QFileInfo(m_currentFile).fileName();
    setWindowTitle(QString("%1 - CADGameFusion Editor").arg(shown));
}
bool MainWindow::isDirtyState() const { return m_isDirty || (m_undoStack && !m_undoStack->isClean()); }

bool MainWindow::maybeSave() {
    if (!isDirtyState()) return true;
    auto ret = QMessageBox::question(this, "Unsaved Changes", "Save changes to project?", QMessageBox::Save|QMessageBox::Discard|QMessageBox::Cancel, QMessageBox::Save);
    if (ret == QMessageBox::Save) { saveFile(); return !m_isDirty; }
    if (ret == QMessageBox::Cancel) return false;
    return true;
}

void MainWindow::setCurrentFile(const QString& fileName) {
    m_currentFile = fileName;
    QString shown = fileName.isEmpty() ? "untitled.cgf" : QFileInfo(fileName).fileName();
    setWindowTitle(QString("%1%2 - CADGameFusion Editor")
                   .arg(shown)
                   .arg(m_isDirty?"*":""));
}

void MainWindow::newFile() {
    if (!maybeSave()) return;
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget());
    m_document.clear();
    if (canvas) {
        canvas->setDocument(&m_document);
        canvas->clearTriMesh();
        m_undoStack->clear();  // Clear undo history
    }
    setCurrentFile("untitled.cgf");
    m_undoStack->setClean();
    markClean();
}

void MainWindow::openFile() {
    if (!maybeSave()) return;
    QString path = QFileDialog::getOpenFileName(this, "Open Project", QString(), "CADGameFusion Project (*.cgf)");
    if (path.isEmpty()) return;
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget());
    if (m_project && m_project->load(path, m_document, canvas)) {
        m_undoStack->clear();
        setCurrentFile(path);
        m_undoStack->setClean();
        markClean();
        statusBar()->showMessage("Opened " + path, 2000);
    } else {
        QMessageBox::warning(this, "Open", "Failed to open project");
    }
}

void MainWindow::saveFile() {
    if (m_currentFile.isEmpty() || m_currentFile == "untitled.cgf") { saveFileAs(); return; }
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget());
    if (m_project && canvas && m_project->save(m_currentFile, m_document, canvas)) {
        m_undoStack->setClean();  // Mark this state as clean
        markClean();
        statusBar()->showMessage("Saved " + m_currentFile, 2000);
        addToRecentFiles(m_currentFile);
    } else {
        QMessageBox::warning(this, "Save", "Failed to save project");
    }
}

void MainWindow::saveFileAs() {
    QString path = QFileDialog::getSaveFileName(this, "Save Project As", m_currentFile, "CADGameFusion Project (*.cgf)");
    if (path.isEmpty()) return;
    if (!path.endsWith(".cgf")) path += ".cgf";
    m_currentFile = path;
    saveFile();
}

void MainWindow::closeEvent(QCloseEvent* event) {
    if (maybeSave()) event->accept(); else event->ignore();
}

bool MainWindow::openProjectFile(const QString& path, bool fromRecent) {
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget());
    if (!m_project || !canvas) return false;
    if (m_project->load(path, m_document, canvas)) {
        m_undoStack->clear();
        setCurrentFile(path);
        m_undoStack->setClean();
        markClean();
        statusBar()->showMessage("Opened " + path + (fromRecent?" (recent)":""), 2000);
        addToRecentFiles(path);
        return true;
    }
    QMessageBox::warning(this, "Open", "Failed to open project");
    return false;
}

void MainWindow::loadRecentFiles() {
    QSettings s("CADGameFusion", "Editor");
    m_recentFiles = s.value("recentFiles").toStringList();
}

void MainWindow::saveRecentFiles() {
    QSettings s("CADGameFusion", "Editor");
    s.setValue("recentFiles", m_recentFiles);
    if (!m_currentFile.isEmpty() && m_currentFile != "untitled.cgf") s.setValue("lastFile", m_currentFile);
}

void MainWindow::updateRecentFilesMenu() {
    if (!m_recentMenu) return;
    m_recentMenu->clear();
    if (m_recentFiles.isEmpty()) {
        QAction* none = m_recentMenu->addAction("(None)");
        none->setEnabled(false);
        return;
    }
    for (const auto& f : m_recentFiles) {
        QAction* a = m_recentMenu->addAction(QFileInfo(f).fileName());
        a->setData(f);
    }
    m_recentMenu->addSeparator();
    QAction* clearAct = m_recentMenu->addAction("Clear List");
    connect(clearAct, &QAction::triggered, this, [this]{ m_recentFiles.clear(); updateRecentFilesMenu(); saveRecentFiles(); });
}

void MainWindow::addToRecentFiles(const QString& path) {
    if (path.isEmpty()) return;
    QString canon = QFileInfo(path).canonicalFilePath();
    if (canon.isEmpty()) canon = path;
    m_recentFiles.removeAll(canon);
    m_recentFiles.prepend(canon);
    while (m_recentFiles.size() > kMaxRecent) m_recentFiles.removeLast();
    updateRecentFilesMenu();
    saveRecentFiles();
}

void MainWindow::maybeAutoRestore() {
    QSettings s("CADGameFusion", "Editor");
    QString last = s.value("lastFile").toString();
    if (last.isEmpty()) return;
    if (!QFileInfo::exists(last)) return;
    if (m_isDirty || (m_currentFile != "untitled.cgf")) return;
    auto ret = QMessageBox::question(this, "Restore Last Session",
                                     QString("Reopen last project?\n%1").arg(last),
                                     QMessageBox::Yes | QMessageBox::No,
                                     QMessageBox::Yes);
    if (ret == QMessageBox::Yes) {
        openProjectFile(last, true);
    }
}

void MainWindow::addSamplePolyline() {
    // PR7: Add to Document; Canvas observes Document changes (single source of truth).
    core::Vec2 pts[5] = {{0, 0}, {100, 0}, {100, 100}, {0, 100}, {0, 0}};  // closed square
    core::Polyline pl;
    pl.points.reserve(5);
    for (const auto& p : pts) pl.points.push_back(p);
    auto id = m_document.add_polyline(pl, "Sample Square");
    // Set default groupId using next available
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget());
    int gid = m_document.alloc_group_id();
    m_document.set_entity_group_id(id, gid);
    statusBar()->showMessage(QString("Added polyline id=%1").arg(static_cast<qulonglong>(id)), 2000);
}

void MainWindow::triangulateSample() {
    struct TriangulateCommand : Command {
        CanvasWidget* canvas;
        QVector<QPointF> oldVerts; QVector<unsigned int> oldIdx;
        QVector<QPointF> newVerts; QVector<unsigned int> newIdx;
        bool captured{false};
        TriangulateCommand(CanvasWidget* c, QVector<QPointF> nv, QVector<unsigned int> ni)
            : canvas(c), newVerts(std::move(nv)), newIdx(std::move(ni)) {}
        void execute() override {
            if (!canvas) return;
            if (!captured) {
                oldVerts = canvas->triVerts();
                oldIdx = canvas->triIndices();
                captured = true;
                qDebug() << "TriangulateCommand::execute() - captured old mesh, vertices:" << oldVerts.size() << "indices:" << oldIdx.size();
            }
            canvas->setTriMesh(newVerts, newIdx);
            qDebug() << (captured && oldVerts.size()>0 ? "TriangulateCommand::redo() - reapply new mesh" : "TriangulateCommand::execute() - set new mesh")
                     << "vertices:" << newVerts.size() << "indices:" << newIdx.size();
        }
        void undo() override {
            if (!canvas) return;
            qDebug() << "TriangulateCommand::undo() called - oldVerts:" << oldVerts.size() << "oldIdx:" << oldIdx.size();
            if (oldVerts.isEmpty() && oldIdx.isEmpty()) {
                qDebug() << "Clearing tri mesh (was empty before)";
                canvas->clearTriMesh();
            } else {
                qDebug() << "Restoring old mesh";
                canvas->setTriMesh(oldVerts, oldIdx);
            }
        }
        QString name() const override { return "Triangulate"; }
    };

    std::vector<core::Vec2> pts{{0, 0}, {120, 0}, {120, 80}, {0, 80}, {0, 0}}; // closed
    core::TriMesh2D m = core::triangulate_polygon(pts);
    if (m.indices.empty() || m.vertices.empty()) {
        statusBar()->showMessage("Triangulation failed", 2000);
        return;
    }
    QVector<QPointF> verts;
    verts.reserve(static_cast<int>(m.vertices.size()));
    for (const auto& p : m.vertices) verts.push_back(QPointF(p.x, p.y));
    QVector<unsigned int> qidx;
    qidx.reserve(static_cast<int>(m.indices.size()));
    for (auto idx : m.indices) qidx.push_back(static_cast<unsigned int>(idx));
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget()); if (!canvas) return;
    m_cmdMgr->push(std::make_unique<TriangulateCommand>(canvas, verts, qidx));
    // Ensure dirty marker for UI (wireframe is not serialized but we mark edit intent)
    markDirty();
    statusBar()->showMessage(QString("Triangulated %1 triangles (undoable)").arg(qidx.size() / 3), 2000);
}

void MainWindow::demoBoolean() {
    // PR7: Add result polylines to Document; Canvas observes Document changes.
    // simple union of two overlapping boxes (闭合多边形)
    core::Polyline a;
    a.points = {{0, 0}, {100, 0}, {100, 100}, {0, 100}, {0, 0}};  // 正确闭合
    core::Polyline b;
    b.points = {{50, 50}, {150, 50}, {150, 150}, {50, 150}, {50, 50}};  // 正确闭合

    std::vector<core::Polyline> resPolys = core::boolean_op({a}, {b}, core::BoolOp::Union);
    if (resPolys.empty()) {
        statusBar()->showMessage("Boolean empty (maybe no CLIPPER2)", 2000);
        return;
    }
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget());
    if (!canvas) return;
    int gidB = m_document.alloc_group_id();
    // Add result polylines to Document (single source of truth)
    for (size_t i = 0; i < resPolys.size(); i++) {
        std::string name = "Boolean_" + std::to_string(i);
        auto id = m_document.add_polyline(resPolys[i], name);
        m_document.set_entity_group_id(id, gidB);
        // Alternate colors: 0x64C8FF (cyan) and 0xFFB478 (orange)
        uint32_t col = (i % 2 == 0) ? 0x64C8FF : 0xFFB478;
        m_document.set_entity_color(id, col);
    }
    markDirty();
    statusBar()->showMessage(QString("Boolean union: %1 result(s)").arg(resPolys.size()), 2000);
}

void MainWindow::demoOffset() {
    // PR7: Add result polylines to Document; Canvas observes Document changes.
    core::Polyline a;
    a.points = {{0, 0}, {100, 0}, {100, 100}, {0, 100}, {0, 0}};  // 正确闭合的矩形
    std::vector<core::Polyline> resPolys = core::offset({a}, 10.0);
    if (resPolys.empty()) {
        statusBar()->showMessage("Offset empty (maybe no CLIPPER2)", 2000);
        return;
    }
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget());
    if (!canvas) return;
    int gidO = m_document.alloc_group_id();
    // Add result polylines to Document (single source of truth)
    for (size_t i = 0; i < resPolys.size(); i++) {
        std::string name = "Offset_" + std::to_string(i);
        auto id = m_document.add_polyline(resPolys[i], name);
        m_document.set_entity_group_id(id, gidO);
        // Green color: 0xB4FF78
        m_document.set_entity_color(id, 0xB4FF78);
    }
    markDirty();
    statusBar()->showMessage(QString("Offset: %1 result(s)").arg(resPolys.size()), 2000);
}

void MainWindow::showAboutCore() {
    const char* ver = core::version_string();
    unsigned int flags = 0u;
#if defined(USE_EARCUT)
    flags |= 1u << 0;
#endif
#if defined(USE_CLIPPER2)
    flags |= 1u << 1;
#endif
    QStringList feats;
    feats << QString("USE_EARCUT: ") + ((flags & (1u<<0)) ? "ON" : "OFF");
    feats << QString("USE_CLIPPER2: ") + ((flags & (1u<<1)) ? "ON" : "OFF");
    QString msg = QString("Core version: %1\nFeatures:\n - %2\n - %3")
                  .arg(QString::fromUtf8(ver ? ver : "unknown"))
                  .arg(feats.value(0))
                  .arg(feats.value(1));
    QMessageBox::about(this, "About Core", msg);
}

static uint32_t effectiveEntityColor(const core::Document& doc, const core::Entity& e) {
    if (e.color != 0) return e.color;
    const auto* layer = doc.get_layer(e.layerId);
    return layer ? layer->color : 0xDCDCE6;
}

static QVector<core::EntityId> buildRemovalSet(const core::Document& doc,
                                               const QList<qulonglong>& selection,
                                               bool allSimilar) {
    QVector<core::EntityId> ids;
    if (selection.isEmpty()) return ids;

    QSet<core::EntityId> seen;
    auto addId = [&](core::EntityId id) {
        if (id == 0 || seen.contains(id)) return;
        if (!doc.get_entity(id)) return;
        seen.insert(id);
        ids.push_back(id);
    };

    if (!allSimilar || selection.size() != 1) {
        for (qulonglong sel : selection) {
            addId(static_cast<core::EntityId>(sel));
        }
        return ids;
    }

    const core::EntityId selId = static_cast<core::EntityId>(selection.front());
    const core::Entity* sel = doc.get_entity(selId);
    if (!sel || sel->type != core::EntityType::Polyline) return ids;

    if (sel->groupId != -1) {
        const int gid = sel->groupId;
        for (const auto& e : doc.entities()) {
            if (e.type != core::EntityType::Polyline) continue;
            if (e.groupId == gid) addId(e.id);
        }
        return ids;
    }

    const uint32_t targetColor = effectiveEntityColor(doc, *sel);
    for (const auto& e : doc.entities()) {
        if (e.type != core::EntityType::Polyline) continue;
        if (effectiveEntityColor(doc, e) == targetColor) addId(e.id);
    }
    return ids;
}

void MainWindow::exportSceneAction() {
    exportSceneActionImpl(ExportJSON | ExportGLTF);
}

void MainWindow::exportSceneActionImpl(int kinds) {
    QString base = QFileDialog::getExistingDirectory(this, "Select export base directory");
    if (base.isEmpty()) return;
    QVector<ExportItem> items = export_helpers::collectExportItems(m_document);
    // Use document unit scale by default for quick export
    double unitScale = m_document.settings().unit_scale;
    ExportResult r = exportScene(items, QDir(base), kinds, unitScale, QJsonObject(), true, /*includeHolesGLTF=*/true);
    if (r.ok) {
        // Persist last export path for ExportDialog convenience
        {
            QSettings s("CADGameFusion", "ExportDialog");
            // Prefer validation report file path if present, otherwise scene dir
            QString lastPath = !r.written.isEmpty() ? r.written.back() : r.sceneDir;
            s.setValue("lastExportPath", lastPath);
        }
        QMessageBox box(this);
        box.setWindowTitle("Export");
        box.setText(QString("Exported to %1\n%2\nFiles:\n%3").arg(r.sceneDir, r.validationReport, r.written.join("\n")));
        QPushButton* openBtn = box.addButton(tr("Open"), QMessageBox::ActionRole);
        QPushButton* copyBtn = box.addButton(tr("Copy Path"), QMessageBox::ActionRole);
        box.addButton(QMessageBox::Ok);
        box.exec();
        if (box.clickedButton() == static_cast<QAbstractButton*>(openBtn)) {
            QDesktopServices::openUrl(QUrl::fromLocalFile(r.sceneDir));
        } else if (box.clickedButton() == static_cast<QAbstractButton*>(copyBtn)) {
            QApplication::clipboard()->setText(r.sceneDir);
            statusBar()->showMessage("Export path copied", 2000);
        }
    } else {
        QMessageBox::warning(this, "Export", QString("Export failed: %1").arg(r.error));
    }
}


void MainWindow::exportWithOptions() {
    // Simple inline dialog (future: move to its own class/UI)
    // Use ExportDialog for options
    ExportDialog::ExportOptions opts;
    const QList<qulonglong> selection = m_selectionModel ? m_selectionModel->selection() : QList<qulonglong>{};
    int selGid = export_helpers::selectionGroupId(m_document, selection);
    if (!ExportDialog::getExportOptions(this, nullptr, selGid, opts)) return;

    int kinds = 0;
    if (opts.format == "json") kinds |= ExportJSON;
    else if (opts.format == "gltf") kinds |= ExportGLTF;
    else /*unity*/ { kinds |= (ExportJSON|ExportGLTF); }

    // Collect and export
    QString base = QFileDialog::getExistingDirectory(this, "Select export base directory"); 
    if (base.isEmpty()) return;
    const bool onlySelected = (opts.range == ExportDialog::SelectedGroupOnly && selGid!=-1);
    QVector<ExportItem> items = export_helpers::collectExportItems(m_document, onlySelected ? selGid : -1);
    // Determine unit scale (use document settings or custom value)
    double unitScale = opts.useDocUnit ? m_document.settings().unit_scale : opts.unitScale;
    if (!opts.useDocUnit) unitScale = opts.unitScale;
    QJsonObject meta; 
    meta["joinType"] = static_cast<int>(opts.joinType); 
    meta["miterLimit"] = opts.miterLimit; 
    meta["unitScale"] = unitScale; 
    meta["useDocUnit"] = opts.useDocUnit; 
    meta["includeHoles"] = opts.includeHoles;
    ExportResult r = exportScene(items, QDir(base), kinds, unitScale, meta, opts.exportRingRoles, /*includeHolesGLTF=*/opts.includeHoles);
    if (r.ok) {
        // Persist last export path for ExportDialog convenience
        {
            QSettings s("CADGameFusion", "ExportDialog");
            QString lastPath = !r.written.isEmpty() ? r.written.back() : r.sceneDir;
            s.setValue("lastExportPath", lastPath);
        }
        QMessageBox box(this);
        box.setWindowTitle("Export");
        box.setText(QString("Exported to %1\n%2\nFiles:\n%3").arg(r.sceneDir, r.validationReport, r.written.join("\n")));
        QPushButton* openBtn = box.addButton(tr("Open"), QMessageBox::ActionRole);
        QPushButton* copyBtn = box.addButton(tr("Copy Path"), QMessageBox::ActionRole);
        box.addButton(QMessageBox::Ok);
        box.exec();
        if (box.clickedButton() == static_cast<QAbstractButton*>(openBtn)) {
            QDesktopServices::openUrl(QUrl::fromLocalFile(r.sceneDir));
        } else if (box.clickedButton() == static_cast<QAbstractButton*>(copyBtn)) {
            QApplication::clipboard()->setText(r.sceneDir);
            statusBar()->showMessage("Export path copied", 2000);
        }
    } else {
        QMessageBox::warning(this, "Export", QString("Export failed: %1").arg(r.error));
    }
}

static QString svToQString(cadgf_string_view v) {
    if (!v.data || v.size <= 0) return {};
    return QString::fromUtf8(v.data, v.size);
}

void MainWindow::rebuildPluginExportMenu() {
    if (!m_pluginExportMenu) return;
    m_pluginExportMenu->clear();

    if (!m_pluginRegistry) {
        QAction* a = m_pluginExportMenu->addAction("(No plugins loaded)");
        a->setEnabled(false);
        m_pluginExportMenu->setEnabled(false);
        return;
    }

    const auto exporters = m_pluginRegistry->exporters();
    if (exporters.empty()) {
        QAction* a = m_pluginExportMenu->addAction("(No exporters)");
        a->setEnabled(false);
        m_pluginExportMenu->setEnabled(false);
        return;
    }

    m_pluginExportMenu->setEnabled(true);
    for (const cadgf_exporter_api_v1* ex : exporters) {
        if (!ex || !ex->name || !ex->extension || !ex->export_document) continue;
        const QString name = svToQString(ex->name());
        const QString ext = svToQString(ex->extension());
        const QString label = ext.isEmpty() ? name : QString("%1 (*.%2)").arg(name, ext);
        QAction* act = m_pluginExportMenu->addAction(label);
        connect(act, &QAction::triggered, this, [this, ex] { exportViaPlugin(ex); });
    }
}

void MainWindow::loadPlugin() {
    const QString filter = "CADGameFusion Plugin (*.so *.dll *.dylib);;All Files (*)";
    const QString path = QFileDialog::getOpenFileName(this, "Load Plugin", QDir::currentPath(), filter);
    if (path.isEmpty()) return;

    if (!m_pluginRegistry) m_pluginRegistry = std::make_unique<cadgf::PluginRegistry>();

    std::string err;
    if (!m_pluginRegistry->load_plugin(path.toStdString(), &err)) {
        QMessageBox::critical(this, "Plugin", QString("Failed to load plugin:\n%1\n\n%2").arg(path, QString::fromStdString(err)));
        return;
    }

    const auto& plugins = m_pluginRegistry->plugins();
    const cadgf_plugin_desc_v1 d = plugins.empty() ? cadgf_plugin_desc_v1{} : plugins.back().desc;
    statusBar()->showMessage(QString("Loaded plugin: %1 (%2)")
                                 .arg(svToQString(d.name), svToQString(d.version)),
                             3000);
    rebuildPluginExportMenu();
}

bool MainWindow::buildCadgfDocumentFromDocument(cadgf_document* doc, QString* error) const {
    if (!doc) {
        if (error) *error = "Invalid cadgf_document";
        return false;
    }
    if (!cadgf_document_set_unit_scale(doc, m_document.settings().unit_scale)) {
        if (error) *error = "Failed to set document unit scale";
        return false;
    }

    std::unordered_map<int, int> layerMap;
    layerMap.reserve(static_cast<size_t>(m_document.layers().size()));

    for (const auto& layer : m_document.layers()) {
        if (layer.id == 0) {
            (void)cadgf_document_set_layer_color(doc, 0, layer.color);
            (void)cadgf_document_set_layer_visible(doc, 0, layer.visible ? 1 : 0);
            (void)cadgf_document_set_layer_locked(doc, 0, layer.locked ? 1 : 0);
            layerMap.emplace(0, 0);
            continue;
        }

        int outLayerId = -1;
        if (!cadgf_document_add_layer(doc, layer.name.c_str(), layer.color, &outLayerId)) {
            if (error) *error = QString("Failed to add layer: %1").arg(QString::fromStdString(layer.name));
            return false;
        }
        (void)cadgf_document_set_layer_visible(doc, outLayerId, layer.visible ? 1 : 0);
        (void)cadgf_document_set_layer_locked(doc, outLayerId, layer.locked ? 1 : 0);
        layerMap.emplace(layer.id, outLayerId);
    }

    int polyIndex = 0;
    for (const auto& e : m_document.entities()) {
        if (e.type != core::EntityType::Polyline || !e.payload) continue;
        const auto* pl = static_cast<const core::Polyline*>(e.payload.get());
        if (!pl || pl->points.size() < 2) continue;

        int layerId = 0;
        if (auto it = layerMap.find(e.layerId); it != layerMap.end()) layerId = it->second;

        std::vector<cadgf_vec2> pts;
        pts.reserve(pl->points.size());
        for (const auto& pt : pl->points) pts.push_back(cadgf_vec2{pt.x, pt.y});

        QString name;
        if (!e.name.empty()) {
            name = QString::fromStdString(e.name);
        } else {
            name = (e.groupId >= 0) ? QString("group_%1_poly_%2").arg(e.groupId).arg(polyIndex)
                                    : QString("polyline_%1").arg(polyIndex);
        }
        const QByteArray nameUtf8 = name.toUtf8();

        const cadgf_entity_id id = cadgf_document_add_polyline_ex(doc, pts.data(), static_cast<int>(pts.size()),
                                                                  nameUtf8.constData(), layerId);
        if (id == 0) {
            if (error) *error = QString("Failed to add polyline #%1").arg(polyIndex);
            return false;
        }
        (void)cadgf_document_set_entity_visible(doc, id, e.visible ? 1 : 0);
        (void)cadgf_document_set_entity_group_id(doc, id, e.groupId);
        (void)cadgf_document_set_entity_color(doc, id, e.color);
        polyIndex++;
    }

    return true;
}

void MainWindow::exportViaPlugin(const cadgf_exporter_api_v1* exporter) {
    if (!exporter || !exporter->export_document || !exporter->name || !exporter->extension) {
        QMessageBox::warning(this, "Plugin Export", "Invalid exporter");
        return;
    }

    const QString name = svToQString(exporter->name());
    QString ext = svToQString(exporter->extension());
    if (ext.startsWith('.')) ext.remove(0, 1);

    QString filter = svToQString(exporter->file_type_description ? exporter->file_type_description() : cadgf_string_view{nullptr, 0});
    if (filter.isEmpty()) filter = ext.isEmpty() ? "All Files (*)" : QString("%1 (*.%2)").arg(name, ext);

    QString suggested = QDir::currentPath();
    if (!ext.isEmpty()) suggested += QString("/export.%1").arg(ext);
    QString outPath = QFileDialog::getSaveFileName(this, "Export via Plugin", suggested, filter);
    if (outPath.isEmpty()) return;
    if (!ext.isEmpty() && QFileInfo(outPath).suffix().isEmpty()) outPath += QString(".%1").arg(ext);

    cadgf_document* doc = cadgf_document_create();
    if (!doc) {
        QMessageBox::critical(this, "Plugin Export", "cadgf_document_create failed");
        return;
    }

    QString buildErr;
    if (!buildCadgfDocumentFromDocument(doc, &buildErr)) {
        cadgf_document_destroy(doc);
        QMessageBox::critical(this, "Plugin Export", QString("Failed to build export document:\n%1").arg(buildErr));
        return;
    }

    cadgf_export_options_v1 options{};
    options.include_hidden_layers = 1;
    options.include_metadata = 1;
    options.scale = m_document.settings().unit_scale;
    options.custom_json.data = nullptr;
    options.custom_json.size = 0;

    cadgf_error_v1 err{};
    err.code = 0;
    err.message[0] = 0;

    const QByteArray outUtf8 = outPath.toUtf8();
    const int32_t ok = exporter->export_document(doc, outUtf8.constData(), &options, &err);
    cadgf_document_destroy(doc);

    if (!ok) {
        QMessageBox::critical(this, "Plugin Export",
                              QString("Export failed (code=%1):\n%2").arg(err.code).arg(QString::fromUtf8(err.message)));
        return;
    }

    statusBar()->showMessage(QString("Exported via plugin: %1").arg(outPath), 3000);
}
