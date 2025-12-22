#include "core/document.hpp"
#include "core/geometry2d.hpp"

#include <cassert>
#include <vector>

namespace {

struct TestObserver : core::DocumentObserver {
    std::vector<core::DocumentChangeEvent> events;

    void on_document_changed(const core::Document&, const core::DocumentChangeEvent& event) override {
        events.push_back(event);
    }

    void clear() { events.clear(); }
};

} // namespace

int main() {
    core::Document doc;
    TestObserver observer;
    doc.add_observer(&observer);

    observer.clear();
    bool ok = doc.set_layer_visible(0, true);
    assert(ok);
    assert(observer.events.empty());

    ok = doc.set_layer_visible(0, false);
    assert(ok);
    assert(observer.events.size() == 1);
    assert(observer.events[0].type == core::DocumentChangeType::LayerChanged);
    assert(observer.events[0].layerId == 0);

    observer.clear();
    ok = doc.set_layer_visible(0, false);
    assert(ok);
    assert(observer.events.empty());

    observer.clear();
    ok = doc.set_layer_locked(0, true);
    assert(ok);
    assert(observer.events.size() == 1);
    assert(observer.events[0].type == core::DocumentChangeType::LayerChanged);
    assert(observer.events[0].layerId == 0);

    observer.clear();
    ok = doc.set_layer_locked(0, true);
    assert(ok);
    assert(observer.events.empty());

    observer.clear();
    ok = doc.set_layer_color(0, 0x112233u);
    assert(ok);
    assert(observer.events.size() == 1);
    assert(observer.events[0].type == core::DocumentChangeType::LayerChanged);
    assert(observer.events[0].layerId == 0);

    observer.clear();
    ok = doc.set_layer_color(0, 0x112233u);
    assert(ok);
    assert(observer.events.empty());

    core::Polyline pl;
    pl.points = {{0, 0}, {1, 0}, {1, 1}, {0, 0}};
    auto id = doc.add_polyline(pl, "noop");
    assert(id > 0);
    observer.clear();

    ok = doc.set_entity_visible(id, true);
    assert(ok);
    assert(observer.events.empty());

    ok = doc.set_entity_visible(id, false);
    assert(ok);
    assert(observer.events.size() == 1);
    assert(observer.events[0].type == core::DocumentChangeType::EntityMetaChanged);
    assert(observer.events[0].entityId == id);

    observer.clear();
    ok = doc.set_entity_visible(id, false);
    assert(ok);
    assert(observer.events.empty());

    observer.clear();
    ok = doc.set_entity_color(id, 0);
    assert(ok);
    assert(observer.events.empty());

    ok = doc.set_entity_color(id, 0x445566u);
    assert(ok);
    assert(observer.events.size() == 1);
    assert(observer.events[0].type == core::DocumentChangeType::EntityMetaChanged);
    assert(observer.events[0].entityId == id);

    observer.clear();
    ok = doc.set_entity_color(id, 0x445566u);
    assert(ok);
    assert(observer.events.empty());

    observer.clear();
    ok = doc.set_entity_group_id(id, -1);
    assert(ok);
    assert(observer.events.empty());

    ok = doc.set_entity_group_id(id, 7);
    assert(ok);
    assert(observer.events.size() == 1);
    assert(observer.events[0].type == core::DocumentChangeType::EntityMetaChanged);
    assert(observer.events[0].entityId == id);

    observer.clear();
    ok = doc.set_entity_group_id(id, 7);
    assert(ok);
    assert(observer.events.empty());

    observer.clear();
    ok = doc.set_polyline_points(id, pl);
    assert(ok);
    assert(observer.events.empty());

    core::Polyline moved;
    moved.points = {{2, 2}, {3, 2}, {3, 3}, {2, 2}};
    ok = doc.set_polyline_points(id, moved);
    assert(ok);
    assert(observer.events.size() == 1);
    assert(observer.events[0].type == core::DocumentChangeType::EntityGeometryChanged);
    assert(observer.events[0].entityId == id);

    observer.clear();
    ok = doc.set_polyline_points(id, moved);
    assert(ok);
    assert(observer.events.empty());

    return 0;
}
