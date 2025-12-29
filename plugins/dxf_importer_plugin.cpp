#include "core/plugin_abi_c_v1.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <fstream>
#include <string>
#include <unordered_map>
#include <vector>

struct DxfStyle {
    std::string line_type;
    double line_weight = 0.0;
    double line_type_scale = 0.0;
    bool has_line_type = false;
    bool has_line_weight = false;
    bool has_line_scale = false;
};

struct DxfPolyline {
    std::string layer;
    std::vector<cadgf_vec2> points;
    bool closed = false;
    DxfStyle style;
};

struct DxfLine {
    std::string layer;
    cadgf_vec2 a{};
    cadgf_vec2 b{};
    bool has_ax = false;
    bool has_ay = false;
    bool has_bx = false;
    bool has_by = false;
    DxfStyle style;
};

struct DxfCircle {
    std::string layer;
    cadgf_vec2 center{};
    double radius = 0.0;
    bool has_cx = false;
    bool has_cy = false;
    bool has_radius = false;
    DxfStyle style;
};

struct DxfArc {
    std::string layer;
    cadgf_vec2 center{};
    double radius = 0.0;
    double start_deg = 0.0;
    double end_deg = 0.0;
    bool has_cx = false;
    bool has_cy = false;
    bool has_radius = false;
    bool has_start = false;
    bool has_end = false;
    DxfStyle style;
};

struct DxfEllipse {
    std::string layer;
    cadgf_vec2 center{};
    cadgf_vec2 major_axis{};
    double ratio = 0.0;
    double start_param = 0.0;
    double end_param = 0.0;
    bool has_cx = false;
    bool has_cy = false;
    bool has_ax = false;
    bool has_ay = false;
    bool has_ratio = false;
    bool has_start = false;
    bool has_end = false;
    DxfStyle style;
};

struct DxfSpline {
    std::string layer;
    int degree = 3;
    std::vector<cadgf_vec2> control_points;
    std::vector<double> knots;
    DxfStyle style;
};

struct DxfText {
    std::string layer;
    cadgf_vec2 pos{};
    double height = 0.0;
    double rotation_deg = 0.0;
    std::string text;
    bool has_x = false;
    bool has_y = false;
    DxfStyle style;
};

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

static bool parse_int(const std::string& s, int* out) {
    if (!out) return false;
    char* end = nullptr;
    long v = std::strtol(s.c_str(), &end, 10);
    if (!end || *end != '\0') return false;
    *out = static_cast<int>(v);
    return true;
}

static bool parse_double(const std::string& s, double* out) {
    if (!out) return false;
    char* end = nullptr;
    double v = std::strtod(s.c_str(), &end);
    if (!end || *end != '\0') return false;
    *out = v;
    return true;
}

static bool parse_style_code(DxfStyle* style, int code, const std::string& value_line) {
    if (!style) return false;
    switch (code) {
        case 6: {
            if (!value_line.empty() && value_line != "BYLAYER" && value_line != "BYBLOCK") {
                style->line_type = value_line;
                style->has_line_type = true;
            }
            return true;
        }
        case 48: {
            double scale = 0.0;
            if (parse_double(value_line, &scale)) {
                style->line_type_scale = scale;
                style->has_line_scale = true;
            }
            return true;
        }
        case 370: {
            int weight = 0;
            if (parse_int(value_line, &weight)) {
                if (weight >= 0) {
                    style->line_weight = static_cast<double>(weight) / 100.0;
                    style->has_line_weight = true;
                }
            }
            return true;
        }
        default:
            return false;
    }
}

static void apply_line_style(cadgf_document* doc, cadgf_entity_id id, const DxfStyle& style) {
    if (!doc || id == 0) return;
    if (style.has_line_type) {
        (void)cadgf_document_set_entity_line_type(doc, id, style.line_type.c_str());
    }
    if (style.has_line_weight) {
        (void)cadgf_document_set_entity_line_weight(doc, id, style.line_weight);
    }
    if (style.has_line_scale) {
        (void)cadgf_document_set_entity_line_type_scale(doc, id, style.line_type_scale);
    }
}

