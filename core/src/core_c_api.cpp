#include "core/core_c_api.h"
#include "core/document.hpp"
#include "core/geometry2d.hpp"
#include "core/ops2d.hpp"
#include "core/version.hpp"

#include <algorithm>
#include <cstring>
#include <iterator>

using namespace core;

struct core_document { Document impl; };

extern "C" {

CORE_API int core_get_abi_version() {
    return CADGF_ABI_VERSION;
}

CORE_API const char* core_get_version() {
    return core::version_string();
}

CORE_API unsigned int core_get_feature_flags() {
    unsigned int flags = 0u;
#if defined(USE_EARCUT)
    flags |= 1u << 0;
#endif
#if defined(USE_CLIPPER2)
    flags |= 1u << 1;
#endif
    return flags;
}

CORE_API core_document* core_document_create() {
    return new core_document{Document{}};
}

CORE_API void core_document_destroy(core_document* doc) {
    delete doc;
}

CORE_API core_entity_id core_document_add_polyline(core_document* doc, const core_vec2* pts, int n) {
    if (!doc || !pts || n <= 1) return 0;
    Polyline pl;
    pl.points.reserve(static_cast<size_t>(n));
    for (int i=0;i<n;i++) pl.points.push_back(Vec2{pts[i].x, pts[i].y});
    return doc->impl.add_polyline(pl);
}

CORE_API core_entity_id core_document_add_polyline_ex(core_document* doc, const core_vec2* pts, int n,
                                                      const char* name_utf8, int layer_id) {
    if (!doc || !pts || n <= 1) return 0;
    Polyline pl;
    pl.points.reserve(static_cast<size_t>(n));
    for (int i=0;i<n;i++) pl.points.push_back(Vec2{pts[i].x, pts[i].y});
    return doc->impl.add_polyline(pl, name_utf8 ? name_utf8 : "", layer_id);
}

CORE_API core_entity_id core_document_add_point(core_document* doc, const core_point* p,
                                                const char* name_utf8, int layer_id) {
    if (!doc || !p) return 0;
    return doc->impl.add_point(Vec2{p->p.x, p->p.y}, name_utf8 ? name_utf8 : "", layer_id);
}

CORE_API core_entity_id core_document_add_line(core_document* doc, const core_line* l,
                                               const char* name_utf8, int layer_id) {
    if (!doc || !l) return 0;
    Line line;
    line.a = Vec2{l->a.x, l->a.y};
    line.b = Vec2{l->b.x, l->b.y};
    return doc->impl.add_line(line, name_utf8 ? name_utf8 : "", layer_id);
}

CORE_API core_entity_id core_document_add_arc(core_document* doc, const core_arc* a,
                                              const char* name_utf8, int layer_id) {
    if (!doc || !a) return 0;
    Arc arc;
    arc.center = Vec2{a->center.x, a->center.y};
    arc.radius = a->radius;
    arc.start_angle = a->start_angle;
    arc.end_angle = a->end_angle;
    arc.clockwise = a->clockwise;
    return doc->impl.add_arc(arc, name_utf8 ? name_utf8 : "", layer_id);
}

CORE_API core_entity_id core_document_add_circle(core_document* doc, const core_circle* c,
                                                 const char* name_utf8, int layer_id) {
    if (!doc || !c) return 0;
    Circle circle;
    circle.center = Vec2{c->center.x, c->center.y};
    circle.radius = c->radius;
    return doc->impl.add_circle(circle, name_utf8 ? name_utf8 : "", layer_id);
}

CORE_API core_entity_id core_document_add_ellipse(core_document* doc, const core_ellipse* e,
                                                  const char* name_utf8, int layer_id) {
    if (!doc || !e) return 0;
    Ellipse ellipse;
    ellipse.center = Vec2{e->center.x, e->center.y};
    ellipse.rx = e->rx;
    ellipse.ry = e->ry;
    ellipse.rotation = e->rotation;
    ellipse.start_angle = e->start_angle;
    ellipse.end_angle = e->end_angle;
    return doc->impl.add_ellipse(ellipse, name_utf8 ? name_utf8 : "", layer_id);
}

CORE_API core_entity_id core_document_add_text(core_document* doc, const core_vec2* pos,
                                               double height, double rotation,
                                               const char* text_utf8,
                                               const char* name_utf8, int layer_id) {
    if (!doc || !pos) return 0;
    Text t;
    t.pos = Vec2{pos->x, pos->y};
    t.height = height;
    t.rotation = rotation;
    t.text = text_utf8 ? text_utf8 : "";
    return doc->impl.add_text(t, name_utf8 ? name_utf8 : "", layer_id);
}

CORE_API core_entity_id core_document_add_spline(core_document* doc,
                                                 const core_vec2* control_pts, int control_count,
                                                 const double* knots, int knot_count,
                                                 int degree, const char* name_utf8, int layer_id) {
    if (!doc || !control_pts || control_count < 2) return 0;
    if (knot_count > 0 && !knots) return 0;
    Spline s;
    s.degree = degree;
    s.control_points.reserve(static_cast<size_t>(control_count));
    for (int i = 0; i < control_count; ++i) {
        s.control_points.push_back(Vec2{control_pts[i].x, control_pts[i].y});
    }
    if (knot_count > 0) {
        s.knots.reserve(static_cast<size_t>(knot_count));
        for (int i = 0; i < knot_count; ++i) s.knots.push_back(knots[i]);
    }
    return doc->impl.add_spline(s, name_utf8 ? name_utf8 : "", layer_id);
}

CORE_API int core_document_remove_entity(core_document* doc, core_entity_id id) {
    if (!doc) return 0;
    return doc->impl.remove_entity(id) ? 1 : 0;
}

static bool copy_utf8(const std::string& s, char* out, int out_cap, int* out_required_bytes) {
    const int required = static_cast<int>(s.size()) + 1; // include NUL
    if (out_required_bytes) *out_required_bytes = required;

    if (!out || out_cap <= 0) return true; // query only

    const int copy_len = std::min(static_cast<int>(s.size()), out_cap - 1);
    if (copy_len > 0) std::memcpy(out, s.data(), static_cast<size_t>(copy_len));
    out[copy_len] = '\0';

    return out_cap >= required;
}

CORE_API int core_document_get_layer_count(const core_document* doc, int* out_count) {
    if (!doc || !out_count) return 0;
    *out_count = static_cast<int>(doc->impl.layers().size());
    return 1;
}

CORE_API int core_document_get_layer_id_at(const core_document* doc, int index, int* out_layer_id) {
    if (!doc || !out_layer_id || index < 0) return 0;
    const auto& layers = doc->impl.layers();
    if (static_cast<size_t>(index) >= layers.size()) return 0;
    *out_layer_id = layers[static_cast<size_t>(index)].id;
    return 1;
}

CORE_API int core_document_get_layer_info(const core_document* doc, int layer_id, core_layer_info* out_info) {
    if (!doc || !out_info) return 0;
    const auto* layer = doc->impl.get_layer(layer_id);
    if (!layer) return 0;
    out_info->id = layer->id;
    out_info->color = static_cast<unsigned int>(layer->color);
    out_info->visible = layer->visible ? 1 : 0;
    out_info->locked = layer->locked ? 1 : 0;
    return 1;
}

CORE_API int core_document_get_layer_info_v2(const core_document* doc, int layer_id, core_layer_info_v2* out_info) {
    if (!doc || !out_info) return 0;
    const auto* layer = doc->impl.get_layer(layer_id);
    if (!layer) return 0;
    out_info->id = layer->id;
    out_info->color = static_cast<unsigned int>(layer->color);
    out_info->visible = layer->visible ? 1 : 0;
    out_info->locked = layer->locked ? 1 : 0;
    out_info->printable = layer->printable ? 1 : 0;
    out_info->frozen = layer->frozen ? 1 : 0;
    out_info->construction = layer->construction ? 1 : 0;
    return 1;
}

CORE_API int core_document_get_layer_name(const core_document* doc, int layer_id,
                                          char* out_name_utf8, int out_name_capacity,
                                          int* out_required_bytes) {
    if (!doc) return 0;
    const auto* layer = doc->impl.get_layer(layer_id);
    if (!layer) return 0;
    const bool ok = copy_utf8(layer->name, out_name_utf8, out_name_capacity, out_required_bytes);
    return ok ? 1 : 0;
}

CORE_API int core_document_add_layer(core_document* doc, const char* name_utf8, unsigned int color, int* out_layer_id) {
    if (!doc || !out_layer_id) return 0;
    *out_layer_id = doc->impl.add_layer(name_utf8 ? name_utf8 : "", static_cast<uint32_t>(color));
    return (*out_layer_id >= 0) ? 1 : 0;
}

CORE_API int core_document_set_layer_visible(core_document* doc, int layer_id, int visible) {
    if (!doc) return 0;
    return doc->impl.set_layer_visible(layer_id, visible != 0) ? 1 : 0;
}

CORE_API int core_document_set_layer_locked(core_document* doc, int layer_id, int locked) {
    if (!doc) return 0;
    return doc->impl.set_layer_locked(layer_id, locked != 0) ? 1 : 0;
}

CORE_API int core_document_set_layer_printable(core_document* doc, int layer_id, int printable) {
    if (!doc) return 0;
    return doc->impl.set_layer_printable(layer_id, printable != 0) ? 1 : 0;
}

CORE_API int core_document_set_layer_frozen(core_document* doc, int layer_id, int frozen) {
    if (!doc) return 0;
    return doc->impl.set_layer_frozen(layer_id, frozen != 0) ? 1 : 0;
}

CORE_API int core_document_set_layer_construction(core_document* doc, int layer_id, int construction) {
    if (!doc) return 0;
    return doc->impl.set_layer_construction(layer_id, construction != 0) ? 1 : 0;
}

CORE_API int core_document_set_layer_color(core_document* doc, int layer_id, unsigned int color) {
    if (!doc) return 0;
    return doc->impl.set_layer_color(layer_id, static_cast<uint32_t>(color)) ? 1 : 0;
}

CORE_API int core_document_get_entity_count(const core_document* doc, int* out_count) {
    if (!doc || !out_count) return 0;
    *out_count = static_cast<int>(doc->impl.entities().size());
    return 1;
}

CORE_API int core_document_get_entity_id_at(const core_document* doc, int index, core_entity_id* out_entity_id) {
    if (!doc || !out_entity_id || index < 0) return 0;
    const auto& ents = doc->impl.entities();
    if (static_cast<size_t>(index) >= ents.size()) return 0;
    *out_entity_id = static_cast<core_entity_id>(ents[static_cast<size_t>(index)].id);
    return 1;
}

static const Entity* find_entity(const Document& d, core_entity_id id) {
    const auto& ents = d.entities();
    for (const auto& e : ents) {
        if (e.id == static_cast<EntityId>(id)) return &e;
    }
    return nullptr;
}

static int entity_type_to_c(EntityType type) {
    switch (type) {
        case EntityType::Polyline: return CORE_ENTITY_TYPE_POLYLINE;
        case EntityType::Point: return CORE_ENTITY_TYPE_POINT;
        case EntityType::Line: return CORE_ENTITY_TYPE_LINE;
        case EntityType::Arc: return CORE_ENTITY_TYPE_ARC;
        case EntityType::Circle: return CORE_ENTITY_TYPE_CIRCLE;
        case EntityType::Ellipse: return CORE_ENTITY_TYPE_ELLIPSE;
        case EntityType::Spline: return CORE_ENTITY_TYPE_SPLINE;
        case EntityType::Text: return CORE_ENTITY_TYPE_TEXT;
        default: return CORE_ENTITY_TYPE_POLYLINE;
    }
}

CORE_API int core_document_get_entity_info(const core_document* doc, core_entity_id id, core_entity_info* out_info) {
    if (!doc || !out_info) return 0;
    const auto* e = find_entity(doc->impl, id);
    if (!e) return 0;
    out_info->id = static_cast<core_entity_id>(e->id);
    out_info->type = entity_type_to_c(e->type);
    out_info->layer_id = e->layerId;
    return 1;
}

CORE_API int core_document_get_entity_info_v2(const core_document* doc, core_entity_id id, core_entity_info_v2* out_info) {
    if (!doc || !out_info) return 0;
    const auto* e = find_entity(doc->impl, id);
    if (!e) return 0;
    out_info->id = static_cast<core_entity_id>(e->id);
    out_info->type = entity_type_to_c(e->type);
    out_info->layer_id = e->layerId;
    out_info->visible = e->visible ? 1 : 0;
    out_info->group_id = e->groupId;
    out_info->color = static_cast<unsigned int>(e->color);
    return 1;
}

CORE_API int core_document_get_entity_name(const core_document* doc, core_entity_id id,
                                           char* out_name_utf8, int out_name_capacity,
                                           int* out_required_bytes) {
    if (!doc) return 0;
    const auto* e = find_entity(doc->impl, id);
    if (!e) return 0;
    const bool ok = copy_utf8(e->name, out_name_utf8, out_name_capacity, out_required_bytes);
    return ok ? 1 : 0;
}

CORE_API int core_document_get_polyline_points(const core_document* doc, core_entity_id id,
                                               core_vec2* out_pts, int out_pts_capacity,
                                               int* out_required_points) {
    if (!doc || !out_required_points) return 0;
    const auto* e = find_entity(doc->impl, id);
    if (!e || e->type != EntityType::Polyline) return 0;

    const auto* pl = std::get_if<Polyline>(&e->payload);
    if (!pl) return 0;

    const int count = static_cast<int>(pl->points.size());
    *out_required_points = count;

    if (!out_pts || out_pts_capacity <= 0) return 1; // query only
    if (out_pts_capacity < count) return 0;

    for (int i = 0; i < count; ++i) out_pts[i] = core_vec2{pl->points[static_cast<size_t>(i)].x, pl->points[static_cast<size_t>(i)].y};
    return 1;
}

CORE_API int core_document_set_polyline_points(core_document* doc, core_entity_id id,
                                               const core_vec2* pts, int n) {
    if (!doc || !pts || n <= 1) return 0;
    Polyline pl;
    pl.points.reserve(static_cast<size_t>(n));
    for (int i = 0; i < n; ++i) {
        pl.points.push_back(Vec2{pts[i].x, pts[i].y});
    }
    return doc->impl.set_polyline_points(static_cast<EntityId>(id), pl) ? 1 : 0;
}

CORE_API int core_document_get_point(const core_document* doc, core_entity_id id, core_point* out_p) {
    if (!doc || !out_p) return 0;
    const auto* pt = doc->impl.get_point(static_cast<EntityId>(id));
    if (!pt) return 0;
    out_p->p = core_vec2{pt->p.x, pt->p.y};
    return 1;
}

CORE_API int core_document_get_line(const core_document* doc, core_entity_id id, core_line* out_l) {
    if (!doc || !out_l) return 0;
    const auto* ln = doc->impl.get_line(static_cast<EntityId>(id));
    if (!ln) return 0;
    out_l->a = core_vec2{ln->a.x, ln->a.y};
    out_l->b = core_vec2{ln->b.x, ln->b.y};
    return 1;
}

CORE_API int core_document_get_arc(const core_document* doc, core_entity_id id, core_arc* out_a) {
    if (!doc || !out_a) return 0;
    const auto* arc = doc->impl.get_arc(static_cast<EntityId>(id));
    if (!arc) return 0;
    out_a->center = core_vec2{arc->center.x, arc->center.y};
    out_a->radius = arc->radius;
    out_a->start_angle = arc->start_angle;
    out_a->end_angle = arc->end_angle;
    out_a->clockwise = arc->clockwise;
    return 1;
}

CORE_API int core_document_get_circle(const core_document* doc, core_entity_id id, core_circle* out_c) {
    if (!doc || !out_c) return 0;
    const auto* circle = doc->impl.get_circle(static_cast<EntityId>(id));
    if (!circle) return 0;
    out_c->center = core_vec2{circle->center.x, circle->center.y};
    out_c->radius = circle->radius;
    return 1;
}

CORE_API int core_document_get_ellipse(const core_document* doc, core_entity_id id, core_ellipse* out_e) {
    if (!doc || !out_e) return 0;
    const auto* ellipse = doc->impl.get_ellipse(static_cast<EntityId>(id));
    if (!ellipse) return 0;
    out_e->center = core_vec2{ellipse->center.x, ellipse->center.y};
    out_e->rx = ellipse->rx;
    out_e->ry = ellipse->ry;
    out_e->rotation = ellipse->rotation;
    out_e->start_angle = ellipse->start_angle;
    out_e->end_angle = ellipse->end_angle;
    return 1;
}

CORE_API int core_document_get_text(const core_document* doc, core_entity_id id,
                                    core_vec2* out_pos, double* out_height, double* out_rotation,
                                    char* out_text_utf8, int out_text_capacity,
                                    int* out_required_bytes) {
    if (!doc || !out_required_bytes) return 0;
    const auto* text = doc->impl.get_text(static_cast<EntityId>(id));
    if (!text) return 0;
    if (out_pos) {
        out_pos->x = text->pos.x;
        out_pos->y = text->pos.y;
    }
    if (out_height) *out_height = text->height;
    if (out_rotation) *out_rotation = text->rotation;
    const bool ok = copy_utf8(text->text, out_text_utf8, out_text_capacity, out_required_bytes);
    return ok ? 1 : 0;
}

CORE_API int core_document_get_spline(const core_document* doc, core_entity_id id,
                                      core_vec2* out_control_pts, int out_control_capacity,
                                      int* out_required_control_pts,
                                      double* out_knots, int out_knot_capacity,
                                      int* out_required_knots,
                                      int* out_degree) {
    if (!doc || !out_required_control_pts || !out_required_knots || !out_degree) return 0;
    const auto* spline = doc->impl.get_spline(static_cast<EntityId>(id));
    if (!spline) return 0;
    const int control_count = static_cast<int>(spline->control_points.size());
    const int knot_count = static_cast<int>(spline->knots.size());
    *out_required_control_pts = control_count;
    *out_required_knots = knot_count;
    *out_degree = spline->degree;

    if (out_control_pts && out_control_capacity > 0) {
        if (out_control_capacity < control_count) return 0;
        for (int i = 0; i < control_count; ++i) {
            out_control_pts[i] = core_vec2{spline->control_points[static_cast<size_t>(i)].x,
                                           spline->control_points[static_cast<size_t>(i)].y};
        }
    }

    if (out_knots && out_knot_capacity > 0) {
        if (out_knot_capacity < knot_count) return 0;
        for (int i = 0; i < knot_count; ++i) out_knots[i] = spline->knots[static_cast<size_t>(i)];
    }

    return 1;
}

CORE_API int core_document_set_point(core_document* doc, core_entity_id id, const core_point* p) {
    if (!doc || !p) return 0;
    return doc->impl.set_point(static_cast<EntityId>(id), Vec2{p->p.x, p->p.y}) ? 1 : 0;
}

CORE_API int core_document_set_line(core_document* doc, core_entity_id id, const core_line* l) {
    if (!doc || !l) return 0;
    Line line;
    line.a = Vec2{l->a.x, l->a.y};
    line.b = Vec2{l->b.x, l->b.y};
    return doc->impl.set_line(static_cast<EntityId>(id), line) ? 1 : 0;
}

CORE_API int core_document_set_arc(core_document* doc, core_entity_id id, const core_arc* a) {
    if (!doc || !a) return 0;
    Arc arc;
    arc.center = Vec2{a->center.x, a->center.y};
    arc.radius = a->radius;
    arc.start_angle = a->start_angle;
    arc.end_angle = a->end_angle;
    arc.clockwise = a->clockwise;
    return doc->impl.set_arc(static_cast<EntityId>(id), arc) ? 1 : 0;
}

CORE_API int core_document_set_circle(core_document* doc, core_entity_id id, const core_circle* c) {
    if (!doc || !c) return 0;
    Circle circle;
    circle.center = Vec2{c->center.x, c->center.y};
    circle.radius = c->radius;
    return doc->impl.set_circle(static_cast<EntityId>(id), circle) ? 1 : 0;
}

CORE_API int core_document_set_ellipse(core_document* doc, core_entity_id id, const core_ellipse* e) {
    if (!doc || !e) return 0;
    Ellipse ellipse;
    ellipse.center = Vec2{e->center.x, e->center.y};
    ellipse.rx = e->rx;
    ellipse.ry = e->ry;
    ellipse.rotation = e->rotation;
    ellipse.start_angle = e->start_angle;
    ellipse.end_angle = e->end_angle;
    return doc->impl.set_ellipse(static_cast<EntityId>(id), ellipse) ? 1 : 0;
}

CORE_API int core_document_set_entity_visible(core_document* doc, core_entity_id id, int visible) {
    if (!doc) return 0;
    return doc->impl.set_entity_visible(static_cast<EntityId>(id), visible != 0) ? 1 : 0;
}

CORE_API int core_document_set_entity_color(core_document* doc, core_entity_id id, unsigned int color) {
    if (!doc) return 0;
    return doc->impl.set_entity_color(static_cast<EntityId>(id), static_cast<uint32_t>(color)) ? 1 : 0;
}

CORE_API int core_document_set_entity_group_id(core_document* doc, core_entity_id id, int group_id) {
    if (!doc) return 0;
    return doc->impl.set_entity_group_id(static_cast<EntityId>(id), group_id) ? 1 : 0;
}

CORE_API int core_document_set_entity_line_type(core_document* doc, core_entity_id id, const char* line_type_utf8) {
    if (!doc) return 0;
    return doc->impl.set_entity_line_type(static_cast<EntityId>(id), line_type_utf8 ? line_type_utf8 : "") ? 1 : 0;
}

CORE_API int core_document_get_entity_line_type(const core_document* doc, core_entity_id id,
                                                char* out_utf8, int out_cap, int* out_required) {
    if (!doc) return 0;
    const auto* e = doc->impl.get_entity(static_cast<EntityId>(id));
    if (!e) return 0;
    const bool ok = copy_utf8(e->line_type, out_utf8, out_cap, out_required);
    return ok ? 1 : 0;
}

CORE_API int core_document_set_entity_line_weight(core_document* doc, core_entity_id id, double weight) {
    if (!doc) return 0;
    return doc->impl.set_entity_line_weight(static_cast<EntityId>(id), weight) ? 1 : 0;
}

CORE_API int core_document_get_entity_line_weight(const core_document* doc, core_entity_id id, double* out_weight) {
    if (!doc || !out_weight) return 0;
    const auto* e = doc->impl.get_entity(static_cast<EntityId>(id));
    if (!e) return 0;
    *out_weight = e->line_weight;
    return 1;
}

CORE_API int core_document_set_entity_line_type_scale(core_document* doc, core_entity_id id, double scale) {
    if (!doc) return 0;
    return doc->impl.set_entity_line_type_scale(static_cast<EntityId>(id), scale) ? 1 : 0;
}

CORE_API int core_document_get_entity_line_type_scale(const core_document* doc, core_entity_id id, double* out_scale) {
    if (!doc || !out_scale) return 0;
    const auto* e = doc->impl.get_entity(static_cast<EntityId>(id));
    if (!e) return 0;
    *out_scale = e->line_type_scale;
    return 1;
}

CORE_API int core_document_alloc_group_id(core_document* doc) {
    if (!doc) return -1;
    return doc->impl.alloc_group_id();
}

CORE_API double core_document_get_unit_scale(const core_document* doc) {
    if (!doc) return 1.0;
    return doc->impl.settings().unit_scale;
}

CORE_API int core_document_set_unit_scale(core_document* doc, double unit_scale) {
    if (!doc) return 0;
    return doc->impl.set_unit_scale(unit_scale) ? 1 : 0;
}

CORE_API int core_document_get_label(const core_document* doc, char* out_utf8, int out_cap, int* out_required_bytes) {
    if (!doc) return 0;
    return copy_utf8(doc->impl.metadata().label, out_utf8, out_cap, out_required_bytes) ? 1 : 0;
}

CORE_API int core_document_set_label(core_document* doc, const char* label_utf8) {
    if (!doc) return 0;
    return doc->impl.set_label(label_utf8 ? label_utf8 : "") ? 1 : 0;
}

CORE_API int core_document_get_author(const core_document* doc, char* out_utf8, int out_cap, int* out_required_bytes) {
    if (!doc) return 0;
    return copy_utf8(doc->impl.metadata().author, out_utf8, out_cap, out_required_bytes) ? 1 : 0;
}

CORE_API int core_document_set_author(core_document* doc, const char* author_utf8) {
    if (!doc) return 0;
    return doc->impl.set_author(author_utf8 ? author_utf8 : "") ? 1 : 0;
}

CORE_API int core_document_get_company(const core_document* doc, char* out_utf8, int out_cap, int* out_required_bytes) {
    if (!doc) return 0;
    return copy_utf8(doc->impl.metadata().company, out_utf8, out_cap, out_required_bytes) ? 1 : 0;
}

CORE_API int core_document_set_company(core_document* doc, const char* company_utf8) {
    if (!doc) return 0;
    return doc->impl.set_company(company_utf8 ? company_utf8 : "") ? 1 : 0;
}

CORE_API int core_document_get_comment(const core_document* doc, char* out_utf8, int out_cap, int* out_required_bytes) {
    if (!doc) return 0;
    return copy_utf8(doc->impl.metadata().comment, out_utf8, out_cap, out_required_bytes) ? 1 : 0;
}

CORE_API int core_document_set_comment(core_document* doc, const char* comment_utf8) {
    if (!doc) return 0;
    return doc->impl.set_comment(comment_utf8 ? comment_utf8 : "") ? 1 : 0;
}

CORE_API int core_document_get_created_at(const core_document* doc, char* out_utf8, int out_cap, int* out_required_bytes) {
    if (!doc) return 0;
    return copy_utf8(doc->impl.metadata().created_at, out_utf8, out_cap, out_required_bytes) ? 1 : 0;
}

CORE_API int core_document_set_created_at(core_document* doc, const char* created_at_utf8) {
    if (!doc) return 0;
    return doc->impl.set_created_at(created_at_utf8 ? created_at_utf8 : "") ? 1 : 0;
}

CORE_API int core_document_get_modified_at(const core_document* doc, char* out_utf8, int out_cap, int* out_required_bytes) {
    if (!doc) return 0;
    return copy_utf8(doc->impl.metadata().modified_at, out_utf8, out_cap, out_required_bytes) ? 1 : 0;
}

CORE_API int core_document_set_modified_at(core_document* doc, const char* modified_at_utf8) {
    if (!doc) return 0;
    return doc->impl.set_modified_at(modified_at_utf8 ? modified_at_utf8 : "") ? 1 : 0;
}

CORE_API int core_document_get_unit_name(const core_document* doc, char* out_utf8, int out_cap, int* out_required_bytes) {
    if (!doc) return 0;
    return copy_utf8(doc->impl.metadata().unit_name, out_utf8, out_cap, out_required_bytes) ? 1 : 0;
}

CORE_API int core_document_set_unit_name(core_document* doc, const char* unit_name_utf8) {
    if (!doc) return 0;
    return doc->impl.set_unit_name(unit_name_utf8 ? unit_name_utf8 : "") ? 1 : 0;
}

CORE_API int core_document_get_meta_count(const core_document* doc, int* out_count) {
    if (!doc || !out_count) return 0;
    *out_count = static_cast<int>(doc->impl.metadata().meta.size());
    return 1;
}

CORE_API int core_document_get_meta_key_at(const core_document* doc, int index,
                                           char* out_key_utf8, int out_key_capacity,
                                           int* out_required_bytes) {
    if (!doc || index < 0) return 0;
    const auto& meta = doc->impl.metadata().meta;
    if (static_cast<size_t>(index) >= meta.size()) return 0;
    auto it = meta.begin();
    std::advance(it, index);
    return copy_utf8(it->first, out_key_utf8, out_key_capacity, out_required_bytes) ? 1 : 0;
}

CORE_API int core_document_get_meta_value(const core_document* doc, const char* key_utf8,
                                          char* out_value_utf8, int out_value_capacity,
                                          int* out_required_bytes) {
    if (!doc || !key_utf8) return 0;
    const auto& meta = doc->impl.metadata().meta;
    auto it = meta.find(key_utf8);
    if (it == meta.end()) return 0;
    return copy_utf8(it->second, out_value_utf8, out_value_capacity, out_required_bytes) ? 1 : 0;
}

CORE_API int core_document_set_meta_value(core_document* doc, const char* key_utf8, const char* value_utf8) {
    if (!doc || !key_utf8 || key_utf8[0] == '\0') return 0;
    return doc->impl.set_meta_value(key_utf8, value_utf8 ? value_utf8 : "") ? 1 : 0;
}

CORE_API int core_document_remove_meta_value(core_document* doc, const char* key_utf8) {
    if (!doc || !key_utf8 || key_utf8[0] == '\0') return 0;
    return doc->impl.remove_meta_value(key_utf8) ? 1 : 0;
}

} // extern C

