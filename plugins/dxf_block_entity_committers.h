#pragma once

#include "dxf_importer_internal_types.h"
#include "dxf_table_records.h"

#include <string>
#include <unordered_map>
#include <vector>

struct Transform2D {
    double m00{1.0};
    double m01{0.0};
    double m10{0.0};
    double m11{1.0};
    cadgf_vec2 t{};
};

Transform2D make_transform(double sx, double sy, double rotation_rad,
                           const cadgf_vec2& pos, const cadgf_vec2& base);
Transform2D combine_transform(const Transform2D& a, const Transform2D& b);
cadgf_vec2 apply_transform(const Transform2D& tr, const cadgf_vec2& p);
cadgf_vec2 apply_linear(const Transform2D& tr, const cadgf_vec2& p);
void transform_scales(const Transform2D& tr, double* out_sx, double* out_sy);

struct DxfBlockEntityCommitterContext {
    cadgf_document* doc = nullptr;
    const std::unordered_map<std::string, DxfBlock>* blocks = nullptr;
    const std::unordered_map<std::string, DxfLayer>* layers = nullptr;
    const std::unordered_map<std::string, DxfTextStyle>* text_styles = nullptr;
    std::unordered_map<std::string, int>* layer_ids = nullptr;
    std::string default_paper_layout_name;
    double default_line_scale = 1.0;
    double default_text_height = 0.0;
};

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
                             cadgf_error_v1* out_error);