static void finalize_polyline(DxfPolyline& pl, std::vector<DxfPolyline>& out) {
    if (pl.points.size() < 2) return;
    if (pl.closed) {
        const auto& first = pl.points.front();
        const auto& last = pl.points.back();
        if (first.x != last.x || first.y != last.y) {
            pl.points.push_back(first);
        }
    }
    out.push_back(pl);
}

static void finalize_line(const DxfLine& line, std::vector<DxfLine>& out) {
    if (!(line.has_ax && line.has_ay && line.has_bx && line.has_by)) return;
    out.push_back(line);
}

static void finalize_circle(const DxfCircle& circle, std::vector<DxfCircle>& out) {
    if (!(circle.has_cx && circle.has_cy && circle.has_radius)) return;
    out.push_back(circle);
}

static void finalize_arc(const DxfArc& arc, std::vector<DxfArc>& out) {
    if (!(arc.has_cx && arc.has_cy && arc.has_radius && arc.has_start && arc.has_end)) return;
    out.push_back(arc);
}

static void finalize_ellipse(const DxfEllipse& ellipse, std::vector<DxfEllipse>& out) {
    if (!(ellipse.has_cx && ellipse.has_cy && ellipse.has_ax && ellipse.has_ay && ellipse.has_ratio)) return;
    out.push_back(ellipse);
}

static void finalize_spline(const DxfSpline& spline, std::vector<DxfSpline>& out) {
    if (spline.control_points.size() < 2) return;
    out.push_back(spline);
}

static void finalize_text(const DxfText& text, std::vector<DxfText>& out) {
    if (!(text.has_x && text.has_y)) return;
    out.push_back(text);
}

enum class DxfEntityKind {
    None,
    Polyline,
    Line,
    Circle,
    Arc,
    Ellipse,
    Spline,
    Text
};

