#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>
#include <QtCore/QDir>
#include <QtCore/QFile>
#include <QtCore/QJsonArray>
#include <QtCore/QJsonDocument>
#include <QtCore/QJsonObject>
#include <QtCore/QList>
#include <QtCore/QTemporaryDir>
#include <QtCore/QVector>

#include <cassert>
#include <cmath>
#include <memory>

#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "command/command_manager.hpp"
#include "export/export_helpers.hpp"
#include "exporter.hpp"

static constexpr double EPS = 1e-6;
static bool near(double a, double b) { return std::abs(a - b) < EPS; }

// ─── Command structs (same as mainwindow.cpp / test_qt_m1_transforms.cpp) ───

struct RotateCmd : Command {
    core::Document* doc;
    QVector<core::EntityId> ids;
    QVector<QVector<QPointF>> before;
    double angleDeg;
    QPointF center;
    RotateCmd(core::Document* d, const QVector<core::EntityId>& i,
              const QVector<QVector<QPointF>>& b, double a, QPointF c)
        : doc(d), ids(i), before(b), angleDeg(a), center(c) {}
    void apply(core::EntityId id, const QVector<QPointF>& pts) {
        core::Polyline pl;
        for (const auto& p : pts) pl.points.push_back({p.x(), p.y()});
        doc->set_polyline_points(id, pl);
    }
    void execute() override {
        double rad = angleDeg * M_PI / 180.0;
        double c_ = std::cos(rad), s_ = std::sin(rad);
        for (int i = 0; i < ids.size(); ++i) {
            QVector<QPointF> r;
            for (const auto& p : before[i]) {
                double dx = p.x() - center.x(), dy = p.y() - center.y();
                r.append(QPointF(center.x() + dx*c_ - dy*s_, center.y() + dx*s_ + dy*c_));
            }
            apply(ids[i], r);
        }
    }
    void undo() override { for (int i = 0; i < ids.size(); ++i) apply(ids[i], before[i]); }
    QString name() const override { return "Rotate"; }
};

struct ScaleCmd : Command {
    core::Document* doc;
    QVector<core::EntityId> ids;
    QVector<QVector<QPointF>> before;
    double factor;
    QPointF center;
    ScaleCmd(core::Document* d, const QVector<core::EntityId>& i,
             const QVector<QVector<QPointF>>& b, double f, QPointF c)
        : doc(d), ids(i), before(b), factor(f), center(c) {}
    void apply(core::EntityId id, const QVector<QPointF>& pts) {
        core::Polyline pl;
        for (const auto& p : pts) pl.points.push_back({p.x(), p.y()});
        doc->set_polyline_points(id, pl);
    }
    void execute() override {
        for (int i = 0; i < ids.size(); ++i) {
            QVector<QPointF> s;
            for (const auto& p : before[i])
                s.append(QPointF(center.x() + (p.x()-center.x())*factor,
                                 center.y() + (p.y()-center.y())*factor));
            apply(ids[i], s);
        }
    }
    void undo() override { for (int i = 0; i < ids.size(); ++i) apply(ids[i], before[i]); }
    QString name() const override { return "Scale"; }
};

struct GroupCmd : Command {
    core::Document* doc;
    QVector<core::EntityId> ids;
    QVector<int> old;
    int gid;
    GroupCmd(core::Document* d, const QVector<core::EntityId>& i, int g)
        : doc(d), ids(i), gid(g) {
        for (auto eid : ids) { auto* e = doc->get_entity(eid); old.push_back(e ? e->groupId : -1); }
    }
    void execute() override { for (auto eid : ids) doc->set_entity_group_id(eid, gid); }
    void undo() override { for (int i = 0; i < ids.size(); ++i) doc->set_entity_group_id(ids[i], old[i]); }
    QString name() const override { return "Group"; }
};

// ─── Helpers ───

static QVector<QPointF> getPoints(core::Document& doc, core::EntityId id) {
    QVector<QPointF> pts;
    auto* e = doc.get_entity(id);
    if (!e) return pts;
    auto* pl = std::get_if<core::Polyline>(&e->payload);
    if (!pl) return pts;
    for (const auto& p : pl->points) pts.append(QPointF(p.x, p.y));
    return pts;
}

