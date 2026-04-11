#include "dxf_top_level_entity_committers.h"

#include "dxf_math_utils.h"
#include "dxf_metadata_writer.h"
#include "dxf_style.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <string>
#include <unordered_map>

namespace {

static int resolve_local_group_id(cadgf_document* doc,
                                  std::unordered_map<int, int>& local_to_doc_group,
                                  int local_group_tag,
                                  int fallback_group_id) {
    if (!doc) return fallback_group_id;
    if (local_group_tag < 0) return fallback_group_id;
    auto it = local_to_doc_group.find(local_group_tag);
    if (it != local_to_doc_group.end()) {
        return it->second;
    }
    const int doc_group_id = cadgf_document_alloc_group_id(doc);
    local_to_doc_group.emplace(local_group_tag, doc_group_id);
    return doc_group_id;
}

static std::string trim_ascii(const std::string& value) {
    const char* whitespace = " \t\r\n";
    const size_t start = value.find_first_not_of(whitespace);
    if (start == std::string::npos) return {};
    const size_t end = value.find_last_not_of(whitespace);
    return value.substr(start, end - start + 1);
}

static std::string format_measurement(double value) {
    char buf[64];
    std::snprintf(buf, sizeof(buf), "%.3f", value);
    std::string out(buf);
    const size_t last_non_zero = out.find_last_not_of('0');
    if (last_non_zero != std::string::npos) {
        out.erase(last_non_zero + 1);
    }
    if (!out.empty() && out.back() == '.') {
        out.pop_back();
    }
    return out;
}

}  // namespace

