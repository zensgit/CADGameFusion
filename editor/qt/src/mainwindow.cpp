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

#include "core/core_c_api.h"
#include "canvas.hpp"
#include "exporter.hpp"
#include "export_dialog.hpp"
#include "command/command_manager.hpp"
#include "panels/property_panel.hpp"
#include "panels/layer_panel.hpp"
#include "project/project.hpp"

MainWindow::MainWindow(QWidget* parent) : QMainWindow(parent) {
    setWindowTitle("CADGameFusion - Qt Editor");

    // ... (existing code) ...

    auto* canvas = new CanvasWidget(this);
    setCentralWidget(canvas);

    // Layer dock
    m_layerPanel = new LayerPanel(this);
    addDockWidget(Qt::LeftDockWidgetArea, m_layerPanel);
    m_layerPanel->setDocument(&m_document);

    // Properties dock (initially shows empty selection)
    auto* prop = new PropertyPanel(this);
    addDockWidget(Qt::RightDockWidgetArea, prop);
    prop->updateFromSelection({});
    
    // ... (existing code) ...
    connect(canvas, &CanvasWidget::selectionChanged, this, [this, prop, canvas](const QList<int>& ids){
        prop->updateFromSelection(ids);
        // Compute visibility state for current selection
        if (!ids.isEmpty()) {
            bool anyTrue=false, anyFalse=false;
            for (int idx : ids) {
                CanvasWidget::PolyVis pv;
                if (canvas->polylineAt(idx, pv)) {
                    anyTrue  = anyTrue  || pv.visible;
                    anyFalse = anyFalse || !pv.visible;
                }
            }
            Qt::CheckState cs = Qt::PartiallyChecked;
            if (ids.size() == 1) {
                cs = anyTrue ? Qt::Checked : Qt::Unchecked;
            } else {
                if (anyTrue && !anyFalse) cs = Qt::Checked;
                else if (!anyTrue && anyFalse) cs = Qt::Unchecked;
            }
            prop->setVisibleCheckState(cs, /*silent*/true);
        }
    });
    connect(prop, &PropertyPanel::propertyEdited, [this, canvas](int entityId, const QString& key, const QVariant& value){
        if (!canvas) return;
        if (key == "visible") {
            struct SetPropertyCommand : Command {
                CanvasWidget* canvas; int idx; QString prop; QVariant newVal; QVariant oldVal; bool haveOld{false};
                SetPropertyCommand(CanvasWidget* c, int i, QString p, QVariant nv)
                    : canvas(c), idx(i), prop(std::move(p)), newVal(std::move(nv)) {
                    if (canvas && prop == "visible") { CanvasWidget::PolyVis pv; haveOld = canvas->polylineAt(idx, pv); if (haveOld) oldVal = pv.visible; }
                }
                void apply(const QVariant& v) {
                    if (!canvas) return;
                    if (prop == "visible") canvas->setPolylineVisible(idx, v.toBool());
                }
                void execute() override { apply(newVal); }
                void undo() override { if (haveOld) apply(oldVal); }
                QString name() const override { return QString("Set %1").arg(prop); }
            };
            m_cmdMgr->push(std::make_unique<SetPropertyCommand>(canvas, entityId, "visible", value));
        }
    });
    connect(prop, &PropertyPanel::propertyEditedBatch, [this, canvas](const QList<int>& ids, const QString& key, const QVariant& value){
        if (!canvas || key != "visible" || ids.isEmpty()) return;
        struct BatchSetVisible : Command {
            CanvasWidget* canvas; QList<int> validIds; QVector<bool> oldVals; bool newVal;
            BatchSetVisible(CanvasWidget* c, QList<int> is, bool nv) : canvas(c), newVal(nv) {
                QSet<int> seen;
                validIds.reserve(is.size());
                oldVals.reserve(is.size());
                for (int idx : is) {
                    if (seen.contains(idx)) continue; // de-duplicate
                    seen.insert(idx);
                    CanvasWidget::PolyVis pv;
                    if (canvas && canvas->polylineAt(idx, pv)) {
                        validIds.push_back(idx);
                        oldVals.push_back(pv.visible);
                    }
                }
            }
            void execute() override { for (int idx : validIds) canvas->setPolylineVisible(idx, newVal); }
            void undo() override { for (int i=0;i<validIds.size();++i) canvas->setPolylineVisible(validIds[i], oldVals[i]); }
            QString name() const override { return "Set Visible (Batch)"; }
        };
        auto cmd = std::make_unique<BatchSetVisible>(canvas, ids, value.toBool());
        if (cmd->validIds.isEmpty()) {
            statusBar()->showMessage("No valid selection for visibility change", 1200);
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
    if (canvas) {
        canvas->clear();
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
    core_document* doc = core_document_create();
    core_vec2 pts[5] = { {0,0},{100,0},{100,100},{0,100},{0,0} };  // 已经正确闭合
    auto id = core_document_add_polyline(doc, pts, 5);
    core_document_destroy(doc);
    QVector<QPointF> poly;
    for (auto& p : pts) poly.push_back(QPointF(p.x, p.y));
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget());
    if (canvas) {
        int gid = canvas->newGroupId();
        canvas->addPolylineColored(poly, QColor(220,220,230), gid);
    }
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

    core_vec2 pts[5] = { {0,0},{120,0},{120,80},{0,80},{0,0} }; // closed
    int idxCount = 0;
    if (!core_triangulate_polygon(pts, 5, nullptr, &idxCount) || idxCount <= 0) {
        statusBar()->showMessage("Triangulation failed", 2000);
        return;
    }
    std::vector<unsigned int> indices(idxCount);
    if (!core_triangulate_polygon(pts, 5, indices.data(), &idxCount)) {
        statusBar()->showMessage("Triangulation fill failed", 2000);
        return;
    }
    QVector<QPointF> verts; verts.reserve(4);
    for (int i=0;i<4;++i) verts.push_back(QPointF(pts[i].x, pts[i].y));
    QVector<unsigned int> qidx(indices.begin(), indices.end());
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget()); if (!canvas) return;
    m_cmdMgr->push(std::make_unique<TriangulateCommand>(canvas, verts, qidx));
    // Ensure dirty marker for UI (wireframe is not serialized but we mark edit intent)
    markDirty();
    statusBar()->showMessage(QString("Triangulated %1 triangles (undoable)").arg(idxCount/3), 2000);
}

void MainWindow::demoBoolean() {
    // simple union of two overlapping boxes (闭合多边形)
    std::vector<core_vec2> a{{0,0},{100,0},{100,100},{0,100},{0,0}};  // 正确闭合
    std::vector<core_vec2> b{{50,50},{150,50},{150,150},{50,150},{50,50}};  // 正确闭合
    int poly_count=0,total_pts=0;
    int ok = core_boolean_op_single(a.data(), (int)a.size(), b.data(), (int)b.size(), 0,
                                    nullptr, nullptr, &poly_count, &total_pts);
    if (!ok || poly_count<=0) { statusBar()->showMessage("Boolean empty (maybe no CLIPPER2)",2000); return; }
    std::vector<core_vec2> out_pts(total_pts);
    std::vector<int> counts(poly_count);
    core_boolean_op_single(a.data(), (int)a.size(), b.data(), (int)b.size(), 0,
                           out_pts.data(), counts.data(), &poly_count, &total_pts);
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget());
    if (!canvas) return;
    int off=0;
    int gidB = canvas->newGroupId();
    for (int i=0;i<poly_count;i++) {
        QVector<QPointF> poly;
        for (int j=0;j<counts[i];j++) poly.push_back(QPointF(out_pts[off+j].x, out_pts[off+j].y));
        off += counts[i];
        const QColor col = (i%2==0) ? QColor(100,200,255) : QColor(255,180,120);
        canvas->addPolylineColored(poly, col, gidB);
    }
}

void MainWindow::demoOffset() {
    std::vector<core_vec2> a{{0,0},{100,0},{100,100},{0,100},{0,0}};  // 正确闭合的矩形
    int poly_count=0,total_pts=0;
    int ok = core_offset_single(a.data(), (int)a.size(), 10.0, nullptr, nullptr, &poly_count, &total_pts);
    if (!ok || poly_count<=0) { statusBar()->showMessage("Offset empty (maybe no CLIPPER2)",2000); return; }
    std::vector<core_vec2> out_pts(total_pts);
    std::vector<int> counts(poly_count);
    core_offset_single(a.data(), (int)a.size(), 10.0, out_pts.data(), counts.data(), &poly_count, &total_pts);
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget());
    if (!canvas) return;
    int off=0;
    int gidO = canvas->newGroupId();
    for (int i=0;i<poly_count;i++) {
        QVector<QPointF> poly;
        for (int j=0;j<counts[i];j++) poly.push_back(QPointF(out_pts[off+j].x, out_pts[off+j].y));
        off += counts[i];
        canvas->addPolylineColored(poly, QColor(180,255,120), gidO);
    }
}

