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
#include <QSettings>
#include <QDesktopServices>
#include <QUrl>
#include <QClipboard>

#include "core/core_c_api.h"
#include "canvas.hpp"
#include "exporter.hpp"
#include "export_dialog.hpp"

MainWindow::MainWindow(QWidget* parent) : QMainWindow(parent) {
    setWindowTitle("CADGameFusion - Qt Editor");

    auto* tb = addToolBar("Main");
    auto* actAdd = tb->addAction("Add Polyline");
    connect(actAdd, &QAction::triggered, this, &MainWindow::addSamplePolyline);
    auto* actTri = tb->addAction("Triangulate");
    connect(actTri, &QAction::triggered, this, &MainWindow::triangulateSample);
    auto* actBool = tb->addAction("Boolean");
    connect(actBool, &QAction::triggered, this, &MainWindow::demoBoolean);
    auto* actOff = tb->addAction("Offset");
    connect(actOff, &QAction::triggered, this, &MainWindow::demoOffset);
    auto* actDel = tb->addAction("Delete Selected");
    connect(actDel, &QAction::triggered, [this]{ 
        auto* c = qobject_cast<CanvasWidget*>(centralWidget()); 
        if(c) {
            c->removeSelected();
            statusBar()->showMessage("Deleted selected polyline", 2000);
        }
    });
    auto* actDelSimilar = tb->addAction("Delete Similar");
    connect(actDelSimilar, &QAction::triggered, [this]{ 
        auto* c = qobject_cast<CanvasWidget*>(centralWidget()); 
        if(c) {
            int count = c->removeAllSimilar();
            statusBar()->showMessage(QString("Deleted %1 similar polylines").arg(count), 2000);
        }
    });
    auto* actClear = tb->addAction("Clear All");
    connect(actClear, &QAction::triggered, [this]{ 
        auto* c = qobject_cast<CanvasWidget*>(centralWidget()); 
        if(c) {
            c->clear();
            statusBar()->showMessage("Cleared all polylines", 2000);
        }
    });

    auto* canvas = new CanvasWidget(this);
    setCentralWidget(canvas);

    // File menu (first)
    auto* fileMenu = menuBar()->addMenu("File");
    auto* actExport = fileMenu->addAction("Export Scene (JSON+glTF)...");
    connect(actExport, &QAction::triggered, this, &MainWindow::exportSceneAction);
    auto* actExportJson = fileMenu->addAction("Export Scene (JSON only)...");
    connect(actExportJson, &QAction::triggered, [this]{ exportSceneActionImpl(ExportJSON); });
    auto* actExportGltf = fileMenu->addAction("Export Scene (glTF only)...");
    connect(actExportGltf, &QAction::triggered, [this]{ exportSceneActionImpl(ExportGLTF); });
    fileMenu->addSeparator();
    auto* actExportOpt = fileMenu->addAction("Export with Options...");
    connect(actExportOpt, &QAction::triggered, this, &MainWindow::exportWithOptions);

    // Help menu
    auto* helpMenu = menuBar()->addMenu("Help");
    auto* actAbout = helpMenu->addAction("About Core...");
    connect(actAbout, &QAction::triggered, this, &MainWindow::showAboutCore);

    statusBar()->showMessage("Ready | Delete=删单条, Shift+Delete=删同批次/同类, Clear All=清空");
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
    core_vec2 pts[5] = { {0,0},{120,0},{120,80},{0,80},{0,0} };  // 闭合多边形
    int idxCount = 0;
    // 传入完整的5个点（C API内部会处理闭合点）
    if (!core_triangulate_polygon(pts, 5, nullptr, &idxCount) || idxCount <= 0) {
        statusBar()->showMessage("Triangulation failed", 2000);
        return;
    }
    std::vector<unsigned int> indices(idxCount);
    if (!core_triangulate_polygon(pts, 5, indices.data(), &idxCount)) {
        statusBar()->showMessage("Triangulation fill failed", 2000);
        return;
    }
    // Render triangles as selectable polylines on canvas
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget());
    if (!canvas) return;
    
    QVector<QPointF> verts;
    // 使用去掉收尾重复点后的完整顶点集（前4个唯一点）
    for (int i=0; i<4; ++i) verts.push_back(QPointF(pts[i].x, pts[i].y));
    
    // Add each triangle as a selectable polyline; group them for one-shot delete
    int gid = canvas->newGroupId();
    for (int i=0; i+2<idxCount; i+=3) {
        QVector<QPointF> tri;
        tri.push_back(verts[indices[i]]);
        tri.push_back(verts[indices[i+1]]);
        tri.push_back(verts[indices[i+2]]);
        tri.push_back(verts[indices[i]]);  // Close the triangle
        canvas->addPolylineColored(tri, QColor(120,200,120), gid);
    }
    statusBar()->showMessage(QString("Triangulated into %1 triangles").arg(idxCount/3), 2000);
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
    QMap<int, QVector<QVector<QPointF>>> groups;
    for (const auto& pv : canvas->polylinesData()) {
        groups[pv.groupId].push_back(pv.pts);
    }
    QVector<ExportItem> items;
    for (auto it = groups.begin(); it != groups.end(); ++it) {
        ExportItem e; e.groupId = it.key(); e.rings = it.value(); items.push_back(e);
    }
    // Unit scale (TODO: read from Document settings; use 1.0 for now)
    double unitScale = 1.0;
    ExportResult r = exportScene(items, QDir(base), kinds, unitScale);
    if (r.ok) {
        QMessageBox box(this);
        box.setWindowTitle("Export");
        box.setText(QString("Exported to %1\n%2\nFiles:\n%3").arg(r.sceneDir, r.validationReport, r.written.join("\n")));
        QPushButton* openBtn = box.addButton(tr("Open"), QMessageBox::ActionRole);
        QPushButton* copyBtn = box.addButton(tr("Copy Path"), QMessageBox::ActionRole);
        box.addButton(QMessageBox::Ok);
        box.exec();
        if (box.clickedButton() == openBtn) {
            QDesktopServices::openUrl(QUrl::fromLocalFile(r.sceneDir));
        } else if (box.clickedButton() == copyBtn) {
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
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget()); if (!canvas) return;
    int selGid = canvas->selectedGroupId();
    if (!ExportDialog::getExportOptions(this, nullptr, selGid, opts)) return;

    int kinds = 0;
    if (opts.format == "json") kinds |= ExportJSON;
    else if (opts.format == "gltf") kinds |= ExportGLTF;
    else /*unity*/ { kinds |= (ExportJSON|ExportGLTF); }

    // Collect and export
    QString base = QFileDialog::getExistingDirectory(this, "Select export base directory"); if (base.isEmpty()) return;
    QMap<int, QVector<QVector<QPointF>>> groups;
    const bool onlySelected = (opts.range == ExportDialog::SelectedGroupOnly && selGid!=-1);
    for (const auto& pv : canvas->polylinesData()) {
        if (onlySelected && pv.groupId != selGid) continue;
        groups[pv.groupId].push_back(pv.pts);
    }
    QVector<ExportItem> items; for (auto it = groups.begin(); it != groups.end(); ++it) { ExportItem e; e.groupId = it.key(); e.rings = it.value(); items.push_back(e);} 
    // Determine unit scale (use document settings or custom value)
    double unitScale = opts.useDocUnit ? m_document.settings().unit_scale : opts.unitScale;
    if (!opts.useDocUnit) unitScale = opts.unitScale;
    QJsonObject meta; meta["joinType"] = static_cast<int>(opts.joinType); meta["miterLimit"] = opts.miterLimit; meta["unitScale"] = unitScale; meta["useDocUnit"] = opts.useDocUnit;
    ExportResult r = exportScene(items, QDir(base), kinds, unitScale, meta, opts.exportRingRoles);
    if (r.ok) {
        QMessageBox box(this);
        box.setWindowTitle("Export");
        box.setText(QString("Exported to %1\n%2\nFiles:\n%3").arg(r.sceneDir, r.validationReport, r.written.join("\n")));
        QPushButton* openBtn = box.addButton(tr("Open"), QMessageBox::ActionRole);
        QPushButton* copyBtn = box.addButton(tr("Copy Path"), QMessageBox::ActionRole);
        box.addButton(QMessageBox::Ok);
        box.exec();
        if (box.clickedButton() == openBtn) {
            QDesktopServices::openUrl(QUrl::fromLocalFile(r.sceneDir));
        } else if (box.clickedButton() == copyBtn) {
            QApplication::clipboard()->setText(r.sceneDir);
            statusBar()->showMessage("Export path copied", 2000);
        }
    } else {
        QMessageBox::warning(this, "Export", QString("Export failed: %1").arg(r.error));
    }
}
