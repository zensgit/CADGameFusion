#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>
#include <QtCore/QList>
#include <QtCore/QSet>
#include <QtCore/QVector>

#include <cassert>
#include <memory>

#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "canvas.hpp"
#include "command/command_manager.hpp"

static core::Polyline makeSquare(double size) {
    core::Polyline pl;
    pl.points = {{0, 0}, {size, 0}, {size, size}, {0, size}, {0, 0}};
    return pl;
}

static const CanvasWidget::PolylineState* findState(const QVector<CanvasWidget::PolylineState>& states, EntityId id) {
    for (const auto& state : states) {
        if (state.entityId == id) {
            return &state;
        }
    }
    return nullptr;
}

static const core::Entity* findEntityByName(const core::Document& doc, const std::string& name) {
    for (const auto& entity : doc.entities()) {
        if (entity.name == name) {
            return &entity;
        }
    }
    return nullptr;
}

class SetVisibleCommand : public Command {
public:
    SetVisibleCommand(core::Document* doc, CanvasWidget* canvas, EntityId id, bool visible)
        : doc_(doc), canvas_(canvas), id_(id), newVal_(visible) {
        if (doc_) {
            if (const auto* entity = doc_->get_entity(id_)) {
                oldVal_ = entity->visible;
            }
        }
    }

    void execute() override {
        if (doc_) {
            doc_->set_entity_visible(id_, newVal_);
        }
        if (canvas_) {
            canvas_->reloadFromDocument();
        }
    }

    void undo() override {
        if (doc_) {
            doc_->set_entity_visible(id_, oldVal_);
        }
        if (canvas_) {
            canvas_->reloadFromDocument();
        }
    }

    QString name() const override { return "Set Visible"; }

private:
    core::Document* doc_{nullptr};
    CanvasWidget* canvas_{nullptr};
    EntityId id_{0};
    bool newVal_{false};
    bool oldVal_{true};
};

class BatchSetVisibleCommand : public Command {
public:
    BatchSetVisibleCommand(core::Document* doc, CanvasWidget* canvas, const QList<qulonglong>& ids, bool visible)
        : doc_(doc), canvas_(canvas), newVal_(visible) {
        QSet<EntityId> seen;
        for (qulonglong rawId : ids) {
            EntityId eid = static_cast<EntityId>(rawId);
            if (eid == 0 || seen.contains(eid)) {
                continue;
            }
            seen.insert(eid);
            auto* entity = doc_ ? doc_->get_entity(eid) : nullptr;
            if (entity) {
                entityIds_.push_back(eid);
                oldVals_.push_back(entity->visible);
            }
        }
    }

    void execute() override {
        if (doc_) {
            for (EntityId eid : entityIds_) {
                doc_->set_entity_visible(eid, newVal_);
            }
        }
        if (canvas_) {
            canvas_->reloadFromDocument();
        }
    }

    void undo() override {
        if (doc_) {
            for (int i = 0; i < entityIds_.size(); ++i) {
                doc_->set_entity_visible(entityIds_[i], oldVals_[i]);
            }
        }
        if (canvas_) {
            canvas_->reloadFromDocument();
        }
    }

    QString name() const override { return "Set Visible (Batch)"; }

private:
    core::Document* doc_{nullptr};
    CanvasWidget* canvas_{nullptr};
    QVector<EntityId> entityIds_;
    QVector<bool> oldVals_;
    bool newVal_{false};
};

class RemoveEntitiesCommand : public Command {
public:
    RemoveEntitiesCommand(core::Document* doc, CanvasWidget* canvas, const QVector<core::EntityId>& ids)
        : doc_(doc), canvas_(canvas), ids_(ids) {}

    void execute() override {
        if (!doc_) {
            return;
        }
        removed_.clear();
        removed_.reserve(ids_.size());
        for (core::EntityId id : ids_) {
            if (const auto* entity = doc_->get_entity(id)) {
                removed_.push_back(*entity);
                doc_->remove_entity(id);
            }
        }
        if (canvas_) {
            canvas_->reloadFromDocument();
        }
    }

    void undo() override {
        if (!doc_) {
            return;
        }
        for (const auto& entity : removed_) {
            if (entity.type != core::EntityType::Polyline || !entity.payload) {
                continue;
            }
            const auto* pl = static_cast<const core::Polyline*>(entity.payload.get());
            if (!pl) {
                continue;
            }
            core::EntityId newId = doc_->add_polyline(*pl, entity.name, entity.layerId);
            doc_->set_entity_visible(newId, entity.visible);
            doc_->set_entity_group_id(newId, entity.groupId);
            doc_->set_entity_color(newId, entity.color);
        }
        if (canvas_) {
            canvas_->reloadFromDocument();
        }
    }

    QString name() const override { return "Remove Entities"; }

private:
    core::Document* doc_{nullptr};
    CanvasWidget* canvas_{nullptr};
    QVector<core::Entity> removed_;
    QVector<core::EntityId> ids_;
};

