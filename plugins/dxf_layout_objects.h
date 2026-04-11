#pragma once
// DXF layout-object field parser extracted from dxf_importer_plugin.cpp.
// Handles group codes inside LAYOUT objects in the OBJECTS section.
//
// Dependencies: dxf_text_encoding.h, standard headers.

#include <string>

// ---------- DxfLayout ---------------------------------------------------------
struct DxfLayout {
    std::string name;
    std::string block_record;
    bool has_name = false;
    bool has_block_record = false;
};

// Handles a single DXF record inside a LAYOUT object.
// Always returns true (the record is always consumed; caller should `continue`).
bool handle_layout_object_field(int code, const std::string& value_line,
                                const std::string& header_codepage,
                                DxfLayout& layout);
