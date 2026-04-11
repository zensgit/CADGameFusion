#pragma once
// DXF parser code==2 section/table name routing handler.
// Extracted from dxf_importer_plugin.cpp to reduce branching in
// parse_dxf_entities().
//
// Dependencies: dxf_parser_zero_record.h (for DxfSection enum), standard headers.

#include "dxf_parser_zero_record.h"

#include <string>

// ---------- DxfNameRoutingContext ------------------------------------------------
// Bundles the parser state pointers needed by the code==2 name-routing handler.
// The caller sets up pointers into its own local state so that the handler can
// read and write parser variables directly.
struct DxfNameRoutingContext {
    bool* expect_section_name;
    bool* expect_table_name;
    DxfSection* current_section;
    std::string* current_header_var;
    std::string* current_table;
    bool* in_block;
    bool* in_block_header;
    bool* in_layer_table;
    bool* in_style_table;
    bool* in_vport_table;
};

// Handles a code==2 DXF record for section/table name routing.
// Returns true if the record was consumed (caller should `continue`).
bool handle_name_routing(int code, const std::string& value_line,
                         DxfNameRoutingContext& ctx);