static bool parse_dxf_entities(const std::string& path,
                               std::vector<DxfPolyline>& polylines,
                               std::vector<DxfLine>& lines,
                               std::vector<DxfCircle>& circles,
                               std::vector<DxfArc>& arcs,
                               std::vector<DxfEllipse>& ellipses,
                               std::vector<DxfSpline>& splines,
                               std::vector<DxfText>& texts,
                               std::string* err) {
    std::ifstream in(path);
    if (!in.is_open()) {
        if (err) *err = "failed to open input file";
        return false;
    }

    std::string code_line;
    std::string value_line;
    DxfEntityKind current_kind = DxfEntityKind::None;
    DxfPolyline current_polyline;
    DxfLine current_line;
    DxfCircle current_circle;
    DxfArc current_arc;
    DxfEllipse current_ellipse;
    DxfSpline current_spline;
    DxfText current_text;
    double pending_x = 0.0;
    bool has_x = false;
    double pending_spline_x = 0.0;
    bool has_spline_x = false;

    auto reset_polyline = [&]() {
        current_polyline = DxfPolyline{};
        has_x = false;
    };
    auto reset_line = [&]() { current_line = DxfLine{}; };
    auto reset_circle = [&]() { current_circle = DxfCircle{}; };
    auto reset_arc = [&]() { current_arc = DxfArc{}; };
    auto reset_ellipse = [&]() { current_ellipse = DxfEllipse{}; };
    auto reset_spline = [&]() {
        current_spline = DxfSpline{};
        has_spline_x = false;
    };
    auto reset_text = [&]() { current_text = DxfText{}; };

    auto flush_current = [&]() {
        switch (current_kind) {
            case DxfEntityKind::Polyline:
                finalize_polyline(current_polyline, polylines);
                reset_polyline();
                break;
            case DxfEntityKind::Line:
                finalize_line(current_line, lines);
                reset_line();
                break;
            case DxfEntityKind::Circle:
                finalize_circle(current_circle, circles);
                reset_circle();
                break;
            case DxfEntityKind::Arc:
                finalize_arc(current_arc, arcs);
                reset_arc();
                break;
            case DxfEntityKind::Ellipse:
                finalize_ellipse(current_ellipse, ellipses);
                reset_ellipse();
                break;
            case DxfEntityKind::Spline:
                finalize_spline(current_spline, splines);
                reset_spline();
                break;
            case DxfEntityKind::Text:
                finalize_text(current_text, texts);
                reset_text();
                break;
            case DxfEntityKind::None:
                break;
        }
        current_kind = DxfEntityKind::None;
    };

    while (std::getline(in, code_line)) {
        if (!std::getline(in, value_line)) break;

        int code = 0;
        if (!parse_int(code_line, &code)) continue;

        if (code == 0) {
            flush_current();
            if (value_line == "LWPOLYLINE") {
                current_kind = DxfEntityKind::Polyline;
                reset_polyline();
            } else if (value_line == "LINE") {
                current_kind = DxfEntityKind::Line;
                reset_line();
            } else if (value_line == "CIRCLE") {
                current_kind = DxfEntityKind::Circle;
                reset_circle();
            } else if (value_line == "ARC") {
                current_kind = DxfEntityKind::Arc;
                reset_arc();
            } else if (value_line == "ELLIPSE") {
                current_kind = DxfEntityKind::Ellipse;
                reset_ellipse();
            } else if (value_line == "SPLINE") {
                current_kind = DxfEntityKind::Spline;
                reset_spline();
            } else if (value_line == "TEXT" || value_line == "MTEXT") {
                current_kind = DxfEntityKind::Text;
                reset_text();
            } else {
                current_kind = DxfEntityKind::None;
            }
            continue;
        }

        switch (current_kind) {
            case DxfEntityKind::Polyline:
                if (parse_style_code(&current_polyline.style, code, value_line)) break;
                switch (code) {
                    case 8:
                        current_polyline.layer = value_line;
                        break;
                    case 70: {
                        int flags = 0;
                        if (parse_int(value_line, &flags)) {
                            current_polyline.closed = (flags & 1) != 0;
                        }
                        break;
                    }
                    case 10: {
                        double x = 0.0;
                        if (parse_double(value_line, &x)) {
                            pending_x = x;
                            has_x = true;
                        }
                        break;
                    }
                    case 20: {
                        if (!has_x) break;
                        double y = 0.0;
                        if (parse_double(value_line, &y)) {
                            current_polyline.points.push_back(cadgf_vec2{pending_x, y});
                        }
                        has_x = false;
                        break;
                    }
                    default:
                        break;
                }
                break;
            case DxfEntityKind::Line:
                if (parse_style_code(&current_line.style, code, value_line)) break;
                switch (code) {
                    case 8:
                        current_line.layer = value_line;
                        break;
                    case 10:
                        if (parse_double(value_line, &current_line.a.x)) {
                            current_line.has_ax = true;
                        }
                        break;
                    case 20:
                        if (parse_double(value_line, &current_line.a.y)) {
                            current_line.has_ay = true;
                        }
                        break;
                    case 11:
                        if (parse_double(value_line, &current_line.b.x)) {
                            current_line.has_bx = true;
                        }
                        break;
                    case 21:
                        if (parse_double(value_line, &current_line.b.y)) {
                            current_line.has_by = true;
                        }
                        break;
                    default:
                        break;
                }
                break;
            case DxfEntityKind::Circle:
                if (parse_style_code(&current_circle.style, code, value_line)) break;
                switch (code) {
                    case 8:
                        current_circle.layer = value_line;
                        break;
                    case 10:
                        if (parse_double(value_line, &current_circle.center.x)) {
                            current_circle.has_cx = true;
                        }
                        break;
                    case 20:
                        if (parse_double(value_line, &current_circle.center.y)) {
                            current_circle.has_cy = true;
                        }
                        break;
                    case 40:
                        if (parse_double(value_line, &current_circle.radius)) {
                            current_circle.has_radius = true;
                        }
                        break;
                    default:
                        break;
                }
                break;
            case DxfEntityKind::Arc:
                if (parse_style_code(&current_arc.style, code, value_line)) break;
                switch (code) {
                    case 8:
                        current_arc.layer = value_line;
                        break;
                    case 10:
                        if (parse_double(value_line, &current_arc.center.x)) {
                            current_arc.has_cx = true;
                        }
                        break;
                    case 20:
                        if (parse_double(value_line, &current_arc.center.y)) {
                            current_arc.has_cy = true;
                        }
                        break;
                    case 40:
                        if (parse_double(value_line, &current_arc.radius)) {
                            current_arc.has_radius = true;
                        }
                        break;
                    case 50:
                        if (parse_double(value_line, &current_arc.start_deg)) {
                            current_arc.has_start = true;
                        }
                        break;
                    case 51:
                        if (parse_double(value_line, &current_arc.end_deg)) {
                            current_arc.has_end = true;
                        }
                        break;
                    default:
                        break;
                }
                break;
            case DxfEntityKind::Ellipse:
                if (parse_style_code(&current_ellipse.style, code, value_line)) break;
                switch (code) {
                    case 8:
                        current_ellipse.layer = value_line;
                        break;
                    case 10:
                        if (parse_double(value_line, &current_ellipse.center.x)) {
                            current_ellipse.has_cx = true;
                        }
                        break;
                    case 20:
                        if (parse_double(value_line, &current_ellipse.center.y)) {
                            current_ellipse.has_cy = true;
                        }
                        break;
                    case 11:
                        if (parse_double(value_line, &current_ellipse.major_axis.x)) {
                            current_ellipse.has_ax = true;
                        }
                        break;
                    case 21:
                        if (parse_double(value_line, &current_ellipse.major_axis.y)) {
                            current_ellipse.has_ay = true;
                        }
                        break;
                    case 40:
                        if (parse_double(value_line, &current_ellipse.ratio)) {
                            current_ellipse.has_ratio = true;
                        }
                        break;
                    case 41:
                        if (parse_double(value_line, &current_ellipse.start_param)) {
                            current_ellipse.has_start = true;
                        }
                        break;
                    case 42:
                        if (parse_double(value_line, &current_ellipse.end_param)) {
                            current_ellipse.has_end = true;
                        }
                        break;
                    default:
                        break;
                }
                break;
            case DxfEntityKind::Spline:
                if (parse_style_code(&current_spline.style, code, value_line)) break;
                switch (code) {
                    case 8:
                        current_spline.layer = value_line;
                        break;
                    case 71: {
                        int degree = 0;
                        if (parse_int(value_line, &degree)) {
                            current_spline.degree = degree;
                        }
                        break;
                    }
                    case 10: {
                        double x = 0.0;
                        if (parse_double(value_line, &x)) {
                            pending_spline_x = x;
                            has_spline_x = true;
                        }
                        break;
                    }
                    case 20: {
                        if (!has_spline_x) break;
                        double y = 0.0;
                        if (parse_double(value_line, &y)) {
                            current_spline.control_points.push_back(cadgf_vec2{pending_spline_x, y});
                        }
                        has_spline_x = false;
                        break;
                    }
                    case 40: {
                        double k = 0.0;
                        if (parse_double(value_line, &k)) {
                            current_spline.knots.push_back(k);
                        }
                        break;
                    }
                    default:
                        break;
                }
                break;
            case DxfEntityKind::Text:
                if (parse_style_code(&current_text.style, code, value_line)) break;
                switch (code) {
                    case 8:
                        current_text.layer = value_line;
                        break;
                    case 10:
                        if (parse_double(value_line, &current_text.pos.x)) {
                            current_text.has_x = true;
                        }
                        break;
                    case 20:
                        if (parse_double(value_line, &current_text.pos.y)) {
                            current_text.has_y = true;
                        }
                        break;
                    case 40:
                        (void)parse_double(value_line, &current_text.height);
                        break;
                    case 50:
                        (void)parse_double(value_line, &current_text.rotation_deg);
                        break;
                    case 1:
                        current_text.text = value_line;
                        break;
                    case 3:
                        if (!current_text.text.empty()) current_text.text += "\n";
                        current_text.text += value_line;
                        break;
                    default:
                        break;
                }
                break;
            case DxfEntityKind::None:
                break;
        }
    }

    if (current_kind != DxfEntityKind::None) {
        flush_current();
    }

    if (polylines.empty() && lines.empty() && circles.empty() && arcs.empty() &&
        ellipses.empty() && splines.empty() && texts.empty()) {
        if (err) *err = "no supported DXF entities found";
        return false;
    }
    return true;
}

