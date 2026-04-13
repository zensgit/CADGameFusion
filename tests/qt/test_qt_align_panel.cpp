#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>

#include <cassert>
#include <cmath>
#include <algorithm>
#include <memory>

#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "command/command_manager.hpp"

static constexpr double EPS = 1e-6;
static bool near(double a, double b) { return std::abs(a - b) < EPS; }

using EntityId = uint64_t;

// Simplified AlignEntitiesCommand (same logic as mainwindow.cpp)
struct AlignCmd : Command {
    core::Document* doc;
    QVector<EntityId> ids;
    QVector<QVector<QPointF>> before;
    int alignType;
    AlignCmd(core::Document* d, const QVector<EntityId>& i, const QVector<QVector<QPointF>>& b, int at)
        : doc(d), ids(i), before(b), alignType(at) {}
    void apply(EntityId id, const QVector<QPointF>& pts) {
        core::Polyline pl;
        for (const auto& p : pts) pl.points.push_back({p.x(), p.y()});
        doc->set_polyline_points(id, pl);
    }
    void execute() override {
        double gMinX=1e18, gMinY=1e18, gMaxX=-1e18, gMaxY=-1e18;
        for (const auto& pts : before)
            for (const auto& p : pts) {
                if (p.x()<gMinX) gMinX=p.x(); if (p.y()<gMinY) gMinY=p.y();
                if (p.x()>gMaxX) gMaxX=p.x(); if (p.y()>gMaxY) gMaxY=p.y();
            }
        for (int i = 0; i < ids.size(); ++i) {
            double eMinX=1e18, eMinY=1e18, eMaxX=-1e18, eMaxY=-1e18;
            for (const auto& p : before[i]) {
                if (p.x()<eMinX) eMinX=p.x(); if (p.y()<eMinY) eMinY=p.y();
                if (p.x()>eMaxX) eMaxX=p.x(); if (p.y()>eMaxY) eMaxY=p.y();
            }
            double dx=0, dy=0;
            switch(alignType) {
                case 0: dx = gMinX - eMinX; break;
                case 1: dx = (gMinX+gMaxX)/2 - (eMinX+eMaxX)/2; break;
                case 2: dx = gMaxX - eMaxX; break;
                case 3: dy = gMinY - eMinY; break;
                case 4: dy = (gMinY+gMaxY)/2 - (eMinY+eMaxY)/2; break;
                case 5: dy = gMaxY - eMaxY; break;
            }
            QVector<QPointF> moved;
            for (const auto& p : before[i]) moved.append(p + QPointF(dx, dy));
            apply(ids[i], moved);
        }
    }
    void undo() override { for (int i = 0; i < ids.size(); ++i) apply(ids[i], before[i]); }
    QString name() const override { return "Align"; }
};

struct DistCmd : Command {
    core::Document* doc;
    QVector<EntityId> ids;
    QVector<QVector<QPointF>> before;
    int axis;
    DistCmd(core::Document* d, const QVector<EntityId>& i, const QVector<QVector<QPointF>>& b, int a)
        : doc(d), ids(i), before(b), axis(a) {}
    void apply(EntityId id, const QVector<QPointF>& pts) {
        core::Polyline pl;
        for (const auto& p : pts) pl.points.push_back({p.x(), p.y()});
        doc->set_polyline_points(id, pl);
    }
    void execute() override {
        QVector<QPair<double, int>> centers;
        for (int i = 0; i < before.size(); ++i) {
            double lo=1e18, hi=-1e18;
            for (const auto& p : before[i]) {
                double v = (axis==0) ? p.x() : p.y();
                if (v<lo) lo=v; if (v>hi) hi=v;
            }
            centers.append({(lo+hi)/2, i});
        }
        std::sort(centers.begin(), centers.end(),
                  [](const QPair<double,int>& a, const QPair<double,int>& b){ return a.first < b.first; });
        double first = centers.first().first;
        double last = centers.last().first;
        double step = (last - first) / (centers.size() - 1);
        for (int ci = 1; ci < centers.size()-1; ++ci) {
            int idx = centers[ci].second;
            double target = first + step * ci;
            double delta = target - centers[ci].first;
            QVector<QPointF> moved;
            for (const auto& p : before[idx]) {
                if (axis==0) moved.append(p + QPointF(delta, 0));
                else moved.append(p + QPointF(0, delta));
            }
            apply(ids[idx], moved);
        }
    }
    void undo() override { for (int i = 0; i < ids.size(); ++i) apply(ids[i], before[i]); }
    QString name() const override { return "Distribute"; }
};

static QVector<QPointF> getPoints(core::Document& doc, core::EntityId id) {
    QVector<QPointF> pts;
    auto* e = doc.get_entity(id);
    if (!e) return pts;
    auto* pl = std::get_if<core::Polyline>(&e->payload);
    if (!pl) return pts;
    for (const auto& p : pl->points) pts.append(QPointF(p.x, p.y));
    return pts;
}

