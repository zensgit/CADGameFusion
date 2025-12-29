#include "core/plugin_abi_c_v1.h"
#include "json.hpp"

#include <cctype>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <string>
#include <unordered_map>
#include <vector>

using nlohmann::json;

static cadgf_string_view sv(const char* s) {
    cadgf_string_view v;
    v.data = s;
    v.size = s ? static_cast<int32_t>(std::strlen(s)) : 0;
    return v;
}

static void set_error(cadgf_error_v1* err, int32_t code, const char* msg) {
    if (!err) return;
    err->code = code;
    if (!msg) {
        err->message[0] = 0;
        return;
    }
    std::snprintf(err->message, sizeof(err->message), "%s", msg);
    err->message[sizeof(err->message) - 1] = 0;
}

static bool parse_bool(const json& value, bool fallback) {
    if (value.is_boolean()) return value.get<bool>();
    if (value.is_number_integer()) return value.get<int>() != 0;
    return fallback;
}

static bool parse_color(const json& value, unsigned int* out_color) {
    if (!out_color) return false;
    if (value.is_number_unsigned() || value.is_number_integer()) {
        *out_color = value.get<unsigned int>();
        return true;
    }
    if (value.is_string()) {
        const std::string s = value.get<std::string>();
        if (s.size() == 7 && s[0] == '#') {
            char* end = nullptr;
            const unsigned long v = std::strtoul(s.c_str() + 1, &end, 16);
            if (end && *end == '\0') {
                *out_color = static_cast<unsigned int>(v);
                return true;
            }
        }
    }
    return false;
}

static bool parse_point(const json& value, cadgf_vec2* out_pt) {
    if (!out_pt) return false;
    if (value.is_array() && value.size() >= 2) {
        out_pt->x = value.at(0).get<double>();
        out_pt->y = value.at(1).get<double>();
        return true;
    }
    if (value.is_object()) {
        auto x_it = value.find("x");
        auto y_it = value.find("y");
        if (x_it != value.end() && y_it != value.end()) {
            out_pt->x = x_it->get<double>();
            out_pt->y = y_it->get<double>();
            return true;
        }
    }
    return false;
}

static bool parse_point_field(const json& obj, const char* key, cadgf_vec2* out_pt) {
    if (!out_pt) return false;
    auto it = obj.find(key);
    if (it == obj.end()) return false;
    return parse_point(*it, out_pt);
}

static bool parse_line(const json& value, cadgf_line* out_line) {
    if (!out_line) return false;
    if (value.is_array() && value.size() >= 2) {
        cadgf_vec2 a{};
        cadgf_vec2 b{};
        if (!parse_point(value.at(0), &a) || !parse_point(value.at(1), &b)) return false;
        out_line->a = a;
        out_line->b = b;
        return true;
    }
    if (value.is_object()) {
        cadgf_vec2 a{};
        cadgf_vec2 b{};
        if (!parse_point_field(value, "a", &a) || !parse_point_field(value, "b", &b)) return false;
        out_line->a = a;
        out_line->b = b;
        return true;
    }
    return false;
}

static bool parse_arc(const json& value, cadgf_arc* out_arc) {
    if (!out_arc || !value.is_object()) return false;
    cadgf_vec2 center{};
    if (!parse_point_field(value, "c", &center) && !parse_point_field(value, "center", &center)) return false;
    out_arc->center = center;
    if (!value.contains("r")) return false;
    out_arc->radius = value.at("r").get<double>();
    out_arc->start_angle = value.value("a0", 0.0);
    out_arc->end_angle = value.value("a1", 0.0);
    out_arc->clockwise = value.value("cw", 0);
    return true;
}

static bool parse_circle(const json& value, cadgf_circle* out_circle) {
    if (!out_circle || !value.is_object()) return false;
    cadgf_vec2 center{};
    if (!parse_point_field(value, "c", &center) && !parse_point_field(value, "center", &center)) return false;
    out_circle->center = center;
    if (!value.contains("r")) return false;
    out_circle->radius = value.at("r").get<double>();
    return true;
}

static bool parse_ellipse(const json& value, cadgf_ellipse* out_ellipse) {
    if (!out_ellipse || !value.is_object()) return false;
    cadgf_vec2 center{};
    if (!parse_point_field(value, "c", &center) && !parse_point_field(value, "center", &center)) return false;
    out_ellipse->center = center;
    if (!value.contains("rx") || !value.contains("ry")) return false;
    out_ellipse->rx = value.at("rx").get<double>();
    out_ellipse->ry = value.at("ry").get<double>();
    out_ellipse->rotation = value.value("rot", 0.0);
    constexpr double kTwoPi = 6.28318530717958647692;
    out_ellipse->start_angle = value.value("a0", 0.0);
    out_ellipse->end_angle = value.value("a1", kTwoPi);
    return true;
}

