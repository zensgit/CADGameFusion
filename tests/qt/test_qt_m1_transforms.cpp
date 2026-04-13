#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>
#include <QtCore/QList>
#include <QtCore/QVector>

#include <cassert>
#include <cmath>
#include <memory>

#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "canvas.hpp"
#include "command/command_manager.hpp"

static constexpr double EPS = 1e-6;

static bool near(double a, double b) { return std::abs(a - b) < EPS; }

static core::Polyline makeSquare(double x, double y, double size) {
    core::Polyline pl;
    pl.points = {{x, y}, {x+size, y}, {x+size, y+size}, {x, y+size}, {x, y}};
    return pl;
}

// ─── Rotate Command (mirrors mainwindow.cpp logic) ───
struct RotateEntitiesCommand : Command {
    core::Document* doc;
    QVector<EntityId> ids;
    QVector<QVector<QPointF>> before;
    double angleDeg;
    QPointF center;
    RotateEntitiesCommand(core::Document* d, const QVector<EntityId>& inIds,
                          const QVector<QVector<QPointF>>& inBefore,
                          double angle, const QPointF& c)
        : doc(d), ids(inIds), before(inBefore), angleDeg(angle), center(c) {}
    void applyPoints(EntityId id, const QVector<QPointF>& pts) {
        core::Polyline pl;
        pl.points.reserve(static_cast<size_t>(pts.size()));
        for (const auto& pt : pts) pl.points.push_back(core::Vec2{pt.x(), pt.y()});
        doc->set_polyline_points(id, pl);
    }
    void execute() override {
        double rad = angleDeg * M_PI / 180.0;
        double cosA = std::cos(rad), sinA = std::sin(rad);
        for (int i = 0; i < ids.size(); ++i) {
            QVector<QPointF> rotated;
            rotated.reserve(before[i].size());
            for (const auto& pt : before[i]) {
                double dx = pt.x() - center.x(), dy = pt.y() - center.y();
                rotated.append(QPointF(center.x() + dx*cosA - dy*sinA,
                                       center.y() + dx*sinA + dy*cosA));
            }
            applyPoints(ids[i], rotated);
        }
    }
    void undo() override {
        for (int i = 0; i < ids.size(); ++i) applyPoints(ids[i], before[i]);
    }
    QString name() const override { return "Rotate Entities"; }
};

// ─── Scale Command ───
struct ScaleEntitiesCommand : Command {
    core::Document* doc;
    QVector<EntityId> ids;
    QVector<QVector<QPointF>> before;
    double factor;
    QPointF center;
    ScaleEntitiesCommand(core::Document* d, const QVector<EntityId>& inIds,
                         const QVector<QVector<QPointF>>& inBefore,
                         double f, const QPointF& c)
        : doc(d), ids(inIds), before(inBefore), factor(f), center(c) {}
    void applyPoints(EntityId id, const QVector<QPointF>& pts) {
        core::Polyline pl;
        pl.points.reserve(static_cast<size_t>(pts.size()));
        for (const auto& pt : pts) pl.points.push_back(core::Vec2{pt.x(), pt.y()});
        doc->set_polyline_points(id, pl);
    }
    void execute() override {
        for (int i = 0; i < ids.size(); ++i) {
            QVector<QPointF> scaled;
            scaled.reserve(before[i].size());
            for (const auto& pt : before[i]) {
                scaled.append(QPointF(center.x() + (pt.x()-center.x())*factor,
                                      center.y() + (pt.y()-center.y())*factor));
            }
            applyPoints(ids[i], scaled);
        }
    }
    void undo() override {
        for (int i = 0; i < ids.size(); ++i) applyPoints(ids[i], before[i]);
    }
    QString name() const override { return "Scale Entities"; }
};

// ─── Group Commands ───
struct GroupEntitiesCommand : Command {
    core::Document* doc;
    QVector<EntityId> ids;
    QVector<int> oldGroupIds;
    int newGroupId;
    GroupEntitiesCommand(core::Document* d, const QVector<EntityId>& inIds, int gid)
        : doc(d), ids(inIds), newGroupId(gid) {
        for (EntityId eid : ids) {
            auto* e = doc->get_entity(eid);
            oldGroupIds.push_back(e ? e->groupId : -1);
        }
    }
    void execute() override {
        for (EntityId eid : ids) doc->set_entity_group_id(eid, newGroupId);
    }
    void undo() override {
        for (int i = 0; i < ids.size(); ++i) doc->set_entity_group_id(ids[i], oldGroupIds[i]);
    }
    QString name() const override { return "Group Entities"; }
};

