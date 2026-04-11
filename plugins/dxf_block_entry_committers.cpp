#include "dxf_block_entry_committers.h"

#include "dxf_math_utils.h"
#include "dxf_root_block_committers.h"

#include <string>

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

    const Transform2D identity{};
    std::vector<std::string> stack;

    for (const auto& insert : inserts) {
        if (!include_space(insert.space)) continue;
        if (insert.block_name.empty()) continue;
        auto block_it = blocks.find(insert.block_name);
        if (block_it == blocks.end()) continue;
        const DxfBlock& block = block_it->second;
        const bool is_dim_block = insert.is_dimension || block.name.rfind("*D", 0) == 0;
        const std::string insert_layer =
            (insert.layer.empty() || insert.layer == "0") ? std::string("0") : insert.layer;

        Transform2D combined;
        if (is_dim_block) {
            combined = identity;
        } else {
            const cadgf_vec2 base = block.has_base ? block.base : cadgf_vec2{0.0, 0.0};
            const Transform2D local = make_transform(insert.scale_x, insert.scale_y,
                                                     insert.rotation_deg * kDegToRad,
                                                     insert.pos, base);
            combined = combine_transform(identity, local);
        }

        stack.clear();
        stack.push_back(block.name);

        int group_id = -1;
        if (insert.local_group_tag >= 0) {
            const int fallback_group_id = cadgf_document_alloc_group_id(doc);
            group_id = resolve_local_group_id(doc, top_level_local_groups,
                                              insert.local_group_tag, fallback_group_id);
        } else {
            group_id = cadgf_document_alloc_group_id(doc);
        }

        if (!emit_dxf_block_entities(block_commit_ctx, block, combined, insert_layer, &insert.style,
                                     group_id, insert.is_dimension ? group_id : -1,
                                     insert.space, insert.layout_name, &insert, stack, 0, out_err)) {
            return false;
        }

        if (!insert.is_dimension && group_id >= 0 && !insert.block_name.empty()) {
            const std::string ref_key =
                "dxf.block_ref." + std::to_string(static_cast<unsigned long long>(group_id));
            (void)cadgf_document_set_meta_value(doc, ref_key.c_str(), insert.block_name.c_str());
        }
    }

    return true;
}