static bool parse_text(const json& value, cadgf_vec2* out_pos, double* out_height, double* out_rotation, std::string* out_text) {
    if (!out_pos || !out_height || !out_rotation || !out_text || !value.is_object()) return false;
    if (!parse_point_field(value, "pos", out_pos) && !parse_point_field(value, "position", out_pos)) return false;
    *out_height = value.value("h", value.value("height", 0.0));
    *out_rotation = value.value("rot", value.value("rotation", 0.0));
    if (value.contains("value")) {
        *out_text = value.at("value").get<std::string>();
    } else if (value.contains("text")) {
        *out_text = value.at("text").get<std::string>();
    } else {
        *out_text = std::string();
    }
    return true;
}

static bool parse_spline(const json& value, std::vector<cadgf_vec2>* out_control, std::vector<double>* out_knots, int* out_degree) {
    if (!out_control || !out_knots || !out_degree || !value.is_object()) return false;
    auto control_it = value.find("control");
    if (control_it == value.end() || !control_it->is_array()) return false;
    out_control->clear();
    out_control->reserve(control_it->size());
    for (const auto& pt_val : *control_it) {
        cadgf_vec2 pt{};
        if (!parse_point(pt_val, &pt)) return false;
        out_control->push_back(pt);
    }
    auto knots_it = value.find("knots");
    out_knots->clear();
    if (knots_it != value.end() && knots_it->is_array()) {
        out_knots->reserve(knots_it->size());
        for (const auto& knot_val : *knots_it) {
            out_knots->push_back(knot_val.get<double>());
        }
    }
    *out_degree = value.value("degree", 3);
    return !out_control->empty();
}

static void apply_line_style(const json& entity_val, cadgf_document* doc, cadgf_entity_id id) {
    if (!doc || id == 0) return;
    auto type_it = entity_val.find("line_type");
    if (type_it != entity_val.end() && type_it->is_string()) {
        const std::string line_type = type_it->get<std::string>();
        (void)cadgf_document_set_entity_line_type(doc, id, line_type.c_str());
    }
    auto weight_it = entity_val.find("line_weight");
    if (weight_it != entity_val.end() && weight_it->is_number()) {
        (void)cadgf_document_set_entity_line_weight(doc, id, weight_it->get<double>());
    }
    auto scale_it = entity_val.find("line_type_scale");
    if (scale_it != entity_val.end() && scale_it->is_number()) {
        (void)cadgf_document_set_entity_line_type_scale(doc, id, scale_it->get<double>());
    }
}

