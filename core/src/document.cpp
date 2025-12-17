#include "core/document.hpp"
#include "core/geometry2d.hpp"

namespace core {

Document::Document() {
    // Default layer 0
    Layer l0;
    l0.id = 0;
    l0.name = "0";
    l0.color = 0xFFFFFF;
    layers_.push_back(l0);
}

Document::~Document() = default;

int Document::add_layer(const std::string& name, uint32_t color) {
    Layer l;
    l.id = next_layer_id_++;
    l.name = name;
    l.color = color;
    layers_.push_back(l);
    return l.id;
}

Layer* Document::get_layer(int id) {
    for (auto& l : layers_) {
        if (l.id == id) return &l;
    }
    return nullptr;
}

EntityId Document::add_polyline(const Polyline& pl, const std::string& name, int layerId) {
    Entity e;
    e.id = next_id_++;
    e.type = EntityType::Polyline;
    e.name = name;
    e.layerId = layerId;
    e.payload = std::shared_ptr<void>(new Polyline(pl), [](void* p){ delete static_cast<Polyline*>(p); });
    entities_.push_back(e);
    return e.id;
}

bool Document::remove_entity(EntityId id) {
    for (auto it = entities_.begin(); it != entities_.end(); ++it) {
        if (it->id == id) { entities_.erase(it); return true; }
    }
    return false;
}

} // namespace core