#include "dxf_view_finalizers.h"

#include <cctype>

namespace {

std::string uppercase_ascii_local(const std::string& value) {
    std::string out;
    out.reserve(value.size());
    for (char c : value) {
        out.push_back(static_cast<char>(std::toupper(static_cast<unsigned char>(c))));
    }
    return out;
}

bool is_paper_block_name_local(const std::string& name) {
    if (name.empty()) return false;
    const std::string upper = uppercase_ascii_local(name);
    return upper.rfind("*PAPER_SPACE", 0) == 0;
}

bool is_model_layout_name_local(const std::string& name) {
    if (name.empty()) return false;
    const std::string upper = uppercase_ascii_local(name);
    return upper == "MODEL" || upper == "MODEL_SPACE" || upper == "*MODEL_SPACE";
}

}  // namespace

void finalize_dxf_viewport(DxfViewport& viewport, bool in_block,
                           const std::string& current_block_name,
                           bool& has_paperspace,
                           std::vector<DxfViewport>& viewports) {
    if (!(viewport.has_center_x && viewport.has_center_y &&
          viewport.has_view_center_x && viewport.has_view_center_y &&
          viewport.has_width && viewport.has_height && viewport.has_view_height)) {
        return;
    }
    if (!(viewport.width > 0.0) || !(viewport.height > 0.0) || !(viewport.view_height > 0.0)) {
        return;
    }
    if (viewport.space != 1) {
        bool is_paper = false;
        if (!viewport.layout.empty() && !is_model_layout_name_local(viewport.layout)) {
            is_paper = true;
        }
        if (!is_paper && in_block && is_paper_block_name_local(current_block_name)) {
            is_paper = true;
        }
        if (is_paper) {
            viewport.space = 1;
            has_paperspace = true;
        }
    }
    viewports.push_back(viewport);
}

void finalize_dxf_vport(const DxfView& view, DxfView& active_view,
                        bool& has_active_view) {
    if (!view.has_name) return;
    if (!(view.has_center_x && view.has_center_y && view.has_view_height)) return;
    if (!(view.view_height > 0.0)) return;
    if (uppercase_ascii_local(view.name) == "*ACTIVE") {
        active_view = view;
        has_active_view = true;
    }
}

void finalize_dxf_layout(const DxfLayout& layout,
                         std::unordered_map<std::string, std::string>& layout_by_block_record) {
    if (!(layout.has_name && layout.has_block_record)) return;
    layout_by_block_record[layout.block_record] = layout.name;
}