static int32_t importer_import_document(cadgf_document* doc, const char* path_utf8, cadgf_error_v1* out_err) {
    if (!doc || !path_utf8 || !*path_utf8) {
        set_error(out_err, 1, "invalid args");
        return 0;
    }

    try {
        std::ifstream in(path_utf8, std::ios::in | std::ios::binary);
        if (!in.is_open()) {
            set_error(out_err, 2, "failed to open input file");
            return 0;
        }

        json root = json::parse(in, nullptr, false);
        if (root.is_discarded() || !root.is_object()) {
            set_error(out_err, 3, "invalid JSON document");
            return 0;
        }

        std::unordered_map<int, int> layer_map;
        layer_map.emplace(0, 0);

        const auto layers_it = root.find("layers");
        if (layers_it != root.end() && layers_it->is_array()) {
            for (const auto& layer_val : *layers_it) {
                if (!layer_val.is_object()) continue;
                const int src_id = layer_val.value("id", 0);
                std::string name = layer_val.value("name", std::string());
                unsigned int color = 0xFFFFFFu;
                auto color_it = layer_val.find("color");
                if (color_it != layer_val.end()) (void)parse_color(*color_it, &color);
                bool visible = true;
                auto visible_it = layer_val.find("visible");
                if (visible_it != layer_val.end()) visible = parse_bool(*visible_it, true);
                bool locked = false;
                auto locked_it = layer_val.find("locked");
                if (locked_it != layer_val.end()) locked = parse_bool(*locked_it, false);

                if (src_id == 0) {
                    (void)cadgf_document_set_layer_color(doc, 0, color);
                    (void)cadgf_document_set_layer_visible(doc, 0, visible ? 1 : 0);
                    (void)cadgf_document_set_layer_locked(doc, 0, locked ? 1 : 0);
                    layer_map[0] = 0;
                    continue;
                }

                if (name.empty()) {
                    name = "Layer " + std::to_string(src_id);
                }

                int new_id = -1;
                if (!cadgf_document_add_layer(doc, name.c_str(), color, &new_id)) {
                    set_error(out_err, 4, "failed to add layer");
                    return 0;
                }
                (void)cadgf_document_set_layer_visible(doc, new_id, visible ? 1 : 0);
                (void)cadgf_document_set_layer_locked(doc, new_id, locked ? 1 : 0);
                layer_map[src_id] = new_id;
            }
        }

        const auto entities_it = root.find("entities");
        if (entities_it != root.end() && entities_it->is_array()) {
            for (const auto& entity_val : *entities_it) {
                if (!entity_val.is_object()) continue;

                int type = -1;
                auto type_it = entity_val.find("type");
                if (type_it != entity_val.end()) {
                    if (type_it->is_number_integer()) {
                        type = type_it->get<int>();
                    } else if (type_it->is_string()) {
                        const std::string t = type_it->get<std::string>();
                        if (t == "polyline") type = CADGF_ENTITY_TYPE_POLYLINE;
                        else if (t == "point") type = CADGF_ENTITY_TYPE_POINT;
                        else if (t == "line") type = CADGF_ENTITY_TYPE_LINE;
                        else if (t == "arc") type = CADGF_ENTITY_TYPE_ARC;
                        else if (t == "circle") type = CADGF_ENTITY_TYPE_CIRCLE;
                        else if (t == "ellipse") type = CADGF_ENTITY_TYPE_ELLIPSE;
                        else if (t == "spline") type = CADGF_ENTITY_TYPE_SPLINE;
                        else if (t == "text") type = CADGF_ENTITY_TYPE_TEXT;
                    }
                }
                const std::string name = entity_val.value("name", std::string());
                int layer_id = entity_val.value("layer_id", 0);
                auto it = layer_map.find(layer_id);
                if (it != layer_map.end()) layer_id = it->second;
                else layer_id = 0;

                if (type == CADGF_ENTITY_TYPE_POLYLINE) {
                    auto poly_it = entity_val.find("polyline");
                    if (poly_it == entity_val.end() || !poly_it->is_array()) {
                        set_error(out_err, 5, "polyline entity missing points");
                        return 0;
                    }

                    std::vector<cadgf_vec2> pts;
                    pts.reserve(poly_it->size());
                    for (const auto& pt_val : *poly_it) {
                        cadgf_vec2 pt{};
                        if (!parse_point(pt_val, &pt)) {
                            set_error(out_err, 6, "invalid polyline point");
                            return 0;
                        }
                        pts.push_back(pt);
                    }
                    if (pts.size() < 2) continue;

                    cadgf_entity_id new_id = cadgf_document_add_polyline_ex(doc, pts.data(), static_cast<int>(pts.size()),
                                                                            name.c_str(), layer_id);
                    apply_line_style(entity_val, doc, new_id);
                } else if (type == CADGF_ENTITY_TYPE_POINT) {
                    auto pt_it = entity_val.find("point");
                    cadgf_vec2 pt{};
                    if (pt_it == entity_val.end() || !parse_point(*pt_it, &pt)) {
                        set_error(out_err, 7, "invalid point entity");
                        return 0;
                    }
                    cadgf_point p{};
                    p.p = pt;
                    cadgf_entity_id new_id = cadgf_document_add_point(doc, &p, name.c_str(), layer_id);
                    apply_line_style(entity_val, doc, new_id);
                } else if (type == CADGF_ENTITY_TYPE_LINE) {
                    auto line_it = entity_val.find("line");
                    cadgf_line line{};
                    if (line_it == entity_val.end() || !parse_line(*line_it, &line)) {
                        set_error(out_err, 8, "invalid line entity");
                        return 0;
                    }
                    cadgf_entity_id new_id = cadgf_document_add_line(doc, &line, name.c_str(), layer_id);
                    apply_line_style(entity_val, doc, new_id);
                } else if (type == CADGF_ENTITY_TYPE_ARC) {
                    auto arc_it = entity_val.find("arc");
                    cadgf_arc arc{};
                    if (arc_it == entity_val.end() || !parse_arc(*arc_it, &arc)) {
                        set_error(out_err, 9, "invalid arc entity");
                        return 0;
                    }
                    cadgf_entity_id new_id = cadgf_document_add_arc(doc, &arc, name.c_str(), layer_id);
                    apply_line_style(entity_val, doc, new_id);
                } else if (type == CADGF_ENTITY_TYPE_CIRCLE) {
                    auto circle_it = entity_val.find("circle");
                    cadgf_circle circle{};
                    if (circle_it == entity_val.end() || !parse_circle(*circle_it, &circle)) {
                        set_error(out_err, 10, "invalid circle entity");
                        return 0;
                    }
                    cadgf_entity_id new_id = cadgf_document_add_circle(doc, &circle, name.c_str(), layer_id);
                    apply_line_style(entity_val, doc, new_id);
                } else if (type == CADGF_ENTITY_TYPE_ELLIPSE) {
                    auto ellipse_it = entity_val.find("ellipse");
                    cadgf_ellipse ellipse{};
                    if (ellipse_it == entity_val.end() || !parse_ellipse(*ellipse_it, &ellipse)) {
                        set_error(out_err, 11, "invalid ellipse entity");
                        return 0;
                    }
                    cadgf_entity_id new_id = cadgf_document_add_ellipse(doc, &ellipse, name.c_str(), layer_id);
                    apply_line_style(entity_val, doc, new_id);
                } else if (type == CADGF_ENTITY_TYPE_SPLINE) {
                    auto spline_it = entity_val.find("spline");
                    std::vector<cadgf_vec2> control;
                    std::vector<double> knots;
                    int degree = 3;
                    if (spline_it == entity_val.end() || !parse_spline(*spline_it, &control, &knots, &degree)) {
                        set_error(out_err, 12, "invalid spline entity");
                        return 0;
                    }
                    cadgf_entity_id new_id = cadgf_document_add_spline(doc, control.data(), static_cast<int>(control.size()),
                                                                      knots.empty() ? nullptr : knots.data(),
                                                                      static_cast<int>(knots.size()), degree,
                                                                      name.c_str(), layer_id);
                    apply_line_style(entity_val, doc, new_id);
                } else if (type == CADGF_ENTITY_TYPE_TEXT) {
                    auto text_it = entity_val.find("text");
                    cadgf_vec2 pos{};
                    double height = 0.0;
                    double rotation = 0.0;
                    std::string text;
                    if (text_it == entity_val.end() || !parse_text(*text_it, &pos, &height, &rotation, &text)) {
                        set_error(out_err, 13, "invalid text entity");
                        return 0;
                    }
                    cadgf_entity_id new_id = cadgf_document_add_text(doc, &pos, height, rotation, text.c_str(), name.c_str(), layer_id);
                    apply_line_style(entity_val, doc, new_id);
                }
            }
        }

        set_error(out_err, 0, "");
        return 1;
    } catch (const std::exception& e) {
        set_error(out_err, 7, e.what());
        return 0;
    } catch (...) {
        set_error(out_err, 8, "exception during import");
        return 0;
    }
}

