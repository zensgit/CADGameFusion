#include "core/document.hpp"
#include "core/geometry2d.hpp"

namespace core {

Document::Document() = default;
Document::~Document() = default;

EntityId Document::add_polyline(const Polyline& pl, const std::string& name) {
    Entity e;
    e.id = next_id_++;
    e.type = EntityType::Polyline;
    e.name = name;
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

