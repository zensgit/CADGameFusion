#include "dxf_block_entry_committers.h"

#include "dxf_root_block_committers.h"
#include "dxf_top_level_insert_committers.h"

namespace {

static int resolve_local_group_id(cadgf_document* doc,
                                  std::unordered_map<int, int>& local_to_doc_group,
                                  int local_group_tag,
                                  int fallback_group_id) {
    if (!doc) return fallback_group_id;
    if (local_group_tag < 0) return fallback_group_id;
    auto it = local_to_doc_group.find(local_group_tag);
    if (it != local_to_doc_group.end()) {
        return it->second;
    }
    const int doc_group_id = cadgf_document_alloc_group_id(doc);
    local_to_doc_group.emplace(local_group_tag, doc_group_id);
    return doc_group_id;
}

}  // namespace

bool commit_dxf_block_entries(
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
    std::unordered_map<int, int>& top_level_local_groups,
    cadgf_error_v1* out_err) {
    if (!doc) return false;

    auto include_space = [&](int space) -> bool {
        return include_all_spaces || space == target_space;
    };

    if (!commit_dxf_root_blocks(doc, blocks, polylines, lines, circles, arcs, ellipses,
                                splines, texts, inserts, commit_ctx, block_commit_ctx,
                                has_paperspace, include_all_spaces, target_space, out_err)) {
        return false;
    }

    return commit_dxf_top_level_inserts(doc, blocks, inserts, block_commit_ctx,
                                        include_all_spaces, target_space,
                                        top_level_local_groups, &resolve_local_group_id,
                                        out_err);
}