static cadgf_string_view importer_name(void) { return sv("Sample JSON Importer"); }
static cadgf_string_view importer_extensions(void) { return sv("json"); }
static cadgf_string_view importer_filetype_desc(void) { return sv("CADGF JSON (*.json)"); }

static const cadgf_exporter_api_v1* get_exporter(int32_t index);
static const cadgf_importer_api_v1* get_importer(int32_t index);

static cadgf_importer_api_v1 g_importer = {
    static_cast<int32_t>(sizeof(cadgf_importer_api_v1)),
    importer_name,
    importer_extensions,
    importer_filetype_desc,
    importer_import_document,
};

static cadgf_plugin_desc_v1 plugin_describe_impl(void) {
    cadgf_plugin_desc_v1 d{};
    d.size = static_cast<int32_t>(sizeof(cadgf_plugin_desc_v1));
    d.name = sv("CADGameFusion JSON Importer Plugin");
    d.version = sv("0.1.0");
    d.description = sv("Sample importer plugin implementing cadgf_plugin_api_v1");
    return d;
}

static int32_t plugin_initialize(void) { return 1; }
static void plugin_shutdown(void) {}

static int32_t plugin_exporter_count(void) { return 0; }
static const cadgf_exporter_api_v1* get_exporter(int32_t index) { (void)index; return nullptr; }

static int32_t plugin_importer_count(void) { return 1; }
static const cadgf_importer_api_v1* get_importer(int32_t index) { return (index == 0) ? &g_importer : nullptr; }

static cadgf_plugin_api_v1 g_api = {
    static_cast<int32_t>(sizeof(cadgf_plugin_api_v1)),
    CADGF_PLUGIN_ABI_V1,
    plugin_describe_impl,
    plugin_initialize,
    plugin_shutdown,
    plugin_exporter_count,
    get_exporter,
    plugin_importer_count,
    get_importer,
};

extern "C" CADGF_PLUGIN_EXPORT const cadgf_plugin_api_v1* cadgf_plugin_get_api_v1(void) {
    return &g_api;
}
