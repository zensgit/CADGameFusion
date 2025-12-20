#include <QtWidgets/QApplication>
#include <QtCore/QByteArray>

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
    assert(id1 > 0);
    assert(id2 > 0);

    int gid = doc.alloc_group_id();
    assert(gid >= 1);
    assert(doc.set_entity_group_id(id1, gid));
    assert(doc.set_entity_color(id1, 0x112233u));
    assert(doc.set_entity_visible(id1, false));

    canvas.reloadFromDocument();

    auto states = canvas.polylineStates();
    assert(states.size() == 2);
    const auto* s1 = findState(states, id1);
    const auto* s2 = findState(states, id2);
    assert(s1);
    assert(s2);

    assert(!s1->visible);
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

    assert(doc.remove_entity(id1));
    canvas.reloadFromDocument();
    states = canvas.polylineStates();
    assert(states.size() == 1);
    assert(states[0].entityId == id2);

    QUndoStack stack;
    CommandManager mgr;
    mgr.setUndoStack(&stack);
    mgr.push(std::make_unique<SetVisibleCommand>(&doc, &canvas, id2, false));
    const auto* entity = doc.get_entity(id2);
    assert(entity);
    assert(!entity->visible);
    states = canvas.polylineStates();
    const auto* s2_after = findState(states, id2);
    assert(s2_after);
    assert(!s2_after->visible);

    stack.undo();
    entity = doc.get_entity(id2);
    assert(entity);
    assert(entity->visible);
    states = canvas.polylineStates();
    s2_after = findState(states, id2);
    assert(s2_after);
    assert(s2_after->visible);

    stack.redo();
    entity = doc.get_entity(id2);
    assert(entity);
    assert(!entity->visible);
    states = canvas.polylineStates();
    s2_after = findState(states, id2);
    assert(s2_after);
    assert(!s2_after->visible);

    return 0;
}