extern "C" {

CORE_API int core_triangulate_polygon(const core_vec2* pts, int n,
                                      unsigned int* indices, int* index_count) {
    if (!pts || n < 3 || !index_count) return 0;
    std::vector<Vec2> poly;
    poly.reserve(static_cast<size_t>(n));
    for (int i=0;i<n;i++) poly.push_back(Vec2{pts[i].x, pts[i].y});
    TriMesh2D m = triangulate_polygon(poly);
    if (m.indices.empty()) { *index_count = 0; return 0; }
    *index_count = static_cast<int>(m.indices.size());
    if (!indices) return 1; // query only
    for (size_t i=0;i<m.indices.size();++i) indices[i] = m.indices[i];
    return 1;
}

} // extern C

extern "C" {

static core::BoolOp to_boolop(int op) {
    switch (op) {
        case 0: return core::BoolOp::Union;
        case 1: return core::BoolOp::Difference;
        case 2: return core::BoolOp::Intersection;
        case 3: return core::BoolOp::Xor;
        default: return core::BoolOp::Union;
    }
}

CORE_API int core_boolean_op_single(const core_vec2* subj, int subj_n,
                                    const core_vec2* clip, int clip_n,
                                    int op,
                                    core_vec2* out_pts, int* out_counts,
                                    int* poly_count, int* total_pts) {
    if (!subj || subj_n < 3 || !clip || clip_n < 3 || !poly_count || !total_pts) return 0;
    Polyline s; s.points.reserve(subj_n);
    for (int i=0;i<subj_n;i++) s.points.push_back(Vec2{subj[i].x, subj[i].y});
    Polyline c; c.points.reserve(clip_n);
    for (int i=0;i<clip_n;i++) c.points.push_back(Vec2{clip[i].x, clip[i].y});
    std::vector<Polyline> res = boolean_op({s}, {c}, to_boolop(op));
    int pc = static_cast<int>(res.size());
    int tp = 0; for (auto& pl : res) tp += static_cast<int>(pl.points.size());
    *poly_count = pc; *total_pts = tp;
    if (!out_pts || !out_counts) return pc > 0 ? 1 : 0;
    int offset = 0;
    for (int i=0;i<pc;i++) {
        out_counts[i] = static_cast<int>(res[i].points.size());
        for (auto& p : res[i].points) {
            out_pts[offset++] = core_vec2{p.x, p.y};
        }
    }
    return pc > 0 ? 1 : 0;
}

CORE_API int core_offset_single(const core_vec2* poly, int n, double delta,
                                core_vec2* out_pts, int* out_counts,
                                int* poly_count, int* total_pts) {
    if (!poly || n < 3 || !poly_count || !total_pts) return 0;
    Polyline p; p.points.reserve(n);
    for (int i=0;i<n;i++) p.points.push_back(Vec2{poly[i].x, poly[i].y});
    std::vector<Polyline> res = offset({p}, delta);
    int pc = static_cast<int>(res.size());
    int tp = 0; for (auto& pl : res) tp += static_cast<int>(pl.points.size());
    *poly_count = pc; *total_pts = tp;
    if (!out_pts || !out_counts) return pc > 0 ? 1 : 0;
    int offsetIdx = 0;
    for (int i=0;i<pc;i++) {
        out_counts[i] = static_cast<int>(res[i].points.size());
        for (auto& q : res[i].points) out_pts[offsetIdx++] = core_vec2{q.x, q.y};
    }
    return pc > 0 ? 1 : 0;
}

} // extern C

