#pragma once

#include "dxf_block_entity_committers.h"

bool emit_dxf_block_leaf_entities(const DxfBlockEntityCommitterContext& ctx,
                                  const DxfBlock& block,
                                  const Transform2D& tr,
                                  const std::string& insert_layer,
                                  const DxfStyle* insert_style,
                                  int group_id,
                                  int source_bundle_id,
                                  int space,
                                  const std::string& layout_name,
                                  const DxfInsert* origin_insert,
                                  cadgf_error_v1* out_error);
