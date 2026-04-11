#pragma once
// DXF table/block finalizers extracted from parse_dxf_entities().
// Each finalizer gates on has_name before inserting into the target map.

#include "dxf_table_records.h"

#include <string>
#include <unordered_map>

void finalize_layer(DxfLayer& layer,
                    std::unordered_map<std::string, DxfLayer>& layers);

void finalize_text_style(DxfTextStyle& style,
                         std::unordered_map<std::string, DxfTextStyle>& text_styles);

// DxfBlock is defined locally in dxf_importer_plugin.cpp, so finalize_block
// is a template instantiated at the call site where the full type is visible.
template <typename Block>
inline void finalize_block(Block& block,
                           std::unordered_map<std::string, Block>& blocks) {
    if (!block.has_name) return;
    blocks[block.name] = block;
}
