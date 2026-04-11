#pragma once

#include "dxf_types.h"
#include "dxf_layout_objects.h"

#include <string>
#include <unordered_map>
#include <vector>

// Finalize a parsed DXF viewport record and append it when complete.
void finalize_dxf_viewport(DxfViewport& viewport, bool in_block,
                           const std::string& current_block_name,
                           bool& has_paperspace,
                           std::vector<DxfViewport>& viewports);

// Finalize a parsed DXF VPORT table record and capture the active view.
void finalize_dxf_vport(const DxfView& view, DxfView& active_view,
                        bool& has_active_view);

// Finalize a parsed DXF LAYOUT object and register its block-record mapping.
void finalize_dxf_layout(const DxfLayout& layout,
                         std::unordered_map<std::string, std::string>& layout_by_block_record);
