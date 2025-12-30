#include "core/plugin_abi_c_v1.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <algorithm>
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
    bool byblock_line_type = false;
    bool byblock_line_weight = false;
    unsigned int color = 0;
    bool has_color = false;
    bool byblock_color = false;
    bool hidden = false;
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

struct DxfLayer {
    std::string name;
    bool has_name = false;
    bool visible = true;
    bool locked = false;
    bool frozen = false;
    bool printable = true;
    DxfStyle style;
};

struct DxfInsert {
    std::string block_name;
    std::string layer;
    cadgf_vec2 pos{};
    double scale_x = 1.0;
    double scale_y = 1.0;
    double rotation_deg = 0.0;
    bool has_x = false;
    bool has_y = false;
    bool has_scale_x = false;
    bool has_scale_y = false;
    DxfStyle style;
};

struct DxfBlock {
    std::string name;
    bool has_name = false;
    cadgf_vec2 base{};
    bool has_base = false;
    std::vector<DxfPolyline> polylines;
    std::vector<DxfLine> lines;
    std::vector<DxfCircle> circles;
    std::vector<DxfArc> arcs;
    std::vector<DxfEllipse> ellipses;
    std::vector<DxfSpline> splines;
    std::vector<DxfText> texts;
    std::vector<DxfInsert> inserts;
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

static unsigned int aci_to_rgb(int index) {
    switch (index) {
        case 1: return 0xFF0000u;
        case 2: return 0xFFFF00u;
        case 3: return 0x00FF00u;
        case 4: return 0x00FFFFu;
        case 5: return 0x0000FFu;
        case 6: return 0xFF00FFu;
        case 7: return 0xFFFFFFu;
        case 8: return 0x808080u;
        case 9: return 0xC0C0C0u;
        default: return 0xFFFFFFu;
    }
}

static bool parse_style_code(DxfStyle* style, int code, const std::string& value_line) {
    if (!style) return false;
    switch (code) {
        case 6: {
            if (value_line == "BYBLOCK") {
                style->byblock_line_type = true;
                return true;
            }
            if (!value_line.empty() && value_line != "BYLAYER") {
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
                if (weight == -2) {
                    style->byblock_line_weight = true;
                    return true;
                }
                if (weight >= 0) {
                    style->line_weight = static_cast<double>(weight) / 100.0;
                    style->has_line_weight = true;
                }
            }
            return true;
        }
        case 60: {
            int hidden = 0;
            if (parse_int(value_line, &hidden) && hidden != 0) {
                style->hidden = true;
            }
            return true;
        }
        case 62: {
            int index = 0;
            if (parse_int(value_line, &index)) {
                if (index == 0) {
                    style->byblock_color = true;
                    return true;
                }
                if (index == 256) {
                    return true;
                }
                if (index < 0) {
                    style->hidden = true;
                    index = -index;
                }
                if (index > 0) {
                    style->color = aci_to_rgb(index);
                    style->has_color = true;
                }
            }
            return true;
        }
        case 420: {
            int rgb = 0;
            if (parse_int(value_line, &rgb)) {
                style->color = static_cast<unsigned int>(rgb) & 0xFFFFFFu;
                style->has_color = true;
            }
            return true;
        }
        default:
            return false;
    }
}

static void apply_line_style(cadgf_document* doc, cadgf_entity_id id, const DxfStyle& style,
                             const DxfStyle* layer_style, const DxfStyle* block_style) {
    if (!doc || id == 0) return;
    if (style.has_line_type) {
        (void)cadgf_document_set_entity_line_type(doc, id, style.line_type.c_str());
    } else if (style.byblock_line_type && block_style && block_style->has_line_type) {
        (void)cadgf_document_set_entity_line_type(doc, id, block_style->line_type.c_str());
    } else if (layer_style && layer_style->has_line_type) {
        (void)cadgf_document_set_entity_line_type(doc, id, layer_style->line_type.c_str());
    }
    if (style.has_line_weight) {
        (void)cadgf_document_set_entity_line_weight(doc, id, style.line_weight);
    } else if (style.byblock_line_weight && block_style && block_style->has_line_weight) {
        (void)cadgf_document_set_entity_line_weight(doc, id, block_style->line_weight);
    } else if (layer_style && layer_style->has_line_weight) {
        (void)cadgf_document_set_entity_line_weight(doc, id, layer_style->line_weight);
    }
    if (style.has_line_scale) {
        (void)cadgf_document_set_entity_line_type_scale(doc, id, style.line_type_scale);
    } else if (layer_style && layer_style->has_line_scale) {
        (void)cadgf_document_set_entity_line_type_scale(doc, id, layer_style->line_type_scale);
    }
    if (style.has_color) {
        (void)cadgf_document_set_entity_color(doc, id, style.color);
    } else if (style.byblock_color && block_style && block_style->has_color) {
        (void)cadgf_document_set_entity_color(doc, id, block_style->color);
    }
    if (style.hidden) {
        (void)cadgf_document_set_entity_visible(doc, id, 0);
    }
}

struct Transform2D {
    double m00{1.0};
    double m01{0.0};
    double m10{0.0};
    double m11{1.0};
    cadgf_vec2 t{};
};

static Transform2D make_transform(double sx, double sy, double rotation_rad,
                                  const cadgf_vec2& pos, const cadgf_vec2& base) {
    const double cos_r = std::cos(rotation_rad);
    const double sin_r = std::sin(rotation_rad);
    Transform2D tr;
    tr.m00 = cos_r * sx;
    tr.m01 = -sin_r * sy;
    tr.m10 = sin_r * sx;
    tr.m11 = cos_r * sy;
    tr.t.x = pos.x - (tr.m00 * base.x + tr.m01 * base.y);
    tr.t.y = pos.y - (tr.m10 * base.x + tr.m11 * base.y);
    return tr;
}

static Transform2D combine_transform(const Transform2D& a, const Transform2D& b) {
    Transform2D out;
    out.m00 = a.m00 * b.m00 + a.m01 * b.m10;
    out.m01 = a.m00 * b.m01 + a.m01 * b.m11;
    out.m10 = a.m10 * b.m00 + a.m11 * b.m10;
    out.m11 = a.m10 * b.m01 + a.m11 * b.m11;
    out.t.x = a.m00 * b.t.x + a.m01 * b.t.y + a.t.x;
    out.t.y = a.m10 * b.t.x + a.m11 * b.t.y + a.t.y;
    return out;
}

static cadgf_vec2 apply_transform(const Transform2D& tr, const cadgf_vec2& p) {
    cadgf_vec2 out{};
    out.x = tr.m00 * p.x + tr.m01 * p.y + tr.t.x;
    out.y = tr.m10 * p.x + tr.m11 * p.y + tr.t.y;
    return out;
}

static cadgf_vec2 apply_linear(const Transform2D& tr, const cadgf_vec2& p) {
    cadgf_vec2 out{};
    out.x = tr.m00 * p.x + tr.m01 * p.y;
    out.y = tr.m10 * p.x + tr.m11 * p.y;
    return out;
}

static void transform_scales(const Transform2D& tr, double* out_sx, double* out_sy) {
    if (out_sx) *out_sx = std::hypot(tr.m00, tr.m10);
    if (out_sy) *out_sy = std::hypot(tr.m01, tr.m11);
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

static void finalize_insert(DxfInsert& insert, std::vector<DxfInsert>& out) {
    if (insert.block_name.empty() || !(insert.has_x && insert.has_y)) return;
    if (!insert.has_scale_x && insert.has_scale_y) {
        insert.scale_x = insert.scale_y;
    }
    if (!insert.has_scale_y && insert.has_scale_x) {
        insert.scale_y = insert.scale_x;
    }
    out.push_back(insert);
}

enum class DxfEntityKind {
    None,
    Polyline,
    Line,
    Circle,
    Arc,
    Ellipse,
    Spline,
    Text,
    Insert
};

enum class DxfSection {
    None,
    Tables,
    Blocks,
    Entities
};

static bool parse_dxf_entities(const std::string& path,
                               std::vector<DxfPolyline>& polylines,
                               std::vector<DxfLine>& lines,
                               std::vector<DxfCircle>& circles,
                               std::vector<DxfArc>& arcs,
                               std::vector<DxfEllipse>& ellipses,
                               std::vector<DxfSpline>& splines,
                               std::vector<DxfText>& texts,
                               std::unordered_map<std::string, DxfBlock>& blocks,
                               std::vector<DxfInsert>& inserts,
                               std::unordered_map<std::string, DxfLayer>& layers,
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
    DxfInsert current_insert;
    DxfBlock current_block;
    DxfLayer current_layer;
    double pending_x = 0.0;
    bool has_x = false;
    double pending_spline_x = 0.0;
    bool has_spline_x = false;
    double pending_block_x = 0.0;
    bool has_block_x = false;
    bool expect_section_name = false;
    bool expect_table_name = false;
    bool in_layer_table = false;
    bool in_layer_record = false;
    bool in_block = false;
    bool in_block_header = false;
    DxfSection current_section = DxfSection::None;
    std::string current_table;

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
    auto reset_insert = [&]() { current_insert = DxfInsert{}; };
    auto reset_block = [&]() {
        current_block = DxfBlock{};
        has_block_x = false;
    };
    auto reset_layer = [&]() { current_layer = DxfLayer{}; };

    auto flush_current = [&]() {
        switch (current_kind) {
            case DxfEntityKind::Polyline:
                if (in_block) {
                    finalize_polyline(current_polyline, current_block.polylines);
                } else {
                    finalize_polyline(current_polyline, polylines);
                }
                reset_polyline();
                break;
            case DxfEntityKind::Line:
                if (in_block) {
                    finalize_line(current_line, current_block.lines);
                } else {
                    finalize_line(current_line, lines);
                }
                reset_line();
                break;
            case DxfEntityKind::Circle:
                if (in_block) {
                    finalize_circle(current_circle, current_block.circles);
                } else {
                    finalize_circle(current_circle, circles);
                }
                reset_circle();
                break;
            case DxfEntityKind::Arc:
                if (in_block) {
                    finalize_arc(current_arc, current_block.arcs);
                } else {
                    finalize_arc(current_arc, arcs);
                }
                reset_arc();
                break;
            case DxfEntityKind::Ellipse:
                if (in_block) {
                    finalize_ellipse(current_ellipse, current_block.ellipses);
                } else {
                    finalize_ellipse(current_ellipse, ellipses);
                }
                reset_ellipse();
                break;
            case DxfEntityKind::Spline:
                if (in_block) {
                    finalize_spline(current_spline, current_block.splines);
                } else {
                    finalize_spline(current_spline, splines);
                }
                reset_spline();
                break;
            case DxfEntityKind::Text:
                if (in_block) {
                    finalize_text(current_text, current_block.texts);
                } else {
                    finalize_text(current_text, texts);
                }
                reset_text();
                break;
            case DxfEntityKind::Insert:
                if (in_block) {
                    finalize_insert(current_insert, current_block.inserts);
                } else {
                    finalize_insert(current_insert, inserts);
                }
                reset_insert();
                break;
            case DxfEntityKind::None:
                break;
        }
        current_kind = DxfEntityKind::None;
    };

    auto finalize_layer = [&](DxfLayer& layer) {
        if (!layer.has_name) return;
        if (layer.style.hidden) {
            layer.visible = false;
        }
        layers[layer.name] = layer;
    };

    auto finalize_block = [&](DxfBlock& block) {
        if (!block.has_name) return;
        blocks[block.name] = block;
    };

    while (std::getline(in, code_line)) {
        if (!std::getline(in, value_line)) break;

        int code = 0;
        if (!parse_int(code_line, &code)) continue;

        if (code == 0) {
            flush_current();
            if (value_line == "SECTION") {
                expect_section_name = true;
                continue;
            }
            if (value_line == "ENDSEC") {
                if (in_layer_table && in_layer_record) {
                    finalize_layer(current_layer);
                    reset_layer();
                    in_layer_record = false;
                }
                if (in_block) {
                    finalize_block(current_block);
                    reset_block();
                    in_block = false;
                    in_block_header = false;
                }
                in_layer_table = false;
                current_table.clear();
                current_section = DxfSection::None;
                continue;
            }
            if (value_line == "TABLE") {
                expect_table_name = true;
                continue;
            }
            if (value_line == "ENDTAB") {
                if (in_layer_table && in_layer_record) {
                    finalize_layer(current_layer);
                    reset_layer();
                    in_layer_record = false;
                }
                in_layer_table = false;
                current_table.clear();
                continue;
            }
            if (in_layer_table && value_line == "LAYER") {
                if (in_layer_record) {
                    finalize_layer(current_layer);
                    reset_layer();
                }
                in_layer_record = true;
                continue;
            }
            if (value_line == "BLOCK" && current_section == DxfSection::Blocks) {
                if (in_block) {
                    finalize_block(current_block);
                }
                reset_block();
                in_block = true;
                in_block_header = true;
                continue;
            }
            if (value_line == "ENDBLK") {
                if (in_block) {
                    finalize_block(current_block);
                    reset_block();
                    in_block = false;
                }
                in_block_header = false;
                continue;
            }
            if (in_block && in_block_header) {
                in_block_header = false;
            }
            const bool in_entities = current_section == DxfSection::Entities;
            const bool in_block_entities = current_section == DxfSection::Blocks && in_block && !in_block_header;
            if (!in_entities && !in_block_entities) {
                current_kind = DxfEntityKind::None;
                continue;
            }
            if (value_line == "INSERT" && (in_entities || in_block_entities)) {
                current_kind = DxfEntityKind::Insert;
                reset_insert();
            } else if (value_line == "LWPOLYLINE") {
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

        if (expect_section_name && code == 2) {
            expect_section_name = false;
            if (value_line == "TABLES") {
                current_section = DxfSection::Tables;
                in_block = false;
                in_block_header = false;
            } else if (value_line == "ENTITIES") {
                current_section = DxfSection::Entities;
                in_block = false;
                in_block_header = false;
            } else if (value_line == "BLOCKS") {
                current_section = DxfSection::Blocks;
                in_block = false;
                in_block_header = false;
            } else {
                current_section = DxfSection::None;
                in_block = false;
                in_block_header = false;
            }
            continue;
        }

        if (expect_table_name && code == 2) {
            expect_table_name = false;
            current_table = value_line;
            in_layer_table = (current_section == DxfSection::Tables && current_table == "LAYER");
            continue;
        }

        if (in_layer_table && in_layer_record) {
            if (parse_style_code(&current_layer.style, code, value_line)) {
                if (current_layer.style.hidden) current_layer.visible = false;
                continue;
            }
            switch (code) {
                case 2:
                    current_layer.name = value_line;
                    current_layer.has_name = true;
                    break;
                case 70: {
                    int flags = 0;
                    if (parse_int(value_line, &flags)) {
                        current_layer.frozen = (flags & 1) != 0 || (flags & 2) != 0;
                        current_layer.locked = (flags & 4) != 0;
                        current_layer.printable = (flags & 128) == 0;
                    }
                    break;
                }
                default:
                    break;
            }
            continue;
        }

        if (in_block_header) {
            switch (code) {
                case 2:
                    current_block.name = value_line;
                    current_block.has_name = true;
                    break;
                case 10:
                    if (parse_double(value_line, &pending_block_x)) {
                        has_block_x = true;
                    }
                    break;
                case 20: {
                    if (!has_block_x) break;
                    double y = 0.0;
                    if (parse_double(value_line, &y)) {
                        current_block.base = cadgf_vec2{pending_block_x, y};
                        current_block.has_base = true;
                    }
                    has_block_x = false;
                    break;
                }
                default:
                    break;
            }
            continue;
        }

        const bool in_entities = current_section == DxfSection::Entities;
        const bool in_block_entities = current_section == DxfSection::Blocks && in_block && !in_block_header;
        if (!in_entities && !in_block_entities) {
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
            case DxfEntityKind::Insert:
                if (parse_style_code(&current_insert.style, code, value_line)) break;
                switch (code) {
                    case 2:
                        current_insert.block_name = value_line;
                        break;
                    case 8:
                        current_insert.layer = value_line;
                        break;
                    case 10:
                        if (parse_double(value_line, &current_insert.pos.x)) {
                            current_insert.has_x = true;
                        }
                        break;
                    case 20:
                        if (parse_double(value_line, &current_insert.pos.y)) {
                            current_insert.has_y = true;
                        }
                        break;
                    case 41:
                        if (parse_double(value_line, &current_insert.scale_x)) {
                            current_insert.has_scale_x = true;
                        }
                        break;
                    case 42:
                        if (parse_double(value_line, &current_insert.scale_y)) {
                            current_insert.has_scale_y = true;
                        }
                        break;
                    case 50:
                        (void)parse_double(value_line, &current_insert.rotation_deg);
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
    if (in_layer_table && in_layer_record) {
        finalize_layer(current_layer);
    }
    if (in_block) {
        finalize_block(current_block);
    }

    if (polylines.empty() && lines.empty() && circles.empty() && arcs.empty() &&
        ellipses.empty() && splines.empty() && texts.empty() && inserts.empty()) {
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
        std::unordered_map<std::string, DxfBlock> blocks;
        std::vector<DxfInsert> inserts;
        std::unordered_map<std::string, DxfLayer> layers;
        std::string err;
        if (!parse_dxf_entities(path_utf8, polylines, lines, circles, arcs, ellipses, splines, texts,
                                blocks, inserts, layers, &err)) {
            set_error(out_err, 2, err.empty() ? "parse failed" : err.c_str());
            return 0;
        }

        std::unordered_map<std::string, int> layer_ids;
        layer_ids["0"] = 0;
        layer_ids[""] = 0;

        auto apply_layer_metadata = [&](int layer_id, const DxfLayer& layer) -> bool {
            if (!cadgf_document_set_layer_visible(doc, layer_id, layer.visible ? 1 : 0)) return false;
            if (!cadgf_document_set_layer_locked(doc, layer_id, layer.locked ? 1 : 0)) return false;
            if (!cadgf_document_set_layer_frozen(doc, layer_id, layer.frozen ? 1 : 0)) return false;
            if (!cadgf_document_set_layer_printable(doc, layer_id, layer.printable ? 1 : 0)) return false;
            if (layer.style.has_color) {
                if (!cadgf_document_set_layer_color(doc, layer_id, layer.style.color)) return false;
            }
            return true;
        };

        for (const auto& entry : layers) {
            const std::string& layer_name = entry.first;
            if (layer_name.empty()) continue;
            if (layer_name == "0") {
                if (!apply_layer_metadata(0, entry.second)) {
                    set_error(out_err, 3, "failed to apply layer metadata");
                    return 0;
                }
                continue;
            }
            if (layer_ids.find(layer_name) != layer_ids.end()) continue;
            const unsigned int color = entry.second.style.has_color ? entry.second.style.color : 0xFFFFFFu;
            int new_id = -1;
            if (!cadgf_document_add_layer(doc, layer_name.c_str(), color, &new_id)) {
                set_error(out_err, 3, "failed to add layer");
                return 0;
            }
            layer_ids[layer_name] = new_id;
            if (!apply_layer_metadata(new_id, entry.second)) {
                set_error(out_err, 3, "failed to apply layer metadata");
                return 0;
            }
        }

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

        auto layer_style_for = [&](const std::string& layer) -> const DxfStyle* {
            const std::string layer_name = layer.empty() ? "0" : layer;
            auto it = layers.find(layer_name);
            if (it == layers.end()) return nullptr;
            return &it->second.style;
        };

        constexpr double kDegToRad = 3.14159265358979323846 / 180.0;
        constexpr double kTwoPi = 6.28318530717958647692;

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
            apply_line_style(doc, id, pl.style, layer_style_for(pl.layer), nullptr);
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
            apply_line_style(doc, id, ln.style, layer_style_for(ln.layer), nullptr);
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
            apply_line_style(doc, id, circle_in.style, layer_style_for(circle_in.layer), nullptr);
        }

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
            apply_line_style(doc, id, arc_in.style, layer_style_for(arc_in.layer), nullptr);
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
            apply_line_style(doc, id, ellipse_in.style, layer_style_for(ellipse_in.layer), nullptr);
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
            apply_line_style(doc, id, spline_in.style, layer_style_for(spline_in.layer), nullptr);
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
            apply_line_style(doc, id, text_in.style, layer_style_for(text_in.layer), nullptr);
        }

        auto resolve_entity_layer_name = [&](const std::string& entity_layer,
                                             const std::string& insert_layer) -> std::string {
            if (entity_layer.empty() || entity_layer == "0") {
                return insert_layer.empty() ? std::string("0") : insert_layer;
            }
            return entity_layer;
        };
        auto apply_group = [&](cadgf_entity_id id, int group_id) {
            if (id == 0 || group_id < 0) return;
            (void)cadgf_document_set_entity_group_id(doc, id, group_id);
        };

        constexpr int kMaxBlockDepth = 8;

        auto emit_block = [&](auto&& self, const DxfBlock& block, const Transform2D& tr,
                              const std::string& insert_layer, const DxfStyle* insert_style, int group_id,
                              std::vector<std::string>& stack, int depth) -> bool {
            if (depth > kMaxBlockDepth) return true;

            double scale_x = 1.0;
            double scale_y = 1.0;
            transform_scales(tr, &scale_x, &scale_y);
            const bool uniform_scale = std::fabs(scale_x - scale_y) <= 1e-6;
            const double rot = std::atan2(tr.m10, tr.m00);

            for (const auto& pl : block.polylines) {
                if (pl.points.size() < 2) continue;
                const std::string layer_name = resolve_entity_layer_name(pl.layer, insert_layer);
                int layer_id = 0;
                if (!resolve_layer_id(layer_name, &layer_id)) {
                    set_error(out_err, 3, "failed to add layer");
                    return false;
                }
                std::vector<cadgf_vec2> points;
                points.reserve(pl.points.size());
                for (const auto& p : pl.points) {
                    points.push_back(apply_transform(tr, p));
                }
                cadgf_entity_id id = cadgf_document_add_polyline_ex(doc, points.data(),
                                                                    static_cast<int>(points.size()),
                                                                    "", layer_id);
                apply_group(id, group_id);
                apply_line_style(doc, id, pl.style, layer_style_for(layer_name), insert_style);
            }

            for (const auto& ln : block.lines) {
                const std::string layer_name = resolve_entity_layer_name(ln.layer, insert_layer);
                int layer_id = 0;
                if (!resolve_layer_id(layer_name, &layer_id)) {
                    set_error(out_err, 3, "failed to add layer");
                    return false;
                }
                cadgf_line line{};
                line.a = apply_transform(tr, ln.a);
                line.b = apply_transform(tr, ln.b);
                cadgf_entity_id id = cadgf_document_add_line(doc, &line, "", layer_id);
                apply_group(id, group_id);
                apply_line_style(doc, id, ln.style, layer_style_for(layer_name), insert_style);
            }

            for (const auto& circle_in : block.circles) {
                const std::string layer_name = resolve_entity_layer_name(circle_in.layer, insert_layer);
                int layer_id = 0;
                if (!resolve_layer_id(layer_name, &layer_id)) {
                    set_error(out_err, 3, "failed to add layer");
                    return false;
                }
                if (uniform_scale) {
                    cadgf_circle circle{};
                    circle.center = apply_transform(tr, circle_in.center);
                    circle.radius = circle_in.radius * scale_x;
                    cadgf_entity_id id = cadgf_document_add_circle(doc, &circle, "", layer_id);
                    apply_group(id, group_id);
                    apply_line_style(doc, id, circle_in.style, layer_style_for(layer_name), insert_style);
                } else {
                    cadgf_ellipse ellipse{};
                    ellipse.center = apply_transform(tr, circle_in.center);
                    ellipse.rx = circle_in.radius * scale_x;
                    ellipse.ry = circle_in.radius * scale_y;
                    ellipse.rotation = rot;
                    ellipse.start_angle = 0.0;
                    ellipse.end_angle = kTwoPi;
                    cadgf_entity_id id = cadgf_document_add_ellipse(doc, &ellipse, "", layer_id);
                    apply_group(id, group_id);
                    apply_line_style(doc, id, circle_in.style, layer_style_for(layer_name), insert_style);
                }
            }

            for (const auto& arc_in : block.arcs) {
                const std::string layer_name = resolve_entity_layer_name(arc_in.layer, insert_layer);
                int layer_id = 0;
                if (!resolve_layer_id(layer_name, &layer_id)) {
                    set_error(out_err, 3, "failed to add layer");
                    return false;
                }
                if (uniform_scale) {
                    cadgf_arc arc{};
                    arc.center = apply_transform(tr, arc_in.center);
                    arc.radius = arc_in.radius * scale_x;
                    arc.start_angle = arc_in.start_deg * kDegToRad + rot;
                    arc.end_angle = arc_in.end_deg * kDegToRad + rot;
                    arc.clockwise = 0;
                    cadgf_entity_id id = cadgf_document_add_arc(doc, &arc, "", layer_id);
                    apply_group(id, group_id);
                    apply_line_style(doc, id, arc_in.style, layer_style_for(layer_name), insert_style);
                } else {
                    cadgf_ellipse ellipse{};
                    ellipse.center = apply_transform(tr, arc_in.center);
                    ellipse.rx = arc_in.radius * scale_x;
                    ellipse.ry = arc_in.radius * scale_y;
                    ellipse.rotation = rot;
                    ellipse.start_angle = arc_in.start_deg * kDegToRad;
                    ellipse.end_angle = arc_in.end_deg * kDegToRad;
                    cadgf_entity_id id = cadgf_document_add_ellipse(doc, &ellipse, "", layer_id);
                    apply_group(id, group_id);
                    apply_line_style(doc, id, arc_in.style, layer_style_for(layer_name), insert_style);
                }
            }

            for (const auto& ellipse_in : block.ellipses) {
                const std::string layer_name = resolve_entity_layer_name(ellipse_in.layer, insert_layer);
                int layer_id = 0;
                if (!resolve_layer_id(layer_name, &layer_id)) {
                    set_error(out_err, 3, "failed to add layer");
                    return false;
                }
                const double ax = ellipse_in.major_axis.x;
                const double ay = ellipse_in.major_axis.y;
                const double major_len = std::sqrt(ax * ax + ay * ay);
                if (major_len <= 0.0 || ellipse_in.ratio <= 0.0) continue;
                const cadgf_vec2 major_unit{ax / major_len, ay / major_len};
                const cadgf_vec2 minor_unit{-major_unit.y, major_unit.x};
                const cadgf_vec2 major_vec{major_unit.x * major_len, major_unit.y * major_len};
                const cadgf_vec2 minor_vec{minor_unit.x * major_len * ellipse_in.ratio,
                                           minor_unit.y * major_len * ellipse_in.ratio};
                const cadgf_vec2 major_tx = apply_linear(tr, major_vec);
                const cadgf_vec2 minor_tx = apply_linear(tr, minor_vec);
                cadgf_ellipse ellipse{};
                ellipse.center = apply_transform(tr, ellipse_in.center);
                ellipse.rx = std::hypot(major_tx.x, major_tx.y);
                ellipse.ry = std::hypot(minor_tx.x, minor_tx.y);
                ellipse.rotation = std::atan2(major_tx.y, major_tx.x);
                ellipse.start_angle = ellipse_in.has_start ? ellipse_in.start_param : 0.0;
                ellipse.end_angle = ellipse_in.has_end ? ellipse_in.end_param : kTwoPi;
                cadgf_entity_id id = cadgf_document_add_ellipse(doc, &ellipse, "", layer_id);
                apply_group(id, group_id);
                apply_line_style(doc, id, ellipse_in.style, layer_style_for(layer_name), insert_style);
            }

            for (const auto& spline_in : block.splines) {
                if (spline_in.control_points.size() < 2) continue;
                const std::string layer_name = resolve_entity_layer_name(spline_in.layer, insert_layer);
                int layer_id = 0;
                if (!resolve_layer_id(layer_name, &layer_id)) {
                    set_error(out_err, 3, "failed to add layer");
                    return false;
                }
                std::vector<cadgf_vec2> control_points;
                control_points.reserve(spline_in.control_points.size());
                for (const auto& p : spline_in.control_points) {
                    control_points.push_back(apply_transform(tr, p));
                }
                const int degree = spline_in.degree > 0 ? spline_in.degree : 3;
                cadgf_entity_id id = cadgf_document_add_spline(doc,
                                                              control_points.data(),
                                                              static_cast<int>(control_points.size()),
                                                              spline_in.knots.empty() ? nullptr : spline_in.knots.data(),
                                                              static_cast<int>(spline_in.knots.size()),
                                                              degree, "", layer_id);
                apply_group(id, group_id);
                apply_line_style(doc, id, spline_in.style, layer_style_for(layer_name), insert_style);
            }

            for (const auto& text_in : block.texts) {
                const std::string layer_name = resolve_entity_layer_name(text_in.layer, insert_layer);
                int layer_id = 0;
                if (!resolve_layer_id(layer_name, &layer_id)) {
                    set_error(out_err, 3, "failed to add layer");
                    return false;
                }
                cadgf_vec2 pos_out = apply_transform(tr, text_in.pos);
                const double rotation = text_in.rotation_deg * kDegToRad + rot;
                cadgf_entity_id id = cadgf_document_add_text(doc, &pos_out, text_in.height * scale_y,
                                                             rotation, text_in.text.c_str(), "", layer_id);
                apply_group(id, group_id);
                apply_line_style(doc, id, text_in.style, layer_style_for(layer_name), insert_style);
            }

            for (const auto& nested_insert : block.inserts) {
                if (nested_insert.block_name.empty()) continue;
                auto nested_it = blocks.find(nested_insert.block_name);
                if (nested_it == blocks.end()) continue;
                const DxfBlock& nested_block = nested_it->second;
                const std::string nested_layer = (nested_insert.layer.empty() || nested_insert.layer == "0")
                                                    ? insert_layer
                                                    : nested_insert.layer;
                const cadgf_vec2 nested_base = nested_block.has_base ? nested_block.base : cadgf_vec2{0.0, 0.0};
                const double nested_rot = nested_insert.rotation_deg * kDegToRad;
                const Transform2D local = make_transform(nested_insert.scale_x, nested_insert.scale_y,
                                                         nested_rot, nested_insert.pos, nested_base);
                const Transform2D combined = combine_transform(tr, local);
                if (std::find(stack.begin(), stack.end(), nested_block.name) != stack.end()) {
                    continue;
                }
                stack.push_back(nested_block.name);
                const int nested_group = cadgf_document_alloc_group_id(doc);
                if (!self(self, nested_block, combined, nested_layer, &nested_insert.style,
                          nested_group, stack, depth + 1)) {
                    return false;
                }
                stack.pop_back();
            }

            return true;
        };

        const Transform2D identity{};
        std::vector<std::string> stack;
        for (const auto& insert : inserts) {
            if (insert.block_name.empty()) continue;
            auto block_it = blocks.find(insert.block_name);
            if (block_it == blocks.end()) continue;
            const DxfBlock& block = block_it->second;
            const cadgf_vec2 base = block.has_base ? block.base : cadgf_vec2{0.0, 0.0};
            const std::string insert_layer = (insert.layer.empty() || insert.layer == "0")
                                                ? std::string("0")
                                                : insert.layer;
            const Transform2D local = make_transform(insert.scale_x, insert.scale_y,
                                                     insert.rotation_deg * kDegToRad,
                                                     insert.pos, base);
            const Transform2D combined = combine_transform(identity, local);
            stack.clear();
            stack.push_back(block.name);
            const int group_id = cadgf_document_alloc_group_id(doc);
            if (!emit_block(emit_block, block, combined, insert_layer, &insert.style,
                            group_id, stack, 0)) {
                return 0;
            }
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
