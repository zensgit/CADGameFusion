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
    doc.begin_change_batch();
    doc.end_change_batch();
    assert(observer.events.empty());

    observer.clear();
    doc.begin_change_batch();
    int layer_id = doc.add_layer("batch", 0x123456u);
    assert(layer_id > 0);
    doc.set_layer_visible(layer_id, false);

    core::Polyline pl;
    pl.points = {{0, 0}, {1, 0}, {1, 1}, {0, 0}};
    core::EntityId eid = doc.add_polyline(pl, "poly", layer_id);
    assert(eid > 0);
    doc.set_entity_visible(eid, false);
    assert(observer.events.empty());

    doc.end_change_batch();
    assert(observer.events.size() == 1);
    assert(observer.events[0].type == core::DocumentChangeType::Reset);

    observer.clear();
    doc.begin_change_batch();
    doc.begin_change_batch();
    doc.add_layer("nested", 0xabcdefu);
    doc.end_change_batch();
    assert(observer.events.empty());
    doc.end_change_batch();
    assert(observer.events.size() == 1);
    assert(observer.events[0].type == core::DocumentChangeType::Reset);

    return 0;
}
