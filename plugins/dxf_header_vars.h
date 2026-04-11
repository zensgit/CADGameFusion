#pragma once
// DXF parser HEADER section variable handler.
// Extracted from dxf_importer_plugin.cpp to reduce branching in
// parse_dxf_entities().
//
// Dependencies: dxf_parser_zero_record.h (for DxfSection enum),
//               dxf_math_utils.h (for parse_double), standard headers.

#include "dxf_parser_zero_record.h"

#include <string>

// ---------- DxfHeaderVarsContext --------------------------------------------------
// Bundles the parser state pointers needed by the HEADER section handler.
// The caller sets up pointers into its own local state so that the handler can
// read and write parser variables directly.
struct DxfHeaderVarsContext {
    DxfSection* current_section;
    std::string* current_header_var;
    std::string* header_codepage;
    bool* has_header_codepage;
    double* header_ltscale;
    bool* has_header_ltscale;
    double* header_celtscale;
    bool* has_header_celtscale;
    double* header_textsize;
    bool* has_header_textsize;
};

// Handles a single DXF record when current_section == DxfSection::Header.
// Returns true if the record was consumed (caller should `continue`).
bool handle_header_var(int code, const std::string& value_line,
                       DxfHeaderVarsContext& ctx);
