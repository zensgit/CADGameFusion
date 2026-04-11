#include "core/plugin_abi_c_v1.h"

#include "dxf_types.h"
#include "dxf_metadata_writer.h"
#include "dxf_style.h"
#include "dxf_math_utils.h"
#include "dxf_parser_helpers.h"
#include "dxf_parser_zero_record.h"
#include "dxf_header_vars.h"
#include "dxf_parser_name_routing.h"
#include "dxf_block_header.h"
#include "dxf_layout_objects.h"
#include "dxf_table_records.h"
#include "dxf_view_finalizers.h"
#include "dxf_document_commit_context.h"
#include "dxf_block_entry_committers.h"
#include "dxf_block_entity_committers.h"
#include "dxf_top_level_entity_committers.h"
#include "dxf_table_block_finalizers.h"
#include "dxf_simple_geometry_entities.h"
#include "dxf_polyline_entity_parser.h"
#include "dxf_text_encoding.h"
#include "dxf_color.h"
#include "dxf_text_handler.h"
#include "dxf_ellipse_entity_parser.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cctype>
#include <algorithm>
#include <cmath>
#include <fstream>
#include <limits>
#include <string>
#include <utility>
#include <unordered_map>
#include <unordered_set>
#include <vector>

// Internal DXF entity and block types are shared with narrow helper modules
// via dxf_importer_internal_types.h.

// kPi, kTwoPi, kDegToRad, sv(), nearly_equal(), points_nearly_equal()
// are now provided by dxf_math_utils.h

static double dot_vec(const cadgf_vec2& a, const cadgf_vec2& b) {
    return a.x * b.x + a.y * b.y;
}

static bool point_nearly_equal(const cadgf_vec2& a, const cadgf_vec2& b, double eps = 1e-6) {
    return nearly_equal(a.x, b.x, eps) && nearly_equal(a.y, b.y, eps);
}

static void append_boundary_point(std::vector<cadgf_vec2>* boundary, const cadgf_vec2& p) {
    if (!boundary) return;
    if (boundary->empty() || !point_nearly_equal(boundary->back(), p)) {
        boundary->push_back(p);
    }
}

static int arc_segment_count(double delta) {
    const double abs_delta = std::fabs(delta);
    if (abs_delta <= 1e-6) return 0;
    const double step = kPi / 24.0; // higher fidelity for hatch clipping
    int segments = static_cast<int>(std::ceil(abs_delta / step));
    if (segments < 8) segments = 8;
    return segments;
}

static double normalize_param_angle(double angle) {
    if (std::fabs(angle) > kTwoPi + 1e-6) {
        return angle * kDegToRad;
    }
    return angle;
}

static void append_arc_points(std::vector<cadgf_vec2>* boundary, const cadgf_vec2& center,
                              double radius, double start_rad, double end_rad, bool ccw) {
    if (!boundary || !(radius > 0.0)) return;
    double delta = end_rad - start_rad;
    if (ccw) {
        if (delta < 0.0) delta += kTwoPi;
    } else {
        if (delta > 0.0) delta -= kTwoPi;
    }
    const int segments = arc_segment_count(delta);
    if (segments <= 0) return;
    const double step = delta / static_cast<double>(segments);
    for (int i = 0; i <= segments; ++i) {
        const double ang = start_rad + step * static_cast<double>(i);
        cadgf_vec2 p{};
        p.x = center.x + std::cos(ang) * radius;
        p.y = center.y + std::sin(ang) * radius;
        append_boundary_point(boundary, p);
    }
}

static void append_ellipse_points(std::vector<cadgf_vec2>* boundary, const cadgf_vec2& center,
                                  const cadgf_vec2& major_axis, double ratio,
                                  double start_param, double end_param, bool ccw) {
    if (!boundary || !(ratio > 0.0)) return;
    if (std::hypot(major_axis.x, major_axis.y) <= 0.0) return;
    const cadgf_vec2 minor_axis{ -major_axis.y * ratio, major_axis.x * ratio };
    const double start = normalize_param_angle(start_param);
    const double end = normalize_param_angle(end_param);
    double delta = end - start;
    if (ccw) {
        if (delta < 0.0) delta += kTwoPi;
    } else {
        if (delta > 0.0) delta -= kTwoPi;
    }
    const int segments = arc_segment_count(delta);
    if (segments <= 0) return;
    const double step = delta / static_cast<double>(segments);
    for (int i = 0; i <= segments; ++i) {
        const double t = start + step * static_cast<double>(i);
        cadgf_vec2 p{};
        p.x = center.x + major_axis.x * std::cos(t) + minor_axis.x * std::sin(t);
        p.y = center.y + major_axis.y * std::cos(t) + minor_axis.y * std::sin(t);
        append_boundary_point(boundary, p);
    }
}

// set_error(), parse_int(), parse_double(), trim_code_line(), strip_cr()
// are now provided by dxf_math_utils.h

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

static bool is_root_space_block_name(const std::string& name) {
    if (is_paper_block_name(name)) return true;
    const std::string upper = uppercase_ascii(name);
    return upper == "*MODEL_SPACE";
}

// is_valid_utf8(), latin1_to_utf8(), all_digits(), normalize_dxf_codepage(),
// convert_to_utf8_iconv(), sanitize_utf8()
// are now provided by dxf_text_encoding.h

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

static DxfEntityOriginMeta build_hatch_origin_metadata(const DxfHatch& hatch) {
    DxfEntityOriginMeta meta;
    meta.source_type = "HATCH";
    meta.edit_mode = "proxy";
    meta.proxy_kind = "hatch";
    meta.hatch_id = hatch.hatch_id;
    meta.hatch_pattern = hatch.pattern_name;
    return meta;
}

static DxfEntityOriginMeta build_leader_origin_metadata() {
    DxfEntityOriginMeta meta;
    meta.source_type = "LEADER";
    meta.edit_mode = "proxy";
    meta.proxy_kind = "leader";
    return meta;
}

static DxfEntityOriginMeta build_mleader_origin_metadata() {
    DxfEntityOriginMeta meta = build_leader_origin_metadata();
    meta.proxy_kind = "mleader";
    return meta;
}

static bool is_classic_leader_text_kind(const std::string& kind) {
    return kind == "text" || kind == "mtext";
}

static bool is_attribute_text_kind(const std::string& kind) {
    return kind == "attrib" || kind == "attdef";
}

static double point_distance_sq(const cadgf_vec2& a, const cadgf_vec2& b) {
    const double dx = a.x - b.x;
    const double dy = a.y - b.y;
    return dx * dx + dy * dy;
}

static double point_segment_distance_sq(const cadgf_vec2& p,
                                        const cadgf_vec2& a,
                                        const cadgf_vec2& b) {
    const double dx = b.x - a.x;
    const double dy = b.y - a.y;
    const double len_sq = dx * dx + dy * dy;
    if (len_sq <= 1e-12) {
        return point_distance_sq(p, a);
    }
    const double t = std::max(0.0, std::min(1.0,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / len_sq));
    const cadgf_vec2 closest{a.x + dx * t, a.y + dy * t};
    return point_distance_sq(p, closest);
}

static double leader_note_distance_sq(const DxfPolyline& leader, const DxfText& text) {
    if (leader.points.size() < 2) return std::numeric_limits<double>::infinity();
    const cadgf_vec2 note = text.pos;
    const cadgf_vec2& tail = leader.points.back();
    double best_sq = point_distance_sq(note, tail);
    const size_t count = leader.points.size();
    const cadgf_vec2& seg_a = leader.points[count - 2];
    best_sq = std::min(best_sq, point_segment_distance_sq(note, seg_a, tail));
    return best_sq;
}

template <typename LeaderT, typename TextT>
static bool matches_space_layout(const LeaderT& leader, const TextT& text) {
    if (leader.space != text.space) return false;
    if (leader.layout_name.empty() || text.layout_name.empty()) {
        return leader.layout_name.empty() == text.layout_name.empty();
    }
    return leader.layout_name == text.layout_name;
}

static bool has_clear_leader_note_winner(double best_sq, double second_sq) {
    if (!std::isfinite(best_sq)) return false;
    if (!std::isfinite(second_sq)) return true;
    const double best = std::sqrt(std::max(0.0, best_sq));
    const double second = std::sqrt(std::max(0.0, second_sq));
    if (best <= 1e-6) {
        return second >= 1.0;
    }
    return second >= best * 1.8;
}

static void apply_classic_leader_text_guide_metadata(DxfEntityOriginMeta& meta,
                                                     const DxfPolyline& leader,
                                                     const DxfText& text) {
    if (leader.points.size() < 2 || !text.has_x || !text.has_y) return;
    struct Candidate {
        cadgf_vec2 anchor{};
        cadgf_vec2 elbow{};
        bool has_elbow{false};
        double score_sq{std::numeric_limits<double>::infinity()};
    };
    Candidate best{};
    const auto consider = [&](const cadgf_vec2& anchor, const cadgf_vec2* elbow) {
        const double score_sq = point_distance_sq(anchor, text.pos);
        if (!std::isfinite(score_sq) || score_sq >= best.score_sq) return;
        best.anchor = anchor;
        best.has_elbow = elbow != nullptr;
        if (elbow) best.elbow = *elbow;
        best.score_sq = score_sq;
    };
    const cadgf_vec2& first = leader.points.front();
    const cadgf_vec2& second = leader.points[1];
    const cadgf_vec2& penultimate = leader.points[leader.points.size() - 2];
    const cadgf_vec2& last = leader.points.back();
    consider(first, &second);
    consider(last, &penultimate);
    if (!std::isfinite(best.score_sq)) return;
    meta.source_anchor = best.anchor;
    meta.has_source_anchor = true;
    meta.leader_landing = best.anchor;
    meta.has_leader_landing = true;
    if (best.has_elbow) {
        meta.leader_elbow = best.elbow;
        meta.has_leader_elbow = true;
    }
    meta.source_anchor_driver_type = "polyline";
    meta.source_anchor_driver_kind = "endpoint";
}

// resolve_dimension_anchor_axis(), apply_dimension_text_guide_metadata()
// are now provided by dxf_metadata_writer (used internally by write_dimension_metadata).