extern "C" {

CORE_API int core_triangulate_polygon_rings(const core_vec2* pts,
                                            const int* ring_counts,
                                            int ring_count,
                                            unsigned int* indices,
                                            int* index_count) {
    if (!pts || !ring_counts || ring_count <= 0 || !index_count) return 0;
    std::vector<std::vector<Vec2>> rings;
    rings.reserve(static_cast<size_t>(ring_count));
    int offset = 0;
    for (int r=0; r<ring_count; ++r) {
        int cnt = ring_counts[r];
        if (cnt < 3) return 0;
        std::vector<Vec2> ring;
        ring.reserve(static_cast<size_t>(cnt));
        for (int i=0;i<cnt;i++) ring.push_back(Vec2{pts[offset+i].x, pts[offset+i].y});
        rings.push_back(std::move(ring));
        offset += cnt;
    }
    TriMesh2D m = triangulate_rings(rings);
    if (m.indices.empty()) { *index_count = 0; return 0; }
    *index_count = static_cast<int>(m.indices.size());
    if (!indices) return 1;
    for (size_t i=0;i<m.indices.size();++i) indices[i] = m.indices[i];
    return 1;
}

CORE_API int core_boolean_op_multi(const core_vec2* subj_pts, const int* subj_counts, int subj_ring_count,
                                   const core_vec2* clip_pts, const int* clip_counts, int clip_ring_count,
                                   int op, int fill_rule,
                                   core_vec2* out_pts, int* out_counts, int* poly_count, int* total_pts) {
    if (!subj_pts || !subj_counts || subj_ring_count<=0 || !clip_pts || !clip_counts || clip_ring_count<=0 || !poly_count || !total_pts) return 0;
    std::vector<std::vector<Vec2>> s;
    std::vector<std::vector<Vec2>> c;
    int off = 0;
    for (int r=0;r<subj_ring_count;++r) { int cnt=subj_counts[r]; std::vector<Vec2> ring; ring.reserve(cnt); for (int i=0;i<cnt;i++) ring.push_back(Vec2{subj_pts[off+i].x, subj_pts[off+i].y}); s.push_back(std::move(ring)); off+=cnt; }
    off = 0;
    for (int r=0;r<clip_ring_count;++r) { int cnt=clip_counts[r]; std::vector<Vec2> ring; ring.reserve(cnt); for (int i=0;i<cnt;i++) ring.push_back(Vec2{clip_pts[off+i].x, clip_pts[off+i].y}); c.push_back(std::move(ring)); off+=cnt; }
    auto res = boolean_op_multi(s, c, to_boolop(op), fill_rule);
    int pc = static_cast<int>(res.size());
    int tp = 0; for (auto& pl : res) tp += static_cast<int>(pl.points.size());
    *poly_count = pc; *total_pts = tp;
    if (!out_pts || !out_counts) return pc > 0 ? 1 : 0;
    int pos=0;
    for (int i=0;i<pc;i++) { out_counts[i] = static_cast<int>(res[i].points.size()); for (auto& p : res[i].points) out_pts[pos++] = core_vec2{p.x, p.y}; }
    return pc > 0 ? 1 : 0;
}

CORE_API int core_offset_multi(const core_vec2* pts, const int* ring_counts, int ring_count,
                               double delta, int join_type, double miter_limit,
                               core_vec2* out_pts, int* out_counts, int* poly_count, int* total_pts) {
    if (!pts || !ring_counts || ring_count<=0 || !poly_count || !total_pts) return 0;
    std::vector<std::vector<Vec2>> rings;
    rings.reserve(static_cast<size_t>(ring_count));
    int off=0;
    for (int r=0;r<ring_count;++r) { int cnt=ring_counts[r]; std::vector<Vec2> ring; ring.reserve(cnt); for (int i=0;i<cnt;i++) ring.push_back(Vec2{pts[off+i].x, pts[off+i].y}); rings.push_back(std::move(ring)); off+=cnt; }
    auto res = offset_multi(rings, delta, join_type, miter_limit);
    int pc = static_cast<int>(res.size());
    int tp = 0; for (auto& pl : res) tp += static_cast<int>(pl.points.size());
    *poly_count = pc; *total_pts = tp;
    if (!out_pts || !out_counts) return pc > 0 ? 1 : 0;
    int pos=0;
    for (int i=0;i<pc;i++) { out_counts[i] = static_cast<int>(res[i].points.size()); for (auto& p : res[i].points) out_pts[pos++] = core_vec2{p.x, p.y}; }
    return pc > 0 ? 1 : 0;
}

} // extern C

