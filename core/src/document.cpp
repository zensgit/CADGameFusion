#include "core/document.hpp"
#include "core/geometry2d.hpp"

#include <algorithm>

namespace core {

Document::Document() {
    clear();
}

Document::~Document() {
    observers_.clear();
}

void Document::add_observer(DocumentObserver* observer) {
    if (!observer) return;
    if (std::find(observers_.begin(), observers_.end(), observer) != observers_.end()) return;
    observers_.push_back(observer);
}

void Document::remove_observer(DocumentObserver* observer) {
    if (!observer) return;
    observers_.erase(std::remove(observers_.begin(), observers_.end(), observer), observers_.end());
}

void Document::begin_change_batch() {
    ++change_batch_depth_;
}

void Document::end_change_batch() {
    if (change_batch_depth_ <= 0) return;
    --change_batch_depth_;
    if (change_batch_depth_ == 0 && pending_reset_) {
        pending_reset_ = false;
        notify(DocumentChangeType::Reset);
    }
}

void Document::notify(DocumentChangeType type, EntityId entityId, int layerId) {
    if (change_batch_depth_ > 0) {
        pending_reset_ = true;
        return;
    }
    DocumentChangeEvent event;
    event.type = type;
    event.entityId = entityId;
    event.layerId = layerId;
    for (auto* observer : observers_) {
        if (observer) observer->on_document_changed(*this, event);
    }
}

int Document::add_layer(const std::string& name, uint32_t color) {
    Layer l;
    l.id = next_layer_id_++;
    l.name = name;
    l.color = color;
    layers_.push_back(l);
    notify(DocumentChangeType::LayerChanged, 0, l.id);
    return l.id;
}

Layer* Document::get_layer(int id) {
    for (auto& l : layers_) {
        if (l.id == id) return &l;
    }
    return nullptr;
}

const Layer* Document::get_layer(int id) const {
    for (const auto& l : layers_) {
        if (l.id == id) return &l;
    }
    return nullptr;
}

bool Document::set_layer_visible(int id, bool visible) {
    auto* layer = get_layer(id);
    if (!layer) return false;
    layer->visible = visible;
    notify(DocumentChangeType::LayerChanged, 0, id);
    return true;
}

bool Document::set_layer_locked(int id, bool locked) {
    auto* layer = get_layer(id);
    if (!layer) return false;
    layer->locked = locked;
    notify(DocumentChangeType::LayerChanged, 0, id);
    return true;
}

bool Document::set_layer_color(int id, uint32_t color) {
    auto* layer = get_layer(id);
    if (!layer) return false;
    layer->color = color;
    notify(DocumentChangeType::LayerChanged, 0, id);
    return true;
}

EntityId Document::add_polyline(const Polyline& pl, const std::string& name, int layerId) {
    Entity e;
    e.id = next_id_++;
    e.type = EntityType::Polyline;
    e.name = name;
    e.layerId = layerId;
    e.payload = std::shared_ptr<void>(new Polyline(pl), [](void* p){ delete static_cast<Polyline*>(p); });
    entities_.push_back(e);
    notify(DocumentChangeType::EntityAdded, e.id);
    return e.id;
}

bool Document::set_polyline_points(EntityId id, const Polyline& pl) {
    auto* e = get_entity(id);
    if (!e || e->type != EntityType::Polyline || !e->payload) return false;
    auto* existing = static_cast<Polyline*>(e->payload.get());
    if (!existing) return false;
    *existing = pl;
    notify(DocumentChangeType::EntityGeometryChanged, id);
    return true;
}

bool Document::remove_entity(EntityId id) {
    for (auto it = entities_.begin(); it != entities_.end(); ++it) {
        if (it->id == id) {
            entities_.erase(it);
            notify(DocumentChangeType::EntityRemoved, id);
            return true;
        }
    }
    return false;
}

void Document::clear() {
    settings_ = DocumentSettings{};
    entities_.clear();
    layers_.clear();
    next_id_ = 1;
    next_layer_id_ = 1;
    next_group_id_ = 1;

    Layer l0;
    l0.id = 0;
    l0.name = "0";
    l0.color = 0xFFFFFF;
    l0.visible = true;
    l0.locked = false;
    layers_.push_back(l0);
    notify(DocumentChangeType::Cleared);
}

Entity* Document::get_entity(EntityId id) {
    for (auto& e : entities_) {
        if (e.id == id) return &e;
    }
    return nullptr;
}

const Entity* Document::get_entity(EntityId id) const {
    for (const auto& e : entities_) {
        if (e.id == id) return &e;
    }
    return nullptr;
}

bool Document::set_entity_visible(EntityId id, bool visible) {
    auto* e = get_entity(id);
    if (!e) return false;
    e->visible = visible;
    notify(DocumentChangeType::EntityMetaChanged, id);
    return true;
}

bool Document::set_entity_color(EntityId id, uint32_t color) {
    auto* e = get_entity(id);
    if (!e) return false;
    e->color = color;
    notify(DocumentChangeType::EntityMetaChanged, id);
    return true;
}

bool Document::set_entity_group_id(EntityId id, int groupId) {
    auto* e = get_entity(id);
    if (!e) return false;
    e->groupId = groupId;
    if (groupId >= 0 && groupId >= next_group_id_) {
        next_group_id_ = groupId + 1;
    }
    notify(DocumentChangeType::EntityMetaChanged, id);
    return true;
}

int Document::alloc_group_id() {
    if (next_group_id_ < 1) next_group_id_ = 1;
    return next_group_id_++;
}

DocumentChangeGuard::DocumentChangeGuard(Document& doc) : doc_(&doc) {
    doc_->begin_change_batch();
}

DocumentChangeGuard::~DocumentChangeGuard() {
    if (doc_) doc_->end_change_batch();
}

} // namespace core
