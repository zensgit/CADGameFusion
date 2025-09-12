#include "mainwindow.hpp"

#include <QAction>
#include <QListWidget>
#include <QMenuBar>
#include <QStatusBar>
#include <QToolBar>

#include "core/core_c_api.h"
#include "canvas.hpp"

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
    auto* actDel = tb->addAction("Delete");
    connect(actDel, &QAction::triggered, [this]{ auto* c = qobject_cast<CanvasWidget*>(centralWidget()); if(c) c->removeSelected(); });

    auto* canvas = new CanvasWidget(this);
    setCentralWidget(canvas);

    statusBar()->showMessage("Ready");
}

void MainWindow::addSamplePolyline() {
    core_document* doc = core_document_create();
    core_vec2 pts[5] = { {0,0},{100,0},{100,100},{0,100},{0,0} };
    auto id = core_document_add_polyline(doc, pts, 5);
    core_document_destroy(doc);
    QVector<QPointF> poly;
    for (auto& p : pts) poly.push_back(QPointF(p.x, p.y));
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget());
    if (canvas) canvas->addPolyline(poly);
    statusBar()->showMessage(QString("Added polyline id=%1").arg(static_cast<qulonglong>(id)), 2000);
}

void MainWindow::triangulateSample() {
    core_vec2 pts[5] = { {0,0},{120,0},{120,80},{0,80},{0,0} };
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
    // Render as triangle wireframe on canvas
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget());
    if (!canvas) return;
    QVector<QPointF> verts;
    // use all unique vertices (exclude closing point)
    for (int i=0;i<4; ++i) verts.push_back(QPointF(pts[i].x, pts[i].y));
    QVector<unsigned int> inds;
    inds.reserve(idxCount);
    for (auto id : indices) inds.push_back(id);
    canvas->addTriMesh(verts, inds);
}

void MainWindow::demoBoolean() {
    // simple union of two overlapping boxes
    std::vector<core_vec2> a{{0,0},{100,0},{100,100},{0,100},{0,0}};
    std::vector<core_vec2> b{{50,50},{150,50},{150,150},{50,150},{50,50}};
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
    for (int i=0;i<poly_count;i++) {
        QVector<QPointF> poly;
        for (int j=0;j<counts[i];j++) poly.push_back(QPointF(out_pts[off+j].x, out_pts[off+j].y));
        off += counts[i];
        const QColor col = (i%2==0) ? QColor(100,200,255) : QColor(255,180,120);
        canvas->addPolylineColored(poly, col);
    }
}

void MainWindow::demoOffset() {
    std::vector<core_vec2> a{{0,0},{100,0},{100,100},{0,100},{0,0}};
    int poly_count=0,total_pts=0;
    int ok = core_offset_single(a.data(), (int)a.size(), 10.0, nullptr, nullptr, &poly_count, &total_pts);
    if (!ok || poly_count<=0) { statusBar()->showMessage("Offset empty (maybe no CLIPPER2)",2000); return; }
    std::vector<core_vec2> out_pts(total_pts);
    std::vector<int> counts(poly_count);
    core_offset_single(a.data(), (int)a.size(), 10.0, out_pts.data(), counts.data(), &poly_count, &total_pts);
    auto* canvas = qobject_cast<CanvasWidget*>(centralWidget());
    if (!canvas) return;
    int off=0;
    for (int i=0;i<poly_count;i++) {
        QVector<QPointF> poly;
        for (int j=0;j<counts[i];j++) poly.push_back(QPointF(out_pts[off+j].x, out_pts[off+j].y));
        off += counts[i];
        canvas->addPolylineColored(poly, QColor(180,255,120));
    }
}
