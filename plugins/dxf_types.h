#pragma once
// Minimal DXF types shared across extracted leaf modules.
// Only the types needed by dxf_color, dxf_text_encoding, and dxf_math_utils
// live here.  Everything else stays in dxf_importer_plugin.cpp until a later
// extraction batch.

#include <string>

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