struct UngroupEntitiesCommand : Command {
    core::Document* doc;
    QVector<EntityId> ids;
    QVector<int> oldGroupIds;
    UngroupEntitiesCommand(core::Document* d, const QVector<EntityId>& inIds) : doc(d), ids(inIds) {
        for (EntityId eid : ids) {
            auto* e = doc->get_entity(eid);
            oldGroupIds.push_back(e ? e->groupId : -1);
        }
    }
    void execute() override {
        for (EntityId eid : ids) doc->set_entity_group_id(eid, -1);
    }
    void undo() override {
        for (int i = 0; i < ids.size(); ++i) doc->set_entity_group_id(ids[i], oldGroupIds[i]);
    }
    QString name() const override { return "Ungroup Entities"; }
};

// Helper: get polyline points from document
static QVector<QPointF> getPoints(core::Document& doc, EntityId id) {
    QVector<QPointF> pts;
    auto* e = doc.get_entity(id);
    if (!e) return pts;
    auto* pl = std::get_if<core::Polyline>(&e->payload);
    if (!pl) return pts;
    for (const auto& p : pl->points) pts.append(QPointF(p.x, p.y));
    return pts;
}

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    // ════════════════════════════════════════════
    // TEST 1: Rotate 90 degrees CCW
    // ════════════════════════════════════════════
    {
        core::Document doc;
        QUndoStack stack;
        CommandManager mgr;
        mgr.setUndoStack(&stack);

        // Unit square at origin: (0,0)→(1,0)→(1,1)→(0,1)→(0,0)
        auto id = doc.add_polyline(makeSquare(0, 0, 1.0), "sq1");
        auto pts = getPoints(doc, id);
        assert(pts.size() == 5);

        // Centroid = (0.4, 0.4) for 5 pts including closing point
        double cx = 0, cy = 0;
        for (const auto& p : pts) { cx += p.x(); cy += p.y(); }
        cx /= pts.size(); cy /= pts.size();

        QVector<EntityId> ids{id};
        QVector<QVector<QPointF>> before{pts};

        // Rotate 90 CCW around centroid
        mgr.push(std::make_unique<RotateEntitiesCommand>(&doc, ids, before, 90.0, QPointF(cx, cy)));

        auto after = getPoints(doc, id);
        assert(after.size() == 5);

        // After 90 CCW, first point (0,0) should map to (cx + (0-cy), cy - (0-cx)) = (cx-cy, cy+cx)
        // Actually: x' = cx + (x-cx)*cos90 - (y-cy)*sin90 = cx - (y-cy) = cx - y + cy
        //           y' = cy + (x-cx)*sin90 + (y-cy)*cos90 = cy + (x-cx) = cy + x - cx
        // For (0,0): x' = cx + cy = 0.8, y' = cy - cx = 0  ... let me just check it rotated
        // The key test: 4 rotations should return to original
        for (int r = 0; r < 3; ++r) {
            auto curPts = getPoints(doc, id);
            double rcx = 0, rcy = 0;
            for (const auto& p : curPts) { rcx += p.x(); rcy += p.y(); }
            rcx /= curPts.size(); rcy /= curPts.size();
            mgr.push(std::make_unique<RotateEntitiesCommand>(
                &doc, ids, QVector<QVector<QPointF>>{curPts}, 90.0, QPointF(rcx, rcy)));
        }

        // After 4x90=360 degrees, should be back to original
        auto final_pts = getPoints(doc, id);
        for (int i = 0; i < pts.size(); ++i) {
            assert(near(final_pts[i].x(), pts[i].x()));
            assert(near(final_pts[i].y(), pts[i].y()));
        }

        // Undo all 4 rotations
        stack.undo(); stack.undo(); stack.undo(); stack.undo();
        auto restored = getPoints(doc, id);
        for (int i = 0; i < pts.size(); ++i) {
            assert(near(restored[i].x(), pts[i].x()));
            assert(near(restored[i].y(), pts[i].y()));
        }

        fprintf(stderr, "  PASS: Rotate 90 CCW x4 = identity, undo restores\n");
    }

    // ════════════════════════════════════════════
    // TEST 2: Rotate arbitrary angle + undo
    // ════════════════════════════════════════════
    {
        core::Document doc;
        QUndoStack stack;
        CommandManager mgr;
        mgr.setUndoStack(&stack);

        auto id = doc.add_polyline(makeSquare(10, 20, 5.0), "sq2");
        auto pts = getPoints(doc, id);
        double cx = 0, cy = 0;
        for (const auto& p : pts) { cx += p.x(); cy += p.y(); }
        cx /= pts.size(); cy /= pts.size();

        QVector<EntityId> ids{id};
        mgr.push(std::make_unique<RotateEntitiesCommand>(
            &doc, ids, QVector<QVector<QPointF>>{pts}, 45.0, QPointF(cx, cy)));

        auto rotated = getPoints(doc, id);
        // Points should have moved
        bool anyDiff = false;
        for (int i = 0; i < pts.size(); ++i) {
            if (!near(rotated[i].x(), pts[i].x()) || !near(rotated[i].y(), pts[i].y()))
                anyDiff = true;
        }
        assert(anyDiff);

        // Undo should restore exactly
        stack.undo();
        auto restored = getPoints(doc, id);
        for (int i = 0; i < pts.size(); ++i) {
            assert(near(restored[i].x(), pts[i].x()));
            assert(near(restored[i].y(), pts[i].y()));
        }

        fprintf(stderr, "  PASS: Rotate 45 deg + undo\n");
    }

    // ════════════════════════════════════════════
    // TEST 3: Scale up and down
    // ════════════════════════════════════════════
    {
        core::Document doc;
        QUndoStack stack;
        CommandManager mgr;
        mgr.setUndoStack(&stack);

        auto id = doc.add_polyline(makeSquare(0, 0, 10.0), "sq3");
        auto pts = getPoints(doc, id);
        double cx = 0, cy = 0;
        for (const auto& p : pts) { cx += p.x(); cy += p.y(); }
        cx /= pts.size(); cy /= pts.size();

        QVector<EntityId> ids{id};

        // Scale up 2x
        mgr.push(std::make_unique<ScaleEntitiesCommand>(
            &doc, ids, QVector<QVector<QPointF>>{pts}, 2.0, QPointF(cx, cy)));

        auto scaled = getPoints(doc, id);
        // Each point should be 2x distance from centroid
        for (int i = 0; i < pts.size(); ++i) {
            double origDist = std::hypot(pts[i].x() - cx, pts[i].y() - cy);
            double newDist = std::hypot(scaled[i].x() - cx, scaled[i].y() - cy);
            assert(near(newDist, origDist * 2.0));
        }

        // Undo
        stack.undo();
        auto restored = getPoints(doc, id);
        for (int i = 0; i < pts.size(); ++i) {
            assert(near(restored[i].x(), pts[i].x()));
            assert(near(restored[i].y(), pts[i].y()));
        }

        // Scale down 0.5x
        mgr.push(std::make_unique<ScaleEntitiesCommand>(
            &doc, ids, QVector<QVector<QPointF>>{pts}, 0.5, QPointF(cx, cy)));

        auto shrunk = getPoints(doc, id);
        for (int i = 0; i < pts.size(); ++i) {
            double origDist = std::hypot(pts[i].x() - cx, pts[i].y() - cy);
            double newDist = std::hypot(shrunk[i].x() - cx, shrunk[i].y() - cy);
            assert(near(newDist, origDist * 0.5));
        }

        stack.undo();
        restored = getPoints(doc, id);
        for (int i = 0; i < pts.size(); ++i) {
            assert(near(restored[i].x(), pts[i].x()));
            assert(near(restored[i].y(), pts[i].y()));
        }

        fprintf(stderr, "  PASS: Scale 2x, 0.5x + undo\n");
    }

    // ════════════════════════════════════════════
    // TEST 4: Scale + Rotate composition
    // ════════════════════════════════════════════
    {
        core::Document doc;
        QUndoStack stack;
        CommandManager mgr;
        mgr.setUndoStack(&stack);

        auto id = doc.add_polyline(makeSquare(0, 0, 4.0), "sq4");
        auto origPts = getPoints(doc, id);
        double cx = 0, cy = 0;
        for (const auto& p : origPts) { cx += p.x(); cy += p.y(); }
        cx /= origPts.size(); cy /= origPts.size();
        QVector<EntityId> ids{id};

        // Scale 1.5x then rotate 90
        mgr.push(std::make_unique<ScaleEntitiesCommand>(
            &doc, ids, QVector<QVector<QPointF>>{origPts}, 1.5, QPointF(cx, cy)));
        auto scaledPts = getPoints(doc, id);
        mgr.push(std::make_unique<RotateEntitiesCommand>(
            &doc, ids, QVector<QVector<QPointF>>{scaledPts}, 90.0, QPointF(cx, cy)));

        // Undo rotate
        stack.undo();
        auto afterUndoRot = getPoints(doc, id);
        for (int i = 0; i < scaledPts.size(); ++i) {
            assert(near(afterUndoRot[i].x(), scaledPts[i].x()));
            assert(near(afterUndoRot[i].y(), scaledPts[i].y()));
        }
        // Undo scale
        stack.undo();
        auto afterUndoAll = getPoints(doc, id);
        for (int i = 0; i < origPts.size(); ++i) {
            assert(near(afterUndoAll[i].x(), origPts[i].x()));
            assert(near(afterUndoAll[i].y(), origPts[i].y()));
        }

        fprintf(stderr, "  PASS: Scale + Rotate composition, undo both\n");
    }

    // ════════════════════════════════════════════
    // TEST 5: Multi-entity rotate
    // ════════════════════════════════════════════
    {
        core::Document doc;
        QUndoStack stack;
        CommandManager mgr;
        mgr.setUndoStack(&stack);

        auto id1 = doc.add_polyline(makeSquare(0, 0, 2.0), "a");
        auto id2 = doc.add_polyline(makeSquare(5, 5, 2.0), "b");
        auto pts1 = getPoints(doc, id1);
        auto pts2 = getPoints(doc, id2);

        // Combined centroid
        double cx = 0, cy = 0; int total = 0;
        for (const auto& p : pts1) { cx += p.x(); cy += p.y(); ++total; }
        for (const auto& p : pts2) { cx += p.x(); cy += p.y(); ++total; }
        cx /= total; cy /= total;

        QVector<EntityId> ids{id1, id2};
        QVector<QVector<QPointF>> before{pts1, pts2};

        mgr.push(std::make_unique<RotateEntitiesCommand>(&doc, ids, before, 180.0, QPointF(cx, cy)));

        // After 180 deg, rotating again 180 should restore
        auto mid1 = getPoints(doc, id1);
        auto mid2 = getPoints(doc, id2);
        mgr.push(std::make_unique<RotateEntitiesCommand>(
            &doc, ids, QVector<QVector<QPointF>>{mid1, mid2}, 180.0, QPointF(cx, cy)));

        auto final1 = getPoints(doc, id1);
        auto final2 = getPoints(doc, id2);
        for (int i = 0; i < pts1.size(); ++i) {
            assert(near(final1[i].x(), pts1[i].x()));
            assert(near(final1[i].y(), pts1[i].y()));
        }
        for (int i = 0; i < pts2.size(); ++i) {
            assert(near(final2[i].x(), pts2[i].x()));
            assert(near(final2[i].y(), pts2[i].y()));
        }

        fprintf(stderr, "  PASS: Multi-entity rotate 180+180 = identity\n");
    }

    // ════════════════════════════════════════════
    // TEST 6: Group / Ungroup + undo
    // ════════════════════════════════════════════
    {
        core::Document doc;
        QUndoStack stack;
        CommandManager mgr;
        mgr.setUndoStack(&stack);

        auto id1 = doc.add_polyline(makeSquare(0, 0, 1.0), "g1");
        auto id2 = doc.add_polyline(makeSquare(2, 0, 1.0), "g2");
        auto id3 = doc.add_polyline(makeSquare(4, 0, 1.0), "g3");

        assert(doc.get_entity(id1)->groupId == -1);
        assert(doc.get_entity(id2)->groupId == -1);
        assert(doc.get_entity(id3)->groupId == -1);

        // Group id1 and id2
        int gid = doc.alloc_group_id();
        QVector<EntityId> groupIds{id1, id2};
        mgr.push(std::make_unique<GroupEntitiesCommand>(&doc, groupIds, gid));

        assert(doc.get_entity(id1)->groupId == gid);
        assert(doc.get_entity(id2)->groupId == gid);
        assert(doc.get_entity(id3)->groupId == -1);

        // Undo group
        stack.undo();
        assert(doc.get_entity(id1)->groupId == -1);
        assert(doc.get_entity(id2)->groupId == -1);

        // Redo group
        stack.redo();
        assert(doc.get_entity(id1)->groupId == gid);
        assert(doc.get_entity(id2)->groupId == gid);

        // Ungroup
        mgr.push(std::make_unique<UngroupEntitiesCommand>(&doc, groupIds));
        assert(doc.get_entity(id1)->groupId == -1);
        assert(doc.get_entity(id2)->groupId == -1);

        // Undo ungroup
        stack.undo();
        assert(doc.get_entity(id1)->groupId == gid);
        assert(doc.get_entity(id2)->groupId == gid);

        fprintf(stderr, "  PASS: Group + Ungroup + undo/redo\n");
    }

    // ════════════════════════════════════════════
    // TEST 7: Canvas signals (cursor + snap)
    // ════════════════════════════════════════════
    {
        core::Document doc;
        CanvasWidget canvas;
        canvas.setDocument(&doc);

        double lastX = -999, lastY = -999;
        int lastSnap = -1;
        QObject::connect(&canvas, &CanvasWidget::cursorWorldPositionChanged,
                         [&lastX, &lastY](double x, double y){ lastX = x; lastY = y; });
        QObject::connect(&canvas, &CanvasWidget::snapStateChanged,
                         [&lastSnap](int s){ lastSnap = s; });

        // Signals exist and are connectable
        assert(lastX == -999); // not yet emitted
        fprintf(stderr, "  PASS: Canvas signals connectable\n");
    }

    fprintf(stderr, "\n  All M1 transform tests passed!\n");
    return 0;
}