static int32_t importer_import_document(cadgf_document* doc, const char* path_utf8, cadgf_error_v1* out_err) {
    if (!doc || !path_utf8 || !*path_utf8) {
        set_error(out_err, 1, "invalid args");
        return 0;
    }

    try {
        std::vector<DxfPolyline> polylines;
        std::vector<DxfLine> lines;
        std::vector<DxfCircle> circles;
        std::vector<DxfArc> arcs;
        std::vector<DxfEllipse> ellipses;
        std::vector<DxfSpline> splines;
        std::vector<DxfText> texts;
        std::string err;
        if (!parse_dxf_entities(path_utf8, polylines, lines, circles, arcs, ellipses, splines, texts, &err)) {
            set_error(out_err, 2, err.empty() ? "parse failed" : err.c_str());
            return 0;
        }

        std::unordered_map<std::string, int> layer_ids;
        layer_ids["0"] = 0;
        layer_ids[""] = 0;

        auto resolve_layer_id = [&](const std::string& layer, int* out_layer_id) -> bool {
            const std::string layer_name = layer.empty() ? "0" : layer;
            auto it = layer_ids.find(layer_name);
            if (it != layer_ids.end()) {
                *out_layer_id = it->second;
                return true;
            }
            int new_id = -1;
            if (!cadgf_document_add_layer(doc, layer_name.c_str(), 0xFFFFFFu, &new_id)) {
                return false;
            }
            layer_ids[layer_name] = new_id;
            *out_layer_id = new_id;
            return true;
        };

        for (const auto& pl : polylines) {
            int layer_id = 0;
            if (!resolve_layer_id(pl.layer, &layer_id)) {
                set_error(out_err, 3, "failed to add layer");
                return 0;
            }
            if (pl.points.size() < 2) continue;
            cadgf_entity_id id = cadgf_document_add_polyline_ex(doc, pl.points.data(),
                                                                static_cast<int>(pl.points.size()),
                                                                "", layer_id);
            apply_line_style(doc, id, pl.style);
        }

        for (const auto& ln : lines) {
            int layer_id = 0;
            if (!resolve_layer_id(ln.layer, &layer_id)) {
                set_error(out_err, 3, "failed to add layer");
                return 0;
            }
            cadgf_line line{};
            line.a = ln.a;
            line.b = ln.b;
            cadgf_entity_id id = cadgf_document_add_line(doc, &line, "", layer_id);
            apply_line_style(doc, id, ln.style);
        }

        for (const auto& circle_in : circles) {
            int layer_id = 0;
            if (!resolve_layer_id(circle_in.layer, &layer_id)) {
                set_error(out_err, 3, "failed to add layer");
                return 0;
            }
            cadgf_circle circle{};
            circle.center = circle_in.center;
            circle.radius = circle_in.radius;
            cadgf_entity_id id = cadgf_document_add_circle(doc, &circle, "", layer_id);
            apply_line_style(doc, id, circle_in.style);
        }

        constexpr double kDegToRad = 3.14159265358979323846 / 180.0;
        constexpr double kTwoPi = 6.28318530717958647692;
        for (const auto& arc_in : arcs) {
            int layer_id = 0;
            if (!resolve_layer_id(arc_in.layer, &layer_id)) {
                set_error(out_err, 3, "failed to add layer");
                return 0;
            }
            cadgf_arc arc{};
            arc.center = arc_in.center;
            arc.radius = arc_in.radius;
            arc.start_angle = arc_in.start_deg * kDegToRad;
            arc.end_angle = arc_in.end_deg * kDegToRad;
            arc.clockwise = 0;
            cadgf_entity_id id = cadgf_document_add_arc(doc, &arc, "", layer_id);
            apply_line_style(doc, id, arc_in.style);
        }

        for (const auto& ellipse_in : ellipses) {
            int layer_id = 0;
            if (!resolve_layer_id(ellipse_in.layer, &layer_id)) {
                set_error(out_err, 3, "failed to add layer");
                return 0;
            }
            const double ax = ellipse_in.major_axis.x;
            const double ay = ellipse_in.major_axis.y;
            const double major_len = std::sqrt(ax * ax + ay * ay);
            if (major_len <= 0.0 || ellipse_in.ratio <= 0.0) continue;
            cadgf_ellipse ellipse{};
            ellipse.center = ellipse_in.center;
            ellipse.rx = major_len;
            ellipse.ry = major_len * ellipse_in.ratio;
            ellipse.rotation = std::atan2(ay, ax);
            ellipse.start_angle = ellipse_in.has_start ? ellipse_in.start_param : 0.0;
            ellipse.end_angle = ellipse_in.has_end ? ellipse_in.end_param : kTwoPi;
            cadgf_entity_id id = cadgf_document_add_ellipse(doc, &ellipse, "", layer_id);
            apply_line_style(doc, id, ellipse_in.style);
        }

        for (const auto& spline_in : splines) {
            int layer_id = 0;
            if (!resolve_layer_id(spline_in.layer, &layer_id)) {
                set_error(out_err, 3, "failed to add layer");
                return 0;
            }
            if (spline_in.control_points.size() < 2) continue;
            const int degree = spline_in.degree > 0 ? spline_in.degree : 3;
            cadgf_entity_id id = cadgf_document_add_spline(doc,
                                                          spline_in.control_points.data(),
                                                          static_cast<int>(spline_in.control_points.size()),
                                                          spline_in.knots.empty() ? nullptr : spline_in.knots.data(),
                                                          static_cast<int>(spline_in.knots.size()),
                                                          degree, "", layer_id);
            apply_line_style(doc, id, spline_in.style);
        }

        for (const auto& text_in : texts) {
            int layer_id = 0;
            if (!resolve_layer_id(text_in.layer, &layer_id)) {
                set_error(out_err, 3, "failed to add layer");
                return 0;
            }
            cadgf_vec2 pos = text_in.pos;
            const double rotation = text_in.rotation_deg * kDegToRad;
            cadgf_entity_id id = cadgf_document_add_text(doc, &pos, text_in.height, rotation,
                                                         text_in.text.c_str(), "", layer_id);
            apply_line_style(doc, id, text_in.style);
        }

        set_error(out_err, 0, "");
        return 1;
    } catch (const std::exception& e) {
        set_error(out_err, 4, e.what());
        return 0;
    } catch (...) {
        set_error(out_err, 5, "exception during import");
        return 0;
    }
}

static cadgf_string_view importer_name(void) { return sv("DXF Importer (Lite)"); }
static cadgf_string_view importer_extensions(void) { return sv("dxf"); }
static cadgf_string_view importer_filetype_desc(void) { return sv("DXF (*.dxf)"); }

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
    d.name = sv("CADGameFusion DXF Importer Plugin");
    d.version = sv("0.1.0");
    d.description = sv("DXF importer (LWPOLYLINE/LINE/ARC/CIRCLE/ELLIPSE/SPLINE/TEXT) using cadgf_plugin_api_v1");
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
