#pragma once
// DXF table-record field handlers extracted from dxf_importer_plugin.cpp.
// Handles group codes inside LAYER, STYLE and VPORT table records.
//
// Dependencies: dxf_types.h (DxfStyle, DxfView, cadgf_vec2),
//               dxf_style.h (parse_style_code), dxf_math_utils.h (parse_int,
//               parse_double), dxf_text_encoding.h (sanitize_utf8).

#include "dxf_types.h"

#include <string>

// ---------- DxfLayer ---------------------------------------------------------
struct DxfLayer {
    std::string name;
    bool has_name = false;
    bool visible = true;
    bool locked = false;
    bool frozen = false;
    bool printable = true;
    DxfStyle style;
};

// ---------- DxfTextStyle -----------------------------------------------------
struct DxfTextStyle {
    std::string name;
    bool has_name = false;
    double height = 0.0;
    bool has_height = false;
};

// Handle a single group-code/value pair for an in-progress LAYER record.
// Returns true (and the caller should `continue`) when the code was consumed.
bool handle_layer_record_field(int code, const std::string& value_line,
                               const std::string& header_codepage,
                               DxfLayer& layer);

// Handle a single group-code/value pair for an in-progress STYLE record.
// Returns true (and the caller should `continue`) when the code was consumed.
bool handle_style_record_field(int code, const std::string& value_line,
                               const std::string& header_codepage,
                               DxfTextStyle& style);

// Handle a single group-code/value pair for an in-progress VPORT record.
// Returns true (and the caller should `continue`) when the code was consumed.
bool handle_vport_record_field(int code, const std::string& value_line,
                               const std::string& header_codepage,
                               DxfView& vport);