void MainWindow::showAboutCore() {
    const char* ver = core_get_version();
    unsigned int flags = core_get_feature_flags();
    QStringList feats;
    feats << QString("USE_EARCUT: ") + ((flags & (1u<<0)) ? "ON" : "OFF");
    feats << QString("USE_CLIPPER2: ") + ((flags & (1u<<1)) ? "ON" : "OFF");
    QString msg = QString("Core version: %1\nFeatures:\n - %2\n - %3")
                  .arg(QString::fromUtf8(ver ? ver : "unknown"))
                  .arg(feats.value(0))
                  .arg(feats.value(1));
    QMessageBox::about(this, "About Core", msg);
}

void MainWindow::exportSceneAction() {
    exportSceneActionImpl(ExportJSON | ExportGLTF);
}

void MainWindow::exportSceneActionImpl(int kinds) {
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget());
    if (!canvas) return;
    QString base = QFileDialog::getExistingDirectory(this, "Select export base directory");
    if (base.isEmpty()) return;
    // Group polylines by groupId
    QMap<int, ExportItem> groupMap;
    for (const auto& pv : canvas->polylinesData()) {
        ExportItem& item = groupMap[pv.groupId];
        item.groupId = pv.groupId;
        item.rings.push_back(pv.pts);
        // Layer info (take from first polyline in group)
        if (item.layerName.isEmpty()) {
            auto* layer = m_document.get_layer(pv.layerId);
            if (layer) {
                item.layerName = QString::fromStdString(layer->name);
                item.layerColor = layer->color;
            } else {
                item.layerName = "0";
                item.layerColor = 0xFFFFFF;
            }
        }
    }
    QVector<ExportItem> items;
    for (auto it = groupMap.begin(); it != groupMap.end(); ++it) {
        items.push_back(it.value());
    }
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
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget());
    if (!canvas) return;
    int selGid = canvas->selectedGroupId();
    if (!ExportDialog::getExportOptions(this, nullptr, selGid, opts)) return;

    int kinds = 0;
    if (opts.format == "json") kinds |= ExportJSON;
    else if (opts.format == "gltf") kinds |= ExportGLTF;
    else /*unity*/ { kinds |= (ExportJSON|ExportGLTF); }

    // Collect and export
    QString base = QFileDialog::getExistingDirectory(this, "Select export base directory"); 
    if (base.isEmpty()) return;
    QMap<int, ExportItem> groupMap;
    const bool onlySelected = (opts.range == ExportDialog::SelectedGroupOnly && selGid!=-1);
    for (const auto& pv : canvas->polylinesData()) {
        if (onlySelected && pv.groupId != selGid) continue;
        ExportItem& item = groupMap[pv.groupId];
        item.groupId = pv.groupId;
        item.rings.push_back(pv.pts);
        if (item.layerName.isEmpty()) {
            auto* layer = m_document.get_layer(pv.layerId);
            if (layer) {
                item.layerName = QString::fromStdString(layer->name);
                item.layerColor = layer->color;
            } else {
                item.layerName = "0";
                item.layerColor = 0xFFFFFF;
            }
        }
    }
    QVector<ExportItem> items; 
    for (auto it = groupMap.begin(); it != groupMap.end(); ++it) { 
        items.push_back(it.value());
    } 
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
