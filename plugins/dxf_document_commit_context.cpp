#include "dxf_document_commit_context.h"

#include "dxf_metadata_writer.h"

#include <cctype>
#include <algorithm>
#include <cstdio>
#include <utility>

namespace {

constexpr int kMaxHatchPatternKSteps = 5000;
constexpr int kMaxHatchPatternEdgeChecksPerHatch = 10000000;
constexpr int kMaxHatchPatternEdgeChecksPerDocument = 40000000;
constexpr int kMaxHatchPatternBoundaryPointsForPattern = 20000;

bool is_model_layout_name(const std::string& name) {
    if (name.empty()) return false;
    std::string upper;
    upper.reserve(name.size());
    for (char c : name) {
        upper.push_back(static_cast<char>(std::toupper(static_cast<unsigned char>(c))));
    }
    return upper == "MODEL" || upper == "MODEL_SPACE" || upper == "*MODEL_SPACE";
}

std::vector<DxfViewport> filter_paper_viewports(const std::vector<DxfViewport>& viewports) {
    std::vector<DxfViewport> paper_viewports;
    if (viewports.empty()) return paper_viewports;
    paper_viewports.reserve(viewports.size());
    for (const auto& viewport : viewports) {
        if (viewport.space == 1) {
            paper_viewports.push_back(viewport);
        }
    }
    return paper_viewports;
}

std::string resolve_default_paper_layout_name(const std::vector<DxfViewport>& paper_viewports,
                                              bool has_paperspace) {
    std::vector<std::string> names;
    names.reserve(paper_viewports.size());
    for (const auto& viewport : paper_viewports) {
        if (viewport.layout.empty() || is_model_layout_name(viewport.layout)) continue;
        if (std::find(names.begin(), names.end(), viewport.layout) == names.end()) {
            names.push_back(viewport.layout);
        }
    }
    if (names.size() == 1) {
        return names.front();
    }
    if (names.empty() && (has_paperspace || !paper_viewports.empty())) {
        return "PaperSpace";
    }
    return {};
}

size_t count_entities_in_space(const std::vector<DxfPolyline>& polylines,
                               const std::vector<DxfLine>& lines,
                               const std::vector<DxfPoint>& points,
                               const std::vector<DxfCircle>& circles,
                               const std::vector<DxfArc>& arcs,
                               const std::vector<DxfEllipse>& ellipses,
                               const std::vector<DxfSpline>& splines,
                               const std::vector<DxfText>& texts,
                               const std::vector<DxfInsert>& inserts,
                               int space) {
    size_t total = 0;
    for (const auto& pl : polylines) total += (pl.space == space);
    for (const auto& pt : points) total += (pt.space == space);
    for (const auto& ln : lines) total += (ln.space == space);
    for (const auto& circle : circles) total += (circle.space == space);
    for (const auto& arc : arcs) total += (arc.space == space);
    for (const auto& ellipse : ellipses) total += (ellipse.space == space);
    for (const auto& spline : splines) total += (spline.space == space);
    for (const auto& text : texts) total += (text.space == space);
    for (const auto& insert : inserts) total += (insert.space == space);
    return total;
}

void write_hatch_stats_metadata(cadgf_document* doc, const HatchPatternStats& hatch_stats) {
    if (!doc) return;
    char buf[64]{};
    std::snprintf(buf, sizeof(buf), "%d", hatch_stats.emitted_lines);
    (void)cadgf_document_set_meta_value(doc, "dxf.hatch_pattern_emitted_lines", buf);
    (void)cadgf_document_set_meta_value(doc, "dxf.hatch_pattern_clamped",
                                        hatch_stats.clamped ? "1" : "0");
    std::snprintf(buf, sizeof(buf), "%d", hatch_stats.clamped_hatches);
    (void)cadgf_document_set_meta_value(doc, "dxf.hatch_pattern_clamped_hatches", buf);
    std::snprintf(buf, sizeof(buf), "%d", hatch_stats.stride_max);
    (void)cadgf_document_set_meta_value(doc, "dxf.hatch_pattern_stride_max", buf);
    std::snprintf(buf, sizeof(buf), "%d", kMaxHatchPatternKSteps);
    (void)cadgf_document_set_meta_value(doc, "dxf.hatch_pattern_ksteps_limit", buf);
    std::snprintf(buf, sizeof(buf), "%d", hatch_stats.edge_checks);
    (void)cadgf_document_set_meta_value(doc, "dxf.hatch_pattern_edge_checks", buf);
    std::snprintf(buf, sizeof(buf), "%d", hatch_stats.edge_budget_exhausted_hatches);
    (void)cadgf_document_set_meta_value(doc, "dxf.hatch_pattern_edge_budget_exhausted_hatches", buf);
    std::snprintf(buf, sizeof(buf), "%d", hatch_stats.boundary_points_clamped_hatches);
    (void)cadgf_document_set_meta_value(doc, "dxf.hatch_pattern_boundary_points_clamped_hatches", buf);
    std::snprintf(buf, sizeof(buf), "%d", hatch_stats.boundary_points_max);
    (void)cadgf_document_set_meta_value(doc, "dxf.hatch_pattern_boundary_points_max", buf);
    std::snprintf(buf, sizeof(buf), "%d", kMaxHatchPatternEdgeChecksPerHatch);
    (void)cadgf_document_set_meta_value(doc, "dxf.hatch_pattern_edge_checks_limit_per_hatch", buf);
    std::snprintf(buf, sizeof(buf), "%d", kMaxHatchPatternEdgeChecksPerDocument);
    (void)cadgf_document_set_meta_value(doc, "dxf.hatch_pattern_edge_checks_limit_per_doc", buf);
    std::snprintf(buf, sizeof(buf), "%d", kMaxHatchPatternBoundaryPointsForPattern);
    (void)cadgf_document_set_meta_value(doc, "dxf.hatch_pattern_boundary_points_limit", buf);
}

void write_text_stats_metadata(cadgf_document* doc, const TextImportStats& text_stats) {
    if (!doc) return;
    char buf[64]{};
    (void)cadgf_document_set_meta_value(doc, "dxf.text.align_policy", "strict");
    std::snprintf(buf, sizeof(buf), "%d", text_stats.entities_seen);
    (void)cadgf_document_set_meta_value(doc, "dxf.text.entities_seen", buf);
    std::snprintf(buf, sizeof(buf), "%d", text_stats.entities_emitted);
    (void)cadgf_document_set_meta_value(doc, "dxf.text.entities_emitted", buf);
    std::snprintf(buf, sizeof(buf), "%d", text_stats.skipped_missing_xy);
    (void)cadgf_document_set_meta_value(doc, "dxf.text.skipped_missing_xy", buf);
    std::snprintf(buf, sizeof(buf), "%d", text_stats.align_complete);
    (void)cadgf_document_set_meta_value(doc, "dxf.text.align_complete", buf);
    std::snprintf(buf, sizeof(buf), "%d", text_stats.align_partial);
    (void)cadgf_document_set_meta_value(doc, "dxf.text.align_partial", buf);
    std::snprintf(buf, sizeof(buf), "%d", text_stats.align_partial_x_only);
    (void)cadgf_document_set_meta_value(doc, "dxf.text.align_partial_x_only", buf);
    std::snprintf(buf, sizeof(buf), "%d", text_stats.align_partial_y_only);
    (void)cadgf_document_set_meta_value(doc, "dxf.text.align_partial_y_only", buf);
    std::snprintf(buf, sizeof(buf), "%d", text_stats.align_used);
    (void)cadgf_document_set_meta_value(doc, "dxf.text.align_used", buf);
    std::snprintf(buf, sizeof(buf), "%d", text_stats.nonfinite_values);
    (void)cadgf_document_set_meta_value(doc, "dxf.text.nonfinite_values", buf);
}

void write_import_stats_metadata(cadgf_document* doc, const DxfImportStats& import_stats) {
    if (!doc) return;
    char buf[64]{};
    std::snprintf(buf, sizeof(buf), "%d", import_stats.entities_parsed);
    (void)cadgf_document_set_meta_value(doc, "dxf.import.entities_parsed", buf);
    std::snprintf(buf, sizeof(buf), "%d", import_stats.entities_imported);
    (void)cadgf_document_set_meta_value(doc, "dxf.import.entities_imported", buf);
    std::snprintf(buf, sizeof(buf), "%d", import_stats.entities_skipped);
    (void)cadgf_document_set_meta_value(doc, "dxf.import.entities_skipped", buf);
    if (!import_stats.unsupported_types.empty()) {
        std::string json = "{";
        bool first = true;
        std::vector<std::string> keys;
        keys.reserve(import_stats.unsupported_types.size());
        for (const auto& kv : import_stats.unsupported_types) {
            keys.push_back(kv.first);
        }
        std::sort(keys.begin(), keys.end());
        for (const auto& key : keys) {
            if (!first) json += ",";
            json += "\"" + key + "\":" + std::to_string(import_stats.unsupported_types.at(key));
            first = false;
        }
        json += "}";
        (void)cadgf_document_set_meta_value(doc, "dxf.import.unsupported_types", json.c_str());
    }
}

bool apply_layer_metadata(cadgf_document* doc, int layer_id, const DxfLayer& layer) {
    if (!cadgf_document_set_layer_visible(doc, layer_id, layer.visible ? 1 : 0)) return false;
    if (!cadgf_document_set_layer_locked(doc, layer_id, layer.locked ? 1 : 0)) return false;
    if (!cadgf_document_set_layer_frozen(doc, layer_id, layer.frozen ? 1 : 0)) return false;
    if (!cadgf_document_set_layer_printable(doc, layer_id, layer.printable ? 1 : 0)) return false;
    if (layer.style.has_color) {
        if (!cadgf_document_set_layer_color(doc, layer_id, layer.style.color)) return false;
    }
    return true;
}

}  // namespace