static void associate_classic_leader_notes(std::vector<DxfPolyline>& polylines,
                                           std::vector<DxfText>& texts,
                                           double default_text_height) {
    struct Candidate {
        size_t leader_index = 0;
        size_t text_index = 0;
        double score_sq = std::numeric_limits<double>::infinity();
    };

    std::vector<size_t> leader_indices;
    leader_indices.reserve(polylines.size());
    int next_local_group_tag = 1;
    for (size_t i = 0; i < polylines.size(); ++i) {
        auto& leader = polylines[i];
        if (leader.origin_meta.source_type != "LEADER" ||
            leader.origin_meta.edit_mode != "proxy" ||
            leader.origin_meta.proxy_kind != "leader" ||
            leader.points.size() < 2) {
            continue;
        }
        if (leader.local_group_tag < 0) {
            leader.local_group_tag = next_local_group_tag++;
        } else {
            next_local_group_tag = std::max(next_local_group_tag, leader.local_group_tag + 1);
        }
        leader_indices.push_back(i);
    }
    if (leader_indices.empty() || texts.empty()) return;

    std::vector<Candidate> accepted(leader_indices.size());
    std::vector<double> leader_second_best(leader_indices.size(), std::numeric_limits<double>::infinity());
    std::vector<int> text_best_candidate(texts.size(), -1);
    std::vector<double> text_best_score(texts.size(), std::numeric_limits<double>::infinity());
    std::vector<double> text_second_best(texts.size(), std::numeric_limits<double>::infinity());

    for (size_t leader_pos = 0; leader_pos < leader_indices.size(); ++leader_pos) {
        const size_t leader_index = leader_indices[leader_pos];
        const auto& leader = polylines[leader_index];
        Candidate best{};
        best.leader_index = leader_index;
        for (size_t text_index = 0; text_index < texts.size(); ++text_index) {
            const auto& text = texts[text_index];
            if (!text.origin_meta.source_type.empty()) continue;
            if (!is_classic_leader_text_kind(text.kind)) continue;
            if (!text.has_x || !text.has_y) continue;
            if (!matches_space_layout(leader, text)) continue;
            const double text_height = text.height > 0.0
                ? text.height
                : (default_text_height > 0.0 ? default_text_height : 1.0);
            const double threshold = std::max(15.0, text_height * 5.0);
            const double score_sq = leader_note_distance_sq(leader, text);
            if (!std::isfinite(score_sq) || score_sq > threshold * threshold) continue;
            if (score_sq < best.score_sq) {
                leader_second_best[leader_pos] = best.score_sq;
                best = Candidate{leader_index, text_index, score_sq};
            } else if (score_sq < leader_second_best[leader_pos]) {
                leader_second_best[leader_pos] = score_sq;
            }

            if (score_sq < text_best_score[text_index]) {
                text_second_best[text_index] = text_best_score[text_index];
                text_best_score[text_index] = score_sq;
                text_best_candidate[text_index] = static_cast<int>(leader_pos);
            } else if (score_sq < text_second_best[text_index]) {
                text_second_best[text_index] = score_sq;
            }
        }
        accepted[leader_pos] = best;
    }

    const DxfEntityOriginMeta leader_meta = build_leader_origin_metadata();
    for (size_t leader_pos = 0; leader_pos < leader_indices.size(); ++leader_pos) {
        const Candidate& candidate = accepted[leader_pos];
        if (!std::isfinite(candidate.score_sq)) continue;
        if (!has_clear_leader_note_winner(candidate.score_sq, leader_second_best[leader_pos])) continue;
        if (text_best_candidate[candidate.text_index] != static_cast<int>(leader_pos)) continue;
        if (!has_clear_leader_note_winner(text_best_score[candidate.text_index],
                                          text_second_best[candidate.text_index])) {
            continue;
        }
        auto& text = texts[candidate.text_index];
        auto& leader = polylines[candidate.leader_index];
        text.origin_meta = leader_meta;
        apply_classic_leader_text_guide_metadata(text.origin_meta, leader, text);
        text.local_group_tag = leader.local_group_tag;
    }
}

static void annotate_mleader_texts(std::vector<DxfText>& texts) {
    int next_local_group_tag = 1;
    for (const auto& text : texts) {
        if (text.local_group_tag >= 0) {
            next_local_group_tag = std::max(next_local_group_tag, text.local_group_tag + 1);
        }
    }

    for (auto& text : texts) {
        if (text.kind != "mleader") continue;
        if (text.origin_meta.source_type.empty()) {
            text.origin_meta = build_mleader_origin_metadata();
        } else if (text.origin_meta.proxy_kind.empty()) {
            text.origin_meta.proxy_kind = "mleader";
        }
        if (text.local_group_tag < 0) {
            text.local_group_tag = next_local_group_tag++;
        }
        if (text.has_x && text.has_y) {
            if (!text.origin_meta.has_source_anchor) {
                text.origin_meta.source_anchor = text.pos;
                text.origin_meta.has_source_anchor = true;
            }
            if (!text.origin_meta.has_leader_landing) {
                text.origin_meta.leader_landing = text.pos;
                text.origin_meta.has_leader_landing = true;
            }
        }
    }
}

static void finalize_polyline(DxfPolyline& pl, std::vector<DxfPolyline>& out) {
    if (pl.points.size() < 2) return;
    if (pl.closed) {
        const auto& first = pl.points.front();
        const auto& last = pl.points.back();
        if (first.x != last.x || first.y != last.y) {
            pl.points.push_back(first);
        }
    }
    out.push_back(pl);
}

static void finalize_line(const DxfLine& line, std::vector<DxfLine>& out) {
    if (!(line.has_ax && line.has_ay && line.has_bx && line.has_by)) return;
    out.push_back(line);
}

static void finalize_point(const DxfPoint& pt, std::vector<DxfPoint>& out) {
    if (!(pt.has_x && pt.has_y)) return;
    out.push_back(pt);
}

static void finalize_circle(const DxfCircle& circle, std::vector<DxfCircle>& out) {
    if (!(circle.has_cx && circle.has_cy && circle.has_radius)) return;
    out.push_back(circle);
}

static void finalize_arc(const DxfArc& arc, std::vector<DxfArc>& out) {
    if (!(arc.has_cx && arc.has_cy && arc.has_radius && arc.has_start && arc.has_end)) return;
    out.push_back(arc);
}

static void finalize_ellipse(const DxfEllipse& ellipse, std::vector<DxfEllipse>& out) {
    if (!(ellipse.has_cx && ellipse.has_cy && ellipse.has_ax && ellipse.has_ay && ellipse.has_ratio)) return;
    out.push_back(ellipse);
}

static void finalize_spline(const DxfSpline& spline, std::vector<DxfSpline>& out) {
    if (spline.control_points.size() < 2) return;
    out.push_back(spline);
}

static void finalize_solid(const DxfSolid& solid, std::vector<DxfPolyline>& out) {
    std::vector<cadgf_vec2> points;
    points.reserve(4);
    for (const auto& p : solid.points) {
        if (p.has_x && p.has_y) {
            points.push_back(p.pos);
        }
    }
    if (points.size() < 3) return;
    DxfPolyline pl;
    pl.layer = solid.layer;
    pl.points = std::move(points);
    pl.closed = true;
    pl.space = solid.space;
    pl.style = solid.style;
    finalize_polyline(pl, out);
}

static bool looks_nonfinite_number(const std::string& raw) {
    std::string s;
    s.reserve(raw.size());
    for (char c : raw) {
        if (!std::isspace(static_cast<unsigned char>(c))) {
            s.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
        }
    }
    if (s.empty()) return false;
    // Common spellings: nan, inf, 1.#INF, -1.#IND, etc.
    if (s.find("nan") != std::string::npos) return true;
    if (s.find("inf") != std::string::npos) return true;
    if (s.find("ind") != std::string::npos) return true;
    return false;
}

// Guardrails for extreme HATCH patterns (very small spacing) to avoid long loops or line explosion.
static constexpr int kMaxHatchPatternKSteps = 5000;
static constexpr int kMaxHatchPatternLinesPerHatch = 50000;
static constexpr int kMaxHatchPatternLinesPerDocument = 200000;
static constexpr int kMaxHatchPatternEdgeChecksPerHatch = 10000000;
static constexpr int kMaxHatchPatternEdgeChecksPerDocument = 40000000;
static constexpr int kMaxHatchPatternBoundaryPointsForPattern = 20000;

