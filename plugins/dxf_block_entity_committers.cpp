#include "dxf_block_entity_committers.h"

#include "dxf_block_leaf_entity_emitters.h"
#include "dxf_math_utils.h"
#include "dxf_metadata_writer.h"
#include "dxf_style.h"

#include <algorithm>
#include <cmath>
#include <cstdio>

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
    constexpr double kDegToRad = 3.14159265358979323846 / 180.0;
    constexpr int kMaxBlockDepth = 8;

    auto emit_block = [&](auto&& self, const DxfBlock& current_block, const Transform2D& current_tr,
                          const std::string& current_insert_layer, const DxfStyle* current_insert_style,
                          int current_group_id, int current_source_bundle_id, int current_space,
                          const std::string& current_layout_name, const DxfInsert* current_origin_insert,
                          std::vector<std::string>& current_stack, int current_depth) -> bool {
        if (current_depth > kMaxBlockDepth) return true;

        if (!emit_dxf_block_leaf_entities(ctx, current_block, current_tr, current_insert_layer,
                                          current_insert_style, current_group_id, current_source_bundle_id,
                                          current_space, current_layout_name, current_origin_insert, out_error)) {
            return false;
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
