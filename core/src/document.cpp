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

void Document::notify_before(DocumentChangeType type, EntityId entityId, int layerId) {
    // Capture property diff for transaction undo
    if (active_transaction_ && !in_undo_redo_) {
        PropertyDiff diff;
        diff.type = type;
        diff.entityId = entityId;
        diff.layerId = layerId;
        if (type == DocumentChangeType::EntityGeometryChanged) {
            const auto* ent = get_entity(entityId);
            if (ent) diff.oldPayload = ent->payload;
        } else if (type == DocumentChangeType::EntityMetaChanged) {
            const auto* ent = get_entity(entityId);
            if (ent) diff.oldEntity = *ent;
        } else if (type == DocumentChangeType::LayerChanged) {
            const auto* layer = get_layer(layerId);
            if (layer) diff.oldLayer = *layer;
        }
        active_transaction_->diffs.push_back(diff);
    }

    if (change_batch_depth_ > 0) return;
    DocumentChangeEvent event;
    event.type = type;
    event.entityId = entityId;
    event.layerId = layerId;
    for (auto* observer : observers_) {
        if (observer) observer->on_before_document_changed(*this, event);
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
    if (layer->visible == visible) return true;
    notify_before(DocumentChangeType::LayerChanged, 0, id);
    layer->visible = visible;
    notify(DocumentChangeType::LayerChanged, 0, id);
    return true;
}

bool Document::set_layer_locked(int id, bool locked) {
    auto* layer = get_layer(id);
    if (!layer) return false;
    if (layer->locked == locked) return true;
    notify_before(DocumentChangeType::LayerChanged, 0, id);
    layer->locked = locked;
    notify(DocumentChangeType::LayerChanged, 0, id);
    return true;
}

bool Document::set_layer_printable(int id, bool printable) {
    auto* layer = get_layer(id);
    if (!layer) return false;
    if (layer->printable == printable) return true;
    notify_before(DocumentChangeType::LayerChanged, 0, id);
    layer->printable = printable;
    notify(DocumentChangeType::LayerChanged, 0, id);
    return true;
}

bool Document::set_layer_frozen(int id, bool frozen) {
    auto* layer = get_layer(id);
    if (!layer) return false;
    if (layer->frozen == frozen) return true;
    notify_before(DocumentChangeType::LayerChanged, 0, id);
    layer->frozen = frozen;
    notify(DocumentChangeType::LayerChanged, 0, id);
    return true;
}

bool Document::set_layer_construction(int id, bool construction) {
    auto* layer = get_layer(id);
    if (!layer) return false;
    if (layer->construction == construction) return true;
    notify_before(DocumentChangeType::LayerChanged, 0, id);
    layer->construction = construction;
    notify(DocumentChangeType::LayerChanged, 0, id);
    return true;
}

bool Document::set_layer_color(int id, uint32_t color) {
    auto* layer = get_layer(id);
    if (!layer) return false;
    if (layer->color == color) return true;
    notify_before(DocumentChangeType::LayerChanged, 0, id);
    layer->color = color;
    notify(DocumentChangeType::LayerChanged, 0, id);
    return true;
}

EntityId Document::add_point(const Vec2& p, const std::string& name, int layerId) {
    Entity e;
    e.id = next_id_++;
    e.type = EntityType::Point;
    e.name = name;
    e.layerId = layerId;
    e.payload = Point{p};
    entities_.push_back(e);
    notify(DocumentChangeType::EntityAdded, e.id);
    return e.id;
}

EntityId Document::add_line(const Line& l, const std::string& name, int layerId) {
    Entity e;
    e.id = next_id_++;
    e.type = EntityType::Line;
    e.name = name;
    e.layerId = layerId;
    e.payload = l;
    entities_.push_back(e);
    notify(DocumentChangeType::EntityAdded, e.id);
    return e.id;
}

EntityId Document::add_arc(const Arc& a, const std::string& name, int layerId) {
    Entity e;
    e.id = next_id_++;
    e.type = EntityType::Arc;
    e.name = name;
    e.layerId = layerId;
    e.payload = a;
    entities_.push_back(e);
    notify(DocumentChangeType::EntityAdded, e.id);
    return e.id;
}

EntityId Document::add_circle(const Circle& c, const std::string& name, int layerId) {
    Entity e;
    e.id = next_id_++;
    e.type = EntityType::Circle;
    e.name = name;
    e.layerId = layerId;
    e.payload = c;
    entities_.push_back(e);
    notify(DocumentChangeType::EntityAdded, e.id);
    return e.id;
}

EntityId Document::add_ellipse(const Ellipse& e, const std::string& name, int layerId) {
    Entity ent;
    ent.id = next_id_++;
    ent.type = EntityType::Ellipse;
    ent.name = name;
    ent.layerId = layerId;
    ent.payload = e;
    entities_.push_back(ent);
    notify(DocumentChangeType::EntityAdded, ent.id);
    return ent.id;
}

EntityId Document::add_spline(const Spline& s, const std::string& name, int layerId) {
    Entity ent;
    ent.id = next_id_++;
    ent.type = EntityType::Spline;
    ent.name = name;
    ent.layerId = layerId;
    ent.payload = s;
    entities_.push_back(ent);
    notify(DocumentChangeType::EntityAdded, ent.id);
    return ent.id;
}

EntityId Document::add_text(const Text& t, const std::string& name, int layerId) {
    Entity ent;
    ent.id = next_id_++;
    ent.type = EntityType::Text;
    ent.name = name;
    ent.layerId = layerId;
    ent.payload = t;
    entities_.push_back(ent);
    notify(DocumentChangeType::EntityAdded, ent.id);
    return ent.id;
}

Point* Document::get_point(EntityId id) {
    auto* e = get_entity(id);
    if (!e || e->type != EntityType::Point) return nullptr;
    return std::get_if<Point>(&e->payload);
}

const Point* Document::get_point(EntityId id) const {
    const auto* e = get_entity(id);
    if (!e || e->type != EntityType::Point) return nullptr;
    return std::get_if<Point>(&e->payload);
}

Line* Document::get_line(EntityId id) {
    auto* e = get_entity(id);
    if (!e || e->type != EntityType::Line) return nullptr;
    return std::get_if<Line>(&e->payload);
}

const Line* Document::get_line(EntityId id) const {
    const auto* e = get_entity(id);
    if (!e || e->type != EntityType::Line) return nullptr;
    return std::get_if<Line>(&e->payload);
}

Arc* Document::get_arc(EntityId id) {
    auto* e = get_entity(id);
    if (!e || e->type != EntityType::Arc) return nullptr;
    return std::get_if<Arc>(&e->payload);
}

const Arc* Document::get_arc(EntityId id) const {
    const auto* e = get_entity(id);
    if (!e || e->type != EntityType::Arc) return nullptr;
    return std::get_if<Arc>(&e->payload);
}

Circle* Document::get_circle(EntityId id) {
    auto* e = get_entity(id);
    if (!e || e->type != EntityType::Circle) return nullptr;
    return std::get_if<Circle>(&e->payload);
}

const Circle* Document::get_circle(EntityId id) const {
    const auto* e = get_entity(id);
    if (!e || e->type != EntityType::Circle) return nullptr;
    return std::get_if<Circle>(&e->payload);
}

Ellipse* Document::get_ellipse(EntityId id) {
    auto* e = get_entity(id);
    if (!e || e->type != EntityType::Ellipse) return nullptr;
    return std::get_if<Ellipse>(&e->payload);
}

const Ellipse* Document::get_ellipse(EntityId id) const {
    const auto* e = get_entity(id);
    if (!e || e->type != EntityType::Ellipse) return nullptr;
    return std::get_if<Ellipse>(&e->payload);
}

Spline* Document::get_spline(EntityId id) {
    auto* e = get_entity(id);
    if (!e || e->type != EntityType::Spline) return nullptr;
    return std::get_if<Spline>(&e->payload);
}

const Spline* Document::get_spline(EntityId id) const {
    const auto* e = get_entity(id);
    if (!e || e->type != EntityType::Spline) return nullptr;
    return std::get_if<Spline>(&e->payload);
}

Text* Document::get_text(EntityId id) {
    auto* e = get_entity(id);
    if (!e || e->type != EntityType::Text) return nullptr;
    return std::get_if<Text>(&e->payload);
}

const Text* Document::get_text(EntityId id) const {
    const auto* e = get_entity(id);
    if (!e || e->type != EntityType::Text) return nullptr;
    return std::get_if<Text>(&e->payload);
}

bool Document::set_point(EntityId id, const Vec2& p) {
    auto* pt = get_point(id);
    if (!pt) return false;
    if (pt->p.x == p.x && pt->p.y == p.y) return true;
    notify_before(DocumentChangeType::EntityGeometryChanged, id);
    pt->p = p;
    notify(DocumentChangeType::EntityGeometryChanged, id);
    return true;
}

bool Document::set_line(EntityId id, const Line& l) {
    auto* ln = get_line(id);
    if (!ln) return false;
    if (ln->a.x == l.a.x && ln->a.y == l.a.y && ln->b.x == l.b.x && ln->b.y == l.b.y) return true;
    notify_before(DocumentChangeType::EntityGeometryChanged, id);
    *ln = l;
    notify(DocumentChangeType::EntityGeometryChanged, id);
    return true;
}

bool Document::set_arc(EntityId id, const Arc& a) {
    auto* arc = get_arc(id);
    if (!arc) return false;
    if (arc->center.x == a.center.x && arc->center.y == a.center.y &&
        arc->radius == a.radius && arc->start_angle == a.start_angle &&
        arc->end_angle == a.end_angle && arc->clockwise == a.clockwise) {
        return true;
    }
    notify_before(DocumentChangeType::EntityGeometryChanged, id);
    *arc = a;
    notify(DocumentChangeType::EntityGeometryChanged, id);
    return true;
}

bool Document::set_circle(EntityId id, const Circle& c) {
    auto* circ = get_circle(id);
    if (!circ) return false;
    if (circ->center.x == c.center.x && circ->center.y == c.center.y && circ->radius == c.radius) return true;
    notify_before(DocumentChangeType::EntityGeometryChanged, id);
    *circ = c;
    notify(DocumentChangeType::EntityGeometryChanged, id);
    return true;
}

bool Document::set_ellipse(EntityId id, const Ellipse& e) {
    auto* ellipse = get_ellipse(id);
    if (!ellipse) return false;
    if (ellipse->center.x == e.center.x && ellipse->center.y == e.center.y &&
        ellipse->rx == e.rx && ellipse->ry == e.ry &&
        ellipse->rotation == e.rotation &&
        ellipse->start_angle == e.start_angle &&
        ellipse->end_angle == e.end_angle) {
        return true;
    }
    notify_before(DocumentChangeType::EntityGeometryChanged, id);
    *ellipse = e;
    notify(DocumentChangeType::EntityGeometryChanged, id);
    return true;
}

bool Document::set_spline(EntityId id, const Spline& s) {
    auto* spline = get_spline(id);
    if (!spline) return false;
    if (spline->degree == s.degree &&
        spline->control_points.size() == s.control_points.size() &&
        spline->knots.size() == s.knots.size()) {
        bool identical = true;
        for (size_t i = 0; i < s.control_points.size(); ++i) {
            if (spline->control_points[i].x != s.control_points[i].x ||
                spline->control_points[i].y != s.control_points[i].y) {
                identical = false;
                break;
            }
        }
        if (identical) {
            for (size_t i = 0; i < s.knots.size(); ++i) {
                if (spline->knots[i] != s.knots[i]) {
                    identical = false;
                    break;
                }
            }
        }
        if (identical) return true;
    }
    notify_before(DocumentChangeType::EntityGeometryChanged, id);
    *spline = s;
    notify(DocumentChangeType::EntityGeometryChanged, id);
    return true;
}

bool Document::set_text(EntityId id, const Text& t) {
    auto* text = get_text(id);
    if (!text) return false;
    if (text->pos.x == t.pos.x && text->pos.y == t.pos.y &&
        text->height == t.height && text->rotation == t.rotation &&
        text->text == t.text) {
        return true;
    }
    notify_before(DocumentChangeType::EntityGeometryChanged, id);
    *text = t;
    notify(DocumentChangeType::EntityGeometryChanged, id);
    return true;
}

EntityId Document::add_polyline(const Polyline& pl, const std::string& name, int layerId) {
    Entity e;
    e.id = next_id_++;
    e.type = EntityType::Polyline;
    e.name = name;
    e.layerId = layerId;
    e.payload = pl;
    entities_.push_back(e);
    notify(DocumentChangeType::EntityAdded, e.id);
    return e.id;
}

bool Document::set_polyline_points(EntityId id, const Polyline& pl) {
    auto* e = get_entity(id);
    if (!e || e->type != EntityType::Polyline) return false;
    auto* existing = std::get_if<Polyline>(&e->payload);
    if (!existing) return false;
    if (existing->points.size() == pl.points.size()) {
        bool identical = true;
        for (size_t i = 0; i < pl.points.size(); ++i) {
            if (existing->points[i].x != pl.points[i].x ||
                existing->points[i].y != pl.points[i].y) {
                identical = false;
                break;
            }
        }
        if (identical) return true;
    }
    notify_before(DocumentChangeType::EntityGeometryChanged, id);
    *existing = pl;
    notify(DocumentChangeType::EntityGeometryChanged, id);
    return true;
}

bool Document::remove_entity(EntityId id) {
    for (auto it = entities_.begin(); it != entities_.end(); ++it) {
        if (it->id == id) {
            notify_before(DocumentChangeType::EntityRemoved, id);
            entities_.erase(it);
            notify(DocumentChangeType::EntityRemoved, id);
            return true;
        }
    }
    return false;
}

void Document::clear() {
    notify_before(DocumentChangeType::Cleared);
    settings_ = DocumentSettings{};
    metadata_ = DocumentMetadata{};
    entities_.clear();
    layers_.clear();
    block_definitions_.clear();
    dep_graph_.clear();
    next_id_ = 1;
    next_layer_id_ = 1;
    next_group_id_ = 1;

    Layer l0;
    l0.id = 0;
    l0.name = "0";
    l0.color = 0xFFFFFF;
    l0.visible = true;
    l0.locked = false;
    l0.printable = true;
    l0.frozen = false;
    l0.construction = false;
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
    if (e->visible == visible) return true;
    notify_before(DocumentChangeType::EntityMetaChanged, id);
    e->visible = visible;
    notify(DocumentChangeType::EntityMetaChanged, id);
    return true;
}

bool Document::set_entity_color(EntityId id, uint32_t color) {
    auto* e = get_entity(id);
    if (!e) return false;
    if (e->color == color) return true;
    notify_before(DocumentChangeType::EntityMetaChanged, id);
    e->color = color;
    notify(DocumentChangeType::EntityMetaChanged, id);
    return true;
}

bool Document::set_entity_group_id(EntityId id, int groupId) {
    auto* e = get_entity(id);
    if (!e) return false;
    if (e->groupId == groupId) return true;
    notify_before(DocumentChangeType::EntityMetaChanged, id);
    e->groupId = groupId;
    if (groupId >= 0 && groupId >= next_group_id_) {
        next_group_id_ = groupId + 1;
    }
    notify(DocumentChangeType::EntityMetaChanged, id);
    return true;
}

bool Document::set_entity_line_type(EntityId id, const std::string& lineType) {
    auto* e = get_entity(id);
    if (!e) return false;
    if (e->line_type == lineType) return true;
    notify_before(DocumentChangeType::EntityMetaChanged, id);
    e->line_type = lineType;
    notify(DocumentChangeType::EntityMetaChanged, id);
    return true;
}

bool Document::set_entity_line_weight(EntityId id, double weight) {
    auto* e = get_entity(id);
    if (!e) return false;
    if (e->line_weight == weight) return true;
    notify_before(DocumentChangeType::EntityMetaChanged, id);
    e->line_weight = weight;
    notify(DocumentChangeType::EntityMetaChanged, id);
    return true;
}

bool Document::set_entity_line_type_scale(EntityId id, double scale) {
    auto* e = get_entity(id);
    if (!e) return false;
    if (e->line_type_scale == scale) return true;
    notify_before(DocumentChangeType::EntityMetaChanged, id);
    e->line_type_scale = scale;
    notify(DocumentChangeType::EntityMetaChanged, id);
    return true;
}

int Document::alloc_group_id() {
    if (next_group_id_ < 1) next_group_id_ = 1;
    return next_group_id_++;
}

bool Document::set_label(const std::string& label) {
    if (metadata_.label == label) return true;
    notify_before(DocumentChangeType::DocumentMetaChanged);
    metadata_.label = label;
    notify(DocumentChangeType::DocumentMetaChanged);
    return true;
}

bool Document::set_author(const std::string& author) {
    if (metadata_.author == author) return true;
    notify_before(DocumentChangeType::DocumentMetaChanged);
    metadata_.author = author;
    notify(DocumentChangeType::DocumentMetaChanged);
    return true;
}

bool Document::set_company(const std::string& company) {
    if (metadata_.company == company) return true;
    notify_before(DocumentChangeType::DocumentMetaChanged);
    metadata_.company = company;
    notify(DocumentChangeType::DocumentMetaChanged);
    return true;
}

bool Document::set_comment(const std::string& comment) {
    if (metadata_.comment == comment) return true;
    notify_before(DocumentChangeType::DocumentMetaChanged);
    metadata_.comment = comment;
    notify(DocumentChangeType::DocumentMetaChanged);
    return true;
}

bool Document::set_created_at(const std::string& created_at) {
    if (metadata_.created_at == created_at) return true;
    notify_before(DocumentChangeType::DocumentMetaChanged);
    metadata_.created_at = created_at;
    notify(DocumentChangeType::DocumentMetaChanged);
    return true;
}

bool Document::set_modified_at(const std::string& modified_at) {
    if (metadata_.modified_at == modified_at) return true;
    notify_before(DocumentChangeType::DocumentMetaChanged);
    metadata_.modified_at = modified_at;
    notify(DocumentChangeType::DocumentMetaChanged);
    return true;
}

bool Document::set_unit_name(const std::string& unit_name) {
    if (metadata_.unit_name == unit_name) return true;
    notify_before(DocumentChangeType::DocumentMetaChanged);
    metadata_.unit_name = unit_name;
    notify(DocumentChangeType::DocumentMetaChanged);
    return true;
}

bool Document::set_meta_value(const std::string& key, const std::string& value) {
    if (key.empty()) return false;
    auto it = metadata_.meta.find(key);
    if (it != metadata_.meta.end() && it->second == value) return true;
    notify_before(DocumentChangeType::DocumentMetaChanged);
    metadata_.meta[key] = value;
    notify(DocumentChangeType::DocumentMetaChanged);
    return true;
}

bool Document::remove_meta_value(const std::string& key) {
    if (key.empty()) return false;
    auto it = metadata_.meta.find(key);
    if (it == metadata_.meta.end()) return false;
    metadata_.meta.erase(it);
    notify(DocumentChangeType::DocumentMetaChanged);
    return true;
}

bool Document::set_unit_scale(double unit_scale) {
    if (settings_.unit_scale == unit_scale) return true;
    settings_.unit_scale = unit_scale;
    notify(DocumentChangeType::SettingsChanged);
    return true;
}

// --- Block definition / instance management (P2.4) ---

int Document::add_block_definition(const std::string& name) {
    BlockDefinition bd;
    bd.name = name;
    block_definitions_.push_back(std::move(bd));
    return static_cast<int>(block_definitions_.size()) - 1;
}

bool Document::add_entity_to_block(int blockIndex, EntityId entityId) {
    if (blockIndex < 0 || blockIndex >= static_cast<int>(block_definitions_.size())) return false;
    block_definitions_[blockIndex].memberIds.push_back(entityId);
    return true;
}

EntityId Document::add_block_instance(const BlockInstance& inst, const std::string& name, int layerId) {
    Entity e;
    e.id = next_id_++;
    e.type = EntityType::BlockInstance;
    e.name = name;
    e.layerId = layerId;
    e.payload = inst;
    entities_.push_back(e);
    notify(DocumentChangeType::EntityAdded, e.id);
    return e.id;
}

// --- DependencyGraph (P3.2) ---

void DependencyGraph::addDependency(EntityId source, EntityId dependent) {
    if (source == dependent) return;
    forward_[source].insert(dependent);
    reverse_[dependent].insert(source);
}

void DependencyGraph::removeDependency(EntityId source, EntityId dependent) {
    auto fit = forward_.find(source);
    if (fit != forward_.end()) {
        fit->second.erase(dependent);
        if (fit->second.empty()) forward_.erase(fit);
    }
    auto rit = reverse_.find(dependent);
    if (rit != reverse_.end()) {
        rit->second.erase(source);
        if (rit->second.empty()) reverse_.erase(rit);
    }
}

void DependencyGraph::removeEntity(EntityId id) {
    // Remove all forward edges from id
    auto fit = forward_.find(id);
    if (fit != forward_.end()) {
        for (EntityId dep : fit->second) {
            auto rit = reverse_.find(dep);
            if (rit != reverse_.end()) {
                rit->second.erase(id);
                if (rit->second.empty()) reverse_.erase(rit);
            }
        }
        forward_.erase(fit);
    }
    // Remove all reverse edges to id
    auto rit = reverse_.find(id);
    if (rit != reverse_.end()) {
        for (EntityId src : rit->second) {
            auto fit2 = forward_.find(src);
            if (fit2 != forward_.end()) {
                fit2->second.erase(id);
                if (fit2->second.empty()) forward_.erase(fit2);
            }
        }
        reverse_.erase(rit);
    }
}

void DependencyGraph::clear() {
    forward_.clear();
    reverse_.clear();
}

std::vector<EntityId> DependencyGraph::dependentsOf(EntityId source) const {
    auto it = forward_.find(source);
    if (it == forward_.end()) return {};
    return {it->second.begin(), it->second.end()};
}

std::vector<EntityId> DependencyGraph::sourcesOf(EntityId dependent) const {
    auto it = reverse_.find(dependent);
    if (it == reverse_.end()) return {};
    return {it->second.begin(), it->second.end()};
}

bool DependencyGraph::wouldCycle(EntityId source, EntityId dependent) const {
    if (source == dependent) return true;
    // BFS from dependent through forward edges; if we reach source, it's a cycle
    std::unordered_set<EntityId> visited;
    std::vector<EntityId> queue = {dependent};
    while (!queue.empty()) {
        EntityId curr = queue.back();
        queue.pop_back();
        if (curr == source) return true;
        if (!visited.insert(curr).second) continue;
        auto it = forward_.find(curr);
        if (it != forward_.end()) {
            for (EntityId next : it->second) queue.push_back(next);
        }
    }
    return false;
}

std::vector<EntityId> DependencyGraph::topologicalOrder(const std::vector<EntityId>& roots, bool* hasCycle) const {
    if (hasCycle) *hasCycle = false;

    // BFS to collect all reachable entities from roots (downstream)
    std::unordered_set<EntityId> reachable;
    {
        std::vector<EntityId> queue = roots;
        while (!queue.empty()) {
            EntityId curr = queue.back();
            queue.pop_back();
            if (!reachable.insert(curr).second) continue;
            auto it = forward_.find(curr);
            if (it != forward_.end()) {
                for (EntityId next : it->second) queue.push_back(next);
            }
        }
    }

    // Kahn's algorithm on the reachable subgraph
    std::unordered_map<EntityId, int> in_degree;
    for (EntityId id : reachable) in_degree[id] = 0;
    for (EntityId id : reachable) {
        auto it = forward_.find(id);
        if (it == forward_.end()) continue;
        for (EntityId dep : it->second) {
            if (reachable.count(dep)) in_degree[dep]++;
        }
    }

    std::vector<EntityId> queue;
    for (auto& [id, deg] : in_degree) {
        if (deg == 0) queue.push_back(id);
    }

    std::vector<EntityId> order;
    order.reserve(reachable.size());
    while (!queue.empty()) {
        EntityId curr = queue.back();
        queue.pop_back();
        order.push_back(curr);
        auto it = forward_.find(curr);
        if (it == forward_.end()) continue;
        for (EntityId dep : it->second) {
            if (!reachable.count(dep)) continue;
            if (--in_degree[dep] == 0) queue.push_back(dep);
        }
    }

    if (order.size() < reachable.size() && hasCycle) {
        *hasCycle = true;
    }
    return order;
}

std::vector<EntityId> DependencyGraph::allEntities() const {
    std::unordered_set<EntityId> ids;
    for (auto& [k, v] : forward_) {
        ids.insert(k);
        for (EntityId d : v) ids.insert(d);
    }
    return {ids.begin(), ids.end()};
}

size_t DependencyGraph::edgeCount() const {
    size_t count = 0;
    for (auto& [k, v] : forward_) count += v.size();
    return count;
}

int Document::recompute(const std::vector<EntityId>& changedIds) {
    if (!recompute_cb_ || dep_graph_.empty()) return 0;
    bool hasCycle = false;
    auto order = dep_graph_.topologicalOrder(changedIds, &hasCycle);
    int count = 0;
    // Skip the root entities themselves (they already changed); recompute dependents only
    std::unordered_set<EntityId> roots(changedIds.begin(), changedIds.end());
    for (EntityId id : order) {
        if (roots.count(id)) continue;
        recompute_cb_(*this, id);
        count++;
    }
    return count;
}

int Document::recompute_all() {
    if (!recompute_cb_ || dep_graph_.empty()) return 0;
    auto all = dep_graph_.allEntities();
    // Find root entities (no sources)
    std::vector<EntityId> roots;
    for (EntityId id : all) {
        if (dep_graph_.sourcesOf(id).empty()) roots.push_back(id);
    }
    if (roots.empty()) return 0;
    bool hasCycle = false;
    auto order = dep_graph_.topologicalOrder(roots, &hasCycle);
    int count = 0;
    for (EntityId id : order) {
        recompute_cb_(*this, id);
        count++;
    }
    return count;
}

DocumentChangeGuard::DocumentChangeGuard(Document& doc) : doc_(&doc) {
    doc_->begin_change_batch();
}

DocumentChangeGuard::~DocumentChangeGuard() {
    if (doc_) doc_->end_change_batch();
}

// --- Transaction-based undo/redo (P2.1) ---

void Document::begin_transaction(const std::string& label) {
    active_tx_storage_ = Transaction{label, {}};
    active_transaction_ = &active_tx_storage_;
}

void Document::commit_transaction() {
    if (!active_transaction_) return;
    if (!active_transaction_->diffs.empty()) {
        undo_stack_.push_back(std::move(active_tx_storage_));
        redo_stack_.clear(); // new transaction invalidates redo
    }
    active_transaction_ = nullptr;
}

void Document::rollback_transaction() {
    if (!active_transaction_) return;
    // Apply diffs in reverse to restore original state
    for (auto it = active_transaction_->diffs.rbegin(); it != active_transaction_->diffs.rend(); ++it) {
        const auto& diff = *it;
        if (diff.type == DocumentChangeType::EntityGeometryChanged) {
            for (auto& ent : entities_) {
                if (ent.id == diff.entityId) {
                    ent.payload = diff.oldPayload;
                    break;
                }
            }
        } else if (diff.type == DocumentChangeType::EntityMetaChanged) {
            for (auto& ent : entities_) {
                if (ent.id == diff.entityId) {
                    ent.visible = diff.oldEntity.visible;
                    ent.color = diff.oldEntity.color;
                    ent.groupId = diff.oldEntity.groupId;
                    ent.line_type = diff.oldEntity.line_type;
                    ent.line_weight = diff.oldEntity.line_weight;
                    ent.line_type_scale = diff.oldEntity.line_type_scale;
                    break;
                }
            }
        } else if (diff.type == DocumentChangeType::LayerChanged) {
            for (auto& layer : layers_) {
                if (layer.id == diff.layerId) {
                    layer = diff.oldLayer;
                    break;
                }
            }
        }
    }
    active_transaction_ = nullptr;
}

bool Document::undo() {
    if (undo_stack_.empty()) return false;
    in_undo_redo_ = true;
    Transaction tx = std::move(undo_stack_.back());
    undo_stack_.pop_back();
    Transaction redo_tx{tx.label, {}};
    // Apply diffs in reverse
    for (auto it = tx.diffs.rbegin(); it != tx.diffs.rend(); ++it) {
        const auto& diff = *it;
        PropertyDiff redo_diff = diff;
        if (diff.type == DocumentChangeType::EntityGeometryChanged) {
            for (auto& ent : entities_) {
                if (ent.id == diff.entityId) {
                    redo_diff.oldPayload = ent.payload;
                    ent.payload = diff.oldPayload;
                    notify(DocumentChangeType::EntityGeometryChanged, ent.id);
                    break;
                }
            }
        } else if (diff.type == DocumentChangeType::EntityMetaChanged) {
            for (auto& ent : entities_) {
                if (ent.id == diff.entityId) {
                    redo_diff.oldEntity = ent;
                    ent.visible = diff.oldEntity.visible;
                    ent.color = diff.oldEntity.color;
                    ent.groupId = diff.oldEntity.groupId;
                    ent.line_type = diff.oldEntity.line_type;
                    ent.line_weight = diff.oldEntity.line_weight;
                    ent.line_type_scale = diff.oldEntity.line_type_scale;
                    notify(DocumentChangeType::EntityMetaChanged, ent.id);
                    break;
                }
            }
        } else if (diff.type == DocumentChangeType::LayerChanged) {
            for (auto& layer : layers_) {
                if (layer.id == diff.layerId) {
                    redo_diff.oldLayer = layer;
                    layer = diff.oldLayer;
                    notify(DocumentChangeType::LayerChanged, 0, layer.id);
                    break;
                }
            }
        }
        redo_tx.diffs.push_back(redo_diff);
    }
    redo_stack_.push_back(std::move(redo_tx));
    in_undo_redo_ = false;
    return true;
}

bool Document::redo() {
    if (redo_stack_.empty()) return false;
    in_undo_redo_ = true;
    Transaction tx = std::move(redo_stack_.back());
    redo_stack_.pop_back();
    Transaction undo_tx{tx.label, {}};
    for (auto it = tx.diffs.rbegin(); it != tx.diffs.rend(); ++it) {
        const auto& diff = *it;
        PropertyDiff undo_diff = diff;
        if (diff.type == DocumentChangeType::EntityGeometryChanged) {
            for (auto& ent : entities_) {
                if (ent.id == diff.entityId) {
                    undo_diff.oldPayload = ent.payload;
                    ent.payload = diff.oldPayload;
                    notify(DocumentChangeType::EntityGeometryChanged, ent.id);
                    break;
                }
            }
        } else if (diff.type == DocumentChangeType::EntityMetaChanged) {
            for (auto& ent : entities_) {
                if (ent.id == diff.entityId) {
                    undo_diff.oldEntity = ent;
                    ent.visible = diff.oldEntity.visible;
                    ent.color = diff.oldEntity.color;
                    ent.groupId = diff.oldEntity.groupId;
                    ent.line_type = diff.oldEntity.line_type;
                    ent.line_weight = diff.oldEntity.line_weight;
                    ent.line_type_scale = diff.oldEntity.line_type_scale;
                    notify(DocumentChangeType::EntityMetaChanged, ent.id);
                    break;
                }
            }
        } else if (diff.type == DocumentChangeType::LayerChanged) {
            for (auto& layer : layers_) {
                if (layer.id == diff.layerId) {
                    undo_diff.oldLayer = layer;
                    layer = diff.oldLayer;
                    notify(DocumentChangeType::LayerChanged, 0, layer.id);
                    break;
                }
            }
        }
        undo_tx.diffs.push_back(undo_diff);
    }
    undo_stack_.push_back(std::move(undo_tx));
    in_undo_redo_ = false;
    return true;
}

bool Document::can_undo() const { return !undo_stack_.empty(); }
bool Document::can_redo() const { return !redo_stack_.empty(); }
std::string Document::undo_label() const { return undo_stack_.empty() ? "" : undo_stack_.back().label; }
std::string Document::redo_label() const { return redo_stack_.empty() ? "" : redo_stack_.back().label; }
size_t Document::undo_stack_size() const { return undo_stack_.size(); }

} // namespace core