static void append_hatch_pattern_lines(const DxfHatch& hatch,
                                       const std::vector<cadgf_vec2>& boundary,
                                       std::vector<DxfLine>& out_lines,
                                       double global_scale,
                                       HatchPatternStats* stats,
                                       int* inout_hatch_emitted,
                                       int* inout_hatch_edge_checks,
                                       bool* inout_hatch_clamped,
                                       bool* inout_edge_budget_exhausted,
                                       bool* inout_boundary_too_large) {
    if (boundary.size() < 3) return;
    if (hatch.pattern_name.empty() || hatch.pattern_name == "SOLID") return;
    if (hatch.pattern_lines.empty()) return;
    if (stats) {
        stats->boundary_points_max =
            std::max(stats->boundary_points_max, static_cast<int>(boundary.size()));
    }

    if (boundary.size() > static_cast<size_t>(kMaxHatchPatternBoundaryPointsForPattern)) {
        if (inout_boundary_too_large) *inout_boundary_too_large = true;
        if (stats) stats->boundary_points_clamped_hatches += 1;
        if (inout_hatch_clamped) *inout_hatch_clamped = true;
        if (stats) stats->clamped = true;
        return;
    }

    auto mark_clamped = [&]() {
        if (inout_hatch_clamped) *inout_hatch_clamped = true;
        if (stats) stats->clamped = true;
    };

    auto budget_exhausted = [&]() -> bool {
        if (stats && stats->emitted_lines >= kMaxHatchPatternLinesPerDocument) return true;
        if (inout_hatch_emitted && *inout_hatch_emitted >= kMaxHatchPatternLinesPerHatch) return true;
        return false;
    };

    auto edge_budget_exhausted = [&]() -> bool {
        if (stats && stats->edge_checks >= kMaxHatchPatternEdgeChecksPerDocument) return true;
        if (inout_hatch_edge_checks && *inout_hatch_edge_checks >= kMaxHatchPatternEdgeChecksPerHatch) return true;
        return false;
    };

    if (budget_exhausted()) {
        mark_clamped();
        return;
    }

    if (edge_budget_exhausted()) {
        mark_clamped();
        if (inout_edge_budget_exhausted) *inout_edge_budget_exhausted = true;
        return;
    }

    std::vector<cadgf_vec2> points = boundary;
    if (points.size() > 2 && points_nearly_equal(points.front(), points.back())) {
        points.pop_back();
    }
    if (points.size() < 3) return;

    const double scale = (hatch.has_pattern_scale && hatch.pattern_scale > 0.0)
        ? hatch.pattern_scale
        : 1.0;
    const double effective_scale = scale * (global_scale > 0.0 ? global_scale : 1.0);

    bool stop = false;
    for (const auto& pattern : hatch.pattern_lines) {
        if (stop) break;
        if (!pattern.has_angle) continue;
        const double angle = pattern.angle_deg * kDegToRad;
        const cadgf_vec2 dir{std::cos(angle), std::sin(angle)};
        const cadgf_vec2 normal{-dir.y, dir.x};
        const double base_x = (pattern.has_base_x ? pattern.base_x : 0.0) * effective_scale;
        const double base_y = (pattern.has_base_y ? pattern.base_y : 0.0) * effective_scale;
        const double offset_x = (pattern.has_offset_x ? pattern.offset_x : 0.0) * effective_scale;
        const double offset_y = (pattern.has_offset_y ? pattern.offset_y : 0.0) * effective_scale;
        const double base_d = base_x * normal.x + base_y * normal.y;
        double spacing = offset_x * normal.x + offset_y * normal.y;
        if (std::fabs(spacing) < 1e-6) {
            spacing = effective_scale;
        }
        const double offset_along = offset_x * dir.x + offset_y * dir.y;

        double min_d = dot_vec(points[0], normal);
        double max_d = min_d;
        for (const auto& p : points) {
            const double d = dot_vec(p, normal);
            min_d = std::min(min_d, d);
            max_d = std::max(max_d, d);
        }
        double kmin_f = (min_d - base_d) / spacing;
        double kmax_f = (max_d - base_d) / spacing;
        if (kmin_f > kmax_f) std::swap(kmin_f, kmax_f);
        const int k_min = static_cast<int>(std::floor(kmin_f)) - 1;
        const int k_max = static_cast<int>(std::ceil(kmax_f)) + 1;
        const int k_range = k_max - k_min + 1;
        int stride = 1;
        if (k_range > kMaxHatchPatternKSteps) {
            stride = (k_range + kMaxHatchPatternKSteps - 1) / kMaxHatchPatternKSteps;
            mark_clamped();
        }
        stride = std::max(1, stride);
        if (stats) stats->stride_max = std::max(stats->stride_max, stride);

        for (int k = k_min; k <= k_max; k += stride) {
            if (stop) break;
            if (edge_budget_exhausted()) {
                mark_clamped();
                if (inout_edge_budget_exhausted) *inout_edge_budget_exhausted = true;
                stop = true;
                break;
            }
            const double d = base_d + spacing * k;
            std::vector<cadgf_vec2> hits;
            const size_t count = points.size();
            for (size_t i = 0; i < count; ++i) {
                if (edge_budget_exhausted()) {
                    mark_clamped();
                    if (inout_edge_budget_exhausted) *inout_edge_budget_exhausted = true;
                    stop = true;
                    break;
                }
                if (stats) stats->edge_checks += 1;
                if (inout_hatch_edge_checks) *inout_hatch_edge_checks += 1;
                const size_t j = (i + 1) % count;
                const cadgf_vec2& p0 = points[i];
                const cadgf_vec2& p1 = points[j];
                const cadgf_vec2 edge{p1.x - p0.x, p1.y - p0.y};
                const double denom = edge.x * normal.x + edge.y * normal.y;
                if (std::fabs(denom) < 1e-9) continue;
                double t = (d - (p0.x * normal.x + p0.y * normal.y)) / denom;
                if (t < -1e-6 || t > 1.0 + 1e-6) continue;
                t = std::min(1.0, std::max(0.0, t));
                hits.push_back(cadgf_vec2{p0.x + edge.x * t, p0.y + edge.y * t});
            }
            if (hits.size() < 2) continue;
            std::sort(hits.begin(), hits.end(), [&](const cadgf_vec2& a, const cadgf_vec2& b) {
                return dot_vec(a, dir) < dot_vec(b, dir);
            });
            for (size_t h = 0; h + 1 < hits.size(); h += 2) {
                if (stop) break;
                cadgf_vec2 a = hits[h];
                cadgf_vec2 b = hits[h + 1];
                double start_t = dot_vec(a, dir);
                double end_t = dot_vec(b, dir);
                if (end_t < start_t) {
                    std::swap(a, b);
                    std::swap(start_t, end_t);
                }
                const double length = end_t - start_t;
                if (length < 1e-6) continue;

                std::vector<double> dash_lengths;
                std::vector<bool> dash_draw;
                if (!pattern.dashes.empty()) {
                    dash_lengths.reserve(pattern.dashes.size());
                    dash_draw.reserve(pattern.dashes.size());
                    for (double raw : pattern.dashes) {
                        double len = std::abs(raw) * effective_scale;
                        if (len < 1e-6) {
                            len = 0.2 * effective_scale;
                        }
                        dash_lengths.push_back(len);
                        dash_draw.push_back(raw >= 0.0);
                    }
                }

                if (dash_lengths.empty()) {
                    if (budget_exhausted()) {
                        mark_clamped();
                        stop = true;
                        break;
                    }
                    DxfLine ln;
                    ln.layer = hatch.layer;
                    ln.a = a;
                    ln.b = b;
                    ln.has_ax = ln.has_ay = ln.has_bx = ln.has_by = true;
                    ln.style = hatch.style;
                    ln.space = hatch.space;
                    ln.origin_meta = build_hatch_origin_metadata(hatch);
                    out_lines.push_back(std::move(ln));
                    if (stats) stats->emitted_lines += 1;
                    if (inout_hatch_emitted) *inout_hatch_emitted += 1;
                    continue;
                }

                double cycle = 0.0;
                for (double len : dash_lengths) {
                    cycle += len;
                }
                if (cycle < 1e-6) {
                    if (budget_exhausted()) {
                        mark_clamped();
                        stop = true;
                        break;
                    }
                    DxfLine ln;
                    ln.layer = hatch.layer;
                    ln.a = a;
                    ln.b = b;
                    ln.has_ax = ln.has_ay = ln.has_bx = ln.has_by = true;
                    ln.style = hatch.style;
                    ln.space = hatch.space;
                    ln.origin_meta = build_hatch_origin_metadata(hatch);
                    out_lines.push_back(std::move(ln));
                    if (stats) stats->emitted_lines += 1;
                    if (inout_hatch_emitted) *inout_hatch_emitted += 1;
                    continue;
                }

                const double base_param = base_x * dir.x + base_y * dir.y + offset_along * k;
                double phase = std::fmod(start_t - base_param, cycle);
                if (phase < 0.0) phase += cycle;
                size_t dash_idx = 0;
                while (dash_idx < dash_lengths.size() && phase >= dash_lengths[dash_idx] - 1e-9) {
                    phase -= dash_lengths[dash_idx];
                    dash_idx = (dash_idx + 1) % dash_lengths.size();
                }
                double pos = 0.0;
                double remaining = length;
                double seg_remaining = dash_lengths[dash_idx] - phase;
                while (remaining > 1e-6) {
                    if (stop) break;
                    const double step = std::min(seg_remaining, remaining);
                    if (dash_draw[dash_idx] && step > 1e-6) {
                        if (budget_exhausted()) {
                            mark_clamped();
                            stop = true;
                            break;
                        }
                        const cadgf_vec2 p0{a.x + dir.x * pos, a.y + dir.y * pos};
                        const cadgf_vec2 p1{a.x + dir.x * (pos + step), a.y + dir.y * (pos + step)};
                        DxfLine ln;
                        ln.layer = hatch.layer;
                        ln.a = p0;
                        ln.b = p1;
                        ln.has_ax = ln.has_ay = ln.has_bx = ln.has_by = true;
                        ln.style = hatch.style;
                        ln.space = hatch.space;
                        ln.origin_meta = build_hatch_origin_metadata(hatch);
                        out_lines.push_back(std::move(ln));
                        if (stats) stats->emitted_lines += 1;
                        if (inout_hatch_emitted) *inout_hatch_emitted += 1;
                    }
                    pos += step;
                    remaining -= step;
                    dash_idx = (dash_idx + 1) % dash_lengths.size();
                    seg_remaining = dash_lengths[dash_idx];
                }
            }
        }
    }
}

static void finalize_hatch(const DxfHatch& hatch,
                           std::vector<DxfPolyline>& out,
                           std::vector<DxfLine>& out_lines,
                           double global_scale,
                           HatchPatternStats* stats) {
    if (hatch.boundaries.empty()) return;
    if (hatch.hatch_id < 0) return;
    const std::string name = std::string("__cadgf_hatch:") + std::to_string(hatch.hatch_id);
    const DxfEntityOriginMeta origin_meta = build_hatch_origin_metadata(hatch);
    int hatch_emitted = 0;
    int hatch_edge_checks = 0;
    bool hatch_clamped = false;
    bool hatch_edge_budget_exhausted = false;
    bool hatch_boundary_too_large = false;
    for (const auto& boundary : hatch.boundaries) {
        if (boundary.size() < 3) continue;
        DxfPolyline pl;
        pl.layer = hatch.layer;
        pl.points = boundary;
        pl.closed = true;
        pl.name = name;
        pl.space = hatch.space;
        pl.style = hatch.style;
        pl.origin_meta = origin_meta;
        finalize_polyline(pl, out);
        append_hatch_pattern_lines(hatch,
                                   boundary,
                                   out_lines,
                                   global_scale,
                                   stats,
                                   &hatch_emitted,
                                   &hatch_edge_checks,
                                   &hatch_clamped,
                                   &hatch_edge_budget_exhausted,
                                   &hatch_boundary_too_large);
    }
    if (stats && hatch_clamped) {
        stats->clamped = true;
        stats->clamped_hatches += 1;
    }
    if (stats && hatch_edge_budget_exhausted) {
        stats->edge_budget_exhausted_hatches += 1;
    }
    (void)hatch_boundary_too_large; // counted per-boundary at call site (stats->boundary_points_clamped_hatches)
}

static void finalize_insert(DxfInsert& insert, std::vector<DxfInsert>& out) {
    if (insert.block_name.empty() || !(insert.has_x && insert.has_y)) return;
    if (!insert.has_scale_x && insert.has_scale_y) {
        insert.scale_x = insert.scale_y;
    }
    if (!insert.has_scale_y && insert.has_scale_x) {
        insert.scale_y = insert.scale_x;
    }
    out.push_back(insert);
}


