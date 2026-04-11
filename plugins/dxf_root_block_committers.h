#pragma once

#include "dxf_block_entity_committers.h"
#include "dxf_document_commit_context.h"

#include <string>
#include <unordered_map>
#include <vector>

bool commit_dxf_root_blocks(
    cadgf_document* doc,
    const std::unordered_map<std::string, DxfBlock>& blocks,
    const std::vector<DxfPolyline>& polylines,
    const std::vector<DxfLine>& lines,
    const std::vector<DxfCircle>& circles,
    const std::vector<DxfArc>& arcs,
    const std::vector<DxfEllipse>& ellipses,
    const std::vector<DxfSpline>& splines,
    const std::vector<DxfText>& texts,
    const std::vector<DxfInsert>& inserts,
    const DxfDocumentCommitContext& commit_ctx,
    const DxfBlockEntityCommitterContext& block_commit_ctx,
    bool has_paperspace,
    bool include_all_spaces,
    int target_space,
    cadgf_error_v1* out_err);
