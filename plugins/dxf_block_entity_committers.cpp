#include "dxf_block_entity_committers.h"

#include "dxf_math_utils.h"
#include "dxf_metadata_writer.h"
#include "dxf_style.h"

#include <algorithm>
#include <cmath>
#include <cstdio>

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

static std::string resolve_entity_layer_name(const std::string& entity_layer,
                                             const std::string& insert_layer) {
    if (entity_layer.empty() || entity_layer == "0") {
        return insert_layer.empty() ? std::string("0") : insert_layer;
    }
    return entity_layer;
}

}  // namespace

Transform2D make_transform(double sx, double sy, double rotation_rad,
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

Transform2D combine_transform(const Transform2D& a, const Transform2D& b) {
    Transform2D out;
    out.m00 = a.m00 * b.m00 + a.m01 * b.m10;
    out.m01 = a.m00 * b.m01 + a.m01 * b.m11;
    out.m10 = a.m10 * b.m00 + a.m11 * b.m10;
    out.m11 = a.m10 * b.m01 + a.m11 * b.m11;
    out.t.x = a.m00 * b.t.x + a.m01 * b.t.y + a.t.x;
    out.t.y = a.m10 * b.t.x + a.m11 * b.t.y + a.t.y;
    return out;
}

cadgf_vec2 apply_transform(const Transform2D& tr, const cadgf_vec2& p) {
    cadgf_vec2 out{};
    out.x = tr.m00 * p.x + tr.m01 * p.y + tr.t.x;
    out.y = tr.m10 * p.x + tr.m11 * p.y + tr.t.y;
    return out;
}

cadgf_vec2 apply_linear(const Transform2D& tr, const cadgf_vec2& p) {
    cadgf_vec2 out{};
    out.x = tr.m00 * p.x + tr.m01 * p.y;
    out.y = tr.m10 * p.x + tr.m11 * p.y;
    return out;
}

void transform_scales(const Transform2D& tr, double* out_sx, double* out_sy) {
    if (out_sx) *out_sx = std::hypot(tr.m00, tr.m10);
    if (out_sy) *out_sy = std::hypot(tr.m01, tr.m11);
}

bool emit_dxf_block_entities(const DxfBlockEntityCommitterContext& ctx,
                             const DxfBlock& block,
                             const Transform2D& tr,
                             const std::string& insert_layer,
                             const DxfStyle* insert_style,
                             int group_id,
                             int source_bundle_id,
                             int space,
                             const std::string& layout_name,
                             const DxfInsert* origin_insert,
                             std::vector<std::string>& stack,
                             int depth,
                             cadgf_error_v1* out_error) {
    if (!ctx.doc || !ctx.layer_ids || !ctx.layers || !ctx.text_styles || !ctx.blocks) return false;
    if (depth > 8) return true;

    std::unordered_map<int, int> block_local_groups;
    std::unordered_map<std::string, int> dimension_block_source_bundles;
    auto resolve_entity_group = [&](int local_group_tag) {
        return resolve_local_group_id(ctx.doc, block_local_groups, local_group_tag, group_id);
    };
    auto resolve_source_bundle_group = [&](int entity_group_id, const DxfEntityOriginMeta& meta) {
        if (source_bundle_id >= 0) {
            return source_bundle_id;
        }
        if (entity_group_id < 0 || meta.source_type != "DIMENSION" || meta.block_name.empty()) {
            return -1;
        }
        auto it = dimension_block_source_bundles.find(meta.block_name);
        if (it != dimension_block_source_bundles.end()) {
            return it->second;
        }
        dimension_block_source_bundles.emplace(meta.block_name, entity_group_id);
        return entity_group_id;
    };

    auto resolve_layer_id = [&](const std::string& layer, int* out_layer_id) -> bool {
        const std::string layer_name = layer.empty() ? "0" : layer;
        auto it = ctx.layer_ids->find(layer_name);
        if (it != ctx.layer_ids->end()) {
            *out_layer_id = it->second;
            return true;
        }
        int new_id = -1;
        if (!cadgf_document_add_layer(ctx.doc, layer_name.c_str(), 0xFFFFFFu, &new_id)) {
            return false;
        }
        (*ctx.layer_ids)[layer_name] = new_id;
        *out_layer_id = new_id;
        return true;
    };

    auto layer_style_for = [&](const std::string& layer) -> const DxfStyle* {
        const std::string layer_name = layer.empty() ? "0" : layer;
        auto it = ctx.layers->find(layer_name);
        if (it == ctx.layers->end()) return nullptr;
        return &it->second.style;
    };

    auto maybe_write_layout_metadata = [&](cadgf_entity_id id, int emit_space,
                                           const std::string& block_layout_name = std::string()) {
        if (emit_space != 1) return;
        const std::string effective_layout =
            !block_layout_name.empty() ? block_layout_name : ctx.default_paper_layout_name;
        if (!effective_layout.empty()) {
            write_layout_metadata(ctx.doc, id, effective_layout);
        }
    };

    auto resolve_text_height = [&](const DxfText& text_in) -> double {
        double text_height = text_in.height;
        if (!(text_height > 0.0)) {
            std::string style_name = text_in.style_name;
            if (style_name.empty()) {
                style_name = "STANDARD";
            }
            auto it = ctx.text_styles->find(style_name);
            if (it != ctx.text_styles->end() && it->second.has_height) {
                text_height = it->second.height;
            }
        }
        if (!(text_height > 0.0)) {
            text_height = ctx.default_text_height > 0.0 ? ctx.default_text_height : 1.0;
        }
        return text_height;
    };

    const DxfEntityOriginMeta insert_origin_meta =
        origin_insert ? build_insert_origin_metadata(*origin_insert) : DxfEntityOriginMeta{};

    constexpr double kDegToRad = 3.14159265358979323846 / 180.0;
    constexpr double kTwoPi = 6.28318530717958647692;
    constexpr int kMaxBlockDepth = 8;

    auto emit_block = [&](auto&& self, const DxfBlock& current_block, const Transform2D& current_tr,
                          const std::string& current_insert_layer, const DxfStyle* current_insert_style,
                          int current_group_id, int current_source_bundle_id, int current_space,
                          const std::string& current_layout_name, const DxfInsert* current_origin_insert,
                          std::vector<std::string>& current_stack, int current_depth) -> bool {
        if (current_depth > kMaxBlockDepth) return true;

        std::unordered_map<int, int> current_block_local_groups;
        std::unordered_map<std::string, int> current_dimension_block_source_bundles;
        auto current_resolve_entity_group = [&](int local_group_tag) {
            return resolve_local_group_id(ctx.doc, current_block_local_groups, local_group_tag,
                                          current_group_id);
        };
        auto current_resolve_source_bundle_group = [&](int entity_group_id, const DxfEntityOriginMeta& meta) {
            if (current_source_bundle_id >= 0) {
                return current_source_bundle_id;
            }
            if (entity_group_id < 0 || meta.source_type != "DIMENSION" || meta.block_name.empty()) {
                return -1;
            }
            auto it = current_dimension_block_source_bundles.find(meta.block_name);
            if (it != current_dimension_block_source_bundles.end()) {
                return it->second;
            }
            current_dimension_block_source_bundles.emplace(meta.block_name, entity_group_id);
            return entity_group_id;
        };

        double scale_x = 1.0;
        double scale_y = 1.0;
        transform_scales(current_tr, &scale_x, &scale_y);
        const bool uniform_scale = std::fabs(scale_x - scale_y) <= 1e-6;
        const double rot = std::atan2(current_tr.m10, current_tr.m00);
        const DxfEntityOriginMeta current_insert_origin_meta =
            current_origin_insert ? build_insert_origin_metadata(*current_origin_insert) : DxfEntityOriginMeta{};

        for (const auto& pl : current_block.polylines) {
            if (pl.points.size() < 2) continue;
            const std::string layer_name = resolve_entity_layer_name(pl.layer, current_insert_layer);
            int layer_id = 0;
            if (!resolve_layer_id(layer_name, &layer_id)) {
                set_error(out_error, 3, "failed to add layer");
                return false;
            }
            std::vector<cadgf_vec2> points;
            points.reserve(pl.points.size());
            for (const auto& p : pl.points) {
                points.push_back(apply_transform(current_tr, p));
            }
            cadgf_entity_id id = cadgf_document_add_polyline_ex(
                ctx.doc, points.data(), static_cast<int>(points.size()),
                pl.name.empty() ? "" : pl.name.c_str(), layer_id);
            const int entity_group_id = current_resolve_entity_group(pl.local_group_tag);
            if (id != 0) {
                (void)cadgf_document_set_entity_group_id(ctx.doc, id, entity_group_id);
                write_space_metadata(ctx.doc, id, current_space);
                maybe_write_layout_metadata(id, current_space, current_layout_name);
                write_entity_origin_metadata(ctx.doc, id, pl.origin_meta);
                if (current_origin_insert && pl.origin_meta.source_type.empty()) {
                    write_insert_derived_metadata(ctx.doc, id, current_origin_insert);
                }
                write_source_bundle_metadata(ctx.doc, id,
                                             current_resolve_source_bundle_group(entity_group_id, pl.origin_meta));
                apply_line_style(ctx.doc, id, pl.style, layer_style_for(layer_name), current_insert_style,
                                 ctx.default_line_scale);
            }
        }

        for (const auto& ln : current_block.lines) {
            const std::string layer_name = resolve_entity_layer_name(ln.layer, current_insert_layer);
            int layer_id = 0;
            if (!resolve_layer_id(layer_name, &layer_id)) {
                set_error(out_error, 3, "failed to add layer");
                return false;
            }
            cadgf_line line{};
            line.a = apply_transform(current_tr, ln.a);
            line.b = apply_transform(current_tr, ln.b);
            cadgf_entity_id id = cadgf_document_add_line(ctx.doc, &line, "", layer_id);
            const int entity_group_id = current_group_id;
            if (id != 0) {
                (void)cadgf_document_set_entity_group_id(ctx.doc, id, entity_group_id);
                write_space_metadata(ctx.doc, id, current_space);
                maybe_write_layout_metadata(id, current_space, current_layout_name);
                write_entity_origin_metadata(ctx.doc, id, ln.origin_meta);
                if (current_origin_insert && ln.origin_meta.source_type.empty()) {
                    write_insert_derived_metadata(ctx.doc, id, current_origin_insert);
                }
                write_source_bundle_metadata(ctx.doc, id,
                                             current_resolve_source_bundle_group(entity_group_id, ln.origin_meta));
                apply_line_style(ctx.doc, id, ln.style, layer_style_for(layer_name), current_insert_style,
                                 ctx.default_line_scale);
            }
        }

        for (const auto& pt_in : current_block.points) {
            const std::string layer_name = resolve_entity_layer_name(pt_in.layer, current_insert_layer);
            int layer_id = 0;
            if (!resolve_layer_id(layer_name, &layer_id)) {
                set_error(out_error, 3, "failed to add layer");
                return false;
            }
            cadgf_point pt{};
            pt.p = apply_transform(current_tr, pt_in.p);
            cadgf_entity_id id = cadgf_document_add_point(ctx.doc, &pt, "", layer_id);
            const int entity_group_id = current_group_id;
            if (id != 0) {
                (void)cadgf_document_set_entity_group_id(ctx.doc, id, entity_group_id);
                write_space_metadata(ctx.doc, id, current_space);
                maybe_write_layout_metadata(id, current_space, current_layout_name);
                write_entity_origin_metadata(ctx.doc, id, pt_in.origin_meta);
                if (current_origin_insert && pt_in.origin_meta.source_type.empty()) {
                    write_insert_derived_metadata(ctx.doc, id, current_origin_insert);
                }
                write_source_bundle_metadata(ctx.doc, id,
                                             current_resolve_source_bundle_group(entity_group_id, pt_in.origin_meta));
                apply_line_style(ctx.doc, id, pt_in.style, layer_style_for(layer_name), current_insert_style,
                                 ctx.default_line_scale);
            }
        }

        for (const auto& circle_in : current_block.circles) {
            const std::string layer_name = resolve_entity_layer_name(circle_in.layer, current_insert_layer);
            int layer_id = 0;
            if (!resolve_layer_id(layer_name, &layer_id)) {
                set_error(out_error, 3, "failed to add layer");
                return false;
            }
            if (uniform_scale) {
                cadgf_circle circle{};
                circle.center = apply_transform(current_tr, circle_in.center);
                circle.radius = circle_in.radius * scale_x;
                cadgf_entity_id id = cadgf_document_add_circle(ctx.doc, &circle, "", layer_id);
                const int entity_group_id = current_group_id;
                if (id != 0) {
                    (void)cadgf_document_set_entity_group_id(ctx.doc, id, entity_group_id);
                    write_space_metadata(ctx.doc, id, current_space);
                    maybe_write_layout_metadata(id, current_space, current_layout_name);
                    write_insert_derived_metadata(ctx.doc, id, current_origin_insert);
                    write_source_bundle_metadata(ctx.doc, id,
                                                 current_resolve_source_bundle_group(entity_group_id, insert_origin_meta));
                    apply_line_style(ctx.doc, id, circle_in.style, layer_style_for(layer_name), current_insert_style,
                                     ctx.default_line_scale);
                }
            } else {
                cadgf_ellipse ellipse{};
                ellipse.center = apply_transform(current_tr, circle_in.center);
                ellipse.rx = circle_in.radius * scale_x;
                ellipse.ry = circle_in.radius * scale_y;
                ellipse.rotation = rot;
                ellipse.start_angle = 0.0;
                ellipse.end_angle = kTwoPi;
                cadgf_entity_id id = cadgf_document_add_ellipse(ctx.doc, &ellipse, "", layer_id);
                const int entity_group_id = current_group_id;
                if (id != 0) {
                    (void)cadgf_document_set_entity_group_id(ctx.doc, id, entity_group_id);
                    write_space_metadata(ctx.doc, id, current_space);
                    maybe_write_layout_metadata(id, current_space, current_layout_name);
                    write_insert_derived_metadata(ctx.doc, id, current_origin_insert);
                    write_source_bundle_metadata(ctx.doc, id,
                                                 current_resolve_source_bundle_group(entity_group_id, insert_origin_meta));
                    apply_line_style(ctx.doc, id, circle_in.style, layer_style_for(layer_name), current_insert_style,
                                     ctx.default_line_scale);
                }
            }
        }

        for (const auto& arc_in : current_block.arcs) {
            const std::string layer_name = resolve_entity_layer_name(arc_in.layer, current_insert_layer);
            int layer_id = 0;
            if (!resolve_layer_id(layer_name, &layer_id)) {
                set_error(out_error, 3, "failed to add layer");
                return false;
            }
            if (uniform_scale) {
                cadgf_arc arc{};
                arc.center = apply_transform(current_tr, arc_in.center);
                arc.radius = arc_in.radius * scale_x;
                arc.start_angle = arc_in.start_deg * kDegToRad + rot;
                arc.end_angle = arc_in.end_deg * kDegToRad + rot;
                arc.clockwise = 0;
                cadgf_entity_id id = cadgf_document_add_arc(ctx.doc, &arc, "", layer_id);
                const int entity_group_id = current_group_id;
                if (id != 0) {
                    (void)cadgf_document_set_entity_group_id(ctx.doc, id, entity_group_id);
                    write_space_metadata(ctx.doc, id, current_space);
                    maybe_write_layout_metadata(id, current_space, current_layout_name);
                    write_insert_derived_metadata(ctx.doc, id, current_origin_insert);
                    write_source_bundle_metadata(ctx.doc, id,
                                                 current_resolve_source_bundle_group(entity_group_id, insert_origin_meta));
                    apply_line_style(ctx.doc, id, arc_in.style, layer_style_for(layer_name), current_insert_style,
                                     ctx.default_line_scale);
                }
            } else {
                cadgf_ellipse ellipse{};
                ellipse.center = apply_transform(current_tr, arc_in.center);
                ellipse.rx = arc_in.radius * scale_x;
                ellipse.ry = arc_in.radius * scale_y;
                ellipse.rotation = rot;
                ellipse.start_angle = arc_in.start_deg * kDegToRad;
                ellipse.end_angle = arc_in.end_deg * kDegToRad;
                cadgf_entity_id id = cadgf_document_add_ellipse(ctx.doc, &ellipse, "", layer_id);
                const int entity_group_id = current_group_id;
                if (id != 0) {
                    (void)cadgf_document_set_entity_group_id(ctx.doc, id, entity_group_id);
                    write_space_metadata(ctx.doc, id, current_space);
                    maybe_write_layout_metadata(id, current_space, current_layout_name);
                    write_insert_derived_metadata(ctx.doc, id, current_origin_insert);
                    write_source_bundle_metadata(ctx.doc, id,
                                                 current_resolve_source_bundle_group(entity_group_id, insert_origin_meta));
                    apply_line_style(ctx.doc, id, arc_in.style, layer_style_for(layer_name), current_insert_style,
                                     ctx.default_line_scale);
                }
            }
        }

        for (const auto& ellipse_in : current_block.ellipses) {
            const std::string layer_name = resolve_entity_layer_name(ellipse_in.layer, current_insert_layer);
            int layer_id = 0;
            if (!resolve_layer_id(layer_name, &layer_id)) {
                set_error(out_error, 3, "failed to add layer");
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
            const cadgf_vec2 major_tx = apply_linear(current_tr, major_vec);
            const cadgf_vec2 minor_tx = apply_linear(current_tr, minor_vec);
            cadgf_ellipse ellipse{};
            ellipse.center = apply_transform(current_tr, ellipse_in.center);
            ellipse.rx = std::hypot(major_tx.x, major_tx.y);
            ellipse.ry = std::hypot(minor_tx.x, minor_tx.y);
            ellipse.rotation = std::atan2(major_tx.y, major_tx.x);
            ellipse.start_angle = ellipse_in.has_start ? ellipse_in.start_param : 0.0;
            ellipse.end_angle = ellipse_in.has_end ? ellipse_in.end_param : kTwoPi;
            cadgf_entity_id id = cadgf_document_add_ellipse(ctx.doc, &ellipse, "", layer_id);
            const int entity_group_id = current_group_id;
            if (id != 0) {
                (void)cadgf_document_set_entity_group_id(ctx.doc, id, entity_group_id);
                write_space_metadata(ctx.doc, id, current_space);
                maybe_write_layout_metadata(id, current_space, current_layout_name);
                write_insert_derived_metadata(ctx.doc, id, current_origin_insert);
                write_source_bundle_metadata(ctx.doc, id,
                                             current_resolve_source_bundle_group(entity_group_id, insert_origin_meta));
                apply_line_style(ctx.doc, id, ellipse_in.style, layer_style_for(layer_name), current_insert_style,
                                 ctx.default_line_scale);
            }
        }

        for (const auto& spline_in : current_block.splines) {
            if (spline_in.control_points.size() < 2) continue;
            const std::string layer_name = resolve_entity_layer_name(spline_in.layer, current_insert_layer);
            int layer_id = 0;
            if (!resolve_layer_id(layer_name, &layer_id)) {
                set_error(out_error, 3, "failed to add layer");
                return false;
            }
            std::vector<cadgf_vec2> control_points;
            control_points.reserve(spline_in.control_points.size());
            for (const auto& p : spline_in.control_points) {
                control_points.push_back(apply_transform(current_tr, p));
            }
            const int degree = spline_in.degree > 0 ? spline_in.degree : 3;
            cadgf_entity_id id = cadgf_document_add_spline(
                ctx.doc, control_points.data(), static_cast<int>(control_points.size()),
                spline_in.knots.empty() ? nullptr : spline_in.knots.data(),
                static_cast<int>(spline_in.knots.size()), degree, "", layer_id);
            const int entity_group_id = current_group_id;
            if (id != 0) {
                (void)cadgf_document_set_entity_group_id(ctx.doc, id, entity_group_id);
                write_space_metadata(ctx.doc, id, current_space);
                maybe_write_layout_metadata(id, current_space, current_layout_name);
                write_insert_derived_metadata(ctx.doc, id, current_origin_insert);
                write_source_bundle_metadata(ctx.doc, id,
                                             current_resolve_source_bundle_group(entity_group_id, insert_origin_meta));
                apply_line_style(ctx.doc, id, spline_in.style, layer_style_for(layer_name), current_insert_style,
                                 ctx.default_line_scale);
            }
        }

        for (const auto& text_in : current_block.texts) {
            const std::string layer_name = resolve_entity_layer_name(text_in.layer, current_insert_layer);
            int layer_id = 0;
            if (!resolve_layer_id(layer_name, &layer_id)) {
                set_error(out_error, 3, "failed to add layer");
                return false;
            }
            cadgf_vec2 base_pos = text_in.pos;
            cadgf_vec2 pos_out = apply_transform(current_tr, base_pos);
            const double rotation = text_in.rotation_deg * kDegToRad + rot;
            double text_height = resolve_text_height(text_in);
            cadgf_entity_id id = cadgf_document_add_text(ctx.doc, &pos_out, text_height * scale_y, rotation,
                                                         text_in.text.c_str(), "", layer_id);
            if (text_in.has_width) {
                DxfText layout = text_in;
                layout.width = std::fabs(text_in.width * scale_x);
                write_text_metadata(ctx.doc, id, layout);
            } else {
                write_text_metadata(ctx.doc, id, text_in);
            }
            const int entity_group_id = current_resolve_entity_group(text_in.local_group_tag);
            if (id != 0) {
                (void)cadgf_document_set_entity_group_id(ctx.doc, id, entity_group_id);
                write_space_metadata(ctx.doc, id, current_space);
                maybe_write_layout_metadata(id, current_space, current_layout_name);
                write_entity_origin_metadata(ctx.doc, id, text_in.origin_meta);
                if (current_origin_insert && text_in.origin_meta.source_type.empty()) {
                    write_insert_derived_metadata(ctx.doc, id, current_origin_insert,
                                                  current_origin_insert && current_origin_insert->is_dimension);
                }
                write_source_bundle_metadata(ctx.doc, id,
                                             current_resolve_source_bundle_group(entity_group_id, text_in.origin_meta));
                apply_line_style(ctx.doc, id, text_in.style, layer_style_for(layer_name), current_insert_style,
                                 ctx.default_line_scale);
            }
        }

        for (const auto& nested_insert : current_block.inserts) {
            if (nested_insert.block_name.empty()) continue;
            auto nested_it = ctx.blocks->find(nested_insert.block_name);
            if (nested_it == ctx.blocks->end()) continue;
            const DxfBlock& nested_block = nested_it->second;
            const std::string nested_layer =
                (nested_insert.layer.empty() || nested_insert.layer == "0") ? current_insert_layer
                                                                             : nested_insert.layer;
            const bool is_dim_block = nested_insert.is_dimension || nested_block.name.rfind("*D", 0) == 0;
            Transform2D combined;
            if (is_dim_block) {
                combined = Transform2D{};
            } else {
                const cadgf_vec2 nested_base = nested_block.has_base ? nested_block.base : cadgf_vec2{0.0, 0.0};
                const double nested_rot = nested_insert.rotation_deg * kDegToRad;
                const Transform2D local = make_transform(nested_insert.scale_x, nested_insert.scale_y, nested_rot,
                                                         nested_insert.pos, nested_base);
                combined = combine_transform(current_tr, local);
            }
            if (std::find(current_stack.begin(), current_stack.end(), nested_block.name) != current_stack.end()) {
                continue;
            }
            current_stack.push_back(nested_block.name);
            const int nested_group = cadgf_document_alloc_group_id(ctx.doc);
            const DxfStyle nested_style = resolve_insert_byblock_style(nested_insert.style, current_insert_style);
            const DxfInsert* nested_origin_insert = current_origin_insert ? current_origin_insert : &nested_insert;
            if (!self(self, nested_block, combined, nested_layer, &nested_style, nested_group, current_source_bundle_id,
                      current_space, current_layout_name, nested_origin_insert, current_stack, current_depth + 1)) {
                return false;
            }
            current_stack.pop_back();
        }

        return true;
    };

    return emit_block(emit_block, block, tr, insert_layer, insert_style, group_id, source_bundle_id, space,
                      layout_name, origin_insert, stack, depth);
}
