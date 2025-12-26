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
    if (layer->visible == visible) return true;
    layer->visible = visible;
    notify(DocumentChangeType::LayerChanged, 0, id);
    return true;
}

bool Document::set_layer_locked(int id, bool locked) {
    auto* layer = get_layer(id);
    if (!layer) return false;
    if (layer->locked == locked) return true;
    layer->locked = locked;
    notify(DocumentChangeType::LayerChanged, 0, id);
    return true;
}

bool Document::set_layer_printable(int id, bool printable) {
    auto* layer = get_layer(id);
    if (!layer) return false;
    if (layer->printable == printable) return true;
    layer->printable = printable;
    notify(DocumentChangeType::LayerChanged, 0, id);
    return true;
}

bool Document::set_layer_frozen(int id, bool frozen) {
    auto* layer = get_layer(id);
    if (!layer) return false;
    if (layer->frozen == frozen) return true;
    layer->frozen = frozen;
    notify(DocumentChangeType::LayerChanged, 0, id);
    return true;
}

bool Document::set_layer_construction(int id, bool construction) {
    auto* layer = get_layer(id);
    if (!layer) return false;
    if (layer->construction == construction) return true;
    layer->construction = construction;
    notify(DocumentChangeType::LayerChanged, 0, id);
    return true;
}

bool Document::set_layer_color(int id, uint32_t color) {
    auto* layer = get_layer(id);
    if (!layer) return false;
    if (layer->color == color) return true;
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
    pt->p = p;
    notify(DocumentChangeType::EntityGeometryChanged, id);
    return true;
}

bool Document::set_line(EntityId id, const Line& l) {
    auto* ln = get_line(id);
    if (!ln) return false;
    if (ln->a.x == l.a.x && ln->a.y == l.a.y && ln->b.x == l.b.x && ln->b.y == l.b.y) return true;
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
    *arc = a;
    notify(DocumentChangeType::EntityGeometryChanged, id);
    return true;
}

bool Document::set_circle(EntityId id, const Circle& c) {
    auto* circ = get_circle(id);
    if (!circ) return false;
    if (circ->center.x == c.center.x && circ->center.y == c.center.y && circ->radius == c.radius) return true;
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
    metadata_ = DocumentMetadata{};
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
    e->visible = visible;
    notify(DocumentChangeType::EntityMetaChanged, id);
    return true;
}

bool Document::set_entity_color(EntityId id, uint32_t color) {
    auto* e = get_entity(id);
    if (!e) return false;
    if (e->color == color) return true;
    e->color = color;
    notify(DocumentChangeType::EntityMetaChanged, id);
    return true;
}

bool Document::set_entity_group_id(EntityId id, int groupId) {
    auto* e = get_entity(id);
    if (!e) return false;
    if (e->groupId == groupId) return true;
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
    e->line_type = lineType;
    notify(DocumentChangeType::EntityMetaChanged, id);
    return true;
}

bool Document::set_entity_line_weight(EntityId id, double weight) {
    auto* e = get_entity(id);
    if (!e) return false;
    if (e->line_weight == weight) return true;
    e->line_weight = weight;
    notify(DocumentChangeType::EntityMetaChanged, id);
    return true;
}

bool Document::set_entity_line_type_scale(EntityId id, double scale) {
    auto* e = get_entity(id);
    if (!e) return false;
    if (e->line_type_scale == scale) return true;
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
    metadata_.label = label;
    notify(DocumentChangeType::DocumentMetaChanged);
    return true;
}

bool Document::set_author(const std::string& author) {
    if (metadata_.author == author) return true;
    metadata_.author = author;
    notify(DocumentChangeType::DocumentMetaChanged);
    return true;
}

bool Document::set_company(const std::string& company) {
    if (metadata_.company == company) return true;
    metadata_.company = company;
    notify(DocumentChangeType::DocumentMetaChanged);
    return true;
}

bool Document::set_comment(const std::string& comment) {
    if (metadata_.comment == comment) return true;
    metadata_.comment = comment;
    notify(DocumentChangeType::DocumentMetaChanged);
    return true;
}

bool Document::set_created_at(const std::string& created_at) {
    if (metadata_.created_at == created_at) return true;
    metadata_.created_at = created_at;
    notify(DocumentChangeType::DocumentMetaChanged);
    return true;
}

bool Document::set_modified_at(const std::string& modified_at) {
    if (metadata_.modified_at == modified_at) return true;
    metadata_.modified_at = modified_at;
    notify(DocumentChangeType::DocumentMetaChanged);
    return true;
}

bool Document::set_unit_name(const std::string& unit_name) {
    if (metadata_.unit_name == unit_name) return true;
    metadata_.unit_name = unit_name;
    notify(DocumentChangeType::DocumentMetaChanged);
    return true;
}

bool Document::set_meta_value(const std::string& key, const std::string& value) {
    if (key.empty()) return false;
    auto it = metadata_.meta.find(key);
    if (it != metadata_.meta.end() && it->second == value) return true;
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

DocumentChangeGuard::DocumentChangeGuard(Document& doc) : doc_(&doc) {
    doc_->begin_change_batch();
}

DocumentChangeGuard::~DocumentChangeGuard() {
    if (doc_) doc_->end_change_batch();
}

} // namespace core
