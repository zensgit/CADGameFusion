#include "core/document.hpp"

#include <cassert>

int main() {
    core::Document doc;

    assert(doc.layers().size() == 1);
    const auto& default_layer = doc.layers().front();
    assert(default_layer.id == 0);
    assert(default_layer.name == "0");
    assert(default_layer.color == 0xFFFFFFu);
    assert(default_layer.visible);
    assert(!default_layer.locked);

    assert(doc.get_layer(-1) == nullptr);
    assert(doc.get_layer(999) == nullptr);
    assert(!doc.set_layer_visible(-1, false));
    assert(!doc.set_layer_locked(-1, true));
    assert(!doc.set_layer_color(-1, 0x112233u));
    assert(!doc.set_layer_visible(999, false));
    assert(!doc.set_layer_locked(999, true));
    assert(!doc.set_layer_color(999, 0x112233u));

    const auto* layer0 = doc.get_layer(0);
    assert(layer0);
    assert(layer0->visible);
    assert(!layer0->locked);
    assert(layer0->color == 0xFFFFFFu);

    int layer1 = doc.add_layer("L1", 0xABCDEFu);
    assert(layer1 == 1);
    assert(doc.set_layer_visible(layer1, false));
    assert(doc.set_layer_locked(layer1, true));
    assert(doc.set_layer_color(layer1, 0x123456u));

    doc.clear();
    assert(doc.layers().size() == 1);
    const auto* layer0_after = doc.get_layer(0);
    assert(layer0_after);
    assert(layer0_after->id == 0);
    assert(layer0_after->name == "0");
    assert(layer0_after->color == 0xFFFFFFu);
    assert(layer0_after->visible);
    assert(!layer0_after->locked);

    int layer2 = doc.add_layer("L2");
    assert(layer2 == 1);
    return 0;
}