bool prepare_dxf_document_commit_context(
    cadgf_document* doc,
    const std::vector<DxfPolyline>& polylines,
    const std::vector<DxfLine>& lines,
    const std::vector<DxfPoint>& points,
    const std::vector<DxfCircle>& circles,
    const std::vector<DxfArc>& arcs,
    const std::vector<DxfEllipse>& ellipses,
    const std::vector<DxfSpline>& splines,
    const std::vector<DxfText>& texts,
    const std::vector<DxfInsert>& inserts,
    const std::vector<DxfViewport>& viewports,
    const std::unordered_map<std::string, DxfLayer>& layers,
    bool has_paperspace,
    bool has_active_view,
    const DxfView& active_view,
    double default_text_height,
    const HatchPatternStats& hatch_stats,
    const TextImportStats& text_stats,
    const DxfImportStats& import_stats,
    DxfDocumentCommitContext* out_context,
    std::string* out_error) {
    if (!doc || !out_context) {
        if (out_error) *out_error = "invalid context";
        return false;
    }

    const std::vector<DxfViewport> paper_viewports = filter_paper_viewports(viewports);
    const std::string default_paper_layout_name =
        resolve_default_paper_layout_name(paper_viewports, has_paperspace);

    const size_t count_space0 =
        count_entities_in_space(polylines, lines, points, circles, arcs, ellipses, splines, texts,
                                inserts, 0);
    const size_t count_space1 =
        count_entities_in_space(polylines, lines, points, circles, arcs, ellipses, splines, texts,
                                inserts, 1);
    const bool has_viewports = !paper_viewports.empty();
    const bool include_all_spaces =
        has_paperspace && count_space0 > 0 && (count_space1 > 0 || has_viewports);
    int target_space = 0;
    if (count_space1 > 0 && count_space0 == 0) {
        target_space = 1;
    } else if (has_paperspace && count_space1 > count_space0) {
        target_space = 1;
    }
    if (has_viewports) {
        target_space = 1;
    }
    const int default_space =
        include_all_spaces ? (has_viewports ? 1 : ((count_space1 > count_space0) ? 1 : 0))
                           : target_space;

    (void)cadgf_document_set_meta_value(doc, "dxf.default_space", default_space == 1 ? "1" : "0");
    write_viewport_list_metadata(doc, paper_viewports);
    if (default_text_height > 0.0) {
        char buf[64]{};
        std::snprintf(buf, sizeof(buf), "%.6f", default_text_height);
        (void)cadgf_document_set_meta_value(doc, "dxf.default_text_height", buf);
    }
    write_hatch_stats_metadata(doc, hatch_stats);
    write_text_stats_metadata(doc, text_stats);
    write_import_stats_metadata(doc, import_stats);
    if (has_active_view) {
        write_active_view_metadata(doc, active_view);
    }

    std::unordered_map<std::string, int> layer_ids;
    layer_ids["0"] = 0;
    layer_ids[""] = 0;

    for (const auto& entry : layers) {
        const std::string& layer_name = entry.first;
        if (layer_name.empty()) continue;
        if (layer_name == "0") {
            if (!apply_layer_metadata(doc, 0, entry.second)) {
                if (out_error) *out_error = "failed to apply layer metadata";
                return false;
            }
            continue;
        }
        if (layer_ids.find(layer_name) != layer_ids.end()) continue;
        const unsigned int color = entry.second.style.has_color ? entry.second.style.color : 0xFFFFFFu;
        int new_id = -1;
        if (!cadgf_document_add_layer(doc, layer_name.c_str(), color, &new_id)) {
            if (out_error) *out_error = "failed to add layer";
            return false;
        }
        layer_ids[layer_name] = new_id;
        if (!apply_layer_metadata(doc, new_id, entry.second)) {
            if (out_error) *out_error = "failed to apply layer metadata";
            return false;
        }
    }

    out_context->layer_ids = std::move(layer_ids);
    out_context->default_paper_layout_name = default_paper_layout_name;
    out_context->include_all_spaces = include_all_spaces;
    out_context->target_space = target_space;
    out_context->default_space = default_space;
    out_context->count_space0 = count_space0;
    out_context->count_space1 = count_space1;
    if (out_error) out_error->clear();
    return true;
}
