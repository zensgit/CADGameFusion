#pragma once
// Shared DXF types used by extracted importer helper modules.
// This header intentionally grows in small batches as modules are split out of
// dxf_importer_plugin.cpp.

#include "core/plugin_abi_c_v1.h"

#include <string>
#include <vector>

// ---------- DxfStyle ----------------------------------------------------------
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
    int color_aci = 0;
    bool has_color_aci = false;
    bool color_is_true = false;
    bool byblock_color = false;
    bool hidden = false;
};

// ---------- DxfColorSource / DxfColorMeta ------------------------------------
enum class DxfColorSource {
    None,
    ByLayer,
    ByBlock,
    Index,
    TrueColor
};

struct DxfColorMeta {
    DxfColorSource source{DxfColorSource::None};
    int aci{0};
    bool has_aci{false};
};

// ---------- DxfEntityOriginMeta ---------------------------------------------
struct DxfEntityOriginMeta {
    std::string source_type;
    std::string edit_mode;
    std::string proxy_kind;
    std::string block_name;
    std::string hatch_pattern;
    int hatch_id{-1};
    cadgf_vec2 source_anchor{};
    bool has_source_anchor{false};
    cadgf_vec2 leader_landing{};
    bool has_leader_landing{false};
    cadgf_vec2 leader_elbow{};
    bool has_leader_elbow{false};
    std::string source_anchor_driver_type;
    std::string source_anchor_driver_kind;
};

// ---------- DxfText ----------------------------------------------------------
struct DxfText {
    std::string layer;
    std::string owner_handle;
    bool has_owner_handle = false;
    std::string layout_name;
    std::string style_name;
    std::string kind;
    std::string attribute_tag;
    std::string attribute_default;
    std::string attribute_prompt;
    cadgf_vec2 pos{};
    cadgf_vec2 align_pos{};
    double height = 0.0;
    double rotation_deg = 0.0;
    double width = 0.0;
    double width_factor = 1.0;
    std::string text;
    bool has_x = false;
    bool has_y = false;
    bool has_align_x = false;
    bool has_align_y = false;
    bool has_width = false;
    bool has_width_factor = false;
    int attribute_flags = 0;
    bool has_attribute_tag = false;
    bool has_attribute_default = false;
    bool has_attribute_prompt = false;
    bool has_attribute_flags = false;
    int attachment = 0;
    bool has_attachment = false;
    int halign = 0;
    int valign = 0;
    bool has_halign = false;
    bool has_valign = false;
    bool is_mtext = false;
    bool allow_extended_text = false;
    DxfStyle style;
    int space = 0;
    DxfEntityOriginMeta origin_meta;
    int local_group_tag = -1;
};

// ---------- DxfInsert --------------------------------------------------------
struct DxfInsert {
    std::string block_name;
    std::string layer;
    std::string owner_handle;
    bool has_owner_handle = false;
    std::string layout_name;
    cadgf_vec2 pos{};
    double scale_x = 1.0;
    double scale_y = 1.0;
    double rotation_deg = 0.0;
    bool has_x = false;
    bool has_y = false;
    bool has_scale_x = false;
    bool has_scale_y = false;
    bool is_dimension = false;
    std::string dim_text;
    std::string dim_style;
    cadgf_vec2 dim_text_pos{};
    bool has_dim_text_pos = false;
    double dim_measurement = 0.0;
    bool has_dim_measurement = false;
    cadgf_vec2 dim_defpoint1{};
    cadgf_vec2 dim_defpoint2{};
    bool has_dim_defpoint1 = false;
    bool has_dim_defpoint2 = false;
    int dim_type = 0;
    DxfStyle style;
    int space = 0;
    bool has_following_attributes = false;
    int local_group_tag = -1;
};

// ---------- DxfEllipse ------------------------------------------------------
struct DxfEllipse {
    std::string layer;
    std::string owner_handle;
    bool has_owner_handle = false;
    std::string layout_name;
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
    int space = 0;
};

// ---------- DxfViewport / DxfView -------------------------------------------
struct DxfViewport {
    int space = 0;
    int id = -1;
    cadgf_vec2 center{};
    cadgf_vec2 view_center{};
    double width = 0.0;
    double height = 0.0;
    double view_height = 0.0;
    double twist_deg = 0.0;
    bool has_center_x = false;
    bool has_center_y = false;
    bool has_view_center_x = false;
    bool has_view_center_y = false;
    bool has_width = false;
    bool has_height = false;
    bool has_view_height = false;
    bool has_twist = false;
    bool has_id = false;
    std::string layout;
    std::string owner_handle;
    bool has_owner_handle = false;
};

struct DxfView {
    std::string name;
    bool has_name = false;
    cadgf_vec2 center{};
    double view_height = 0.0;
    double aspect = 0.0;
    bool has_center_x = false;
    bool has_center_y = false;
    bool has_view_height = false;
    bool has_aspect = false;
};
