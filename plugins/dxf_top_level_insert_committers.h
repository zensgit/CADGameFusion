#pragma once

#include "dxf_block_entity_committers.h"

#include <string>
#include <unordered_map>
#include <vector>

using DxfResolveLocalGroupIdFn = int (*)(cadgf_document*,
                                         std::unordered_map<int, int>&,
                                         int,
                                         int);

bool commit_dxf_top_level_inserts(
    cadgf_document* doc,
    const std::unordered_map<std::string, DxfBlock>& blocks,
    const std::vector<DxfInsert>& inserts,
    const DxfBlockEntityCommitterContext& block_commit_ctx,
    bool include_all_spaces,
    int target_space,
    std::unordered_map<int, int>& top_level_local_groups,
    DxfResolveLocalGroupIdFn resolve_local_group_id,
    cadgf_error_v1* out_err);
