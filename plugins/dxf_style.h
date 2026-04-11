#pragma once

#include "dxf_types.h"

#include <string>

bool parse_style_code(DxfStyle* style, int code, const std::string& value_line, const std::string& codepage);
void apply_line_style(cadgf_document* doc,
                      cadgf_entity_id id,
                      const DxfStyle& style,
                      const DxfStyle* layer_style,
                      const DxfStyle* block_style,
                      double default_line_scale);
DxfStyle resolve_insert_byblock_style(const DxfStyle& insert_style, const DxfStyle* parent_style);