extern "C" {

CADGF_API const char* cadgf_get_version() { return core_get_version(); }
CADGF_API unsigned int cadgf_get_feature_flags() { return core_get_feature_flags(); }
CADGF_API int cadgf_get_abi_version() { return core_get_abi_version(); }

CADGF_API cadgf_document* cadgf_document_create() { return core_document_create(); }
CADGF_API void cadgf_document_destroy(cadgf_document* doc) { core_document_destroy(doc); }

CADGF_API cadgf_entity_id cadgf_document_add_polyline(cadgf_document* doc, const cadgf_vec2* pts, int n) {
    return core_document_add_polyline(doc, pts, n);
}

CADGF_API cadgf_entity_id cadgf_document_add_polyline_ex(cadgf_document* doc, const cadgf_vec2* pts, int n,
                                                         const char* name_utf8, int layer_id) {
    return core_document_add_polyline_ex(doc, pts, n, name_utf8, layer_id);
}

CADGF_API cadgf_entity_id cadgf_document_add_point(cadgf_document* doc, const cadgf_point* p,
                                                   const char* name_utf8, int layer_id) {
    return core_document_add_point(doc, p, name_utf8, layer_id);
}

CADGF_API cadgf_entity_id cadgf_document_add_line(cadgf_document* doc, const cadgf_line* l,
                                                  const char* name_utf8, int layer_id) {
    return core_document_add_line(doc, l, name_utf8, layer_id);
}

CADGF_API cadgf_entity_id cadgf_document_add_arc(cadgf_document* doc, const cadgf_arc* a,
                                                 const char* name_utf8, int layer_id) {
    return core_document_add_arc(doc, a, name_utf8, layer_id);
}

CADGF_API cadgf_entity_id cadgf_document_add_circle(cadgf_document* doc, const cadgf_circle* c,
                                                    const char* name_utf8, int layer_id) {
    return core_document_add_circle(doc, c, name_utf8, layer_id);
}

CADGF_API cadgf_entity_id cadgf_document_add_ellipse(cadgf_document* doc, const cadgf_ellipse* e,
                                                     const char* name_utf8, int layer_id) {
    return core_document_add_ellipse(doc, e, name_utf8, layer_id);
}

CADGF_API cadgf_entity_id cadgf_document_add_text(cadgf_document* doc, const cadgf_vec2* pos,
                                                  double height, double rotation,
                                                  const char* text_utf8,
                                                  const char* name_utf8, int layer_id) {
    return core_document_add_text(doc, pos, height, rotation, text_utf8, name_utf8, layer_id);
}

CADGF_API cadgf_entity_id cadgf_document_add_spline(cadgf_document* doc,
                                                    const cadgf_vec2* control_pts, int control_count,
                                                    const double* knots, int knot_count,
                                                    int degree, const char* name_utf8, int layer_id) {
    return core_document_add_spline(doc, control_pts, control_count, knots, knot_count, degree, name_utf8, layer_id);
}

CADGF_API int cadgf_document_remove_entity(cadgf_document* doc, cadgf_entity_id id) {
    return core_document_remove_entity(doc, id);
}

CADGF_API int cadgf_document_get_layer_count(const cadgf_document* doc, int* out_count) {
    return core_document_get_layer_count(doc, out_count);
}

CADGF_API int cadgf_document_get_layer_id_at(const cadgf_document* doc, int index, int* out_layer_id) {
    return core_document_get_layer_id_at(doc, index, out_layer_id);
}

CADGF_API int cadgf_document_get_layer_info(const cadgf_document* doc, int layer_id, cadgf_layer_info* out_info) {
    return core_document_get_layer_info(doc, layer_id, out_info);
}

CADGF_API int cadgf_document_get_layer_info_v2(const cadgf_document* doc, int layer_id, cadgf_layer_info_v2* out_info) {
    return core_document_get_layer_info_v2(doc, layer_id, out_info);
}

CADGF_API int cadgf_document_get_layer_name(const cadgf_document* doc, int layer_id,
                                            char* out_name_utf8, int out_name_capacity,
                                            int* out_required_bytes) {
    return core_document_get_layer_name(doc, layer_id, out_name_utf8, out_name_capacity, out_required_bytes);
}

CADGF_API int cadgf_document_add_layer(cadgf_document* doc, const char* name_utf8, unsigned int color, int* out_layer_id) {
    return core_document_add_layer(doc, name_utf8, color, out_layer_id);
}

CADGF_API int cadgf_document_set_layer_visible(cadgf_document* doc, int layer_id, int visible) {
    return core_document_set_layer_visible(doc, layer_id, visible);
}

CADGF_API int cadgf_document_set_layer_locked(cadgf_document* doc, int layer_id, int locked) {
    return core_document_set_layer_locked(doc, layer_id, locked);
}

CADGF_API int cadgf_document_set_layer_printable(cadgf_document* doc, int layer_id, int printable) {
    return core_document_set_layer_printable(doc, layer_id, printable);
}

CADGF_API int cadgf_document_set_layer_frozen(cadgf_document* doc, int layer_id, int frozen) {
    return core_document_set_layer_frozen(doc, layer_id, frozen);
}

CADGF_API int cadgf_document_set_layer_construction(cadgf_document* doc, int layer_id, int construction) {
    return core_document_set_layer_construction(doc, layer_id, construction);
}

CADGF_API int cadgf_document_set_layer_color(cadgf_document* doc, int layer_id, unsigned int color) {
    return core_document_set_layer_color(doc, layer_id, color);
}

CADGF_API int cadgf_document_get_entity_count(const cadgf_document* doc, int* out_count) {
    return core_document_get_entity_count(doc, out_count);
}

CADGF_API int cadgf_document_get_entity_id_at(const cadgf_document* doc, int index, cadgf_entity_id* out_entity_id) {
    return core_document_get_entity_id_at(doc, index, out_entity_id);
}

CADGF_API int cadgf_document_get_entity_info(const cadgf_document* doc, cadgf_entity_id id, cadgf_entity_info* out_info) {
    return core_document_get_entity_info(doc, id, out_info);
}

CADGF_API int cadgf_document_get_entity_info_v2(const cadgf_document* doc, cadgf_entity_id id, cadgf_entity_info_v2* out_info) {
    return core_document_get_entity_info_v2(doc, id, out_info);
}

CADGF_API int cadgf_document_get_entity_name(const cadgf_document* doc, cadgf_entity_id id,
                                             char* out_name_utf8, int out_name_capacity,
                                             int* out_required_bytes) {
    return core_document_get_entity_name(doc, id, out_name_utf8, out_name_capacity, out_required_bytes);
}

CADGF_API int cadgf_document_get_polyline_points(const cadgf_document* doc, cadgf_entity_id id,
                                                 cadgf_vec2* out_pts, int out_pts_capacity,
                                                 int* out_required_points) {
    return core_document_get_polyline_points(doc, id, out_pts, out_pts_capacity, out_required_points);
}

CADGF_API int cadgf_document_set_polyline_points(cadgf_document* doc, cadgf_entity_id id,
                                                 const cadgf_vec2* pts, int n) {
    return core_document_set_polyline_points(doc, id, pts, n);
}

CADGF_API int cadgf_document_get_point(const cadgf_document* doc, cadgf_entity_id id, cadgf_point* out_p) {
    return core_document_get_point(doc, id, out_p);
}

CADGF_API int cadgf_document_get_line(const cadgf_document* doc, cadgf_entity_id id, cadgf_line* out_l) {
    return core_document_get_line(doc, id, out_l);
}

CADGF_API int cadgf_document_get_arc(const cadgf_document* doc, cadgf_entity_id id, cadgf_arc* out_a) {
    return core_document_get_arc(doc, id, out_a);
}

CADGF_API int cadgf_document_get_circle(const cadgf_document* doc, cadgf_entity_id id, cadgf_circle* out_c) {
    return core_document_get_circle(doc, id, out_c);
}

CADGF_API int cadgf_document_get_ellipse(const cadgf_document* doc, cadgf_entity_id id, cadgf_ellipse* out_e) {
    return core_document_get_ellipse(doc, id, out_e);
}

CADGF_API int cadgf_document_get_text(const cadgf_document* doc, cadgf_entity_id id,
                                      cadgf_vec2* out_pos, double* out_height, double* out_rotation,
                                      char* out_text_utf8, int out_text_capacity,
                                      int* out_required_bytes) {
    return core_document_get_text(doc, id, out_pos, out_height, out_rotation, out_text_utf8, out_text_capacity, out_required_bytes);
}

CADGF_API int cadgf_document_get_spline(const cadgf_document* doc, cadgf_entity_id id,
                                        cadgf_vec2* out_control_pts, int out_control_capacity,
                                        int* out_required_control_pts,
                                        double* out_knots, int out_knot_capacity,
                                        int* out_required_knots,
                                        int* out_degree) {
    return core_document_get_spline(doc, id, out_control_pts, out_control_capacity,
                                    out_required_control_pts, out_knots, out_knot_capacity,
                                    out_required_knots, out_degree);
}

CADGF_API int cadgf_document_set_point(cadgf_document* doc, cadgf_entity_id id, const cadgf_point* p) {
    return core_document_set_point(doc, id, p);
}

CADGF_API int cadgf_document_set_line(cadgf_document* doc, cadgf_entity_id id, const cadgf_line* l) {
    return core_document_set_line(doc, id, l);
}

CADGF_API int cadgf_document_set_arc(cadgf_document* doc, cadgf_entity_id id, const cadgf_arc* a) {
    return core_document_set_arc(doc, id, a);
}

CADGF_API int cadgf_document_set_circle(cadgf_document* doc, cadgf_entity_id id, const cadgf_circle* c) {
    return core_document_set_circle(doc, id, c);
}

CADGF_API int cadgf_document_set_ellipse(cadgf_document* doc, cadgf_entity_id id, const cadgf_ellipse* e) {
    return core_document_set_ellipse(doc, id, e);
}

CADGF_API int cadgf_document_set_entity_visible(cadgf_document* doc, cadgf_entity_id id, int visible) {
    return core_document_set_entity_visible(doc, id, visible);
}

CADGF_API int cadgf_document_set_entity_color(cadgf_document* doc, cadgf_entity_id id, unsigned int color) {
    return core_document_set_entity_color(doc, id, color);
}

CADGF_API int cadgf_document_set_entity_group_id(cadgf_document* doc, cadgf_entity_id id, int group_id) {
    return core_document_set_entity_group_id(doc, id, group_id);
}

CADGF_API int cadgf_document_set_entity_line_type(cadgf_document* doc, cadgf_entity_id id, const char* line_type_utf8) {
    return core_document_set_entity_line_type(doc, id, line_type_utf8);
}

CADGF_API int cadgf_document_get_entity_line_type(const cadgf_document* doc, cadgf_entity_id id,
                                                  char* out_utf8, int out_cap, int* out_required) {
    return core_document_get_entity_line_type(doc, id, out_utf8, out_cap, out_required);
}

CADGF_API int cadgf_document_set_entity_line_weight(cadgf_document* doc, cadgf_entity_id id, double weight) {
    return core_document_set_entity_line_weight(doc, id, weight);
}

CADGF_API int cadgf_document_get_entity_line_weight(const cadgf_document* doc, cadgf_entity_id id, double* out_weight) {
    return core_document_get_entity_line_weight(doc, id, out_weight);
}

CADGF_API int cadgf_document_set_entity_line_type_scale(cadgf_document* doc, cadgf_entity_id id, double scale) {
    return core_document_set_entity_line_type_scale(doc, id, scale);
}

CADGF_API int cadgf_document_get_entity_line_type_scale(const cadgf_document* doc, cadgf_entity_id id, double* out_scale) {
    return core_document_get_entity_line_type_scale(doc, id, out_scale);
}

CADGF_API int cadgf_document_alloc_group_id(cadgf_document* doc) {
    return core_document_alloc_group_id(doc);
}

CADGF_API double cadgf_document_get_unit_scale(const cadgf_document* doc) {
    return core_document_get_unit_scale(doc);
}

CADGF_API int cadgf_document_set_unit_scale(cadgf_document* doc, double unit_scale) {
    return core_document_set_unit_scale(doc, unit_scale);
}

CADGF_API int cadgf_document_get_label(const cadgf_document* doc, char* out_utf8, int out_cap, int* out_required_bytes) {
    return core_document_get_label(doc, out_utf8, out_cap, out_required_bytes);
}

CADGF_API int cadgf_document_set_label(cadgf_document* doc, const char* label_utf8) {
    return core_document_set_label(doc, label_utf8);
}

CADGF_API int cadgf_document_get_author(const cadgf_document* doc, char* out_utf8, int out_cap, int* out_required_bytes) {
    return core_document_get_author(doc, out_utf8, out_cap, out_required_bytes);
}

CADGF_API int cadgf_document_set_author(cadgf_document* doc, const char* author_utf8) {
    return core_document_set_author(doc, author_utf8);
}

CADGF_API int cadgf_document_get_company(const cadgf_document* doc, char* out_utf8, int out_cap, int* out_required_bytes) {
    return core_document_get_company(doc, out_utf8, out_cap, out_required_bytes);
}

CADGF_API int cadgf_document_set_company(cadgf_document* doc, const char* company_utf8) {
    return core_document_set_company(doc, company_utf8);
}

CADGF_API int cadgf_document_get_comment(const cadgf_document* doc, char* out_utf8, int out_cap, int* out_required_bytes) {
    return core_document_get_comment(doc, out_utf8, out_cap, out_required_bytes);
}

CADGF_API int cadgf_document_set_comment(cadgf_document* doc, const char* comment_utf8) {
    return core_document_set_comment(doc, comment_utf8);
}

CADGF_API int cadgf_document_get_created_at(const cadgf_document* doc, char* out_utf8, int out_cap, int* out_required_bytes) {
    return core_document_get_created_at(doc, out_utf8, out_cap, out_required_bytes);
}

CADGF_API int cadgf_document_set_created_at(cadgf_document* doc, const char* created_at_utf8) {
    return core_document_set_created_at(doc, created_at_utf8);
}

CADGF_API int cadgf_document_get_modified_at(const cadgf_document* doc, char* out_utf8, int out_cap, int* out_required_bytes) {
    return core_document_get_modified_at(doc, out_utf8, out_cap, out_required_bytes);
}

CADGF_API int cadgf_document_set_modified_at(cadgf_document* doc, const char* modified_at_utf8) {
    return core_document_set_modified_at(doc, modified_at_utf8);
}

CADGF_API int cadgf_document_get_unit_name(const cadgf_document* doc, char* out_utf8, int out_cap, int* out_required_bytes) {
    return core_document_get_unit_name(doc, out_utf8, out_cap, out_required_bytes);
}

CADGF_API int cadgf_document_set_unit_name(cadgf_document* doc, const char* unit_name_utf8) {
    return core_document_set_unit_name(doc, unit_name_utf8);
}

CADGF_API int cadgf_document_get_meta_count(const cadgf_document* doc, int* out_count) {
    return core_document_get_meta_count(doc, out_count);
}

CADGF_API int cadgf_document_get_meta_key_at(const cadgf_document* doc, int index,
                                             char* out_key_utf8, int out_key_capacity,
                                             int* out_required_bytes) {
    return core_document_get_meta_key_at(doc, index, out_key_utf8, out_key_capacity, out_required_bytes);
}

CADGF_API int cadgf_document_get_meta_value(const cadgf_document* doc, const char* key_utf8,
                                            char* out_value_utf8, int out_value_capacity,
                                            int* out_required_bytes) {
    return core_document_get_meta_value(doc, key_utf8, out_value_utf8, out_value_capacity, out_required_bytes);
}

CADGF_API int cadgf_document_set_meta_value(cadgf_document* doc, const char* key_utf8, const char* value_utf8) {
    return core_document_set_meta_value(doc, key_utf8, value_utf8);
}

CADGF_API int cadgf_document_remove_meta_value(cadgf_document* doc, const char* key_utf8) {
    return core_document_remove_meta_value(doc, key_utf8);
}

CADGF_API int cadgf_triangulate_polygon(const cadgf_vec2* pts, int n,
                                        unsigned int* indices, int* index_count) {
    return core_triangulate_polygon(pts, n, indices, index_count);
}

CADGF_API int cadgf_triangulate_polygon_rings(const cadgf_vec2* pts,
                                              const int* ring_counts,
                                              int ring_count,
                                              unsigned int* indices,
                                              int* index_count) {
    return core_triangulate_polygon_rings(pts, ring_counts, ring_count, indices, index_count);
}

CADGF_API int cadgf_boolean_op_single(const cadgf_vec2* subj, int subj_n,
                                      const cadgf_vec2* clip, int clip_n,
                                      int op,
                                      cadgf_vec2* out_pts, int* out_counts,
                                      int* poly_count, int* total_pts) {
    return core_boolean_op_single(subj, subj_n, clip, clip_n, op, out_pts, out_counts, poly_count, total_pts);
}

CADGF_API int cadgf_offset_single(const cadgf_vec2* poly, int n, double delta,
                                  cadgf_vec2* out_pts, int* out_counts,
                                  int* poly_count, int* total_pts) {
    return core_offset_single(poly, n, delta, out_pts, out_counts, poly_count, total_pts);
}

CADGF_API int cadgf_boolean_op_multi(const cadgf_vec2* subj_pts, const int* subj_counts, int subj_ring_count,
                                     const cadgf_vec2* clip_pts, const int* clip_counts, int clip_ring_count,
                                     int op, int fill_rule,
                                     cadgf_vec2* out_pts, int* out_counts, int* poly_count, int* total_pts) {
    return core_boolean_op_multi(subj_pts, subj_counts, subj_ring_count, clip_pts, clip_counts, clip_ring_count,
                                 op, fill_rule, out_pts, out_counts, poly_count, total_pts);
}

CADGF_API int cadgf_offset_multi(const cadgf_vec2* pts, const int* ring_counts, int ring_count,
                                 double delta, int join_type, double miter_limit,
                                 cadgf_vec2* out_pts, int* out_counts, int* poly_count, int* total_pts) {
    return core_offset_multi(pts, ring_counts, ring_count, delta, join_type, miter_limit,
                             out_pts, out_counts, poly_count, total_pts);
}

} // extern C