int main(int argc, char** argv) {
    qputenv("QT_QPA_PLATFORM", QByteArray("offscreen"));
    QApplication app(argc, argv);

    core::Document doc;
    CanvasWidget canvas;
    canvas.setDocument(&doc);

    core::Polyline pl = makeSquare(1.0);
    int layerId = doc.add_layer("Layer1", 0x445566u);
    auto id1 = doc.add_polyline(pl, "one");
    auto id2 = doc.add_polyline(pl, "two", layerId);
    auto id3 = doc.add_polyline(pl, "three");
    assert(id1 > 0);
    assert(id2 > 0);
    assert(id3 > 0);

    int gid = doc.alloc_group_id();
    assert(gid >= 1);
    assert(doc.set_entity_group_id(id1, gid));
    assert(doc.set_entity_color(id1, 0x112233u));

    canvas.reloadFromDocument();

    auto states = canvas.polylineStates();
    assert(states.size() == 3);
    const auto* s1 = findState(states, id1);
    const auto* s2 = findState(states, id2);
    const auto* s3 = findState(states, id3);
    assert(s1);
    assert(s2);
    assert(s3);

    assert(s1->visible);
    assert(s1->groupId == gid);
    assert(s1->layerId == 0);
    assert(s1->pointCount == 5);
    assert(s1->color.red() == 0x11);
    assert(s1->color.green() == 0x22);
    assert(s1->color.blue() == 0x33);

    assert(s2->visible);
    assert(s2->groupId == -1);
    assert(s2->layerId == layerId);
    assert(s2->pointCount == 5);
    assert(s2->color.red() == 0x44);
    assert(s2->color.green() == 0x55);
    assert(s2->color.blue() == 0x66);

    assert(s3->visible);
    assert(s3->groupId == -1);
    assert(s3->layerId == 0);
    assert(s3->pointCount == 5);
    assert(s3->color.red() == 0xFF);
    assert(s3->color.green() == 0xFF);
    assert(s3->color.blue() == 0xFF);

    QUndoStack singleStack;
    CommandManager singleMgr;
    singleMgr.setUndoStack(&singleStack);
    singleMgr.push(std::make_unique<SetVisibleCommand>(&doc, &canvas, id2, false));
    const auto* entity = doc.get_entity(id2);
    assert(entity);
    assert(!entity->visible);
    states = canvas.polylineStates();
    const auto* s2_after = findState(states, id2);
    assert(s2_after);
    assert(!s2_after->visible);

    singleStack.undo();
    entity = doc.get_entity(id2);
    assert(entity);
    assert(entity->visible);
    states = canvas.polylineStates();
    s2_after = findState(states, id2);
    assert(s2_after);
    assert(s2_after->visible);

    singleStack.redo();
    entity = doc.get_entity(id2);
    assert(entity);
    assert(!entity->visible);
    states = canvas.polylineStates();
    s2_after = findState(states, id2);
    assert(s2_after);
    assert(!s2_after->visible);

    singleStack.undo();
    entity = doc.get_entity(id2);
    assert(entity);
    assert(entity->visible);

    QList<qulonglong> batchIds;
    batchIds << static_cast<qulonglong>(id1) << static_cast<qulonglong>(id2) << static_cast<qulonglong>(id2);
    QUndoStack batchStack;
    CommandManager batchMgr;
    batchMgr.setUndoStack(&batchStack);
    batchMgr.push(std::make_unique<BatchSetVisibleCommand>(&doc, &canvas, batchIds, false));
    assert(!doc.get_entity(id1)->visible);
    assert(!doc.get_entity(id2)->visible);
    states = canvas.polylineStates();
    assert(!findState(states, id1)->visible);
    assert(!findState(states, id2)->visible);

    batchStack.undo();
    assert(doc.get_entity(id1)->visible);
    assert(doc.get_entity(id2)->visible);
    states = canvas.polylineStates();
    assert(findState(states, id1)->visible);
    assert(findState(states, id2)->visible);

    batchStack.redo();
    assert(!doc.get_entity(id1)->visible);
    assert(!doc.get_entity(id2)->visible);
    states = canvas.polylineStates();
    assert(!findState(states, id1)->visible);
    assert(!findState(states, id2)->visible);

    batchStack.undo();
    assert(doc.get_entity(id1)->visible);
    assert(doc.get_entity(id2)->visible);

    QVector<core::EntityId> removeIds;
    removeIds.push_back(id1);
    removeIds.push_back(id3);
    QUndoStack removeStack;
    CommandManager removeMgr;
    removeMgr.setUndoStack(&removeStack);
    removeMgr.push(std::make_unique<RemoveEntitiesCommand>(&doc, &canvas, removeIds));
    assert(doc.entities().size() == 1);
    states = canvas.polylineStates();
    assert(states.size() == 1);
    assert(states[0].entityId == id2);

    removeStack.undo();
    assert(doc.entities().size() == 3);
    const auto* restoredOne = findEntityByName(doc, "one");
    const auto* restoredThree = findEntityByName(doc, "three");
    const auto* keptTwo = findEntityByName(doc, "two");
    assert(restoredOne);
    assert(restoredThree);
    assert(keptTwo);
    assert(restoredOne->groupId == gid);
    assert(restoredOne->color == 0x112233u);
    assert(restoredOne->visible);
    assert(restoredThree->visible);

    removeStack.redo();
    assert(doc.entities().size() == 1);
    assert(findEntityByName(doc, "two"));

    return 0;
}
