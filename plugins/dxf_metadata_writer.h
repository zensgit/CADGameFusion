#pragma once

#include "dxf_types.h"

#include <vector>

void write_color_metadata(cadgf_document* doc, cadgf_entity_id id, const DxfColorMeta& meta);
void write_space_metadata(cadgf_document* doc, cadgf_entity_id id, int space);
void write_layout_metadata(cadgf_document* doc, cadgf_entity_id id, const std::string& layout);
void write_entity_origin_metadata(cadgf_document* doc, cadgf_entity_id id, const DxfEntityOriginMeta& meta);
void write_source_bundle_metadata(cadgf_document* doc, cadgf_entity_id id, int source_bundle_id);
DxfEntityOriginMeta build_insert_origin_metadata(const DxfInsert& insert);
void write_text_metadata(cadgf_document* doc, cadgf_entity_id id, const DxfText& text);
void write_dimension_metadata(cadgf_document* doc, cadgf_entity_id id, const DxfInsert& insert);
void write_insert_derived_metadata(cadgf_document* doc,
                                   cadgf_entity_id id,
                                   const DxfInsert* origin_insert,
                                   bool include_text_metadata = false);
void write_viewport_list_metadata(cadgf_document* doc, const std::vector<DxfViewport>& viewports);
void write_active_view_metadata(cadgf_document* doc, const DxfView& view);