static bool parse_dxf_entities(const std::string& path,
                               std::vector<DxfPolyline>& polylines,
                               std::vector<DxfLine>& lines,
                               std::vector<DxfPoint>& points,
                               std::vector<DxfCircle>& circles,
                               std::vector<DxfArc>& arcs,
                               std::vector<DxfEllipse>& ellipses,
                               std::vector<DxfSpline>& splines,
                               std::vector<DxfText>& texts,
                               std::unordered_map<std::string, DxfBlock>& blocks,
                               std::vector<DxfInsert>& inserts,
                               std::vector<DxfViewport>& viewports,
                               std::unordered_map<std::string, DxfLayer>& layers,
                               std::unordered_map<std::string, DxfTextStyle>& text_styles,
                               double* out_default_line_scale,
                               double* out_default_text_height,
                               bool* out_has_paperspace,
                               bool* out_has_active_view,
                               DxfView* out_active_view,
                               HatchPatternStats* out_hatch_stats,
                               TextImportStats* out_text_stats,
                               DxfImportStats* out_import_stats,
                               std::string* err) {
    std::ifstream in(path);
    if (!in.is_open()) {
        if (err) *err = "failed to open input file";
        return false;
    }
    if (out_hatch_stats) {
        *out_hatch_stats = HatchPatternStats{};
    }
    TextImportStats local_text_stats{};
    TextImportStats* text_stats = out_text_stats ? out_text_stats : &local_text_stats;
    if (out_text_stats) {
        *out_text_stats = TextImportStats{};
    }
    DxfImportStats local_import_stats{};
    DxfImportStats* import_stats = out_import_stats ? out_import_stats : &local_import_stats;
    if (out_import_stats) {
        *out_import_stats = DxfImportStats{};
    }

    std::string code_line;
    std::string value_line;
    DxfEntityKind current_kind = DxfEntityKind::None;
    DxfPolyline current_polyline;
    DxfLine current_line;
    DxfPoint current_point;
    DxfCircle current_circle;
    DxfArc current_arc;
    DxfEllipse current_ellipse;
    DxfSpline current_spline;
    DxfText current_text;
    DxfSolid current_solid;
    DxfHatch current_hatch;
    DxfInsert current_insert;
    DxfInsert active_insert_attribute_owner;
    DxfInsert last_top_level_insert;
    DxfViewport current_viewport;
    DxfLayout current_layout;
    DxfBlock current_block;
    bool in_old_style_polyline = false; // true when parsing POLYLINE+VERTEX sequence
    DxfLayer current_layer;
    DxfTextStyle current_text_style;
    DxfView current_vport;
    DxfView active_view;
    bool has_active_view = false;
    double pending_x = 0.0;
    bool has_x = false;
    double pending_spline_x = 0.0;
    bool has_spline_x = false;
    double pending_block_x = 0.0;
    bool has_block_x = false;
    double pending_dim_text_x = 0.0;
    bool has_dim_text_x = false;
    bool has_active_insert_attribute_owner = false;
    bool has_last_top_level_insert = false;
    int next_insert_attribute_group_tag = 1000000;
    bool expect_section_name = false;
    bool expect_table_name = false;
    bool in_layer_table = false;
    bool in_layer_record = false;
    bool in_style_table = false;
    bool in_style_record = false;
    bool in_vport_table = false;
    bool in_vport_record = false;
    bool in_layout_object = false;
    bool in_block = false;
    bool in_block_header = false;
    bool hatch_in_polyline = false;
    bool hatch_in_edge = false;
    bool hatch_capture = false;
    bool hatch_closed = true;
    int hatch_vertex_expected = 0;
    int hatch_vertex_seen = 0;
    int hatch_loop_expected = 0;
    int hatch_loop_seen = 0;
    int hatch_edge_expected = 0;
    int hatch_edge_seen = 0;
    int hatch_edge_type = 0;
    double hatch_pending_x = 0.0;
    bool hatch_has_x = false;
    HatchEdgeLine hatch_edge_line;
    HatchEdgeArc hatch_edge_arc;
    HatchEdgeEllipse hatch_edge_ellipse;
    std::vector<cadgf_vec2> hatch_edge_spline_points;
    int hatch_edge_spline_expected = 0;
    double hatch_edge_spline_pending_x = 0.0;
    bool hatch_edge_spline_has_x = false;
    std::vector<cadgf_vec2>* hatch_active_boundary = nullptr;
    DxfHatch::PatternLine hatch_pattern_line;
    bool hatch_pattern_active = false;
    int hatch_pattern_dash_expected = 0;
    int hatch_pattern_line_expected = 0;
    int hatch_pattern_line_seen = 0;
    int next_hatch_id = 1;
    DxfSection current_section = DxfSection::None;
    std::string current_table;
    std::string current_header_var;
    double header_ltscale = 1.0;
    double header_celtscale = 1.0;
    double header_textsize = 0.0;
    bool has_header_ltscale = false;
    bool has_header_celtscale = false;
    bool has_header_textsize = false;
    std::string header_codepage;
    bool has_header_codepage = false;
    bool has_paperspace = false;
    std::unordered_map<std::string, std::string> layout_by_block_record;

    auto reset_polyline = [&]() {
        current_polyline = DxfPolyline{};
        has_x = false;
    };
    auto reset_line = [&]() { current_line = DxfLine{}; };
    auto reset_point = [&]() { current_point = DxfPoint{}; };
    auto reset_circle = [&]() { current_circle = DxfCircle{}; };
    auto reset_arc = [&]() { current_arc = DxfArc{}; };
    auto reset_ellipse = [&]() { current_ellipse = DxfEllipse{}; };
    auto reset_spline = [&]() {
        current_spline = DxfSpline{};
        has_spline_x = false;
    };
    auto reset_text = [&]() { current_text = DxfText{}; };
    auto reset_solid = [&]() { current_solid = DxfSolid{}; };
    auto reset_hatch_edge = [&]() {
        hatch_edge_type = 0;
        hatch_edge_line = HatchEdgeLine{};
        hatch_edge_arc = HatchEdgeArc{};
        hatch_edge_ellipse = HatchEdgeEllipse{};
        hatch_edge_spline_points.clear();
        hatch_edge_spline_expected = 0;
        hatch_edge_spline_pending_x = 0.0;
        hatch_edge_spline_has_x = false;
    };
    auto reset_hatch = [&]() {
        current_hatch = DxfHatch{};
        hatch_in_polyline = false;
        hatch_in_edge = false;
        hatch_capture = false;
        hatch_closed = true;
        hatch_vertex_expected = 0;
        hatch_vertex_seen = 0;
        hatch_loop_expected = 0;
        hatch_loop_seen = 0;
        hatch_edge_expected = 0;
        hatch_edge_seen = 0;
        reset_hatch_edge();
        hatch_pending_x = 0.0;
        hatch_has_x = false;
        hatch_active_boundary = nullptr;
        hatch_pattern_line = DxfHatch::PatternLine{};
        hatch_pattern_active = false;
        hatch_pattern_dash_expected = 0;
        hatch_pattern_line_expected = 0;
        hatch_pattern_line_seen = 0;
    };
    auto finalize_hatch_pattern_line = [&]() {
        if (!hatch_pattern_active) return;
        if (hatch_pattern_line.has_angle) {
            current_hatch.pattern_lines.push_back(hatch_pattern_line);
            hatch_pattern_line_seen++;
        }
        hatch_pattern_line = DxfHatch::PatternLine{};
        hatch_pattern_active = false;
        hatch_pattern_dash_expected = 0;
    };
    auto finalize_hatch_edge = [&](bool force) {
        if (!hatch_active_boundary || hatch_edge_type == 0) return;
        bool committed = false;
        switch (hatch_edge_type) {
            case 1:
                if (hatch_edge_line.has_start_x && hatch_edge_line.has_start_y &&
                    hatch_edge_line.has_end_x && hatch_edge_line.has_end_y) {
                    append_boundary_point(hatch_active_boundary, hatch_edge_line.start);
                    append_boundary_point(hatch_active_boundary, hatch_edge_line.end);
                    committed = true;
                }
                break;
            case 2:
                if (hatch_edge_arc.has_cx && hatch_edge_arc.has_cy && hatch_edge_arc.has_radius &&
                    hatch_edge_arc.has_start && hatch_edge_arc.has_end) {
                    const double start_rad = hatch_edge_arc.start_deg * kDegToRad;
                    const double end_rad = hatch_edge_arc.end_deg * kDegToRad;
                    append_arc_points(hatch_active_boundary, hatch_edge_arc.center, hatch_edge_arc.radius,
                                      start_rad, end_rad, hatch_edge_arc.ccw != 0);
                    committed = true;
                }
                break;
            case 3:
                if (hatch_edge_ellipse.has_cx && hatch_edge_ellipse.has_cy &&
                    hatch_edge_ellipse.has_ax && hatch_edge_ellipse.has_ay &&
                    hatch_edge_ellipse.has_ratio && hatch_edge_ellipse.has_start &&
                    hatch_edge_ellipse.has_end) {
                    append_ellipse_points(hatch_active_boundary, hatch_edge_ellipse.center,
                                          hatch_edge_ellipse.major_axis, hatch_edge_ellipse.ratio,
                                          hatch_edge_ellipse.start_param, hatch_edge_ellipse.end_param,
                                          hatch_edge_ellipse.ccw != 0);
                    committed = true;
                }
                break;
            case 4:
                if ((force || (hatch_edge_spline_expected > 0 &&
                               static_cast<int>(hatch_edge_spline_points.size()) >= hatch_edge_spline_expected)) &&
                    hatch_edge_spline_points.size() >= 2) {
                    for (const auto& p : hatch_edge_spline_points) {
                        append_boundary_point(hatch_active_boundary, p);
                    }
                    committed = true;
                }
                break;
            default:
                break;
        }
        if (!committed) return;
        hatch_edge_seen++;
        reset_hatch_edge();
        if (hatch_edge_expected > 0 && hatch_edge_seen >= hatch_edge_expected) {
            hatch_capture = false;
            hatch_active_boundary = nullptr;
            hatch_in_edge = false;
        }
    };
    auto reset_insert = [&]() {
        current_insert = DxfInsert{};
        has_dim_text_x = false;
    };
    auto ensure_insert_attribute_group_tag = [&](DxfInsert* insert) {
        if (!insert) return;
        if (insert->local_group_tag < 0) {
            insert->local_group_tag = next_insert_attribute_group_tag++;
        }
    };
    auto reset_block = [&]() {
        current_block = DxfBlock{};
        has_block_x = false;
    };
    auto reset_layer = [&]() { current_layer = DxfLayer{}; };
    auto reset_text_style = [&]() { current_text_style = DxfTextStyle{}; };
    auto reset_viewport = [&]() { current_viewport = DxfViewport{}; };
    auto reset_vport = [&]() { current_vport = DxfView{}; };
    auto reset_layout = [&]() { current_layout = DxfLayout{}; };

    auto finalize_viewport = [&](DxfViewport& viewport) {
        finalize_dxf_viewport(viewport, in_block, current_block.name, has_paperspace, viewports);
    };

    auto finalize_vport = [&](DxfView& view) {
        finalize_dxf_vport(view, active_view, has_active_view);
    };

    auto finalize_layout = [&]() {
        finalize_dxf_layout(current_layout, layout_by_block_record);
    };

    auto flush_current = [&]() {
        switch (current_kind) {
            case DxfEntityKind::Polyline:
                if (in_block) {
                    finalize_polyline(current_polyline, current_block.polylines);
                } else {
                    finalize_polyline(current_polyline, polylines);
                }
                reset_polyline();
                break;
            case DxfEntityKind::Line:
                if (in_block) {
                    finalize_line(current_line, current_block.lines);
                } else {
                    finalize_line(current_line, lines);
                }
                reset_line();
                break;
            case DxfEntityKind::Point:
                if (in_block) {
                    finalize_point(current_point, current_block.points);
                } else {
                    finalize_point(current_point, points);
                }
                reset_point();
                break;
            case DxfEntityKind::Circle:
                if (in_block) {
                    finalize_circle(current_circle, current_block.circles);
                } else {
                    finalize_circle(current_circle, circles);
                }
                reset_circle();
                break;
            case DxfEntityKind::Arc:
                if (in_block) {
                    finalize_arc(current_arc, current_block.arcs);
                } else {
                    finalize_arc(current_arc, arcs);
                }
                reset_arc();
                break;
            case DxfEntityKind::Ellipse:
                if (in_block) {
                    finalize_ellipse(current_ellipse, current_block.ellipses);
                } else {
                    finalize_ellipse(current_ellipse, ellipses);
                }
                reset_ellipse();
                break;
            case DxfEntityKind::Spline:
                if (in_block) {
                    finalize_spline(current_spline, current_block.splines);
                } else {
                    finalize_spline(current_spline, splines);
                }
                reset_spline();
                break;
            case DxfEntityKind::Text:
                if (in_block) {
                    finalize_text(current_text, current_block.texts, text_stats);
                } else {
                    finalize_text(current_text, texts, text_stats);
                }
                reset_text();
                break;
            case DxfEntityKind::Solid:
                if (in_block) {
                    finalize_solid(current_solid, current_block.polylines);
                } else {
                    finalize_solid(current_solid, polylines);
                }
                reset_solid();
                break;
	            case DxfEntityKind::Hatch:
	                finalize_hatch_edge(true);
	                finalize_hatch_pattern_line();
	                if (in_block) {
	                    finalize_hatch(current_hatch, current_block.polylines, current_block.lines,
	                                   header_ltscale * header_celtscale, out_hatch_stats);
	                } else {
	                    finalize_hatch(current_hatch, polylines, lines,
	                                   header_ltscale * header_celtscale, out_hatch_stats);
	                }
	                reset_hatch();
	                break;
            case DxfEntityKind::Insert:
                if (in_block) {
                    finalize_insert(current_insert, current_block.inserts);
                } else {
                    finalize_insert(current_insert, inserts);
                    if (!current_insert.is_dimension) {
                        last_top_level_insert = current_insert;
                        has_last_top_level_insert = true;
                    } else {
                        has_last_top_level_insert = false;
                    }
                }
                reset_insert();
                break;
            case DxfEntityKind::Viewport:
                finalize_viewport(current_viewport);
                reset_viewport();
                break;
            case DxfEntityKind::None:
                break;
        }
        current_kind = DxfEntityKind::None;
    };


    auto finalize_layer = [&](DxfLayer& layer) {
        ::finalize_layer(layer, layers);
    };

    auto finalize_text_style = [&](DxfTextStyle& style) {
        ::finalize_text_style(style, text_styles);
    };

    auto finalize_block = [&](DxfBlock& block) {
        ::finalize_block(block, blocks);
    };

    DxfZeroRecordContext zero_ctx{};
    zero_ctx.current_kind = &current_kind;
    zero_ctx.current_section = &current_section;
    zero_ctx.current_table = &current_table;
    zero_ctx.in_old_style_polyline = &in_old_style_polyline;
    zero_ctx.expect_section_name = &expect_section_name;
    zero_ctx.expect_table_name = &expect_table_name;
    zero_ctx.in_layer_table = &in_layer_table;
    zero_ctx.in_layer_record = &in_layer_record;
    zero_ctx.in_style_table = &in_style_table;
    zero_ctx.in_style_record = &in_style_record;
    zero_ctx.in_vport_table = &in_vport_table;
    zero_ctx.in_vport_record = &in_vport_record;
    zero_ctx.in_block = &in_block;
    zero_ctx.in_block_header = &in_block_header;
    zero_ctx.in_layout_object = &in_layout_object;
    zero_ctx.has_active_insert_attribute_owner = &has_active_insert_attribute_owner;
    zero_ctx.has_last_top_level_insert = &has_last_top_level_insert;
    zero_ctx.active_insert_attribute_owner = &active_insert_attribute_owner;
    zero_ctx.last_top_level_insert = &last_top_level_insert;
    zero_ctx.next_insert_attribute_group_tag = &next_insert_attribute_group_tag;
    zero_ctx.next_hatch_id = &next_hatch_id;
    zero_ctx.current_text = &current_text;
    zero_ctx.current_insert = &current_insert;
    zero_ctx.current_polyline_origin_meta = &current_polyline.origin_meta;
    zero_ctx.current_hatch_hatch_id = &current_hatch.hatch_id;
    zero_ctx.import_stats = import_stats;
    zero_ctx.inserts = &inserts;
    zero_ctx.flush_current = flush_current;
    zero_ctx.finalize_layout = finalize_layout;
    zero_ctx.reset_layout = reset_layout;
    zero_ctx.finalize_layer = [&]() { finalize_layer(current_layer); };
    zero_ctx.reset_layer = reset_layer;
    zero_ctx.finalize_text_style = [&]() { finalize_text_style(current_text_style); };
    zero_ctx.reset_text_style = reset_text_style;
    zero_ctx.finalize_vport = [&]() { finalize_vport(current_vport); };
    zero_ctx.reset_vport = reset_vport;
    zero_ctx.finalize_block = [&]() { finalize_block(current_block); };
    zero_ctx.reset_block = reset_block;
    zero_ctx.reset_polyline = reset_polyline;
    zero_ctx.reset_line = reset_line;
    zero_ctx.reset_point = reset_point;
    zero_ctx.reset_circle = reset_circle;
    zero_ctx.reset_arc = reset_arc;
    zero_ctx.reset_ellipse = reset_ellipse;
    zero_ctx.reset_spline = reset_spline;
    zero_ctx.reset_text = reset_text;
    zero_ctx.reset_solid = reset_solid;
    zero_ctx.reset_hatch = reset_hatch;
    zero_ctx.reset_insert = reset_insert;
    zero_ctx.reset_viewport = reset_viewport;
    zero_ctx.build_insert_origin_metadata = [](const DxfInsert& ins) {
        return build_insert_origin_metadata(ins);
    };
    zero_ctx.build_leader_origin_metadata = []() {
        return build_leader_origin_metadata();
    };

    DxfNameRoutingContext name_ctx{};
    name_ctx.expect_section_name = &expect_section_name;
    name_ctx.expect_table_name = &expect_table_name;
    name_ctx.current_section = &current_section;
    name_ctx.current_header_var = &current_header_var;
    name_ctx.current_table = &current_table;
    name_ctx.in_block = &in_block;
    name_ctx.in_block_header = &in_block_header;
    name_ctx.in_layer_table = &in_layer_table;
    name_ctx.in_style_table = &in_style_table;
    name_ctx.in_vport_table = &in_vport_table;

    DxfHeaderVarsContext hdr_ctx{};
    hdr_ctx.current_section = &current_section;
    hdr_ctx.current_header_var = &current_header_var;
    hdr_ctx.header_codepage = &header_codepage;
    hdr_ctx.has_header_codepage = &has_header_codepage;
    hdr_ctx.header_ltscale = &header_ltscale;
    hdr_ctx.has_header_ltscale = &has_header_ltscale;
    hdr_ctx.header_celtscale = &header_celtscale;
    hdr_ctx.has_header_celtscale = &has_header_celtscale;
    hdr_ctx.header_textsize = &header_textsize;
    hdr_ctx.has_header_textsize = &has_header_textsize;

    DxfBlockHeaderContext blk_hdr_ctx{};
    blk_hdr_ctx.in_block_header = &in_block_header;
    blk_hdr_ctx.block_name = &current_block.name;
    blk_hdr_ctx.has_name = &current_block.has_name;
    blk_hdr_ctx.owner_handle = &current_block.owner_handle;
    blk_hdr_ctx.has_owner_handle = &current_block.has_owner_handle;
    blk_hdr_ctx.block_base = &current_block.base;
    blk_hdr_ctx.has_base = &current_block.has_base;
    blk_hdr_ctx.pending_block_x = &pending_block_x;
    blk_hdr_ctx.has_block_x = &has_block_x;
    blk_hdr_ctx.header_codepage = &header_codepage;

    while (std::getline(in, code_line)) {
        if (!std::getline(in, value_line)) break;
        trim_code_line(&code_line);
        strip_cr(&value_line);

        int code = 0;
        if (!parse_int(code_line, &code)) continue;

        if (code == 0) {
            handle_zero_record(value_line, zero_ctx);
            continue;
        }

        if (handle_name_routing(code, value_line, name_ctx)) {
            continue;
        }

        if (handle_header_var(code, value_line, hdr_ctx)) {
            continue;
        }

        if (in_layer_table && in_layer_record) {
            handle_layer_record_field(code, value_line, header_codepage, current_layer);
            continue;
        }

        if (in_style_table && in_style_record) {
            handle_style_record_field(code, value_line, header_codepage, current_text_style);
            continue;
        }

        if (in_vport_table && in_vport_record) {
            handle_vport_record_field(code, value_line, header_codepage, current_vport);
            continue;
        }

        if (current_section == DxfSection::Objects && in_layout_object) {
            handle_layout_object_field(code, value_line, header_codepage, current_layout);
            continue;
        }

        if (handle_block_header_field(code, value_line, blk_hdr_ctx)) {
            continue;
        }

        const bool in_entities = current_section == DxfSection::Entities;
        const bool in_block_entities = current_section == DxfSection::Blocks && in_block && !in_block_header;
        if (!in_entities && !in_block_entities) {
            continue;
        }

        switch (current_kind) {
            case DxfEntityKind::Polyline:
                parse_polyline_entity_record({
                    &current_polyline.layer,
                    &current_polyline.owner_handle,
                    &current_polyline.has_owner_handle,
                    &current_polyline.style,
                    &current_polyline.space,
                    &current_polyline.points,
                    &current_polyline.closed,
                    &pending_x,
                    &has_x,
                }, code, value_line, header_codepage, &has_paperspace);
                break;
            case DxfEntityKind::Line:
                parse_line_entity_record({
                    &current_line.layer,
                    &current_line.owner_handle,
                    &current_line.has_owner_handle,
                    &current_line.style,
                    &current_line.space,
                    &current_line.a,
                    &current_line.b,
                    &current_line.has_ax,
                    &current_line.has_ay,
                    &current_line.has_bx,
                    &current_line.has_by,
                }, code, value_line, header_codepage, &has_paperspace);
                break;
            case DxfEntityKind::Point:
                parse_point_entity_record({
                    &current_point.layer,
                    &current_point.owner_handle,
                    &current_point.has_owner_handle,
                    &current_point.style,
                    &current_point.space,
                    &current_point.p,
                    &current_point.has_x,
                    &current_point.has_y,
                }, code, value_line, header_codepage, &has_paperspace);
                break;
            case DxfEntityKind::Circle:
                parse_circle_entity_record({
                    &current_circle.layer,
                    &current_circle.owner_handle,
                    &current_circle.has_owner_handle,
                    &current_circle.style,
                    &current_circle.space,
                    &current_circle.center,
                    &current_circle.radius,
                    &current_circle.has_cx,
                    &current_circle.has_cy,
                    &current_circle.has_radius,
                }, code, value_line, header_codepage, &has_paperspace);
                break;
            case DxfEntityKind::Arc:
                parse_arc_entity_record({
                    &current_arc.layer,
                    &current_arc.owner_handle,
                    &current_arc.has_owner_handle,
                    &current_arc.style,
                    &current_arc.space,
                    &current_arc.center,
                    &current_arc.radius,
                    &current_arc.start_deg,
                    &current_arc.end_deg,
                    &current_arc.has_cx,
                    &current_arc.has_cy,
                    &current_arc.has_radius,
                    &current_arc.has_start,
                    &current_arc.has_end,
                }, code, value_line, header_codepage, &has_paperspace);
                break;
            case DxfEntityKind::Ellipse:
                parse_ellipse_entity_record(code, value_line, &current_ellipse, &has_paperspace, header_codepage);
                break;
            case DxfEntityKind::Spline:
                if (parse_entity_space(code, value_line, &current_spline.space, &has_paperspace)) break;
                if (parse_entity_owner(code, value_line, &current_spline.owner_handle,
                                       &current_spline.has_owner_handle)) break;
                if (parse_style_code(&current_spline.style, code, value_line, header_codepage)) break;
                switch (code) {
                    case 8:
                        current_spline.layer = sanitize_utf8(value_line, header_codepage);
                        break;
                    case 71: {
                        int degree = 0;
                        if (parse_int(value_line, &degree)) {
                            current_spline.degree = degree;
                        }
                        break;
                    }
                    case 10: {
                        double x = 0.0;
                        if (parse_double(value_line, &x)) {
                            pending_spline_x = x;
                            has_spline_x = true;
                        }
                        break;
                    }
                    case 20: {
                        if (!has_spline_x) break;
                        double y = 0.0;
                        if (parse_double(value_line, &y)) {
                            current_spline.control_points.push_back(cadgf_vec2{pending_spline_x, y});
                        }
                        has_spline_x = false;
                        break;
                    }
                    case 40: {
                        double k = 0.0;
                        if (parse_double(value_line, &k)) {
                            current_spline.knots.push_back(k);
                        }
                        break;
                    }
                    default:
                        break;
                }
                break;
            case DxfEntityKind::Text:
                if (parse_entity_space(code, value_line, &current_text.space, &has_paperspace)) break;
                if (parse_entity_owner(code, value_line, &current_text.owner_handle,
                                       &current_text.has_owner_handle)) break;
                if (parse_style_code(&current_text.style, code, value_line, header_codepage)) break;
                switch (code) {
                    case 8:
                        current_text.layer = sanitize_utf8(value_line, header_codepage);
                        break;
                    case 2:
                        if (is_attribute_text_kind(current_text.kind)) {
                            current_text.attribute_tag = sanitize_utf8(value_line, header_codepage);
                            current_text.has_attribute_tag = true;
                        }
                        break;
                    case 3:
                        if (current_text.kind == "attdef") {
                            current_text.attribute_prompt = sanitize_utf8(value_line, header_codepage);
                            current_text.has_attribute_prompt = true;
                            break;
                        }
                        if (!current_text.text.empty()) current_text.text += "\n";
                        current_text.text += sanitize_utf8(value_line, header_codepage);
                        break;
                    case 7:
                        current_text.style_name = sanitize_utf8(value_line, header_codepage);
                        break;
                    case 10:
                        if (looks_nonfinite_number(value_line)) text_stats->nonfinite_values += 1;
                        if (parse_double(value_line, &current_text.pos.x)) {
                            current_text.has_x = true;
                        }
                        break;
                    case 20:
                        if (looks_nonfinite_number(value_line)) text_stats->nonfinite_values += 1;
                        if (parse_double(value_line, &current_text.pos.y)) {
                            current_text.has_y = true;
                        }
                        break;
                    case 11:
                        if (looks_nonfinite_number(value_line)) text_stats->nonfinite_values += 1;
                        if (parse_double(value_line, &current_text.align_pos.x)) {
                            current_text.has_align_x = true;
                        }
                        break;
                    case 21:
                        if (looks_nonfinite_number(value_line)) text_stats->nonfinite_values += 1;
                        if (parse_double(value_line, &current_text.align_pos.y)) {
                            current_text.has_align_y = true;
                        }
                        break;
                    case 40:
                        if (looks_nonfinite_number(value_line)) text_stats->nonfinite_values += 1;
                        (void)parse_double(value_line, &current_text.height);
                        break;
                    case 41:
                        if (looks_nonfinite_number(value_line)) text_stats->nonfinite_values += 1;
                        if (current_text.is_mtext) {
                            if (parse_double(value_line, &current_text.width)) {
                                current_text.has_width = true;
                            }
                        } else {
                            if (parse_double(value_line, &current_text.width_factor)) {
                                current_text.has_width_factor = true;
                            }
                        }
                        break;
                    case 50:
                        if (looks_nonfinite_number(value_line)) text_stats->nonfinite_values += 1;
                        (void)parse_double(value_line, &current_text.rotation_deg);
                        break;
                    case 70:
                        if (is_attribute_text_kind(current_text.kind)) {
                            int flags = 0;
                            if (parse_int(value_line, &flags)) {
                                current_text.attribute_flags = flags;
                                current_text.has_attribute_flags = true;
                            }
                        }
                        break;
                    case 71:
                        if (current_text.is_mtext) {
                            int attachment = 0;
                            if (parse_int(value_line, &attachment)) {
                                current_text.attachment = attachment;
                                current_text.has_attachment = true;
                            }
                        }
                        break;
                    case 72:
                        if (!current_text.is_mtext) {
                            int align = 0;
                            if (parse_int(value_line, &align)) {
                                current_text.halign = align;
                                current_text.has_halign = true;
                            }
                        }
                        break;
                    case 73:
                        if (!current_text.is_mtext) {
                            int align = 0;
                            if (parse_int(value_line, &align)) {
                                current_text.valign = align;
                                current_text.has_valign = true;
                            }
                        }
                        break;
                    case 1:
                        current_text.text = sanitize_utf8(value_line, header_codepage);
                        if (current_text.kind == "attdef") {
                            current_text.attribute_default = current_text.text;
                            current_text.has_attribute_default = true;
                        }
                        break;
                    case 302:
                    case 303:
                    case 304:
                        if (!current_text.allow_extended_text) break;
                        if (!current_text.text.empty()) current_text.text += "\n";
                        current_text.text += sanitize_utf8(value_line, header_codepage);
                        break;
                    default:
                        break;
                }
                break;
            case DxfEntityKind::Solid:
                if (parse_entity_space(code, value_line, &current_solid.space, &has_paperspace)) break;
                if (parse_entity_owner(code, value_line, &current_solid.owner_handle,
                                       &current_solid.has_owner_handle)) break;
                if (parse_style_code(&current_solid.style, code, value_line, header_codepage)) break;
                switch (code) {
                    case 8:
                        current_solid.layer = sanitize_utf8(value_line, header_codepage);
                        break;
                    case 10:
                        if (parse_double(value_line, &current_solid.points[0].pos.x)) {
                            current_solid.points[0].has_x = true;
                        }
                        break;
                    case 20:
                        if (parse_double(value_line, &current_solid.points[0].pos.y)) {
                            current_solid.points[0].has_y = true;
                        }
                        break;
                    case 11:
                        if (parse_double(value_line, &current_solid.points[1].pos.x)) {
                            current_solid.points[1].has_x = true;
                        }
                        break;
                    case 21:
                        if (parse_double(value_line, &current_solid.points[1].pos.y)) {
                            current_solid.points[1].has_y = true;
                        }
                        break;
                    case 12:
                        if (parse_double(value_line, &current_solid.points[2].pos.x)) {
                            current_solid.points[2].has_x = true;
                        }
                        break;
                    case 22:
                        if (parse_double(value_line, &current_solid.points[2].pos.y)) {
                            current_solid.points[2].has_y = true;
                        }
                        break;
                    case 13:
                        if (parse_double(value_line, &current_solid.points[3].pos.x)) {
                            current_solid.points[3].has_x = true;
                        }
                        break;
                    case 23:
                        if (parse_double(value_line, &current_solid.points[3].pos.y)) {
                            current_solid.points[3].has_y = true;
                        }
                        break;
                    default:
                        break;
                }
                break;
            case DxfEntityKind::Hatch:
                if (parse_entity_space(code, value_line, &current_hatch.space, &has_paperspace)) break;
                if (parse_entity_owner(code, value_line, &current_hatch.owner_handle,
                                       &current_hatch.has_owner_handle)) break;
                if (parse_style_code(&current_hatch.style, code, value_line, header_codepage)) break;
                switch (code) {
                    case 8:
                        current_hatch.layer = sanitize_utf8(value_line, header_codepage);
                        break;
                    case 2:
                        current_hatch.pattern_name = sanitize_utf8(value_line, header_codepage);
                        break;
                    case 41:
                        if (parse_double(value_line, &current_hatch.pattern_scale)) {
                            current_hatch.has_pattern_scale = true;
                        }
                        break;
                    case 78: {
                        int count = 0;
                        if (parse_int(value_line, &count)) {
                            hatch_pattern_line_expected = count;
                            hatch_pattern_line_seen = 0;
                        }
                        break;
                    }
                    case 53:
                        finalize_hatch_pattern_line();
                        hatch_pattern_active = true;
                        if (parse_double(value_line, &hatch_pattern_line.angle_deg)) {
                            hatch_pattern_line.has_angle = true;
                        }
                        break;
                    case 43:
                        if (hatch_pattern_active && parse_double(value_line, &hatch_pattern_line.base_x)) {
                            hatch_pattern_line.has_base_x = true;
                        }
                        break;
                    case 44:
                        if (hatch_pattern_active && parse_double(value_line, &hatch_pattern_line.base_y)) {
                            hatch_pattern_line.has_base_y = true;
                        }
                        break;
                    case 45:
                        if (hatch_pattern_active && parse_double(value_line, &hatch_pattern_line.offset_x)) {
                            hatch_pattern_line.has_offset_x = true;
                        }
                        break;
                    case 46:
                        if (hatch_pattern_active && parse_double(value_line, &hatch_pattern_line.offset_y)) {
                            hatch_pattern_line.has_offset_y = true;
                        }
                        break;
                    case 79:
                        if (hatch_pattern_active) {
                            int count = 0;
                            if (parse_int(value_line, &count)) {
                                hatch_pattern_dash_expected = count;
                                hatch_pattern_line.dashes.clear();
                            }
                        }
                        break;
                    case 49:
                        if (hatch_pattern_active) {
                            double dash = 0.0;
                            if (parse_double(value_line, &dash)) {
                                hatch_pattern_line.dashes.push_back(dash);
                            }
                        }
                        break;
                    case 91: {
                        int loops = 0;
                        if (parse_int(value_line, &loops)) {
                            hatch_loop_expected = loops;
                            hatch_loop_seen = 0;
                        }
                        break;
                    }
                    case 72: {
                        if (hatch_in_edge && !hatch_in_polyline) {
                            finalize_hatch_edge(true);
                            int edge_type = 0;
                            if (parse_int(value_line, &edge_type)) {
                                reset_hatch_edge();
                                hatch_edge_type = edge_type;
                            }
                        } else {
                            int has_bulge = 0;
                            (void)parse_int(value_line, &has_bulge);
                        }
                        break;
                    }
                    case 73: {
                        if (hatch_in_edge && !hatch_in_polyline &&
                            (hatch_edge_type == 2 || hatch_edge_type == 3)) {
                            int ccw = 0;
                            if (parse_int(value_line, &ccw)) {
                                if (hatch_edge_type == 2) {
                                    hatch_edge_arc.ccw = ccw;
                                } else {
                                    hatch_edge_ellipse.ccw = ccw;
                                }
                                finalize_hatch_edge(false);
                            }
                        } else {
                            int closed = 0;
                            if (parse_int(value_line, &closed)) {
                                hatch_closed = (closed != 0);
                                current_hatch.closed = hatch_closed;
                            }
                        }
                        break;
                    }
                    case 92: {
                        int flags = 0;
                        if (parse_int(value_line, &flags)) {
                            finalize_hatch_edge(true);
                            hatch_in_polyline = (flags & 2) != 0;
                            hatch_in_edge = !hatch_in_polyline;
                            hatch_capture = hatch_in_polyline || hatch_in_edge;
                            hatch_vertex_seen = 0;
                            hatch_vertex_expected = 0;
                            hatch_edge_expected = 0;
                            hatch_edge_seen = 0;
                            hatch_has_x = false;
                            hatch_active_boundary = nullptr;
                            reset_hatch_edge();
                            if (hatch_in_polyline) {
                                current_hatch.boundaries.emplace_back();
                                hatch_active_boundary = &current_hatch.boundaries.back();
                                hatch_loop_seen++;
                            } else if (hatch_in_edge) {
                                current_hatch.boundaries.emplace_back();
                                hatch_active_boundary = &current_hatch.boundaries.back();
                                hatch_loop_seen++;
                            }
                        }
                        break;
                    }
                    case 93: {
                        int count = 0;
                        if (parse_int(value_line, &count)) {
                            if (hatch_in_polyline) {
                                hatch_vertex_expected = count;
                                hatch_vertex_seen = 0;
                                hatch_has_x = false;
                            } else if (hatch_in_edge) {
                                hatch_edge_expected = count;
                                hatch_edge_seen = 0;
                            }
                        }
                        break;
                    }
                    case 94: {
                        if (hatch_in_edge && !hatch_in_polyline && hatch_edge_type == 4) {
                            int count = 0;
                            if (parse_int(value_line, &count)) {
                                hatch_edge_spline_expected = count;
                            }
                        }
                        break;
                    }
                    case 10:
                        if (hatch_in_polyline && hatch_capture && hatch_active_boundary) {
                            if (parse_double(value_line, &hatch_pending_x)) {
                                hatch_has_x = true;
                            }
                        } else if (hatch_in_edge && hatch_active_boundary) {
                            if (hatch_edge_type == 1) {
                                if (parse_double(value_line, &hatch_edge_line.start.x)) {
                                    hatch_edge_line.has_start_x = true;
                                }
                            } else if (hatch_edge_type == 2) {
                                if (parse_double(value_line, &hatch_edge_arc.center.x)) {
                                    hatch_edge_arc.has_cx = true;
                                }
                            } else if (hatch_edge_type == 3) {
                                if (parse_double(value_line, &hatch_edge_ellipse.center.x)) {
                                    hatch_edge_ellipse.has_cx = true;
                                }
                            } else if (hatch_edge_type == 4) {
                                if (parse_double(value_line, &hatch_edge_spline_pending_x)) {
                                    hatch_edge_spline_has_x = true;
                                }
                            }
                        }
                        break;
                    case 20:
                        if (hatch_in_polyline && hatch_has_x && hatch_capture && hatch_active_boundary) {
                            double y = 0.0;
                            if (parse_double(value_line, &y)) {
                                hatch_active_boundary->push_back(cadgf_vec2{hatch_pending_x, y});
                                hatch_vertex_seen++;
                                if (hatch_vertex_expected > 0 && hatch_vertex_seen >= hatch_vertex_expected) {
                                    hatch_capture = false;
                                    hatch_active_boundary = nullptr;
                                }
                            }
                            hatch_has_x = false;
                        } else if (hatch_in_edge && hatch_active_boundary) {
                            if (hatch_edge_type == 1) {
                                if (parse_double(value_line, &hatch_edge_line.start.y)) {
                                    hatch_edge_line.has_start_y = true;
                                    finalize_hatch_edge(false);
                                }
                            } else if (hatch_edge_type == 2) {
                                if (parse_double(value_line, &hatch_edge_arc.center.y)) {
                                    hatch_edge_arc.has_cy = true;
                                    finalize_hatch_edge(false);
                                }
                            } else if (hatch_edge_type == 3) {
                                if (parse_double(value_line, &hatch_edge_ellipse.center.y)) {
                                    hatch_edge_ellipse.has_cy = true;
                                    finalize_hatch_edge(false);
                                }
                            } else if (hatch_edge_type == 4) {
                                if (hatch_edge_spline_has_x) {
                                    double y = 0.0;
                                    if (parse_double(value_line, &y)) {
                                        hatch_edge_spline_points.push_back(
                                            cadgf_vec2{hatch_edge_spline_pending_x, y});
                                        hatch_edge_spline_has_x = false;
                                        finalize_hatch_edge(false);
                                    }
                                }
                            }
                        }
                        break;
                    case 11:
                        if (hatch_in_edge && hatch_active_boundary) {
                            if (hatch_edge_type == 1) {
                                if (parse_double(value_line, &hatch_edge_line.end.x)) {
                                    hatch_edge_line.has_end_x = true;
                                    finalize_hatch_edge(false);
                                }
                            } else if (hatch_edge_type == 3) {
                                if (parse_double(value_line, &hatch_edge_ellipse.major_axis.x)) {
                                    hatch_edge_ellipse.has_ax = true;
                                    finalize_hatch_edge(false);
                                }
                            }
                        }
                        break;
                    case 21:
                        if (hatch_in_edge && hatch_active_boundary) {
                            if (hatch_edge_type == 1) {
                                if (parse_double(value_line, &hatch_edge_line.end.y)) {
                                    hatch_edge_line.has_end_y = true;
                                    finalize_hatch_edge(false);
                                }
                            } else if (hatch_edge_type == 3) {
                                if (parse_double(value_line, &hatch_edge_ellipse.major_axis.y)) {
                                    hatch_edge_ellipse.has_ay = true;
                                    finalize_hatch_edge(false);
                                }
                            }
                        }
                        break;
                    case 40:
                        if (hatch_in_edge && hatch_active_boundary) {
                            if (hatch_edge_type == 2) {
                                if (parse_double(value_line, &hatch_edge_arc.radius)) {
                                    hatch_edge_arc.has_radius = true;
                                    finalize_hatch_edge(false);
                                }
                            } else if (hatch_edge_type == 3) {
                                if (parse_double(value_line, &hatch_edge_ellipse.ratio)) {
                                    hatch_edge_ellipse.has_ratio = true;
                                    finalize_hatch_edge(false);
                                }
                            }
                        }
                        break;
                    case 50:
                        if (hatch_in_edge && hatch_active_boundary) {
                            if (hatch_edge_type == 2) {
                                if (parse_double(value_line, &hatch_edge_arc.start_deg)) {
                                    hatch_edge_arc.has_start = true;
                                    finalize_hatch_edge(false);
                                }
                            } else if (hatch_edge_type == 3) {
                                if (parse_double(value_line, &hatch_edge_ellipse.start_param)) {
                                    hatch_edge_ellipse.has_start = true;
                                    finalize_hatch_edge(false);
                                }
                            }
                        }
                        break;
                    case 51:
                        if (hatch_in_edge && hatch_active_boundary) {
                            if (hatch_edge_type == 2) {
                                if (parse_double(value_line, &hatch_edge_arc.end_deg)) {
                                    hatch_edge_arc.has_end = true;
                                    finalize_hatch_edge(false);
                                }
                            } else if (hatch_edge_type == 3) {
                                if (parse_double(value_line, &hatch_edge_ellipse.end_param)) {
                                    hatch_edge_ellipse.has_end = true;
                                    finalize_hatch_edge(false);
                                }
                            }
                        }
                        break;
                    default:
                        break;
                }
                break;
            case DxfEntityKind::Insert:
                if (parse_entity_space(code, value_line, &current_insert.space, &has_paperspace)) break;
                if (parse_entity_owner(code, value_line, &current_insert.owner_handle,
                                       &current_insert.has_owner_handle)) break;
                if (parse_style_code(&current_insert.style, code, value_line, header_codepage)) break;
                switch (code) {
                    case 2:
                        current_insert.block_name = sanitize_utf8(value_line, header_codepage);
                        break;
                    case 1:
                        if (current_insert.is_dimension) {
                            current_insert.dim_text = sanitize_utf8(value_line, header_codepage);
                        }
                        break;
                    case 3:
                        if (current_insert.is_dimension) {
                            current_insert.dim_style = sanitize_utf8(value_line, header_codepage);
                        }
                        break;
                    case 8:
                        current_insert.layer = sanitize_utf8(value_line, header_codepage);
                        break;
                    case 10:
                        if (parse_double(value_line, &current_insert.pos.x)) {
                            current_insert.has_x = true;
                        }
                        break;
                    case 20:
                        if (parse_double(value_line, &current_insert.pos.y)) {
                            current_insert.has_y = true;
                        }
                        break;
                    case 11:
                        if (current_insert.is_dimension &&
                            parse_double(value_line, &pending_dim_text_x)) {
                            has_dim_text_x = true;
                        }
                        break;
                    case 21: {
                        if (!current_insert.is_dimension || !has_dim_text_x) break;
                        double y = 0.0;
                        if (parse_double(value_line, &y)) {
                            current_insert.dim_text_pos = cadgf_vec2{pending_dim_text_x, y};
                            current_insert.has_dim_text_pos = true;
                        }
                        has_dim_text_x = false;
                        break;
                    }
                    case 41:
                        if (!current_insert.is_dimension &&
                            parse_double(value_line, &current_insert.scale_x)) {
                            current_insert.has_scale_x = true;
                        }
                        break;
                    case 42:
                        if (current_insert.is_dimension) {
                            if (parse_double(value_line, &current_insert.dim_measurement)) {
                                current_insert.has_dim_measurement = true;
                            }
                        } else if (parse_double(value_line, &current_insert.scale_y)) {
                            current_insert.has_scale_y = true;
                        }
                        break;
                    case 66: {
                        int follows = 0;
                        if (!current_insert.is_dimension && parse_int(value_line, &follows)) {
                            current_insert.has_following_attributes = follows != 0;
                        }
                        break;
                    }
                    case 50:
                        (void)parse_double(value_line, &current_insert.rotation_deg);
                        break;
                    case 70:
                        if (current_insert.is_dimension) {
                            int dtype = 0;
                            if (parse_int(value_line, &dtype)) {
                                current_insert.dim_type = dtype;
                            }
                        }
                        break;
                    case 13:
                        if (current_insert.is_dimension) {
                            (void)parse_double(value_line, &current_insert.dim_defpoint1.x);
                        }
                        break;
                    case 23:
                        if (current_insert.is_dimension) {
                            if (parse_double(value_line, &current_insert.dim_defpoint1.y)) {
                                current_insert.has_dim_defpoint1 = true;
                            }
                        }
                        break;
                    case 14:
                        if (current_insert.is_dimension) {
                            (void)parse_double(value_line, &current_insert.dim_defpoint2.x);
                        }
                        break;
                    case 24:
                        if (current_insert.is_dimension) {
                            if (parse_double(value_line, &current_insert.dim_defpoint2.y)) {
                                current_insert.has_dim_defpoint2 = true;
                            }
                        }
                        break;
                    default:
                        break;
                }
                break;
            case DxfEntityKind::Viewport:
                if (parse_entity_space(code, value_line, &current_viewport.space, &has_paperspace)) break;
                switch (code) {
                    case 330:
                        current_viewport.owner_handle = value_line;
                        current_viewport.has_owner_handle = !current_viewport.owner_handle.empty();
                        break;
                    case 10:
                        if (parse_double(value_line, &current_viewport.center.x)) {
                            current_viewport.has_center_x = true;
                        }
                        break;
                    case 20:
                        if (parse_double(value_line, &current_viewport.center.y)) {
                            current_viewport.has_center_y = true;
                        }
                        break;
                    case 40:
                        if (parse_double(value_line, &current_viewport.height)) {
                            current_viewport.has_height = true;
                        }
                        break;
                    case 41:
                        if (parse_double(value_line, &current_viewport.width)) {
                            current_viewport.has_width = true;
                        }
                        break;
                    case 12:
                        if (parse_double(value_line, &current_viewport.view_center.x)) {
                            current_viewport.has_view_center_x = true;
                        }
                        break;
                    case 22:
                        if (parse_double(value_line, &current_viewport.view_center.y)) {
                            current_viewport.has_view_center_y = true;
                        }
                        break;
                    case 45:
                        if (parse_double(value_line, &current_viewport.view_height)) {
                            current_viewport.has_view_height = true;
                        }
                        break;
                    case 51:
                        if (parse_double(value_line, &current_viewport.twist_deg)) {
                            current_viewport.has_twist = true;
                        }
                        break;
                    case 69: {
                        int id = 0;
                        if (parse_int(value_line, &id)) {
                            current_viewport.id = id;
                            current_viewport.has_id = true;
                        }
                        break;
                    }
                    case 410:
                        current_viewport.layout = sanitize_utf8(value_line, header_codepage);
                        break;
                    default:
                        break;
                }
                break;
            case DxfEntityKind::None:
                break;
        }
    }

    if (current_kind != DxfEntityKind::None) {
        flush_current();
    }
    if (in_layout_object) {
        finalize_layout();
        reset_layout();
        in_layout_object = false;
    }
    if (in_layer_table && in_layer_record) {
        finalize_layer(current_layer);
    }
    if (in_block) {
        finalize_block(current_block);
    }

    if (!layout_by_block_record.empty()) {
        auto assign_layout_name = [&](auto& entity) {
            if (entity.space != 1 || !entity.has_owner_handle) return;
            auto it = layout_by_block_record.find(entity.owner_handle);
            if (it == layout_by_block_record.end()) return;
            if (!is_model_layout_name(it->second)) {
                entity.layout_name = it->second;
            }
        };
        auto assign_layout_names = [&](auto& entities) {
            for (auto& entity : entities) {
                assign_layout_name(entity);
            }
        };
        assign_layout_names(polylines);
        assign_layout_names(lines);
        assign_layout_names(points);
        assign_layout_names(circles);
        assign_layout_names(arcs);
        assign_layout_names(ellipses);
        assign_layout_names(splines);
        assign_layout_names(texts);
        assign_layout_names(inserts);
        for (auto& entry : blocks) {
            auto& block = entry.second;
            assign_layout_names(block.polylines);
            assign_layout_names(block.lines);
            assign_layout_names(block.points);
            assign_layout_names(block.circles);
            assign_layout_names(block.arcs);
            assign_layout_names(block.ellipses);
            assign_layout_names(block.splines);
            assign_layout_names(block.texts);
            assign_layout_names(block.inserts);
        }
        for (auto& entry : blocks) {
            auto& block = entry.second;
            if (!block.has_owner_handle) continue;
            auto it = layout_by_block_record.find(block.owner_handle);
            if (it == layout_by_block_record.end()) continue;
            block.layout_name = it->second;
        }
        for (auto& viewport : viewports) {
            if (!viewport.layout.empty()) continue;
            if (!viewport.has_owner_handle) continue;
            auto it = layout_by_block_record.find(viewport.owner_handle);
            if (it == layout_by_block_record.end()) continue;
            viewport.layout = it->second;
            if (viewport.space != 1 && !is_model_layout_name(viewport.layout)) {
                viewport.space = 1;
                has_paperspace = true;
            }
        }
    }

    const double leader_note_default_text_height = has_header_textsize ? header_textsize : 0.0;
    associate_classic_leader_notes(polylines, texts, leader_note_default_text_height);
    annotate_mleader_texts(texts);
    for (auto& entry : blocks) {
        if (!is_root_space_block_name(entry.first)) continue;
        associate_classic_leader_notes(entry.second.polylines, entry.second.texts,
                                       leader_note_default_text_height);
        annotate_mleader_texts(entry.second.texts);
    }

    if (polylines.empty() && lines.empty() && circles.empty() && arcs.empty() &&
        ellipses.empty() && splines.empty() && texts.empty() && inserts.empty()) {
        if (err) *err = "no supported DXF entities found";
        return false;
    }
    if (out_default_line_scale) {
        double scale = 1.0;
        if (has_header_ltscale) {
            scale *= header_ltscale;
        }
        if (has_header_celtscale) {
            scale *= header_celtscale;
        }
        *out_default_line_scale = scale;
    }
    if (out_default_text_height) {
        *out_default_text_height = has_header_textsize ? header_textsize : 0.0;
    }
    if (out_has_paperspace) {
        *out_has_paperspace = has_paperspace;
    }
    if (out_has_active_view) {
        *out_has_active_view = has_active_view;
    }
    if (out_active_view && has_active_view) {
        *out_active_view = active_view;
    }
    // Compute imported entity count from output vectors
    import_stats->entities_imported = static_cast<int>(
        polylines.size() + lines.size() + points.size() + circles.size() +
        arcs.size() + ellipses.size() + splines.size() + texts.size() +
        inserts.size() + viewports.size());
    return true;
}

