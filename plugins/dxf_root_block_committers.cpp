#include "dxf_root_block_committers.h"

#include "dxf_math_utils.h"

#include <algorithm>
#include <cctype>
#include <string>
#include <unordered_set>
#include <vector>

namespace {

static std::string uppercase_ascii(const std::string& value) {
    std::string out;
    out.reserve(value.size());
    for (char c : value) {
        out.push_back(static_cast<char>(std::toupper(static_cast<unsigned char>(c))));
    }
    return out;
}

static bool is_paper_block_name(const std::string& name) {
    if (name.empty()) return false;
    const std::string upper = uppercase_ascii(name);
    return upper.rfind("*PAPER_SPACE", 0) == 0;
}

static bool is_model_layout_name(const std::string& name) {
    if (name.empty()) return false;
    const std::string upper = uppercase_ascii(name);
    return upper == "MODEL" || upper == "MODEL_SPACE" || upper == "*MODEL_SPACE";
}

static bool block_has_entities(const DxfBlock& block) {
    return !(block.polylines.empty() && block.lines.empty() && block.points.empty() &&
             block.circles.empty() && block.arcs.empty() && block.ellipses.empty() &&
             block.splines.empty() && block.texts.empty() && block.inserts.empty());
}

}  // namespace

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
    cadgf_error_v1* out_err) {
    if (!doc) return false;

    auto include_space = [&](int space) -> bool {
        return include_all_spaces || space == target_space;
    };

    const Transform2D identity{};
    std::vector<std::string> stack;

    auto find_named_block = [&](const char* name) -> const DxfBlock* {
        auto it = blocks.find(name);
        if (it == blocks.end()) return nullptr;
        if (!block_has_entities(it->second)) return nullptr;
        return &it->second;
    };

    std::vector<const DxfBlock*> paper_blocks;
    if (has_paperspace) {
        std::vector<std::string> paper_block_names;
        paper_block_names.reserve(blocks.size());
        for (const auto& entry : blocks) {
            if (!is_paper_block_name(entry.first) || !block_has_entities(entry.second)) continue;
            paper_block_names.push_back(entry.first);
        }
        std::sort(paper_block_names.begin(), paper_block_names.end());
        for (const auto& name : paper_block_names) {
            auto it = blocks.find(name);
            if (it == blocks.end()) continue;
            paper_blocks.push_back(&it->second);
        }
    }

    std::unordered_set<std::string> top_level_paper_layouts;
    bool has_unattributed_top_level_paperspace = false;
    auto collect_top_level_paper_layout = [&](const auto& entity) {
        if (entity.space != 1) return;
        if (entity.layout_name.empty() || is_model_layout_name(entity.layout_name)) {
            has_unattributed_top_level_paperspace = true;
            return;
        }
        top_level_paper_layouts.insert(entity.layout_name);
    };
    auto collect_top_level_paper_layouts = [&](const auto& entities) {
        for (const auto& entity : entities) {
            collect_top_level_paper_layout(entity);
        }
    };
    collect_top_level_paper_layouts(polylines);
    collect_top_level_paper_layouts(lines);
    collect_top_level_paper_layouts(circles);
    collect_top_level_paper_layouts(arcs);
    collect_top_level_paper_layouts(ellipses);
    collect_top_level_paper_layouts(splines);
    collect_top_level_paper_layouts(texts);
    collect_top_level_paper_layouts(inserts);

    std::unordered_set<std::string> emitted_root_blocks;
    auto emit_root_block = [&](const DxfBlock* block, int space) -> bool {
        if (!block) return true;
        if (!emitted_root_blocks.insert(block->name).second) return true;
        stack.clear();
        stack.push_back(block->name);
        const int root_group = cadgf_document_alloc_group_id(doc);
        const std::string layout_name = space == 1 ? block->layout_name : std::string();
        const bool ok = emit_dxf_block_entities(block_commit_ctx, *block, identity, "0", nullptr,
                                                root_group, -1, space, layout_name, nullptr,
                                                stack, 0, out_err);
        stack.clear();
        if (!ok) {
            set_error(out_err, 3, "failed to emit block entities");
        }
        return ok;
    };

    const bool has_top_level_entities =
        !(polylines.empty() && lines.empty() && circles.empty() && arcs.empty() &&
          ellipses.empty() && splines.empty() && texts.empty() && inserts.empty());

    if (!has_top_level_entities) {
        const DxfBlock* fallback_block = nullptr;
        int fallback_space = 0;
        fallback_block = find_named_block("*Model_Space");
        if (!fallback_block) fallback_block = find_named_block("*MODEL_SPACE");
        if (!fallback_block) {
            fallback_block = find_named_block("*Paper_Space");
            if (fallback_block) fallback_space = 1;
        }
        if (!fallback_block) {
            fallback_block = find_named_block("*PAPER_SPACE");
            if (fallback_block) fallback_space = 1;
        }

        if (fallback_block && !emit_root_block(fallback_block, fallback_space)) {
            return false;
        }
    }

    if (has_paperspace && include_space(1)) {
        for (const DxfBlock* block : paper_blocks) {
            bool should_emit = commit_ctx.count_space1 == 0;
            if (!should_emit) {
                if (!block->layout_name.empty() && !is_model_layout_name(block->layout_name)) {
                    should_emit = top_level_paper_layouts.find(block->layout_name) ==
                                  top_level_paper_layouts.end();
                } else {
                    should_emit = has_unattributed_top_level_paperspace;
                }
            }
            if (!should_emit) continue;
            if (!emit_root_block(block, 1)) {
                return false;
            }
        }
    }

    return true;
}
