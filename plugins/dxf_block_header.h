#pragma once
// DXF block-header field handler.
// Extracted from dxf_importer_plugin.cpp to reduce branching in
// parse_dxf_entities().
//
// Dependencies: dxf_text_encoding.h (for sanitize_utf8),
//               dxf_math_utils.h (for parse_double), standard headers.

#include "core/plugin_abi_c_v1.h"

#include <string>

// ---------- DxfBlockHeaderContext -----------------------------------------------
// Bundles the parser state pointers needed by the block-header field handler.
// The caller sets up pointers into its own local state so that the handler can
// read and write parser variables directly.
struct DxfBlockHeaderContext {
    const bool* in_block_header;        // gate: currently inside block header?
    std::string* block_name;            // -> current_block.name
    bool* has_name;                     // -> current_block.has_name
    std::string* owner_handle;          // -> current_block.owner_handle
    bool* has_owner_handle;             // -> current_block.has_owner_handle
    cadgf_vec2* block_base;             // -> current_block.base
    bool* has_base;                     // -> current_block.has_base
    double* pending_block_x;            // pending X coordinate for base point
    bool* has_block_x;                  // has pending X?
    const std::string* header_codepage; // codepage for sanitize_utf8
};

// Handles a single DXF record when in_block_header is true.
// Returns true if the record was consumed (caller should `continue`).
bool handle_block_header_field(int code, const std::string& value_line,
                               DxfBlockHeaderContext& ctx);