static int32_t importer_import_document(cadgf_document* doc, const char* path_utf8, cadgf_error_v1* out_err) {
    if (!doc || !path_utf8 || !*path_utf8) {
        set_error(out_err, 1, "invalid args");
        return 0;
    }

    try {
        std::vector<DxfPolyline> polylines;
        std::vector<DxfLine> lines;
        std::vector<DxfPoint> points;
        std::vector<DxfCircle> circles;
        std::vector<DxfArc> arcs;
        std::vector<DxfEllipse> ellipses;
        std::vector<DxfSpline> splines;
        std::vector<DxfText> texts;
        std::unordered_map<std::string, DxfBlock> blocks;
        std::vector<DxfInsert> inserts;
        std::vector<DxfViewport> viewports;
        std::unordered_map<std::string, DxfLayer> layers;
        std::unordered_map<std::string, DxfTextStyle> text_styles;
	        DxfView active_view;
	        std::string err;
	        double default_line_scale = 1.0;
	        double default_text_height = 0.0;
	        HatchPatternStats hatch_stats{};
	        TextImportStats text_stats{};
	        DxfImportStats import_stats{};
	        bool has_paperspace = false;
	        bool has_active_view = false;
	        if (!parse_dxf_entities(path_utf8, polylines, lines, points, circles, arcs, ellipses, splines, texts,
	                                blocks, inserts, viewports, layers, text_styles,
	                                &default_line_scale, &default_text_height,
	                                &has_paperspace, &has_active_view, &active_view,
	                                &hatch_stats, &text_stats, &import_stats, &err)) {
	            set_error(out_err, 2, err.empty() ? "parse failed" : err.c_str());
	            return 0;
	        }

        DxfDocumentCommitContext commit_ctx{};
        std::string commit_ctx_err;
        if (!prepare_dxf_document_commit_context(doc, polylines, lines, points, circles, arcs, ellipses,
                                                 splines, texts, inserts, viewports, layers,
                                                 has_paperspace, has_active_view, active_view,
                                                 default_text_height, hatch_stats, text_stats,
                                                 import_stats, &commit_ctx, &commit_ctx_err)) {
            set_error(out_err, 3, commit_ctx_err.empty() ? "failed to prepare commit context"
                                                        : commit_ctx_err.c_str());
            return 0;
        }

        const std::string& default_paper_layout_name = commit_ctx.default_paper_layout_name;
        const bool include_all_spaces = commit_ctx.include_all_spaces;
        const int target_space = commit_ctx.target_space;
        std::unordered_map<std::string, int> layer_ids = std::move(commit_ctx.layer_ids);

        auto resolve_layer_id = [&](const std::string& layer, int* out_layer_id) -> bool {
            const std::string layer_name = layer.empty() ? "0" : layer;
            auto it = layer_ids.find(layer_name);
            if (it != layer_ids.end()) {
                *out_layer_id = it->second;
                return true;
            }
            int new_id = -1;
            if (!cadgf_document_add_layer(doc, layer_name.c_str(), 0xFFFFFFu, &new_id)) {
                return false;
            }
            layer_ids[layer_name] = new_id;
            *out_layer_id = new_id;
            return true;
        };

        auto include_space = [&](int space) -> bool {
            return include_all_spaces || space == target_space;
        };
        std::unordered_map<int, int> top_level_local_groups;

        if (!commit_dxf_top_level_entities(doc, polylines, lines, points, circles, arcs, ellipses,
                                           splines, texts, inserts, text_styles, layers,
                                           default_paper_layout_name, include_all_spaces, target_space,
                                           default_text_height, default_line_scale,
                                           top_level_local_groups, layer_ids)) {
            set_error(out_err, 3, "failed to add layer");
            return 0;
        }

        DxfBlockEntityCommitterContext block_commit_ctx{};
        block_commit_ctx.doc = doc;
        block_commit_ctx.blocks = &blocks;
        block_commit_ctx.layers = &layers;
        block_commit_ctx.text_styles = &text_styles;
        block_commit_ctx.layer_ids = &layer_ids;
        block_commit_ctx.default_paper_layout_name = default_paper_layout_name;
        block_commit_ctx.default_line_scale = default_line_scale;
        block_commit_ctx.default_text_height = default_text_height;
        if (!commit_dxf_block_entries(doc, blocks, polylines, lines, circles, arcs, ellipses, splines,
                                      texts, inserts, commit_ctx, block_commit_ctx, has_paperspace,
                                      include_all_spaces, target_space, top_level_local_groups, out_err)) {
            return 0;
        }

        set_error(out_err, 0, "");
        return 1;
    } catch (const std::exception& e) {
        set_error(out_err, 4, e.what());
        return 0;
    } catch (...) {
        set_error(out_err, 5, "exception during import");
        return 0;
    }
}