bool commit_dxf_top_level_entities(
    cadgf_document* doc,
    const std::vector<DxfPolyline>& polylines,
    const std::vector<DxfLine>& lines,
    const std::vector<DxfPoint>& points,
    const std::vector<DxfCircle>& circles,
    const std::vector<DxfArc>& arcs,
    const std::vector<DxfEllipse>& ellipses,
    const std::vector<DxfSpline>& splines,
    const std::vector<DxfText>& texts,
    const std::vector<DxfInsert>& inserts,
    const std::unordered_map<std::string, DxfTextStyle>& text_styles,
    const std::unordered_map<std::string, DxfLayer>& layers,
    const std::string& default_paper_layout_name,
    bool include_all_spaces,
    int target_space,
    double default_text_height,
    double default_line_scale,
    std::unordered_map<int, int>& top_level_local_groups,
    std::unordered_map<std::string, int>& layer_ids) {
    if (!doc) return false;

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

    auto maybe_write_layout_metadata = [&](cadgf_entity_id id, int space,
                                           const std::string& layout_name = std::string()) {
        if (space != 1) return;
        const std::string effective_layout =
            !layout_name.empty() ? layout_name : default_paper_layout_name;
        if (!effective_layout.empty()) {
            write_layout_metadata(doc, id, effective_layout);
        }
    };

    auto include_space = [&](int space) -> bool {
        return include_all_spaces || space == target_space;
    };

    auto apply_group = [&](cadgf_entity_id id, int group_id) {
        if (id == 0 || group_id < 0) return;
        (void)cadgf_document_set_entity_group_id(doc, id, group_id);
    };

    auto resolve_text_height = [&](const DxfText& text_in) -> double {
        double text_height = text_in.height;
        if (!(text_height > 0.0)) {
            std::string style_name = text_in.style_name;
            if (style_name.empty()) {
                style_name = "STANDARD";
            }
            auto it = text_styles.find(style_name);
            if (it != text_styles.end() && it->second.has_height) {
                text_height = it->second.height;
            }
        }
        if (!(text_height > 0.0)) {
            text_height = default_text_height > 0.0 ? default_text_height : 1.0;
        }
        return text_height;
    };

    for (const auto& pl : polylines) {
        if (!include_space(pl.space)) continue;
        int layer_id = 0;
        if (!resolve_layer_id(pl.layer, &layer_id)) {
            return false;
        }
        if (pl.points.size() < 2) continue;
        cadgf_entity_id id = cadgf_document_add_polyline_ex(doc, pl.points.data(),
                                                            static_cast<int>(pl.points.size()),
                                                            pl.name.empty() ? "" : pl.name.c_str(), layer_id);
        apply_group(id, resolve_local_group_id(doc, top_level_local_groups, pl.local_group_tag, -1));
        write_space_metadata(doc, id, pl.space);
        maybe_write_layout_metadata(id, pl.space, pl.layout_name);
        write_entity_origin_metadata(doc, id, pl.origin_meta);
        apply_line_style(doc, id, pl.style, layer_style_for(pl.layer), nullptr, default_line_scale);
    }

    for (const auto& ln : lines) {
        if (!include_space(ln.space)) continue;
        int layer_id = 0;
        if (!resolve_layer_id(ln.layer, &layer_id)) {
            return false;
        }
        cadgf_line line{};
        line.a = ln.a;
        line.b = ln.b;
        cadgf_entity_id id = cadgf_document_add_line(doc, &line, "", layer_id);
        write_space_metadata(doc, id, ln.space);
        maybe_write_layout_metadata(id, ln.space, ln.layout_name);
        write_entity_origin_metadata(doc, id, ln.origin_meta);
        apply_line_style(doc, id, ln.style, layer_style_for(ln.layer), nullptr, default_line_scale);
    }

    for (const auto& pt_in : points) {
        if (!include_space(pt_in.space)) continue;
        int layer_id = 0;
        if (!resolve_layer_id(pt_in.layer, &layer_id)) {
            return false;
        }
        cadgf_point pt{};
        pt.p = pt_in.p;
        cadgf_entity_id id = cadgf_document_add_point(doc, &pt, "", layer_id);
        write_space_metadata(doc, id, pt_in.space);
        maybe_write_layout_metadata(id, pt_in.space, pt_in.layout_name);
        write_entity_origin_metadata(doc, id, pt_in.origin_meta);
        apply_line_style(doc, id, pt_in.style, layer_style_for(pt_in.layer), nullptr, default_line_scale);
    }

    for (const auto& circle_in : circles) {
        if (!include_space(circle_in.space)) continue;
        int layer_id = 0;
        if (!resolve_layer_id(circle_in.layer, &layer_id)) {
            return false;
        }
        cadgf_circle circle{};
        circle.center = circle_in.center;
        circle.radius = circle_in.radius;
        cadgf_entity_id id = cadgf_document_add_circle(doc, &circle, "", layer_id);
        write_space_metadata(doc, id, circle_in.space);
        maybe_write_layout_metadata(id, circle_in.space, circle_in.layout_name);
        apply_line_style(doc, id, circle_in.style, layer_style_for(circle_in.layer), nullptr, default_line_scale);
    }

    for (const auto& arc_in : arcs) {
        if (!include_space(arc_in.space)) continue;
        int layer_id = 0;
        if (!resolve_layer_id(arc_in.layer, &layer_id)) {
            return false;
        }
        cadgf_arc arc{};
        arc.center = arc_in.center;
        arc.radius = arc_in.radius;
        arc.start_angle = arc_in.start_deg * kDegToRad;
        arc.end_angle = arc_in.end_deg * kDegToRad;
        arc.clockwise = 0;
        cadgf_entity_id id = cadgf_document_add_arc(doc, &arc, "", layer_id);
        write_space_metadata(doc, id, arc_in.space);
        maybe_write_layout_metadata(id, arc_in.space, arc_in.layout_name);
        apply_line_style(doc, id, arc_in.style, layer_style_for(arc_in.layer), nullptr, default_line_scale);
    }

    for (const auto& ellipse_in : ellipses) {
        if (!include_space(ellipse_in.space)) continue;
        int layer_id = 0;
        if (!resolve_layer_id(ellipse_in.layer, &layer_id)) {
            return false;
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
        write_space_metadata(doc, id, ellipse_in.space);
        maybe_write_layout_metadata(id, ellipse_in.space, ellipse_in.layout_name);
        apply_line_style(doc, id, ellipse_in.style, layer_style_for(ellipse_in.layer), nullptr, default_line_scale);
    }

    for (const auto& spline_in : splines) {
        if (!include_space(spline_in.space)) continue;
        int layer_id = 0;
        if (!resolve_layer_id(spline_in.layer, &layer_id)) {
            return false;
        }
        if (spline_in.control_points.size() < 2) continue;
        const int degree = spline_in.degree > 0 ? spline_in.degree : 3;
        cadgf_entity_id id = cadgf_document_add_spline(doc,
                                                      spline_in.control_points.data(),
                                                      static_cast<int>(spline_in.control_points.size()),
                                                      spline_in.knots.empty() ? nullptr : spline_in.knots.data(),
                                                      static_cast<int>(spline_in.knots.size()),
                                                      degree, "", layer_id);
        write_space_metadata(doc, id, spline_in.space);
        maybe_write_layout_metadata(id, spline_in.space, spline_in.layout_name);
        apply_line_style(doc, id, spline_in.style, layer_style_for(spline_in.layer), nullptr, default_line_scale);
    }

    for (const auto& text_in : texts) {
        if (!include_space(text_in.space)) continue;
        int layer_id = 0;
        if (!resolve_layer_id(text_in.layer, &layer_id)) {
            return false;
        }
        // NOTE: finalize_text() applies strict alignment (only when both 11/21 exist).
        cadgf_vec2 pos = text_in.pos;
        const double rotation = text_in.rotation_deg * kDegToRad;
        double text_height = resolve_text_height(text_in);
        cadgf_entity_id id = cadgf_document_add_text(doc, &pos, text_height, rotation,
                                                     text_in.text.c_str(), "", layer_id);
        apply_group(id, resolve_local_group_id(doc, top_level_local_groups, text_in.local_group_tag, -1));
        write_space_metadata(doc, id, text_in.space);
        maybe_write_layout_metadata(id, text_in.space, text_in.layout_name);
        write_entity_origin_metadata(doc, id, text_in.origin_meta);
        write_text_metadata(doc, id, text_in);
        apply_line_style(doc, id, text_in.style, layer_style_for(text_in.layer), nullptr, default_line_scale);
    }

    for (const auto& insert : inserts) {
        if (!insert.is_dimension) continue;
        if (!include_space(insert.space)) continue;

        int layer_id = 0;
        if (!resolve_layer_id(insert.layer, &layer_id)) {
            return false;
        }

        // NOTE: DIMENSION geometry (extension lines, dimension lines) comes from
        // the associated *D block, which is rendered through the normal block
        // rendering loop below. The defpoint coordinates in DIMENSION entities
        // are in block definition space, not world coordinates.

        std::string dim_text = trim_ascii(insert.dim_text);
        if (dim_text.empty() || dim_text == "<>") {
            if (insert.has_dim_measurement) {
                dim_text = format_measurement(insert.dim_measurement);
            }
        }
        if (!dim_text.empty()) {
            cadgf_vec2 pos = insert.has_dim_text_pos ? insert.dim_text_pos : insert.pos;
            const double text_height = default_text_height > 0.0 ? default_text_height : 1.0;
            cadgf_entity_id id = cadgf_document_add_text(doc, &pos, text_height, 0.0,
                                                         dim_text.c_str(), "", layer_id);
            write_space_metadata(doc, id, insert.space);
            maybe_write_layout_metadata(id, insert.space, insert.layout_name);
            write_dimension_metadata(doc, id, insert);
            apply_line_style(doc, id, insert.style, layer_style_for(insert.layer), nullptr, default_line_scale);
        }
    }

    return true;
}
