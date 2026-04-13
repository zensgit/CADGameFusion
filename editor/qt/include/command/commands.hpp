#pragma once

// Shared Command class declarations for the editor.
// Extracted from mainwindow.cpp inline structs for reusability and testability.

#include "command/command.hpp"
#include "core/document.hpp"

#include <QVector>
#include <QPointF>
#include <QList>
#include <cmath>

using EntityId = uint64_t;

namespace editor_commands {

// Helper: apply QPointF array to Document polyline
inline void applyPoints(core::Document* doc, EntityId id, const QVector<QPointF>& pts) {
    if (!doc) return;
    core::Polyline pl;
    pl.points.reserve(static_cast<size_t>(pts.size()));
    for (const auto& pt : pts)
        pl.points.push_back(core::Vec2{pt.x(), pt.y()});
    doc->set_polyline_points(id, pl);
}

// ─── Move ───
struct MoveEntitiesCommand : Command {
    core::Document* doc;
    QVector<EntityId> ids;
    QVector<QVector<QPointF>> before;
    QPointF delta;

    MoveEntitiesCommand(core::Document* d, const QList<qulonglong>& inIds,
                        const QVector<QVector<QPointF>>& inBefore, const QPointF& dlt)
        : doc(d), before(inBefore), delta(dlt) {
        ids.reserve(inIds.size());
        for (qulonglong id : inIds) ids.push_back(static_cast<EntityId>(id));
    }
    void execute() override {
        for (int i = 0; i < ids.size(); ++i) {
            QVector<QPointF> moved;
            moved.reserve(before[i].size());
            for (const auto& pt : before[i]) moved.append(pt + delta);
            applyPoints(doc, ids[i], moved);
        }
    }
    void undo() override {
        for (int i = 0; i < ids.size(); ++i) applyPoints(doc, ids[i], before[i]);
    }
    QString name() const override { return "Move Entities"; }
};

// ─── Rotate ───
struct RotateEntitiesCommand : Command {
    core::Document* doc;
    QVector<EntityId> ids;
    QVector<QVector<QPointF>> before;
    double angleDeg;
    QPointF center;

    RotateEntitiesCommand(core::Document* d, const QList<qulonglong>& inIds,
                          const QVector<QVector<QPointF>>& inBefore,
                          double angle, const QPointF& c)
        : doc(d), before(inBefore), angleDeg(angle), center(c) {
        ids.reserve(inIds.size());
        for (qulonglong id : inIds) ids.push_back(static_cast<EntityId>(id));
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
            applyPoints(doc, ids[i], rotated);
        }
    }
    void undo() override {
        for (int i = 0; i < ids.size(); ++i) applyPoints(doc, ids[i], before[i]);
    }
    QString name() const override { return "Rotate Entities"; }
};

// ─── Scale ───
struct ScaleEntitiesCommand : Command {
    core::Document* doc;
    QVector<EntityId> ids;
    QVector<QVector<QPointF>> before;
    double factor;
    QPointF center;

    ScaleEntitiesCommand(core::Document* d, const QList<qulonglong>& inIds,
                         const QVector<QVector<QPointF>>& inBefore,
                         double f, const QPointF& c)
        : doc(d), before(inBefore), factor(f), center(c) {
        ids.reserve(inIds.size());
        for (qulonglong id : inIds) ids.push_back(static_cast<EntityId>(id));
    }
    void execute() override {
        for (int i = 0; i < ids.size(); ++i) {
            QVector<QPointF> scaled;
            scaled.reserve(before[i].size());
            for (const auto& pt : before[i])
                scaled.append(QPointF(center.x() + (pt.x()-center.x())*factor,
                                      center.y() + (pt.y()-center.y())*factor));
            applyPoints(doc, ids[i], scaled);
        }
    }
    void undo() override {
        for (int i = 0; i < ids.size(); ++i) applyPoints(doc, ids[i], before[i]);
    }
    QString name() const override { return "Scale Entities"; }
};

// ─── Group / Ungroup ───
struct GroupEntitiesCommand : Command {
    core::Document* doc;
    QVector<EntityId> ids;
    QVector<int> oldGroupIds;
    int newGroupId;

    GroupEntitiesCommand(core::Document* d, const QList<qulonglong>& sel, int gid)
        : doc(d), newGroupId(gid) {
        for (qulonglong id : sel) {
            EntityId eid = static_cast<EntityId>(id);
            if (auto* e = doc->get_entity(eid)) {
                ids.push_back(eid);
                oldGroupIds.push_back(e->groupId);
            }
        }
    }
    void execute() override { for (EntityId eid : ids) doc->set_entity_group_id(eid, newGroupId); }
    void undo() override { for (int i = 0; i < ids.size(); ++i) doc->set_entity_group_id(ids[i], oldGroupIds[i]); }
    QString name() const override { return "Group Entities"; }
};

struct UngroupEntitiesCommand : Command {
    core::Document* doc;
    QVector<EntityId> ids;
    QVector<int> oldGroupIds;

    UngroupEntitiesCommand(core::Document* d, const QList<qulonglong>& sel) : doc(d) {
        for (qulonglong id : sel) {
            EntityId eid = static_cast<EntityId>(id);
            if (auto* e = doc->get_entity(eid)) {
                ids.push_back(eid);
                oldGroupIds.push_back(e->groupId);
            }
        }
    }
    void execute() override { for (EntityId eid : ids) doc->set_entity_group_id(eid, -1); }
    void undo() override { for (int i = 0; i < ids.size(); ++i) doc->set_entity_group_id(ids[i], oldGroupIds[i]); }
    QString name() const override { return "Ungroup Entities"; }
};

} // namespace editor_commands