static cadgf_string_view importer_name(void) { return sv("DXF Importer (Lite)"); }
static cadgf_string_view importer_extensions(void) { return sv("dxf"); }
static cadgf_string_view importer_filetype_desc(void) { return sv("DXF (*.dxf)"); }

static const cadgf_exporter_api_v1* get_exporter(int32_t index);
static const cadgf_importer_api_v1* get_importer(int32_t index);

static cadgf_importer_api_v1 g_importer = {
    static_cast<int32_t>(sizeof(cadgf_importer_api_v1)),
    importer_name,
    importer_extensions,
    importer_filetype_desc,
    importer_import_document,
};

static cadgf_plugin_desc_v1 plugin_describe_impl(void) {
    cadgf_plugin_desc_v1 d{};
    d.size = static_cast<int32_t>(sizeof(cadgf_plugin_desc_v1));
    d.name = sv("CADGameFusion DXF Importer Plugin");
    d.version = sv("0.1.0");
    d.description = sv("DXF importer (LWPOLYLINE/LINE/ARC/CIRCLE/ELLIPSE/SPLINE/TEXT/MTEXT/ATTRIB/SOLID/HATCH/LEADER/DIMENSION/VIEWPORT) using cadgf_plugin_api_v1");
    return d;
}

static int32_t plugin_initialize(void) { return 1; }
static void plugin_shutdown(void) {}

static int32_t plugin_exporter_count(void) { return 0; }
static const cadgf_exporter_api_v1* get_exporter(int32_t index) { (void)index; return nullptr; }

static int32_t plugin_importer_count(void) { return 1; }
static const cadgf_importer_api_v1* get_importer(int32_t index) { return (index == 0) ? &g_importer : nullptr; }

static cadgf_plugin_api_v1 g_api = {
    static_cast<int32_t>(sizeof(cadgf_plugin_api_v1)),
    CADGF_PLUGIN_ABI_V1,
    plugin_describe_impl,
    plugin_initialize,
    plugin_shutdown,
    plugin_exporter_count,
    get_exporter,
    plugin_importer_count,
    get_importer,
};

extern "C" CADGF_PLUGIN_EXPORT const cadgf_plugin_api_v1* cadgf_plugin_get_api_v1(void) {
    return &g_api;
}