static double minX(const QVector<QPointF>& pts) {
    double m = 1e18; for (auto& p : pts) if (p.x()<m) m=p.x(); return m;
}
static double maxX(const QVector<QPointF>& pts) {
    double m = -1e18; for (auto& p : pts) if (p.x()>m) m=p.x(); return m;
}
static double centerX(const QVector<QPointF>& pts) { return (minX(pts)+maxX(pts))/2; }

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    // ═══ Test 1: Align Left ═══
    {
        core::Document doc;
        QUndoStack stack; CommandManager mgr; mgr.setUndoStack(&stack);

        core::Polyline p1; p1.points = {{0,0},{2,0},{2,2},{0,2},{0,0}};
        core::Polyline p2; p2.points = {{5,1},{7,1},{7,3},{5,3},{5,1}};
        core::Polyline p3; p3.points = {{10,0},{13,0},{13,3},{10,3},{10,0}};
        auto id1 = doc.add_polyline(p1, "a");
        auto id2 = doc.add_polyline(p2, "b");
        auto id3 = doc.add_polyline(p3, "c");

        auto pts1 = getPoints(doc, id1);
        auto pts2 = getPoints(doc, id2);
        auto pts3 = getPoints(doc, id3);
        QVector<EntityId> ids{id1, id2, id3};
        QVector<QVector<QPointF>> before{pts1, pts2, pts3};

        mgr.push(std::make_unique<AlignCmd>(&doc, ids, before, 0)); // Left

        auto a1 = getPoints(doc, id1);
        auto a2 = getPoints(doc, id2);
        auto a3 = getPoints(doc, id3);
        assert(near(minX(a1), 0.0));
        assert(near(minX(a2), 0.0)); // was 5, now 0
        assert(near(minX(a3), 0.0)); // was 10, now 0

        stack.undo();
        assert(near(minX(getPoints(doc, id2)), 5.0)); // restored
        fprintf(stderr, "  PASS: align left + undo\n");
    }

    // ═══ Test 2: Align Right ═══
    {
        core::Document doc;
        QUndoStack stack; CommandManager mgr; mgr.setUndoStack(&stack);

        core::Polyline p1; p1.points = {{0,0},{2,0},{2,2},{0,2},{0,0}};
        core::Polyline p2; p2.points = {{5,0},{8,0},{8,2},{5,2},{5,0}};
        auto id1 = doc.add_polyline(p1, "a");
        auto id2 = doc.add_polyline(p2, "b");

        auto pts1 = getPoints(doc, id1);
        auto pts2 = getPoints(doc, id2);
        mgr.push(std::make_unique<AlignCmd>(&doc, QVector<EntityId>{id1,id2},
                 QVector<QVector<QPointF>>{pts1,pts2}, 2)); // Right

        assert(near(maxX(getPoints(doc, id1)), 8.0)); // was 2, now 8
        assert(near(maxX(getPoints(doc, id2)), 8.0));
        fprintf(stderr, "  PASS: align right\n");
    }

    // ═══ Test 3: Align Center H ═══
    {
        core::Document doc;
        QUndoStack stack; CommandManager mgr; mgr.setUndoStack(&stack);

        core::Polyline p1; p1.points = {{0,0},{4,0},{4,2},{0,2},{0,0}};   // cx=2
        core::Polyline p2; p2.points = {{10,0},{14,0},{14,2},{10,2},{10,0}}; // cx=12
        auto id1 = doc.add_polyline(p1, "a");
        auto id2 = doc.add_polyline(p2, "b");

        auto pts1 = getPoints(doc, id1);
        auto pts2 = getPoints(doc, id2);
        mgr.push(std::make_unique<AlignCmd>(&doc, QVector<EntityId>{id1,id2},
                 QVector<QVector<QPointF>>{pts1,pts2}, 1)); // CenterH

        // Global center = (0+14)/2 = 7. Both should center at 7.
        assert(near(centerX(getPoints(doc, id1)), 7.0));
        assert(near(centerX(getPoints(doc, id2)), 7.0));
        fprintf(stderr, "  PASS: align center H\n");
    }

    // ═══ Test 4: Distribute Horizontal ═══
    {
        core::Document doc;
        QUndoStack stack; CommandManager mgr; mgr.setUndoStack(&stack);

        // 3 entities at x centers: 1, 5, 20 → should become 1, 10.5, 20
        core::Polyline p1; p1.points = {{0,0},{2,0},{2,2},{0,2},{0,0}};     // cx=1
        core::Polyline p2; p2.points = {{4,0},{6,0},{6,2},{4,2},{4,0}};     // cx=5
        core::Polyline p3; p3.points = {{19,0},{21,0},{21,2},{19,2},{19,0}}; // cx=20
        auto id1 = doc.add_polyline(p1, "a");
        auto id2 = doc.add_polyline(p2, "b");
        auto id3 = doc.add_polyline(p3, "c");

        auto pts1 = getPoints(doc, id1);
        auto pts2 = getPoints(doc, id2);
        auto pts3 = getPoints(doc, id3);

        mgr.push(std::make_unique<DistCmd>(&doc, QVector<EntityId>{id1,id2,id3},
                 QVector<QVector<QPointF>>{pts1,pts2,pts3}, 0)); // H

        // First (cx=1) and last (cx=20) stay fixed. Middle should be at (1+20)/2 = 10.5
        double c1 = centerX(getPoints(doc, id1));
        double c2 = centerX(getPoints(doc, id2));
        double c3 = centerX(getPoints(doc, id3));
        assert(near(c1, 1.0));
        assert(near(c2, 10.5));
        assert(near(c3, 20.0));

        stack.undo();
        assert(near(centerX(getPoints(doc, id2)), 5.0)); // restored
        fprintf(stderr, "  PASS: distribute horizontal + undo\n");
    }

    fprintf(stderr, "\n  All Align/Distribute tests passed!\n");
    return 0;
}