static void centroid(const QVector<QPointF>& pts, double& cx, double& cy) {
    cx = 0; cy = 0;
    for (const auto& p : pts) { cx += p.x(); cy += p.y(); }
    if (!pts.isEmpty()) { cx /= pts.size(); cy /= pts.size(); }
}

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    core::Document doc;
    QUndoStack stack;
    CommandManager mgr;
    mgr.setUndoStack(&stack);

    // ═══════════════════════════════════════
    // Step 1: Create 3 entities
    // ═══════════════════════════════════════
    core::Polyline triangle;
    triangle.points = {{0,0}, {4,0}, {2,3}, {0,0}};
    auto triId = doc.add_polyline(triangle, "triangle");

    core::Polyline square;
    square.points = {{10,10}, {14,10}, {14,14}, {10,14}, {10,10}};
    auto sqId = doc.add_polyline(square, "square");

    core::Polyline lshape;
    lshape.points = {{20,0}, {24,0}, {24,2}, {22,2}, {22,4}, {20,4}, {20,0}};
    auto lId = doc.add_polyline(lshape, "lshape");

    assert(triId > 0 && sqId > 0 && lId > 0);
    auto origTriPts = getPoints(doc, triId);
    auto origSqPts = getPoints(doc, sqId);
    auto origLPts = getPoints(doc, lId);
    fprintf(stderr, "  Step 1 PASS: created 3 entities\n");

    // ═══════════════════════════════════════
    // Step 2: Rotate square 45°
    // ═══════════════════════════════════════
    {
        auto pts = getPoints(doc, sqId);
        double cx, cy; centroid(pts, cx, cy);
        mgr.push(std::make_unique<RotateCmd>(&doc, QVector<core::EntityId>{sqId},
                 QVector<QVector<QPointF>>{pts}, 45.0, QPointF(cx, cy)));

        auto rotPts = getPoints(doc, sqId);
        // Distance from centroid should be preserved
        for (int i = 0; i < pts.size(); ++i) {
            double dOrig = std::hypot(pts[i].x() - cx, pts[i].y() - cy);
            double dRot = std::hypot(rotPts[i].x() - cx, rotPts[i].y() - cy);
            assert(near(dOrig, dRot));
        }
        // Points should have moved
        bool moved = false;
        for (int i = 0; i < pts.size(); ++i)
            if (!near(pts[i].x(), rotPts[i].x()) || !near(pts[i].y(), rotPts[i].y())) moved = true;
        assert(moved);
    }
    fprintf(stderr, "  Step 2 PASS: square rotated 45 deg, distances preserved\n");

    // ═══════════════════════════════════════
    // Step 3: Scale triangle 2x
    // ═══════════════════════════════════════
    {
        auto pts = getPoints(doc, triId);
        double cx, cy; centroid(pts, cx, cy);
        mgr.push(std::make_unique<ScaleCmd>(&doc, QVector<core::EntityId>{triId},
                 QVector<QVector<QPointF>>{pts}, 2.0, QPointF(cx, cy)));

        auto scalePts = getPoints(doc, triId);
        for (int i = 0; i < pts.size(); ++i) {
            double dOrig = std::hypot(pts[i].x() - cx, pts[i].y() - cy);
            double dScale = std::hypot(scalePts[i].x() - cx, scalePts[i].y() - cy);
            assert(near(dScale, dOrig * 2.0));
        }
    }
    fprintf(stderr, "  Step 3 PASS: triangle scaled 2x, distances doubled\n");

    // ═══════════════════════════════════════
    // Step 4: Group square + triangle
    // ═══════════════════════════════════════
    int gid = doc.alloc_group_id();
    mgr.push(std::make_unique<GroupCmd>(&doc, QVector<core::EntityId>{sqId, triId}, gid));
    assert(doc.get_entity(sqId)->groupId == gid);
    assert(doc.get_entity(triId)->groupId == gid);
    assert(doc.get_entity(lId)->groupId == -1);
    fprintf(stderr, "  Step 4 PASS: square+triangle grouped, L-shape independent\n");

    // ═══════════════════════════════════════
    // Step 5: Export to JSON + verify
    // ═══════════════════════════════════════
    {
        auto items = export_helpers::collectExportItems(doc);
        assert(items.size() >= 2); // at least grouped + ungrouped

        // Find grouped and ungrouped items
        bool foundGrouped = false, foundUngrouped = false;
        for (const auto& item : items) {
            if (item.groupId == gid) foundGrouped = true;
            if (item.groupId == -1) foundUngrouped = true;
        }
        assert(foundGrouped);  // square + triangle group
        assert(foundUngrouped); // L-shape

        // Export to temp directory
        QTemporaryDir tmpDir;
        assert(tmpDir.isValid());
        auto result = exportScene(items, QDir(tmpDir.path()), ExportJSON, 1.0);
        assert(result.ok);
        assert(!result.written.isEmpty());

        // Read back a JSON file and verify structure
        bool jsonVerified = false;
        for (const auto& path : result.written) {
            if (!path.endsWith(".json")) continue;
            QFile f(path);
            if (!f.open(QIODevice::ReadOnly)) continue;
            auto jdoc = QJsonDocument::fromJson(f.readAll());
            assert(!jdoc.isNull());
            auto obj = jdoc.object();
            assert(obj.contains("flat_pts"));
            assert(obj.contains("ring_counts"));
            auto flatPts = obj["flat_pts"].toArray();
            assert(flatPts.size() > 0);
            auto ringCounts = obj["ring_counts"].toArray();
            assert(ringCounts.size() > 0);
            jsonVerified = true;
            break;
        }
        assert(jsonVerified);
    }
    fprintf(stderr, "  Step 5 PASS: JSON export verified (flat_pts, ring_counts)\n");

    // ═══════════════════════════════════════
    // Step 6: Undo all → verify restore
    // ═══════════════════════════════════════
    stack.undo(); // undo group
    assert(doc.get_entity(sqId)->groupId == -1);
    assert(doc.get_entity(triId)->groupId == -1);

    stack.undo(); // undo scale
    auto restoredTriPts = getPoints(doc, triId);
    for (int i = 0; i < origTriPts.size(); ++i) {
        assert(near(restoredTriPts[i].x(), origTriPts[i].x()));
        assert(near(restoredTriPts[i].y(), origTriPts[i].y()));
    }

    stack.undo(); // undo rotate
    auto restoredSqPts = getPoints(doc, sqId);
    for (int i = 0; i < origSqPts.size(); ++i) {
        assert(near(restoredSqPts[i].x(), origSqPts[i].x()));
        assert(near(restoredSqPts[i].y(), origSqPts[i].y()));
    }

    // L-shape should be unchanged throughout
    auto lPts = getPoints(doc, lId);
    for (int i = 0; i < origLPts.size(); ++i) {
        assert(near(lPts[i].x(), origLPts[i].x()));
        assert(near(lPts[i].y(), origLPts[i].y()));
    }
    fprintf(stderr, "  Step 6 PASS: full undo restores all entities to original\n");

    fprintf(stderr, "\n  All M1 E2E tests passed!\n");
    return 0;
}
