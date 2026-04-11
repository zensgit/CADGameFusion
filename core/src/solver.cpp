#include "core/solver.hpp"
#include <cmath>
#include <iostream>
#include <limits>
#include <sstream>
#include <unordered_map>
#include <algorithm>
#include <unordered_set>
#include <Eigen/Dense>

namespace core {

ConstraintKind classifyConstraintKind(const std::string& type) {
    if (type == "horizontal") return ConstraintKind::Horizontal;
    if (type == "vertical") return ConstraintKind::Vertical;
    if (type == "parallel") return ConstraintKind::Parallel;
    if (type == "perpendicular") return ConstraintKind::Perpendicular;
    if (type == "equal") return ConstraintKind::Equal;
    if (type == "concentric") return ConstraintKind::Concentric;
    if (type == "coincident") return ConstraintKind::Coincident;
    if (type == "distance") return ConstraintKind::Distance;
    if (type == "angle") return ConstraintKind::Angle;
    if (type == "tangent") return ConstraintKind::Tangent;
    if (type == "point_on_line") return ConstraintKind::PointOnLine;
    if (type == "symmetric") return ConstraintKind::Symmetric;
    if (type == "midpoint") return ConstraintKind::Midpoint;
    if (type == "fixed_point") return ConstraintKind::FixedPoint;
    return ConstraintKind::Unknown;
}

const char* constraintKindName(ConstraintKind kind) {
    switch (kind) {
        case ConstraintKind::Horizontal: return "horizontal";
        case ConstraintKind::Vertical: return "vertical";
        case ConstraintKind::Parallel: return "parallel";
        case ConstraintKind::Perpendicular: return "perpendicular";
        case ConstraintKind::Equal: return "equal";
        case ConstraintKind::Concentric: return "concentric";
        case ConstraintKind::Coincident: return "coincident";
        case ConstraintKind::Distance: return "distance";
        case ConstraintKind::Angle: return "angle";
        case ConstraintKind::Tangent: return "tangent";
        case ConstraintKind::PointOnLine: return "point_on_line";
        case ConstraintKind::Symmetric: return "symmetric";
        case ConstraintKind::Midpoint: return "midpoint";
        case ConstraintKind::FixedPoint: return "fixed_point";
        case ConstraintKind::Unknown:
        default: return "unknown";
    }
}

const char* constraintDiagnosticCodeName(ConstraintDiagnosticCode code) {
    switch (code) {
        case ConstraintDiagnosticCode::UnsupportedType: return "unsupported_type";
        case ConstraintDiagnosticCode::WrongArity: return "wrong_arity";
        case ConstraintDiagnosticCode::MissingValue: return "missing_value";
        case ConstraintDiagnosticCode::UnexpectedValue: return "unexpected_value";
        case ConstraintDiagnosticCode::UnboundVariable: return "unbound_variable";
        case ConstraintDiagnosticCode::DuplicateConstraint: return "duplicate_constraint";
        default: return "unknown";
    }
}

const char* constraintStructuralStateName(ConstraintStructuralState state) {
    switch (state) {
        case ConstraintStructuralState::Underconstrained: return "underconstrained";
        case ConstraintStructuralState::WellConstrained: return "well_constrained";
        case ConstraintStructuralState::Overconstrained: return "overconstrained";
        case ConstraintStructuralState::Mixed: return "mixed";
        case ConstraintStructuralState::Unknown:
        default: return "unknown";
    }
}

namespace {

struct ConstraintValidationReport {
    std::vector<ConstraintDiagnostic> diagnostics;
    std::vector<ConstraintRedundancyGroup> redundancyGroups;
    ConstraintAnalysis analysis;
};

ConstraintStructuralState classify_structural_state(int dof_estimate,
                                                    int redundant_constraint_estimate,
                                                    bool has_evaluable_rows) {
    if (!has_evaluable_rows) return ConstraintStructuralState::Unknown;
    if (dof_estimate > 0 && redundant_constraint_estimate > 0) {
        return ConstraintStructuralState::Mixed;
    }
    if (redundant_constraint_estimate > 0) {
        return ConstraintStructuralState::Overconstrained;
    }
    if (dof_estimate > 0) {
        return ConstraintStructuralState::Underconstrained;
    }
    return ConstraintStructuralState::WellConstrained;
}

void accumulate_structural_group_state(ConstraintStructuralState state,
                                       ConstraintAnalysis& analysis) {
    analysis.structuralGroupCount += 1;
    switch (state) {
        case ConstraintStructuralState::Underconstrained:
            analysis.underconstrainedGroupCount += 1;
            break;
        case ConstraintStructuralState::WellConstrained:
            analysis.wellConstrainedGroupCount += 1;
            break;
        case ConstraintStructuralState::Overconstrained:
            analysis.overconstrainedGroupCount += 1;
            break;
        case ConstraintStructuralState::Mixed:
            analysis.mixedGroupCount += 1;
            break;
        case ConstraintStructuralState::Unknown:
        default:
            analysis.unknownGroupCount += 1;
            break;
    }
}

int structural_priority_score(const ConstraintStructuralGroup& group) {
    int state_bias = 0;
    switch (group.structuralState) {
        case ConstraintStructuralState::Overconstrained:
            state_bias = 20000;
            break;
        case ConstraintStructuralState::Mixed:
            state_bias = 15000;
            break;
        case ConstraintStructuralState::Underconstrained:
            state_bias = 10000;
            break;
        case ConstraintStructuralState::WellConstrained:
            state_bias = 5000;
            break;
        case ConstraintStructuralState::Unknown:
        default:
            state_bias = 0;
            break;
    }
    return state_bias
        + group.redundantConstraintEstimate * 1000
        + static_cast<int>(group.constraintIndices.size()) * 100
        + static_cast<int>(group.freeVariableKeys.size()) * 10
        + group.dofEstimate;
}

void fill_conflict_priority_breakdown(const ConstraintStructuralGroup& group,
                                      ConstraintConflictGroup& conflict_group) {
    switch (group.structuralState) {
        case ConstraintStructuralState::Overconstrained:
            conflict_group.priorityStateBias = 20000;
            break;
        case ConstraintStructuralState::Mixed:
            conflict_group.priorityStateBias = 15000;
            break;
        case ConstraintStructuralState::Underconstrained:
            conflict_group.priorityStateBias = 10000;
            break;
        case ConstraintStructuralState::WellConstrained:
            conflict_group.priorityStateBias = 5000;
            break;
        case ConstraintStructuralState::Unknown:
        default:
            conflict_group.priorityStateBias = 0;
            break;
    }
    conflict_group.priorityRedundantConstraintContribution = group.redundantConstraintEstimate * 1000;
    conflict_group.priorityConstraintCountContribution = static_cast<int>(group.constraintIndices.size()) * 100;
    conflict_group.priorityFreeVariableContribution = static_cast<int>(group.freeVariableKeys.size()) * 10;
    conflict_group.priorityDofContribution = group.dofEstimate;
}

int conflict_priority_score(const ConstraintStructuralGroup& group) {
    return structural_priority_score(group);
}

void fill_redundancy_priority_breakdown(ConstraintRedundancySubset& subset) {
    subset.priorityRedundantConstraintContribution =
        static_cast<int>(subset.redundantConstraintIndices.size()) * 1000;
    subset.priorityWitnessPenalty = -subset.witnessConstraintCount * 10;
}

int redundancy_subset_priority_score(const ConstraintRedundancySubset& subset) {
    return static_cast<int>(subset.redundantConstraintIndices.size()) * 1000
        - subset.witnessConstraintCount * 10;
}

ConstraintConflictPriorityBreakdownSummary summarize_conflict_priority_breakdown(
    const ConstraintConflictGroup& group) {
    ConstraintConflictPriorityBreakdownSummary summary;
    summary.stateBias = group.priorityStateBias;
    summary.redundantConstraintContribution = group.priorityRedundantConstraintContribution;
    summary.constraintCountContribution = group.priorityConstraintCountContribution;
    summary.freeVariableContribution = group.priorityFreeVariableContribution;
    summary.dofContribution = group.priorityDofContribution;
    return summary;
}

ConstraintRedundancyPriorityBreakdownSummary summarize_redundancy_priority_breakdown(
    const ConstraintRedundancySubset& subset) {
    ConstraintRedundancyPriorityBreakdownSummary summary;
    summary.redundantConstraintContribution = subset.priorityRedundantConstraintContribution;
    summary.witnessPenalty = subset.priorityWitnessPenalty;
    return summary;
}

std::vector<std::string> primary_conflict_selection_policy() {
    return {
        "priority_score_desc",
        "constraint_count_desc",
        "anchor_constraint_index_asc",
    };
}

std::vector<std::string> smallest_conflict_selection_policy() {
    return {
        "constraint_count_asc",
        "priority_score_desc",
        "anchor_constraint_index_asc",
    };
}

std::vector<std::string> primary_redundancy_selection_policy() {
    return {
        "priority_score_desc",
        "witness_constraint_count_asc",
        "anchor_constraint_index_asc",
    };
}

std::vector<std::string> smallest_redundancy_selection_policy() {
    return {
        "witness_constraint_count_asc",
        "redundant_constraint_count_desc",
        "anchor_constraint_index_asc",
    };
}

std::string primary_conflict_selection_explanation() {
    return "highest_priority_conflict_group";
}

std::string primary_conflict_selection_tag() {
    return "conflict-primary-priority";
}

std::string primary_conflict_action_hint() {
    return "Inspect the primary conflict group first and relax or remove one conflicting constraint near the anchor.";
}

std::string primary_conflict_action_label() {
    return "Relax primary conflict";
}

std::string smallest_conflict_selection_explanation() {
    return "smallest_conflict_witness";
}

std::string smallest_conflict_selection_tag() {
    return "conflict-smallest-witness";
}

std::string smallest_conflict_action_hint() {
    return "Start with the smallest conflict witness; it is the fastest subset to inspect and isolate.";
}

std::string smallest_conflict_action_label() {
    return "Inspect smallest conflict witness";
}

std::string primary_redundancy_selection_explanation() {
    return "highest_priority_redundancy_subset";
}

std::string primary_redundancy_selection_tag() {
    return "redundancy-primary-priority";
}

std::string primary_redundancy_action_hint() {
    return "Remove or suppress one redundant constraint from the primary redundancy subset first.";
}

std::string primary_redundancy_action_label() {
    return "Suppress primary redundancy";
}

std::string smallest_redundancy_selection_explanation() {
    return "smallest_redundancy_witness";
}

std::string smallest_redundancy_selection_tag() {
    return "redundancy-smallest-witness";
}

std::string smallest_redundancy_action_hint() {
    return "Trim the smallest redundancy witness first; it is the cheapest subset to simplify.";
}

std::string smallest_redundancy_action_label() {
    return "Trim smallest redundancy witness";
}

std::string summarize_conflict_selection(const std::string& explanation,
                                         const ConstraintConflictGroup& group) {
    std::ostringstream out;
    out << explanation
        << "(state=" << constraintStructuralStateName(group.structuralState)
        << ",constraints=" << group.constraintIndices.size()
        << ",score=" << group.priorityScore
        << ",anchor=" << group.anchorConstraintIndex
        << ")";
    return out.str();
}

std::string summarize_redundancy_selection(const std::string& explanation,
                                           const ConstraintRedundancySubset& subset) {
    std::ostringstream out;
    out << explanation
        << "(redundant=" << subset.redundantConstraintIndices.size()
        << ",witness=" << subset.witnessConstraintCount
        << ",score=" << subset.priorityScore
        << ",anchor=" << subset.anchorConstraintIndex
        << ")";
    return out.str();
}

void collect_problematic_constraint_indices(const std::vector<ConstraintStructuralGroup>& structural_groups,
                                           SolveResult& out) {
    std::unordered_set<int> unique_indices;
    for (const auto& group : structural_groups) {
        if (group.structuralState != ConstraintStructuralState::Mixed
            && group.structuralState != ConstraintStructuralState::Overconstrained) {
            continue;
        }
        for (int index : group.constraintIndices) {
            if (index >= 0) unique_indices.insert(index);
        }
    }
    out.problematicConstraintIndices.assign(unique_indices.begin(), unique_indices.end());
    std::sort(out.problematicConstraintIndices.begin(), out.problematicConstraintIndices.end());
    out.analysis.problematicConstraintCount = static_cast<int>(out.problematicConstraintIndices.size());
}

void collect_conflict_groups(const std::vector<ConstraintStructuralGroup>& structural_groups,
                             SolveResult& out) {
    out.conflictGroups.clear();
    out.primaryConflictConstraintIndices.clear();
    out.smallestConflictConstraintIndices.clear();
    out.analysis.conflictGroupCount = 0;
    out.analysis.largestConflictGroupSize = 0;
    out.analysis.primaryConflictAnchorConstraintIndex = -1;
    out.analysis.primaryConflictPriorityScore = 0;
    out.analysis.smallestConflictGroupAnchorConstraintIndex = -1;
    out.analysis.smallestConflictGroupSize = 0;
    out.analysis.primaryConflictPriorityBreakdown = {};
    out.analysis.smallestConflictPriorityBreakdown = {};
    out.analysis.primaryConflictSelectionExplanation.clear();
    out.analysis.smallestConflictSelectionExplanation.clear();
    out.analysis.primaryConflictSelectionTag.clear();
    out.analysis.smallestConflictSelectionTag.clear();
    out.analysis.primaryConflictSelectionSummary.clear();
    out.analysis.smallestConflictSelectionSummary.clear();
    out.analysis.primaryConflictActionHint.clear();
    out.analysis.smallestConflictActionHint.clear();
    out.analysis.primaryConflictVariableKeys.clear();
    out.analysis.primaryConflictFreeVariableKeys.clear();
    out.analysis.smallestConflictVariableKeys.clear();
    out.analysis.smallestConflictFreeVariableKeys.clear();
    out.analysis.primaryConflictSelectionPolicy.clear();
    out.analysis.smallestConflictSelectionPolicy.clear();
    for (const auto& group : structural_groups) {
        if (group.structuralState != ConstraintStructuralState::Mixed
            && group.structuralState != ConstraintStructuralState::Overconstrained) {
            continue;
        }
        ConstraintConflictGroup conflict_group;
        conflict_group.anchorConstraintIndex = group.anchorConstraintIndex;
        conflict_group.constraintIndices = group.constraintIndices;
        conflict_group.variableKeys = group.variableKeys;
        conflict_group.basisVariableKeys = group.basisVariableKeys;
        conflict_group.freeVariableKeys = group.freeVariableKeys;
        conflict_group.jacobianRank = group.jacobianRank;
        conflict_group.dofEstimate = group.dofEstimate;
        conflict_group.redundantConstraintEstimate = group.redundantConstraintEstimate;
        fill_conflict_priority_breakdown(group, conflict_group);
        conflict_group.priorityScore = conflict_priority_score(group);
        conflict_group.structuralState = group.structuralState;
        out.conflictGroups.push_back(std::move(conflict_group));
        out.analysis.conflictGroupCount += 1;
        out.analysis.largestConflictGroupSize = std::max(
            out.analysis.largestConflictGroupSize,
            static_cast<int>(group.constraintIndices.size()));
    }
    std::sort(out.conflictGroups.begin(), out.conflictGroups.end(),
              [](const ConstraintConflictGroup& a, const ConstraintConflictGroup& b) {
                  if (a.priorityScore != b.priorityScore) return a.priorityScore > b.priorityScore;
                  if (a.constraintIndices.size() != b.constraintIndices.size()) {
                      return a.constraintIndices.size() > b.constraintIndices.size();
                  }
                  return a.anchorConstraintIndex < b.anchorConstraintIndex;
              });
    if (!out.conflictGroups.empty()) {
        out.analysis.primaryConflictAnchorConstraintIndex = out.conflictGroups.front().anchorConstraintIndex;
        out.analysis.primaryConflictPriorityScore = out.conflictGroups.front().priorityScore;
        out.analysis.primaryConflictPriorityBreakdown =
            summarize_conflict_priority_breakdown(out.conflictGroups.front());
        out.analysis.primaryConflictSelectionExplanation =
            primary_conflict_selection_explanation();
        out.analysis.primaryConflictSelectionTag =
            primary_conflict_selection_tag();
        out.analysis.primaryConflictSelectionSummary =
            summarize_conflict_selection(out.analysis.primaryConflictSelectionExplanation,
                                        out.conflictGroups.front());
        out.analysis.primaryConflictActionLabel =
            primary_conflict_action_label();
        out.analysis.primaryConflictActionHint =
            primary_conflict_action_hint();
        out.analysis.primaryConflictVariableKeys = out.conflictGroups.front().variableKeys;
        out.analysis.primaryConflictFreeVariableKeys = out.conflictGroups.front().freeVariableKeys;
        out.analysis.primaryConflictSelectionPolicy = primary_conflict_selection_policy();
        out.primaryConflictConstraintIndices = out.conflictGroups.front().constraintIndices;
        auto smallest_it = std::min_element(
            out.conflictGroups.begin(), out.conflictGroups.end(),
            [](const ConstraintConflictGroup& a, const ConstraintConflictGroup& b) {
                if (a.constraintIndices.size() != b.constraintIndices.size()) {
                    return a.constraintIndices.size() < b.constraintIndices.size();
                }
                if (a.priorityScore != b.priorityScore) {
                    return a.priorityScore > b.priorityScore;
                }
                return a.anchorConstraintIndex < b.anchorConstraintIndex;
            });
        out.analysis.smallestConflictGroupAnchorConstraintIndex = smallest_it->anchorConstraintIndex;
        out.analysis.smallestConflictGroupSize = static_cast<int>(smallest_it->constraintIndices.size());
        out.analysis.smallestConflictPriorityBreakdown =
            summarize_conflict_priority_breakdown(*smallest_it);
        out.analysis.smallestConflictSelectionExplanation =
            smallest_conflict_selection_explanation();
        out.analysis.smallestConflictSelectionTag =
            smallest_conflict_selection_tag();
        out.analysis.smallestConflictSelectionSummary =
            summarize_conflict_selection(out.analysis.smallestConflictSelectionExplanation,
                                        *smallest_it);
        out.analysis.smallestConflictActionLabel =
            smallest_conflict_action_label();
        out.analysis.smallestConflictActionHint =
            smallest_conflict_action_hint();
        out.analysis.smallestConflictVariableKeys = smallest_it->variableKeys;
        out.analysis.smallestConflictFreeVariableKeys = smallest_it->freeVariableKeys;
        out.analysis.smallestConflictSelectionPolicy = smallest_conflict_selection_policy();
        out.smallestConflictConstraintIndices = smallest_it->constraintIndices;
    }
}

int expected_arity(ConstraintKind kind) {
    switch (kind) {
        case ConstraintKind::Horizontal:
        case ConstraintKind::Vertical:
        case ConstraintKind::Equal:
            return 2;
        case ConstraintKind::Distance:
            return 4;
        case ConstraintKind::Parallel:
        case ConstraintKind::Perpendicular:
            return 8;
        case ConstraintKind::Concentric:
        case ConstraintKind::Coincident:
            return 4;
        case ConstraintKind::Angle:
            return 8;
        case ConstraintKind::Tangent:
        case ConstraintKind::PointOnLine:
        case ConstraintKind::Symmetric:
        case ConstraintKind::Midpoint:
            return 6;
        case ConstraintKind::FixedPoint:
            return 2;
        case ConstraintKind::Unknown:
        default:
            return -1;
    }
}

bool requires_numeric_value(ConstraintKind kind) {
    return kind == ConstraintKind::Distance || kind == ConstraintKind::Angle
        || kind == ConstraintKind::Tangent || kind == ConstraintKind::FixedPoint;
}

// Constraints that expand into x/y sub-constraints for 2D residuals
bool needs_xy_expansion(const std::string& type) {
    return type == "symmetric" || type == "midpoint"
        || type == "coincident" || type == "concentric";
}

bool has_numeric_residual_implementation(ConstraintKind kind) {
    switch (kind) {
        case ConstraintKind::Horizontal:
        case ConstraintKind::Vertical:
        case ConstraintKind::Parallel:
        case ConstraintKind::Perpendicular:
        case ConstraintKind::Equal:
        case ConstraintKind::Distance:
            return true;
        case ConstraintKind::Angle:
        case ConstraintKind::Concentric:
        case ConstraintKind::Coincident:
            return true;
        case ConstraintKind::Tangent:
        case ConstraintKind::PointOnLine:
        case ConstraintKind::Symmetric:
        case ConstraintKind::Midpoint:
        case ConstraintKind::FixedPoint:
            return true;
        case ConstraintKind::Unknown:
        default:
            return false;
    }
}

void append_diagnostic(std::vector<ConstraintDiagnostic>& out,
                       int index,
                       const ConstraintSpec& spec,
                       ConstraintKind kind,
                       ConstraintDiagnosticCode code,
                       const std::string& detail,
                       int related_index = -1) {
    out.push_back(ConstraintDiagnostic{index, related_index, kind, code, spec.type, detail});
}

std::string format_var_ref(const VarRef& ref) {
    return ref.id + "." + ref.key;
}

std::string normalize_constraint_key(const ConstraintSpec& spec, ConstraintKind kind) {
    std::vector<std::string> vars;
    vars.reserve(spec.vars.size());
    for (const auto& var : spec.vars) vars.push_back(format_var_ref(var));
    switch (kind) {
        case ConstraintKind::Horizontal:
        case ConstraintKind::Vertical:
        case ConstraintKind::Equal:
        case ConstraintKind::Concentric:
        case ConstraintKind::Coincident:
            std::sort(vars.begin(), vars.end());
            break;
        default:
            break;
    }
    std::ostringstream oss;
    oss << static_cast<int>(kind) << '|';
    for (size_t i = 0; i < vars.size(); ++i) {
        if (i) oss << ';';
        oss << vars[i];
    }
    oss << '|';
    if (spec.value.has_value()) {
        oss.setf(std::ios::fixed);
        oss.precision(9);
        oss << *spec.value;
    } else {
        oss << '_';
    }
    return oss.str();
}

ConstraintValidationReport validate_constraints(const std::vector<ConstraintSpec>& constraints,
                                                const ISolver::GetVar* get) {
    ConstraintValidationReport report;
    auto& diagnostics = report.diagnostics;
    report.analysis.constraintCount = static_cast<int>(constraints.size());
    std::unordered_map<std::string, int> seen_keys;
    std::unordered_map<std::string, std::vector<int>> grouped_keys;
    std::unordered_map<std::string, ConstraintKind> grouped_kinds;
    std::unordered_map<std::string, std::string> grouped_types;
    std::unordered_map<std::string, bool> referenced_vars;
    for (size_t i = 0; i < constraints.size(); ++i) {
        const auto& spec = constraints[i];
        const ConstraintKind kind = classifyConstraintKind(spec.type);
        bool has_structural_error = false;
        for (const auto& var : spec.vars) {
            referenced_vars.emplace(format_var_ref(var), true);
        }
        if (kind == ConstraintKind::Unknown) {
            append_diagnostic(diagnostics, static_cast<int>(i), spec, kind,
                              ConstraintDiagnosticCode::UnsupportedType,
                              "unsupported constraint type");
            report.analysis.structuralDiagnosticCount += 1;
            continue;
        }
        const int arity = expected_arity(kind);
        if (arity >= 0 && static_cast<int>(spec.vars.size()) != arity) {
            append_diagnostic(diagnostics, static_cast<int>(i), spec, kind,
                              ConstraintDiagnosticCode::WrongArity,
                              "expected " + std::to_string(arity) + " refs");
            has_structural_error = true;
            report.analysis.structuralDiagnosticCount += 1;
        }
        const bool needs_value = requires_numeric_value(kind);
        if (needs_value && !spec.value.has_value()) {
            append_diagnostic(diagnostics, static_cast<int>(i), spec, kind,
                              ConstraintDiagnosticCode::MissingValue,
                              "numeric value required");
            has_structural_error = true;
            report.analysis.structuralDiagnosticCount += 1;
        }
        if (!needs_value && spec.value.has_value()) {
            append_diagnostic(diagnostics, static_cast<int>(i), spec, kind,
                              ConstraintDiagnosticCode::UnexpectedValue,
                              "numeric value not used");
            has_structural_error = true;
            report.analysis.structuralDiagnosticCount += 1;
        }
        if (!has_structural_error) {
            report.analysis.wellFormedConstraintCount += 1;
            const std::string key = normalize_constraint_key(spec, kind);
            const auto it = seen_keys.find(key);
            if (it != seen_keys.end()) {
                append_diagnostic(diagnostics, static_cast<int>(i), spec, kind,
                                  ConstraintDiagnosticCode::DuplicateConstraint,
                                  "duplicates constraint #" + std::to_string(it->second),
                                  it->second);
                report.analysis.duplicateConstraintCount += 1;
                grouped_keys[key].push_back(static_cast<int>(i));
            } else {
                seen_keys.emplace(key, static_cast<int>(i));
                grouped_keys.emplace(key, std::vector<int>{static_cast<int>(i)});
                grouped_kinds.emplace(key, kind);
                grouped_types.emplace(key, spec.type);
                report.analysis.uniqueConstraintCount += 1;
            }
        }
        if (!get) continue;
        for (const auto& var : spec.vars) {
            bool ok = false;
            (void)(*get)(var, ok);
            if (!ok) {
                append_diagnostic(diagnostics, static_cast<int>(i), spec, kind,
                                  ConstraintDiagnosticCode::UnboundVariable,
                                  "unbound variable: " + var.id + "." + var.key);
                report.analysis.bindingDiagnosticCount += 1;
            } else {
                report.analysis.boundVariableCount += 1;
            }
        }
    }
    report.analysis.referencedVariableCount = static_cast<int>(referenced_vars.size());
    for (const auto& entry : grouped_keys) {
        if (entry.second.size() <= 1) continue;
        ConstraintRedundancyGroup group;
        group.anchorConstraintIndex = entry.second.front();
        group.kind = grouped_kinds[entry.first];
        group.type = grouped_types[entry.first];
        group.constraintIndices = entry.second;
        report.redundancyGroups.push_back(std::move(group));
        report.analysis.duplicateConstraintGroupCount += 1;
        report.analysis.largestDuplicateConstraintGroupSize = std::max(
            report.analysis.largestDuplicateConstraintGroupSize,
            static_cast<int>(entry.second.size()));
    }
    std::sort(report.redundancyGroups.begin(), report.redundancyGroups.end(),
              [](const ConstraintRedundancyGroup& a, const ConstraintRedundancyGroup& b) {
                  return a.anchorConstraintIndex < b.anchorConstraintIndex;
              });
    return report;
}

template <typename ResidualFn>
void populate_jacobian_analysis(const std::vector<ConstraintSpec>& constraints,
                                const std::vector<VarRef>& vars,
                                const ISolver::SetVar& set,
                                const Eigen::VectorXd& x,
                                const ResidualFn& residual,
                                ConstraintAnalysis& analysis,
                                std::vector<ConstraintStructuralGroup>* structural_groups,
                                std::vector<ConstraintRedundancySubset>* redundancy_subsets) {
    std::vector<size_t> evaluable;
    evaluable.reserve(constraints.size());
    for (size_t i = 0; i < constraints.size(); ++i) {
        if (has_numeric_residual_implementation(classifyConstraintKind(constraints[i].type))) {
            evaluable.push_back(i);
        }
    }

    analysis.evaluableConstraintCount = static_cast<int>(evaluable.size());
    analysis.jacobianRowCount = static_cast<int>(evaluable.size());
    analysis.jacobianColumnCount = static_cast<int>(vars.size());
    if (evaluable.empty() || vars.empty()) {
        return;
    }

    const double eps = 1e-6;
    Eigen::VectorXd rvec(evaluable.size());
    Eigen::MatrixXd J(evaluable.size(), vars.size());
    for (size_t row = 0; row < evaluable.size(); ++row) {
        bool okc = false;
        rvec[row] = residual(constraints[evaluable[row]], okc);
    }
    for (size_t j = 0; j < vars.size(); ++j) {
        const double xj = x[j];
        set(vars[j], xj + eps);
        for (size_t row = 0; row < evaluable.size(); ++row) {
            bool okc = false;
            const double r2 = residual(constraints[evaluable[row]], okc);
            J(row, j) = (r2 - rvec[row]) / eps;
        }
        set(vars[j], xj);
    }

    Eigen::ColPivHouseholderQR<Eigen::MatrixXd> qr(J);
    analysis.jacobianRank = static_cast<int>(qr.rank());
    analysis.dofEstimate = std::max(0, analysis.jacobianColumnCount - analysis.jacobianRank);
    analysis.redundantConstraintEstimate = std::max(0, analysis.jacobianRowCount - analysis.jacobianRank);
    analysis.structuralState = classify_structural_state(
        analysis.dofEstimate,
        analysis.redundantConstraintEstimate,
        !evaluable.empty());

    if (!structural_groups && !redundancy_subsets) return;

    std::unordered_map<std::string, int> var_to_col;
    var_to_col.reserve(vars.size());
    for (size_t i = 0; i < vars.size(); ++i) {
        var_to_col.emplace(format_var_ref(vars[i]), static_cast<int>(i));
    }

    std::vector<std::vector<int>> row_to_cols(evaluable.size());
    std::vector<std::vector<int>> col_to_rows(vars.size());
    for (size_t row = 0; row < evaluable.size(); ++row) {
        std::unordered_set<int> unique_cols;
        for (const auto& var : constraints[evaluable[row]].vars) {
            const auto it = var_to_col.find(format_var_ref(var));
            if (it == var_to_col.end()) continue;
            unique_cols.insert(it->second);
        }
        row_to_cols[row].assign(unique_cols.begin(), unique_cols.end());
        std::sort(row_to_cols[row].begin(), row_to_cols[row].end());
        for (int col : row_to_cols[row]) {
            col_to_rows[static_cast<size_t>(col)].push_back(static_cast<int>(row));
        }
    }

    std::vector<bool> visited_rows(evaluable.size(), false);
    std::vector<bool> visited_cols(vars.size(), false);
    for (size_t start_row = 0; start_row < evaluable.size(); ++start_row) {
        if (visited_rows[start_row]) continue;
        std::vector<int> pending_rows{static_cast<int>(start_row)};
        std::vector<int> pending_cols;
        std::vector<int> component_rows;
        std::vector<int> component_cols;

        while (!pending_rows.empty() || !pending_cols.empty()) {
            while (!pending_rows.empty()) {
                const int row = pending_rows.back();
                pending_rows.pop_back();
                if (row < 0 || row >= static_cast<int>(visited_rows.size()) || visited_rows[static_cast<size_t>(row)]) continue;
                visited_rows[static_cast<size_t>(row)] = true;
                component_rows.push_back(row);
                for (int col : row_to_cols[static_cast<size_t>(row)]) {
                    if (col < 0 || col >= static_cast<int>(visited_cols.size()) || visited_cols[static_cast<size_t>(col)]) continue;
                    pending_cols.push_back(col);
                }
            }
            while (!pending_cols.empty()) {
                const int col = pending_cols.back();
                pending_cols.pop_back();
                if (col < 0 || col >= static_cast<int>(visited_cols.size()) || visited_cols[static_cast<size_t>(col)]) continue;
                visited_cols[static_cast<size_t>(col)] = true;
                component_cols.push_back(col);
                for (int row : col_to_rows[static_cast<size_t>(col)]) {
                    if (row < 0 || row >= static_cast<int>(visited_rows.size()) || visited_rows[static_cast<size_t>(row)]) continue;
                    pending_rows.push_back(row);
                }
            }
        }

        if (component_rows.empty()) continue;
        std::sort(component_rows.begin(), component_rows.end());
        std::sort(component_cols.begin(), component_cols.end());

        Eigen::MatrixXd local_j(component_rows.size(), component_cols.size());
        for (size_t local_row = 0; local_row < component_rows.size(); ++local_row) {
            for (size_t local_col = 0; local_col < component_cols.size(); ++local_col) {
                local_j(local_row, local_col) = J(component_rows[local_row], component_cols[local_col]);
            }
        }

        Eigen::FullPivLU<Eigen::MatrixXd> local_lu(local_j);
        ConstraintStructuralGroup group;
        group.jacobianRowCount = static_cast<int>(component_rows.size());
        group.jacobianColumnCount = static_cast<int>(component_cols.size());
        group.jacobianRank = static_cast<int>(local_lu.rank());
        group.dofEstimate = std::max(0, group.jacobianColumnCount - group.jacobianRank);
        group.redundantConstraintEstimate = std::max(0, group.jacobianRowCount - group.jacobianRank);
        group.structuralState = classify_structural_state(
            group.dofEstimate,
            group.redundantConstraintEstimate,
            group.jacobianRowCount > 0);

        for (int row : component_rows) {
            group.constraintIndices.push_back(static_cast<int>(evaluable[static_cast<size_t>(row)]));
        }
        std::sort(group.constraintIndices.begin(), group.constraintIndices.end());
        group.anchorConstraintIndex = group.constraintIndices.empty() ? -1 : group.constraintIndices.front();
        for (int col : component_cols) {
            group.variableKeys.push_back(format_var_ref(vars[static_cast<size_t>(col)]));
        }
        std::vector<int> basis_local_cols;
        int current_col_rank = 0;
        for (size_t local_col = 0; local_col < component_cols.size(); ++local_col) {
            Eigen::MatrixXd candidate(static_cast<int>(component_rows.size()),
                                      static_cast<int>(basis_local_cols.size()) + 1);
            for (size_t basis_index = 0; basis_index < basis_local_cols.size(); ++basis_index) {
                candidate.col(static_cast<int>(basis_index)) = local_j.col(basis_local_cols[basis_index]);
            }
            candidate.col(static_cast<int>(basis_local_cols.size())) = local_j.col(static_cast<int>(local_col));
            Eigen::FullPivLU<Eigen::MatrixXd> candidate_lu(candidate);
            const int candidate_rank = static_cast<int>(candidate_lu.rank());
            const std::string variable_key = format_var_ref(vars[static_cast<size_t>(component_cols[local_col])]);
            if (candidate_rank > current_col_rank) {
                basis_local_cols.push_back(static_cast<int>(local_col));
                current_col_rank = candidate_rank;
                group.basisVariableKeys.push_back(variable_key);
            } else {
                group.freeVariableKeys.push_back(variable_key);
            }
        }
        group.priorityScore = structural_priority_score(group);

        if (structural_groups) {
            structural_groups->push_back(group);
        }

        if (redundancy_subsets && group.redundantConstraintEstimate > 0) {
            ConstraintRedundancySubset subset;
            subset.anchorConstraintIndex = group.anchorConstraintIndex;
            subset.variableKeys = group.variableKeys;
            subset.jacobianRank = group.jacobianRank;
            subset.structuralState = group.structuralState;

            std::vector<int> basis_local_rows;
            int current_rank = 0;
            for (size_t local_row = 0; local_row < component_rows.size(); ++local_row) {
                Eigen::MatrixXd candidate(static_cast<int>(basis_local_rows.size()) + 1,
                                          static_cast<int>(component_cols.size()));
                for (size_t basis_index = 0; basis_index < basis_local_rows.size(); ++basis_index) {
                    candidate.row(static_cast<int>(basis_index)) = local_j.row(basis_local_rows[basis_index]);
                }
                candidate.row(static_cast<int>(basis_local_rows.size())) = local_j.row(static_cast<int>(local_row));
                Eigen::FullPivLU<Eigen::MatrixXd> candidate_lu(candidate);
                const int candidate_rank = static_cast<int>(candidate_lu.rank());
                const int constraint_index = static_cast<int>(evaluable[static_cast<size_t>(component_rows[local_row])]);
                if (candidate_rank > current_rank) {
                    basis_local_rows.push_back(static_cast<int>(local_row));
                    current_rank = candidate_rank;
                    subset.basisConstraintIndices.push_back(constraint_index);
                } else {
                    subset.redundantConstraintIndices.push_back(constraint_index);
                }
            }
            if (!subset.redundantConstraintIndices.empty()) {
                subset.witnessConstraintCount = static_cast<int>(
                    subset.basisConstraintIndices.size() + subset.redundantConstraintIndices.size());
                fill_redundancy_priority_breakdown(subset);
                subset.priorityScore = redundancy_subset_priority_score(subset);
                redundancy_subsets->push_back(std::move(subset));
            }
        }
    }

    if (structural_groups) {
        std::sort(structural_groups->begin(), structural_groups->end(),
                  [](const ConstraintStructuralGroup& a, const ConstraintStructuralGroup& b) {
                      return a.anchorConstraintIndex < b.anchorConstraintIndex;
                  });
        analysis.freeVariableCandidateCount = 0;
        for (const auto& group : *structural_groups) {
            accumulate_structural_group_state(group.structuralState, analysis);
            analysis.freeVariableCandidateCount += static_cast<int>(group.freeVariableKeys.size());
        }
    }
    if (redundancy_subsets) {
        analysis.primaryRedundancySelectionExplanation.clear();
        analysis.smallestRedundancySelectionExplanation.clear();
        analysis.primaryRedundancySelectionTag.clear();
        analysis.smallestRedundancySelectionTag.clear();
        analysis.primaryRedundancySelectionSummary.clear();
        analysis.smallestRedundancySelectionSummary.clear();
        analysis.primaryRedundancyActionHint.clear();
        analysis.smallestRedundancyActionHint.clear();
        analysis.primaryRedundancySelectionPolicy.clear();
        analysis.smallestRedundancySelectionPolicy.clear();
        std::sort(redundancy_subsets->begin(), redundancy_subsets->end(),
                  [](const ConstraintRedundancySubset& a, const ConstraintRedundancySubset& b) {
                      if (a.priorityScore != b.priorityScore) return a.priorityScore > b.priorityScore;
                      if (a.witnessConstraintCount != b.witnessConstraintCount) {
                          return a.witnessConstraintCount < b.witnessConstraintCount;
                      }
                      return a.anchorConstraintIndex < b.anchorConstraintIndex;
                  });
        analysis.redundancySubsetCount = static_cast<int>(redundancy_subsets->size());
        int redundant_candidate_count = 0;
        for (const auto& subset : *redundancy_subsets) {
            redundant_candidate_count += static_cast<int>(subset.redundantConstraintIndices.size());
        }
        analysis.redundantConstraintCandidateCount = redundant_candidate_count;
        analysis.primaryRedundancySubsetAnchorConstraintIndex = redundancy_subsets->empty()
            ? -1
            : redundancy_subsets->front().anchorConstraintIndex;
        analysis.primaryRedundancyPriorityScore = redundancy_subsets->empty()
            ? 0
            : redundancy_subsets->front().priorityScore;
        analysis.primaryRedundancyPriorityBreakdown = redundancy_subsets->empty()
            ? ConstraintRedundancyPriorityBreakdownSummary{}
            : summarize_redundancy_priority_breakdown(redundancy_subsets->front());
        analysis.primaryRedundancySelectionExplanation = redundancy_subsets->empty()
            ? std::string{}
            : primary_redundancy_selection_explanation();
        analysis.primaryRedundancySelectionTag = redundancy_subsets->empty()
            ? std::string{}
            : primary_redundancy_selection_tag();
        analysis.primaryRedundancySelectionSummary = redundancy_subsets->empty()
            ? std::string{}
            : summarize_redundancy_selection(analysis.primaryRedundancySelectionExplanation,
                                             redundancy_subsets->front());
        analysis.primaryRedundancyActionLabel = redundancy_subsets->empty()
            ? std::string{}
            : primary_redundancy_action_label();
        analysis.primaryRedundancyActionHint = redundancy_subsets->empty()
            ? std::string{}
            : primary_redundancy_action_hint();
        analysis.primaryRedundancySelectionPolicy = redundancy_subsets->empty()
            ? std::vector<std::string>{}
            : primary_redundancy_selection_policy();
        if (!redundancy_subsets->empty()) {
            auto smallest_it = std::min_element(
                redundancy_subsets->begin(), redundancy_subsets->end(),
                [](const ConstraintRedundancySubset& a, const ConstraintRedundancySubset& b) {
                    if (a.witnessConstraintCount != b.witnessConstraintCount) {
                        return a.witnessConstraintCount < b.witnessConstraintCount;
                    }
                    if (a.redundantConstraintIndices.size() != b.redundantConstraintIndices.size()) {
                        return a.redundantConstraintIndices.size() > b.redundantConstraintIndices.size();
                    }
                    return a.anchorConstraintIndex < b.anchorConstraintIndex;
                });
            analysis.smallestRedundancySubsetAnchorConstraintIndex = smallest_it->anchorConstraintIndex;
            analysis.smallestRedundancyWitnessConstraintCount = smallest_it->witnessConstraintCount;
            analysis.smallestRedundancyPriorityBreakdown =
                summarize_redundancy_priority_breakdown(*smallest_it);
            analysis.smallestRedundancySelectionExplanation =
                smallest_redundancy_selection_explanation();
            analysis.smallestRedundancySelectionTag =
                smallest_redundancy_selection_tag();
            analysis.smallestRedundancySelectionSummary =
                summarize_redundancy_selection(analysis.smallestRedundancySelectionExplanation,
                                               *smallest_it);
            analysis.smallestRedundancyActionLabel =
                smallest_redundancy_action_label();
            analysis.smallestRedundancyActionHint =
                smallest_redundancy_action_hint();
            analysis.smallestRedundancySelectionPolicy = smallest_redundancy_selection_policy();
        }
    }
}

// Shared residual evaluation for all solver implementations
double residual_for_constraint(const ConstraintSpec& c, const ISolver::GetVar& get, bool& ok) {
    ok = true;
    if (c.type == "horizontal" && c.vars.size() >= 2) {
        bool ok0=false, ok1=false;
        double y0 = get(c.vars[0], ok0); double y1 = get(c.vars[1], ok1);
        ok = ok0 && ok1; return ok ? (y1 - y0) : 0.0;
    }
    if (c.type == "vertical" && c.vars.size() >= 2) {
        bool ok0=false, ok1=false;
        double x0 = get(c.vars[0], ok0); double x1 = get(c.vars[1], ok1);
        ok = ok0 && ok1; return ok ? (x1 - x0) : 0.0;
    }
    if (c.type == "distance" && c.vars.size() >= 4 && c.value.has_value()) {
        bool ok0=false, ok1=false, ok2=false, ok3=false;
        double x0 = get(c.vars[0], ok0), y0 = get(c.vars[1], ok1);
        double x1 = get(c.vars[2], ok2), y1 = get(c.vars[3], ok3);
        if (!(ok0&&ok1&&ok2&&ok3)) { ok=false; return 0.0; }
        return std::sqrt((x1-x0)*(x1-x0) + (y1-y0)*(y1-y0)) - *c.value;
    }
    if (c.type == "parallel" && c.vars.size() >= 8) {
        bool okv[8]; for (int i=0;i<8;++i) okv[i]=false;
        double x0=get(c.vars[0],okv[0]),y0=get(c.vars[1],okv[1]),x1=get(c.vars[2],okv[2]),y1=get(c.vars[3],okv[3]);
        double x2=get(c.vars[4],okv[4]),y2=get(c.vars[5],okv[5]),x3=get(c.vars[6],okv[6]),y3=get(c.vars[7],okv[7]);
        for (int i=0;i<8;++i) if (!okv[i]) { ok=false; return 0.0; }
        double v1x=x1-x0,v1y=y1-y0,v2x=x3-x2,v2y=y3-y2;
        double n1=std::sqrt(v1x*v1x+v1y*v1y),n2=std::sqrt(v2x*v2x+v2y*v2y);
        if (n1==0||n2==0) return 0.0;
        return (v1x*v2y-v1y*v2x)/(n1*n2);
    }
    if (c.type == "perpendicular" && c.vars.size() >= 8) {
        bool okv[8]; for (int i=0;i<8;++i) okv[i]=false;
        double x0=get(c.vars[0],okv[0]),y0=get(c.vars[1],okv[1]),x1=get(c.vars[2],okv[2]),y1=get(c.vars[3],okv[3]);
        double x2=get(c.vars[4],okv[4]),y2=get(c.vars[5],okv[5]),x3=get(c.vars[6],okv[6]),y3=get(c.vars[7],okv[7]);
        for (int i=0;i<8;++i) if (!okv[i]) { ok=false; return 0.0; }
        double v1x=x1-x0,v1y=y1-y0,v2x=x3-x2,v2y=y3-y2;
        double n1=std::sqrt(v1x*v1x+v1y*v1y),n2=std::sqrt(v2x*v2x+v2y*v2y);
        if (n1==0||n2==0) return 0.0;
        return (v1x*v2x+v1y*v2y)/(n1*n2);
    }
    if (c.type == "equal" && c.vars.size() >= 2) {
        bool ok0=false,ok1=false;
        double a=get(c.vars[0],ok0),b=get(c.vars[1],ok1);
        ok=ok0&&ok1; return ok?(a-b):0.0;
    }
    if (c.type == "coincident" && c.vars.size() >= 4) {
        bool ok0=false,ok1=false,ok2=false,ok3=false;
        double x0=get(c.vars[0],ok0),y0=get(c.vars[1],ok1),x1=get(c.vars[2],ok2),y1=get(c.vars[3],ok3);
        if (!(ok0&&ok1&&ok2&&ok3)) { ok=false; return 0.0; }
        return (c.value.has_value() && *c.value > 0.5) ? (y1-y0) : (x1-x0);
    }
    if (c.type == "concentric" && c.vars.size() >= 4) {
        bool ok0=false,ok1=false,ok2=false,ok3=false;
        double cx0=get(c.vars[0],ok0),cy0=get(c.vars[1],ok1),cx1=get(c.vars[2],ok2),cy1=get(c.vars[3],ok3);
        if (!(ok0&&ok1&&ok2&&ok3)) { ok=false; return 0.0; }
        return (c.value.has_value() && *c.value > 0.5) ? (cy1-cy0) : (cx1-cx0);
    }
    if (c.type == "angle" && c.vars.size() >= 8 && c.value.has_value()) {
        bool okv[8]; for (int i=0;i<8;++i) okv[i]=false;
        double x0=get(c.vars[0],okv[0]),y0=get(c.vars[1],okv[1]),x1=get(c.vars[2],okv[2]),y1=get(c.vars[3],okv[3]);
        double x2=get(c.vars[4],okv[4]),y2=get(c.vars[5],okv[5]),x3=get(c.vars[6],okv[6]),y3=get(c.vars[7],okv[7]);
        for (int i=0;i<8;++i) if (!okv[i]) { ok=false; return 0.0; }
        double v1x=x1-x0,v1y=y1-y0,v2x=x3-x2,v2y=y3-y2;
        double n1=std::sqrt(v1x*v1x+v1y*v1y),n2=std::sqrt(v2x*v2x+v2y*v2y);
        if (n1==0||n2==0) return 0.0;
        double cosA=std::max(-1.0,std::min(1.0,(v1x*v2x+v1y*v2y)/(n1*n2)));
        return std::acos(cosA)-*c.value;
    }
    if (c.type == "tangent" && c.vars.size() >= 6 && c.value.has_value()) {
        bool okv[6]; for (int i=0;i<6;++i) okv[i]=false;
        double p0x=get(c.vars[0],okv[0]),p0y=get(c.vars[1],okv[1]),p1x=get(c.vars[2],okv[2]),p1y=get(c.vars[3],okv[3]);
        double cx=get(c.vars[4],okv[4]),cy=get(c.vars[5],okv[5]);
        for (int i=0;i<6;++i) if (!okv[i]) { ok=false; return 0.0; }
        double dx=p1x-p0x,dy=p1y-p0y,len=std::sqrt(dx*dx+dy*dy);
        if (len<1e-15) return 0.0;
        return std::abs((cx-p0x)*dy-(cy-p0y)*dx)/len - *c.value;
    }
    if (c.type == "point_on_line" && c.vars.size() >= 6) {
        bool okv[6]; for (int i=0;i<6;++i) okv[i]=false;
        double px=get(c.vars[0],okv[0]),py=get(c.vars[1],okv[1]),ax=get(c.vars[2],okv[2]),ay=get(c.vars[3],okv[3]);
        double bx=get(c.vars[4],okv[4]),by=get(c.vars[5],okv[5]);
        for (int i=0;i<6;++i) if (!okv[i]) { ok=false; return 0.0; }
        double dx=bx-ax,dy=by-ay,len=std::sqrt(dx*dx+dy*dy);
        if (len<1e-15) return 0.0;
        return ((px-ax)*dy-(py-ay)*dx)/len;
    }
    if (c.type == "symmetric" && c.vars.size() >= 6) {
        bool okv[6]; for (int i=0;i<6;++i) okv[i]=false;
        double p1x=get(c.vars[0],okv[0]),p1y=get(c.vars[1],okv[1]),p2x=get(c.vars[2],okv[2]),p2y=get(c.vars[3],okv[3]);
        double cx=get(c.vars[4],okv[4]),cy=get(c.vars[5],okv[5]);
        for (int i=0;i<6;++i) if (!okv[i]) { ok=false; return 0.0; }
        double mx=(p1x+p2x)*0.5-cx, my=(p1y+p2y)*0.5-cy;
        return (c.value.has_value() && *c.value > 0.5) ? my : mx;
    }
    if (c.type == "midpoint" && c.vars.size() >= 6) {
        bool okv[6]; for (int i=0;i<6;++i) okv[i]=false;
        double px=get(c.vars[0],okv[0]),py=get(c.vars[1],okv[1]),ax=get(c.vars[2],okv[2]),ay=get(c.vars[3],okv[3]);
        double bx=get(c.vars[4],okv[4]),by=get(c.vars[5],okv[5]);
        for (int i=0;i<6;++i) if (!okv[i]) { ok=false; return 0.0; }
        double dx=px-(ax+bx)*0.5, dy=py-(ay+by)*0.5;
        return (c.value.has_value() && *c.value > 0.5) ? dy : dx;
    }
    if (c.type == "fixed_point" && c.vars.size() >= 2 && c.value.has_value()) {
        bool ok0=false,ok1=false;
        double val=get(c.vars[0],ok0); (void)get(c.vars[1],ok1);
        ok=ok0&&ok1; if (!ok) return 0.0;
        return val - *c.value;
    }
    ok = true; return 0.0;
}

// ---------------------------------------------------------------------------
// Analytical Jacobian helpers – Batch A (8 linear/simple constraint types)
// ---------------------------------------------------------------------------

// Returns true for the 8 constraint types that have analytical gradient support.
bool has_analytical_gradient(const ConstraintSpec& c) {
    const auto kind = classifyConstraintKind(c.type);
    switch (kind) {
        case ConstraintKind::Horizontal:
        case ConstraintKind::Vertical:
        case ConstraintKind::Equal:
        case ConstraintKind::Coincident:
        case ConstraintKind::Concentric:
        case ConstraintKind::FixedPoint:
        case ConstraintKind::Midpoint:
        case ConstraintKind::Symmetric:
            return true;
        default:
            return false;
    }
}

// Compute the analytical partial derivative d(residual)/d(vars[var_index])
// for supported constraint types.  Sets ok=false and returns NaN for
// unsupported types or when var_index is not active.
double analytical_gradient(const ConstraintSpec& c, int var_index,
                           const ISolver::GetVar& /*get*/, bool& ok) {
    ok = true;
    const auto kind = classifyConstraintKind(c.type);

    switch (kind) {
        // horizontal: residual = y1 - y0
        // d/dy0 = -1, d/dy1 = 1
        case ConstraintKind::Horizontal:
            if (var_index == 0) return -1.0;
            if (var_index == 1) return  1.0;
            ok = false; return std::numeric_limits<double>::quiet_NaN();

        // vertical: residual = x1 - x0
        // d/dx0 = -1, d/dx1 = 1
        case ConstraintKind::Vertical:
            if (var_index == 0) return -1.0;
            if (var_index == 1) return  1.0;
            ok = false; return std::numeric_limits<double>::quiet_NaN();

        // equal: residual = a - b
        // d/da = 1, d/db = -1
        case ConstraintKind::Equal:
            if (var_index == 0) return  1.0;
            if (var_index == 1) return -1.0;
            ok = false; return std::numeric_limits<double>::quiet_NaN();

        // coincident (expanded): residual = (x1-x0) or (y1-y0) depending on value
        // For x-component (value <= 0.5): vars[0]=x0, vars[2]=x1 => d/dx0=-1, d/dx1=1
        // For y-component (value > 0.5):  vars[1]=y0, vars[3]=y1 => d/dy0=-1, d/dy1=1
        case ConstraintKind::Coincident: {
            bool yComp = c.value.has_value() && *c.value > 0.5;
            if (yComp) {
                if (var_index == 1) return -1.0; // y0
                if (var_index == 3) return  1.0; // y1
            } else {
                if (var_index == 0) return -1.0; // x0
                if (var_index == 2) return  1.0; // x1
            }
            // Variable not active for this component => gradient is 0
            return 0.0;
        }

        // concentric (expanded): same structure as coincident
        case ConstraintKind::Concentric: {
            bool yComp = c.value.has_value() && *c.value > 0.5;
            if (yComp) {
                if (var_index == 1) return -1.0; // cy0
                if (var_index == 3) return  1.0; // cy1
            } else {
                if (var_index == 0) return -1.0; // cx0
                if (var_index == 2) return  1.0; // cx1
            }
            return 0.0;
        }

        // fixed_point: residual = vars[0] - value
        // d/d(vars[0]) = 1, d/d(vars[1]) = 0
        case ConstraintKind::FixedPoint:
            if (var_index == 0) return 1.0;
            if (var_index == 1) return 0.0;
            ok = false; return std::numeric_limits<double>::quiet_NaN();

        // midpoint (expanded): residual = p - (a+b)*0.5 per component
        // x-component: dx = px - (ax+bx)*0.5
        //   d/dpx = 1, d/dax = -0.5, d/dbx = -0.5
        //   vars: [0]=px, [1]=py, [2]=ax, [3]=ay, [4]=bx, [5]=by
        // y-component: dy = py - (ay+by)*0.5
        //   d/dpy = 1, d/day = -0.5, d/dby = -0.5
        case ConstraintKind::Midpoint: {
            bool yComp = c.value.has_value() && *c.value > 0.5;
            if (yComp) {
                if (var_index == 1) return  1.0;  // py
                if (var_index == 3) return -0.5;  // ay
                if (var_index == 5) return -0.5;  // by
                return 0.0;
            } else {
                if (var_index == 0) return  1.0;  // px
                if (var_index == 2) return -0.5;  // ax
                if (var_index == 4) return -0.5;  // bx
                return 0.0;
            }
        }

        // symmetric (expanded): residual = (p1+p2)*0.5 - c per component
        // x-component: mx = (p1x+p2x)*0.5 - cx
        //   d/dp1x = 0.5, d/dp2x = 0.5, d/dcx = -1.0
        //   vars: [0]=p1x, [1]=p1y, [2]=p2x, [3]=p2y, [4]=cx, [5]=cy
        // y-component: my = (p1y+p2y)*0.5 - cy
        //   d/dp1y = 0.5, d/dp2y = 0.5, d/dcy = -1.0
        case ConstraintKind::Symmetric: {
            bool yComp = c.value.has_value() && *c.value > 0.5;
            if (yComp) {
                if (var_index == 1) return  0.5;  // p1y
                if (var_index == 3) return  0.5;  // p2y
                if (var_index == 5) return -1.0;  // cy
                return 0.0;
            } else {
                if (var_index == 0) return  0.5;  // p1x
                if (var_index == 2) return  0.5;  // p2x
                if (var_index == 4) return -1.0;  // cx
                return 0.0;
            }
        }

        default:
            break;
    }
    ok = false;
    return std::numeric_limits<double>::quiet_NaN();
}

#ifndef NDEBUG
// Debug verification: compare analytical gradient with numerical finite
// difference for each constraint-variable pair that has an analytical formula.
// Logs a warning to stderr if relative error exceeds the given tolerance.
void verify_analytical_gradient(const ConstraintSpec& c, int var_index,
                                double analytical_val,
                                const ISolver::GetVar& get,
                                const ISolver::SetVar& set,
                                const std::vector<VarRef>& vars,
                                int global_var_idx,
                                const std::function<double(const ConstraintSpec&, bool&)>& residual) {
    // Compute numerical gradient for this constraint-variable pair
    bool okr = false;
    double r0 = residual(c, okr);
    if (!okr) return;

    const double eps = 1e-7;
    bool okv = false;
    double xj = get(vars[global_var_idx], okv);
    if (!okv) return;

    set(vars[global_var_idx], xj + eps);
    bool okr2 = false;
    double r1 = residual(c, okr2);
    set(vars[global_var_idx], xj); // restore

    if (!okr2) return;
    double numerical_val = (r1 - r0) / eps;

    // Relative error check
    double denom = std::max(std::abs(analytical_val), std::abs(numerical_val));
    if (denom < 1e-15) return; // both ~zero, skip
    double rel_err = std::abs(analytical_val - numerical_val) / denom;
    if (rel_err > 1e-4) {
        std::cerr << "[WARN] analytical/numerical gradient mismatch: type="
                  << c.type << " var_index=" << var_index
                  << " analytical=" << analytical_val
                  << " numerical=" << numerical_val
                  << " rel_err=" << rel_err << "\n";
    }
}
#endif // NDEBUG

// Helper: compute gradient of objective F(x) = 0.5 * sum(r_i^2)
// using analytical Jacobian entries where available, falling back to
// numerical finite differences for unsupported constraint types.
// Returns grad_j = sum_i( r_i * dri/dxj ) for each variable j.
Eigen::VectorXd compute_objective_gradient(
    const std::vector<ConstraintSpec>& constraints,
    const std::vector<VarRef>& vars,
    const Eigen::VectorXd& x,
    double /*fx*/,
    const ISolver::GetVar& get,
    const ISolver::SetVar& set,
    const std::function<double(const ConstraintSpec&, bool&)>& residual) {

    const int n = static_cast<int>(vars.size());
    const int m = static_cast<int>(constraints.size());
    Eigen::VectorXd grad = Eigen::VectorXd::Zero(n);

    // Build var key -> global index map
    std::unordered_map<std::string, int> var_key_to_global;
    for (int j = 0; j < n; ++j) {
        var_key_to_global[vars[j].id + "." + vars[j].key] = j;
    }

    // Check if any constraint has analytical gradient
    bool any_analytical = false;
    for (const auto& c : constraints) {
        if (has_analytical_gradient(c)) { any_analytical = true; break; }
    }

    if (any_analytical) {
        // Mixed approach: compute per-constraint contributions analytically where
        // possible, and use numerical finite difference for the rest.
        // For analytical: grad_j += r_i * d(r_i)/d(x_j)
        // For numerical: use full-objective finite difference for those variables
        // that appear only in numerical constraints (or use per-entry fallback).

        // Pre-compute all residuals
        Eigen::VectorXd rvec(m);
        for (int i = 0; i < m; ++i) {
            bool okc = false;
            rvec[i] = residual(constraints[i], okc);
        }

        // For each variable, accumulate gradient contributions
        for (int j = 0; j < n; ++j) {
            double gj = 0.0;
            bool all_analytical_for_this_var = true;

            for (int i = 0; i < m; ++i) {
                // Find var_index for this constraint
                int vi = -1;
                for (int k = 0; k < static_cast<int>(constraints[i].vars.size()); ++k) {
                    const auto& vr = constraints[i].vars[k];
                    if (vr.id == vars[j].id && vr.key == vars[j].key) {
                        vi = k;
                        break;
                    }
                }
                if (vi < 0) continue; // variable not in this constraint

                if (has_analytical_gradient(constraints[i])) {
                    bool ok = false;
                    double dri = analytical_gradient(constraints[i], vi, get, ok);
                    if (ok && std::isfinite(dri)) {
#ifndef NDEBUG
                        verify_analytical_gradient(constraints[i], vi, dri, get, set,
                                                   vars, j, residual);
#endif
                        gj += rvec[i] * dri;
                        continue;
                    }
                }
                // This constraint needs numerical diff for this variable
                all_analytical_for_this_var = false;
            }

            if (!all_analytical_for_this_var) {
                // Fall back to full numerical finite difference for this variable's
                // contribution from non-analytical constraints
                const double eps = 1e-7;
                bool okv = false;
                double xj = get(vars[j], okv);
                set(vars[j], xj + eps);
                double fp = 0.0;
                for (int i = 0; i < m; ++i) {
                    if (has_analytical_gradient(constraints[i])) {
                        // Already handled analytically above - need to subtract
                        // analytical contribution to avoid double-counting, then
                        // add back the numerical version. But it's simpler to just
                        // use numerical for everything on this variable.
                    }
                    bool okc = false;
                    double ri = residual(constraints[i], okc);
                    fp += ri * ri;
                }
                fp *= 0.5;
                set(vars[j], xj); // restore
                double f0 = 0.0;
                for (int i = 0; i < m; ++i) {
                    bool okc = false;
                    double ri = residual(constraints[i], okc);
                    f0 += ri * ri;
                }
                f0 *= 0.5;
                grad[j] = (fp - f0) / eps;
            } else {
                grad[j] = gj;
            }
        }
    } else {
        // All numerical: use forward difference on the full objective
        const double eps = 1e-7;
        double f0 = 0.0;
        for (int i = 0; i < m; ++i) {
            bool okc = false;
            double ri = residual(constraints[i], okc);
            f0 += ri * ri;
        }
        f0 *= 0.5;

        for (int j = 0; j < n; ++j) {
            bool okv = false;
            double xj = get(vars[j], okv);
            set(vars[j], xj + eps);
            double fp = 0.0;
            for (int i = 0; i < m; ++i) {
                bool okc = false;
                double ri = residual(constraints[i], okc);
                fp += ri * ri;
            }
            fp *= 0.5;
            set(vars[j], xj); // restore
            grad[j] = (fp - f0) / eps;
        }
    }

    return grad;
}

} // namespace

class MinimalSolver : public ISolver {
    int maxIters_ = 50;
    double tol_ = 1e-6;
public:
    void setMaxIterations(int iters) override { maxIters_ = iters; }
    void setTolerance(double tol) override { tol_ = tol; }

    // NOTE: This is a stub that only evaluates residuals without modifying vars.
    SolveResult solve(std::vector<ConstraintSpec>& constraints) override {
        // Legacy stub
        SolveResult r;
        const auto report = validate_constraints(constraints, nullptr);
        r.diagnostics = report.diagnostics;
        r.redundancyGroups = report.redundancyGroups;
        r.analysis = report.analysis;
        r.ok = r.diagnostics.empty();
        r.iterations = 0;
        r.finalError = 0.0;
        r.message = r.ok ? "Converged (no-op stub)" : "Constraint validation failed";
        return r;
    }

    SolveResult solveWithBindings(std::vector<ConstraintSpec>& constraints, const GetVar& get, const SetVar& set) override {
        SolveResult out;
        const auto report = validate_constraints(constraints, &get);
        out.diagnostics = report.diagnostics;
        out.redundancyGroups = report.redundancyGroups;
        out.analysis = report.analysis;
        if (!out.diagnostics.empty()) {
            out.ok = false;
            out.iterations = 0;
            out.finalError = 0.0;
            out.message = "Constraint validation failed";
            return out;
        }

        // Expand 2D constraints (symmetric, midpoint) into x/y sub-constraint pairs
        std::vector<ConstraintSpec> expanded;
        for (const auto& c : constraints) {
            if (needs_xy_expansion(c.type)) {
                ConstraintSpec cx = c; cx.value = 0.0; // x-component
                ConstraintSpec cy = c; cy.value = 1.0; // y-component
                expanded.push_back(cx);
                expanded.push_back(cy);
            } else {
                expanded.push_back(c);
            }
        }

        // Residual via shared function (deduplicated in P3 tech debt cleanup)
        auto residual = [&](const ConstraintSpec& c, bool& ok)->double {
            return residual_for_constraint(c, get, ok);
        };

        // Collect unique variables
        std::vector<VarRef> vars;
        auto add_unique = [&](const VarRef& v){ for (auto& u : vars) if (u.id==v.id && u.key==v.key) return; vars.push_back(v); };
        for (const auto& c : expanded) for (const auto& v : c.vars) add_unique(v);

        const size_t n = vars.size();
        const size_t m = expanded.size();
        if (n == 0 || m == 0) {
             out.ok = true;
             out.iterations = 0;
             out.finalError = 0.0;
             out.analysis.jacobianColumnCount = static_cast<int>(n);
             return out;
        }

        // Current values snapshot
        Eigen::VectorXd x(n);
        for (size_t j=0;j<n;j++){ bool okv=false; x[j]=get(vars[j], okv); }

        auto write_x = [&](const Eigen::VectorXd& currX){ for (size_t j=0;j<n;j++) set(vars[j], currX[j]); };

        populate_jacobian_analysis(
            expanded,
            vars,
            set,
            x,
            residual,
            out.analysis,
            &out.structuralGroups,
            &out.redundancySubsets);
        collect_conflict_groups(out.structuralGroups, out);
        collect_problematic_constraint_indices(out.structuralGroups, out);
        out.primaryRedundancyBasisConstraintIndices.clear();
        out.primaryRedundantConstraintIndices.clear();
        out.smallestRedundancyBasisConstraintIndices.clear();
        out.smallestRedundantConstraintIndices.clear();
        out.analysis.primaryRedundancyVariableKeys.clear();
        out.analysis.smallestRedundancyVariableKeys.clear();
        if (!out.redundancySubsets.empty()) {
            out.primaryRedundancyBasisConstraintIndices = out.redundancySubsets.front().basisConstraintIndices;
            out.primaryRedundantConstraintIndices = out.redundancySubsets.front().redundantConstraintIndices;
            out.analysis.primaryRedundancyVariableKeys = out.redundancySubsets.front().variableKeys;
            const auto smallest_it = std::find_if(
                out.redundancySubsets.begin(), out.redundancySubsets.end(),
                [&](const ConstraintRedundancySubset& subset) {
                    return subset.anchorConstraintIndex == out.analysis.smallestRedundancySubsetAnchorConstraintIndex;
                });
            if (smallest_it != out.redundancySubsets.end()) {
                out.smallestRedundancyBasisConstraintIndices = smallest_it->basisConstraintIndices;
                out.smallestRedundantConstraintIndices = smallest_it->redundantConstraintIndices;
                out.analysis.smallestRedundancyVariableKeys = smallest_it->variableKeys;
            }
        }

        // Error norm function
        auto eval_norm = [&](){ double s=0.0; for (const auto& c: expanded){ bool okc=false; double rr=residual(c, okc); s += rr*rr; } return std::sqrt(s); };

        // --- Partitioned solving: extract connected components via variable sharing ---
        // Build constraint-variable adjacency and BFS to find components
        std::unordered_map<std::string, int> var_index_map;
        for (size_t j = 0; j < n; ++j) var_index_map[vars[j].id + "." + vars[j].key] = static_cast<int>(j);

        std::vector<std::vector<int>> constraint_vars_idx(m);
        std::vector<std::vector<int>> var_constraints(n);
        for (size_t i = 0; i < m; ++i) {
            for (const auto& v : expanded[i].vars) {
                auto it = var_index_map.find(v.id + "." + v.key);
                if (it != var_index_map.end()) {
                    constraint_vars_idx[i].push_back(it->second);
                    var_constraints[static_cast<size_t>(it->second)].push_back(static_cast<int>(i));
                }
            }
        }

        // BFS to find connected components
        struct Component { std::vector<int> constraint_indices; std::vector<int> var_indices; };
        std::vector<Component> components;
        std::vector<bool> visited_c(m, false), visited_v(n, false);
        for (size_t start = 0; start < m; ++start) {
            if (visited_c[start]) continue;
            Component comp;
            std::vector<int> pending_c{static_cast<int>(start)}, pending_v;
            while (!pending_c.empty() || !pending_v.empty()) {
                while (!pending_c.empty()) {
                    int ci = pending_c.back(); pending_c.pop_back();
                    if (ci < 0 || visited_c[static_cast<size_t>(ci)]) continue;
                    visited_c[static_cast<size_t>(ci)] = true;
                    comp.constraint_indices.push_back(ci);
                    for (int vi : constraint_vars_idx[static_cast<size_t>(ci)]) pending_v.push_back(vi);
                }
                while (!pending_v.empty()) {
                    int vi = pending_v.back(); pending_v.pop_back();
                    if (vi < 0 || visited_v[static_cast<size_t>(vi)]) continue;
                    visited_v[static_cast<size_t>(vi)] = true;
                    comp.var_indices.push_back(vi);
                    for (int ci : var_constraints[static_cast<size_t>(vi)]) pending_c.push_back(ci);
                }
            }
            if (!comp.constraint_indices.empty()) components.push_back(std::move(comp));
        }

        write_x(x);
        int total_iters = 0;
        bool all_ok = true;

        // Solve each component independently
        for (const auto& comp : components) {
            const size_t cm = comp.constraint_indices.size();
            const size_t cn = comp.var_indices.size();
            if (cm == 0 || cn == 0) continue;

            // Map from component-local to global indices
            std::vector<int> ci = comp.constraint_indices;
            std::vector<int> vi = comp.var_indices;

            auto comp_eval_norm = [&]() {
                double s = 0.0;
                for (int idx : ci) { bool okc=false; double rr=residual(expanded[static_cast<size_t>(idx)], okc); s += rr*rr; }
                return std::sqrt(s);
            };

            double prev = comp_eval_norm();
            double lambda = 1e-3;

            for (int it = 0; it < maxIters_; ++it) {
                total_iters++;
                // Residual
                Eigen::VectorXd rvec(cm);
                for (size_t r = 0; r < cm; ++r) { bool okc=false; rvec[r] = residual(expanded[static_cast<size_t>(ci[r])], okc); }

                // Jacobian (cm x cn) — analytical where supported, numerical fallback
                Eigen::MatrixXd J(cm, cn);
                const double eps = 1e-6;
                for (size_t j = 0; j < cn; ++j) {
                    int gj = vi[j];
                    // Check which constraints need numerical diff for this variable
                    bool need_numerical = false;
                    for (size_t r = 0; r < cm; ++r) {
                        const auto& ec = expanded[static_cast<size_t>(ci[r])];
                        if (has_analytical_gradient(ec)) {
                            // Find var_index for this variable in the constraint
                            int vidx = -1;
                            for (int k = 0; k < static_cast<int>(ec.vars.size()); ++k) {
                                if (ec.vars[k].id == vars[static_cast<size_t>(gj)].id &&
                                    ec.vars[k].key == vars[static_cast<size_t>(gj)].key) {
                                    vidx = k; break;
                                }
                            }
                            bool ok = false;
                            double grad = (vidx >= 0) ? analytical_gradient(ec, vidx, get, ok) : 0.0;
                            if (vidx >= 0 && ok && std::isfinite(grad)) {
#ifndef NDEBUG
                                verify_analytical_gradient(ec, vidx, grad, get, set,
                                    vars, gj, residual);
#endif
                                J(r, j) = grad;
                            } else if (vidx < 0) {
                                J(r, j) = 0.0; // variable not in this constraint
                            } else {
                                need_numerical = true; // will fill in below
                            }
                        } else {
                            need_numerical = true;
                        }
                    }
                    if (need_numerical) {
                        double xj = x[gj];
                        set(vars[static_cast<size_t>(gj)], xj + eps);
                        for (size_t r = 0; r < cm; ++r) {
                            const auto& ec = expanded[static_cast<size_t>(ci[r])];
                            if (!has_analytical_gradient(ec)) {
                                bool okc=false;
                                J(r, j) = (residual(ec, okc) - rvec[r]) / eps;
                            }
                        }
                        set(vars[static_cast<size_t>(gj)], xj);
                    }
                }

                Eigen::MatrixXd A = J.transpose() * J;
                A.diagonal().array() += lambda;
                Eigen::VectorXd delta = A.ldlt().solve(-J.transpose() * rvec);

                // Apply delta to global x
                Eigen::VectorXd newX = x;
                for (size_t j = 0; j < cn; ++j) newX[vi[j]] += delta[j];
                write_x(newX);
                double newNorm = comp_eval_norm();

                if (newNorm < prev) {
                    x = newX; prev = newNorm;
                    lambda = std::max(1e-10, lambda * 0.1);
                } else {
                    write_x(x);
                    lambda *= 10.0;
                }
                if (prev <= tol_) break;
            }
            if (prev > tol_) all_ok = false;
        }

        write_x(x);
        double finalErr = eval_norm();
        out.ok = all_ok && (finalErr <= tol_);
        out.iterations = total_iters;
        out.finalError = finalErr;
        out.message = (out.ok ? "Converged (partitioned LM)" : "Stopped (max iters or stagnation)");
        return out;
    }
};

class DogLegSolver : public ISolver {
    int maxIters_ = 80;
    double tol_ = 1e-6;
public:
    void setMaxIterations(int iters) override { maxIters_ = iters; }
    void setTolerance(double tol) override { tol_ = tol; }

    SolveResult solve(std::vector<ConstraintSpec>& constraints) override {
        SolveResult r;
        const auto report = validate_constraints(constraints, nullptr);
        r.diagnostics = report.diagnostics;
        r.redundancyGroups = report.redundancyGroups;
        r.analysis = report.analysis;
        r.ok = r.diagnostics.empty();
        r.iterations = 0;
        r.finalError = 0.0;
        r.message = r.ok ? "Converged (no-op stub)" : "Constraint validation failed";
        return r;
    }

    SolveResult solveWithBindings(std::vector<ConstraintSpec>& constraints, const GetVar& get, const SetVar& set) override {
        // Reuse MinimalSolver's validation and residual setup
        SolveResult out;
        const auto report = validate_constraints(constraints, &get);
        out.diagnostics = report.diagnostics;
        out.redundancyGroups = report.redundancyGroups;
        out.analysis = report.analysis;
        if (!out.diagnostics.empty()) {
            out.ok = false;
            out.iterations = 0;
            out.finalError = 0.0;
            out.message = "Constraint validation failed";
            return out;
        }

        // Residual via shared function (deduplicated in P3 tech debt cleanup)
        auto residual = [&](const ConstraintSpec& c, bool& ok)->double {
            return residual_for_constraint(c, get, ok);
        };

        // Collect unique variables
        std::vector<VarRef> vars;
        auto add_unique = [&](const VarRef& v){ for (auto& u : vars) if (u.id==v.id && u.key==v.key) return; vars.push_back(v); };
        for (const auto& c : constraints) for (const auto& v : c.vars) add_unique(v);

        const size_t n = vars.size();
        const size_t m = constraints.size();
        if (n == 0 || m == 0) {
            out.ok = true; out.iterations = 0; out.finalError = 0.0;
            out.analysis.jacobianColumnCount = static_cast<int>(n);
            return out;
        }

        Eigen::VectorXd x(n);
        for (size_t j=0;j<n;j++){ bool okv=false; x[j]=get(vars[j], okv); }

        auto write_x = [&](const Eigen::VectorXd& currX){ for (size_t j=0;j<n;j++) set(vars[j], currX[j]); };

        populate_jacobian_analysis(constraints, vars, set, x, residual,
            out.analysis, &out.structuralGroups, &out.redundancySubsets);
        collect_conflict_groups(out.structuralGroups, out);
        collect_problematic_constraint_indices(out.structuralGroups, out);
        out.primaryRedundancyBasisConstraintIndices.clear();
        out.primaryRedundantConstraintIndices.clear();
        out.smallestRedundancyBasisConstraintIndices.clear();
        out.smallestRedundantConstraintIndices.clear();
        out.analysis.primaryRedundancyVariableKeys.clear();
        out.analysis.smallestRedundancyVariableKeys.clear();
        if (!out.redundancySubsets.empty()) {
            out.primaryRedundancyBasisConstraintIndices = out.redundancySubsets.front().basisConstraintIndices;
            out.primaryRedundantConstraintIndices = out.redundancySubsets.front().redundantConstraintIndices;
            out.analysis.primaryRedundancyVariableKeys = out.redundancySubsets.front().variableKeys;
            const auto smallest_it = std::find_if(
                out.redundancySubsets.begin(), out.redundancySubsets.end(),
                [&](const ConstraintRedundancySubset& subset) {
                    return subset.anchorConstraintIndex == out.analysis.smallestRedundancySubsetAnchorConstraintIndex;
                });
            if (smallest_it != out.redundancySubsets.end()) {
                out.smallestRedundancyBasisConstraintIndices = smallest_it->basisConstraintIndices;
                out.smallestRedundantConstraintIndices = smallest_it->redundantConstraintIndices;
                out.analysis.smallestRedundancyVariableKeys = smallest_it->variableKeys;
            }
        }

        auto eval_residuals = [&](Eigen::VectorXd& rvec) {
            for (size_t i=0; i<m; ++i) { bool okc=false; rvec[i] = residual(constraints[i], okc); }
        };
        auto eval_norm = [&]() {
            double s=0.0;
            for (const auto& c: constraints){ bool okc=false; double rr=residual(c, okc); s += rr*rr; }
            return std::sqrt(s);
        };

        write_x(x);
        double trustRadius = 1.0;
        const double trustMax = 100.0;
        const double trustMin = 1e-12;
        int it = 0;

        for (; it < maxIters_; ++it) {
            write_x(x);
            double currentNorm = eval_norm();
            if (currentNorm <= tol_) break;

            // Residual vector
            Eigen::VectorXd rvec(m);
            eval_residuals(rvec);

            // Jacobian — analytical where supported, numerical fallback
            Eigen::MatrixXd J(m, n);
            const double eps = 1e-7;
            for (size_t j=0; j<n; ++j) {
                bool need_numerical = false;
                for (size_t i=0; i<m; ++i) {
                    const auto& cc = constraints[i];
                    if (has_analytical_gradient(cc)) {
                        int vidx = -1;
                        for (int k = 0; k < static_cast<int>(cc.vars.size()); ++k) {
                            if (cc.vars[k].id == vars[j].id && cc.vars[k].key == vars[j].key) {
                                vidx = k; break;
                            }
                        }
                        bool ok = false;
                        double grad = (vidx >= 0) ? analytical_gradient(cc, vidx, get, ok) : 0.0;
                        if (vidx >= 0 && ok && std::isfinite(grad)) {
#ifndef NDEBUG
                            verify_analytical_gradient(cc, vidx, grad, get, set,
                                vars, static_cast<int>(j), residual);
#endif
                            J(i, j) = grad;
                        } else if (vidx < 0) {
                            J(i, j) = 0.0;
                        } else {
                            need_numerical = true;
                        }
                    } else {
                        need_numerical = true;
                    }
                }
                if (need_numerical) {
                    double xj = x[j];
                    set(vars[j], xj + eps);
                    for (size_t i=0; i<m; ++i) {
                        if (!has_analytical_gradient(constraints[i])) {
                            bool okc=false;
                            J(i, j) = (residual(constraints[i], okc) - rvec[i]) / eps;
                        }
                    }
                    set(vars[j], xj);
                }
            }

            // Gradient g = J^T * r
            Eigen::VectorXd g = J.transpose() * rvec;

            // Gauss-Newton step: solve J^T J delta_gn = -J^T r
            Eigen::MatrixXd JtJ = J.transpose() * J;
            Eigen::VectorXd delta_gn = JtJ.colPivHouseholderQr().solve(-g);

            // Steepest descent step: delta_sd = -alpha * g where alpha = ||g||^2 / ||J*g||^2
            Eigen::VectorXd Jg = J * g;
            double g_norm2 = g.squaredNorm();
            double Jg_norm2 = Jg.squaredNorm();
            double alpha = (Jg_norm2 > 1e-30) ? (g_norm2 / Jg_norm2) : 1.0;
            Eigen::VectorXd delta_sd = -alpha * g;

            // DogLeg interpolation
            Eigen::VectorXd delta;
            double gn_norm = delta_gn.norm();
            double sd_norm = delta_sd.norm();

            if (gn_norm <= trustRadius) {
                // Gauss-Newton step is within trust region
                delta = delta_gn;
            } else if (sd_norm >= trustRadius) {
                // Steepest descent step is outside trust region; scale it
                delta = (trustRadius / sd_norm) * delta_sd;
            } else {
                // Interpolate between steepest descent and Gauss-Newton
                Eigen::VectorXd diff = delta_gn - delta_sd;
                double a_coeff = diff.squaredNorm();
                double b_coeff = 2.0 * delta_sd.dot(diff);
                double c_coeff = delta_sd.squaredNorm() - trustRadius * trustRadius;
                double discriminant = b_coeff * b_coeff - 4.0 * a_coeff * c_coeff;
                double beta = (-b_coeff + std::sqrt(std::max(0.0, discriminant))) / (2.0 * a_coeff);
                beta = std::max(0.0, std::min(1.0, beta));
                delta = delta_sd + beta * diff;
            }

            // Trial step
            Eigen::VectorXd newX = x + delta;
            write_x(newX);
            double newNorm = eval_norm();

            // Predicted reduction
            Eigen::VectorXd predicted_r = rvec + J * delta;
            double predicted_norm = predicted_r.norm();
            double actual_reduction = currentNorm * currentNorm - newNorm * newNorm;
            double predicted_reduction = currentNorm * currentNorm - predicted_norm * predicted_norm;

            double rho = (predicted_reduction > 1e-30) ? (actual_reduction / predicted_reduction) : 0.0;

            if (rho > 0.0 && newNorm < currentNorm) {
                // Accept step
                x = newX;
            } else {
                // Reject step
                write_x(x);
            }

            // Update trust radius
            if (rho < 0.25) {
                trustRadius = std::max(trustMin, trustRadius * 0.25);
            } else if (rho > 0.75) {
                trustRadius = std::min(trustMax, trustRadius * 2.0);
            }

            if (newNorm <= tol_) break;
        }

        write_x(x);
        double finalErr = eval_norm();
        out.ok = (finalErr <= tol_);
        out.iterations = it;
        out.finalError = finalErr;

        // If DogLeg didn't converge, fallback to LM
        if (!out.ok) {
            // Reset to current x and try LM
            double lambda = 1e-3;
            double prev = finalErr;
            for (int lmIt = 0; lmIt < maxIters_; ++lmIt) {
                Eigen::VectorXd rvec(m);
                eval_residuals(rvec);
                Eigen::MatrixXd J(m, n);
                const double eps2 = 1e-6;
                for (size_t j=0; j<n; ++j) {
                    bool need_numerical = false;
                    for (size_t i=0; i<m; ++i) {
                        const auto& cc = constraints[i];
                        if (has_analytical_gradient(cc)) {
                            int vidx = -1;
                            for (int k = 0; k < static_cast<int>(cc.vars.size()); ++k) {
                                if (cc.vars[k].id == vars[j].id && cc.vars[k].key == vars[j].key) {
                                    vidx = k; break;
                                }
                            }
                            bool ok = false;
                            double grad = (vidx >= 0) ? analytical_gradient(cc, vidx, get, ok) : 0.0;
                            if (vidx >= 0 && ok && std::isfinite(grad)) {
                                J(i, j) = grad;
                            } else if (vidx < 0) {
                                J(i, j) = 0.0;
                            } else {
                                need_numerical = true;
                            }
                        } else {
                            need_numerical = true;
                        }
                    }
                    if (need_numerical) {
                        double xj = x[j];
                        set(vars[j], xj + eps2);
                        for (size_t i=0; i<m; ++i) {
                            if (!has_analytical_gradient(constraints[i])) {
                                bool okc=false;
                                J(i, j) = (residual(constraints[i], okc) - rvec[i]) / eps2;
                            }
                        }
                        set(vars[j], xj);
                    }
                }
                Eigen::MatrixXd A = J.transpose() * J;
                A.diagonal().array() += lambda;
                Eigen::VectorXd b = -J.transpose() * rvec;
                Eigen::VectorXd delta2 = A.ldlt().solve(b);
                Eigen::VectorXd newX2 = x + delta2;
                write_x(newX2);
                double newNorm2 = eval_norm();
                if (newNorm2 < prev) {
                    x = newX2; prev = newNorm2;
                    lambda = std::max(1e-10, lambda * 0.1);
                } else {
                    write_x(x);
                    lambda *= 10.0;
                }
                it++;
                if (prev <= tol_) break;
            }
            write_x(x);
            finalErr = eval_norm();
            out.ok = (finalErr <= tol_);
            out.iterations = it;
            out.finalError = finalErr;
        }

        out.message = out.ok ? "Converged (DogLeg+LM)" : "Stopped (max iters)";
        return out;
    }
};

// BFGS quasi-Newton solver (P3.1)
// Minimizes F(x) = 0.5 * ||r(x)||^2 using L-BFGS-style updates.
// Does not require explicit Jacobian — uses gradient (J^T r) via finite differences.
class BFGSSolver : public ISolver {
    int maxIters_ = 100;
    double tol_ = 1e-6;
public:
    void setMaxIterations(int iters) override { maxIters_ = iters; }
    void setTolerance(double tol) override { tol_ = tol; }

    SolveResult solve(std::vector<ConstraintSpec>& constraints) override {
        SolveResult r;
        const auto report = validate_constraints(constraints, nullptr);
        r.diagnostics = report.diagnostics;
        r.redundancyGroups = report.redundancyGroups;
        r.analysis = report.analysis;
        r.ok = r.diagnostics.empty();
        r.message = r.ok ? "Converged (no-op stub)" : "Constraint validation failed";
        return r;
    }

    SolveResult solveWithBindings(std::vector<ConstraintSpec>& constraints, const GetVar& get, const SetVar& set) override {
        SolveResult out;
        const auto report = validate_constraints(constraints, &get);
        out.diagnostics = report.diagnostics;
        out.redundancyGroups = report.redundancyGroups;
        out.analysis = report.analysis;
        if (!out.diagnostics.empty()) {
            out.ok = false; out.message = "Constraint validation failed"; return out;
        }

        // Reuse the same residual lambda as MinimalSolver (shared code via residual_for_constraint)
        auto residual = [&](const ConstraintSpec& c, bool& ok) -> double {
            return residual_for_constraint(c, get, ok);
        };

        // Expand 2D constraints
        std::vector<ConstraintSpec> expanded;
        for (const auto& c : constraints) {
            if (needs_xy_expansion(c.type)) {
                ConstraintSpec cx = c; cx.value = 0.0;
                ConstraintSpec cy = c; cy.value = 1.0;
                expanded.push_back(cx); expanded.push_back(cy);
            } else {
                expanded.push_back(c);
            }
        }

        std::vector<VarRef> vars;
        auto add_unique = [&](const VarRef& v){ for (auto& u : vars) if (u.id==v.id && u.key==v.key) return; vars.push_back(v); };
        for (const auto& c : expanded) for (const auto& v : c.vars) add_unique(v);

        const int n = static_cast<int>(vars.size());
        const int m = static_cast<int>(expanded.size());
        if (n == 0 || m == 0) { out.ok = true; return out; }

        Eigen::VectorXd x(n);
        for (int j = 0; j < n; ++j) { bool okv = false; x[j] = get(vars[j], okv); }
        auto write_x = [&](const Eigen::VectorXd& v) { for (int j = 0; j < n; ++j) set(vars[j], v[j]); };

        // Objective: F(x) = 0.5 * sum(r_i^2)
        auto eval_F = [&](const Eigen::VectorXd& xv) -> double {
            write_x(xv);
            double f = 0.0;
            for (const auto& c : expanded) { bool okc = false; double r = residual(c, okc); f += r * r; }
            return 0.5 * f;
        };

        // Gradient: analytical J^T*r where supported, numerical fallback otherwise
        auto eval_grad = [&](const Eigen::VectorXd& xv, double fx) -> Eigen::VectorXd {
            write_x(xv);
            return compute_objective_gradient(expanded, vars, xv, fx, get, set, residual);
        };

        // Initialize inverse Hessian approximation as identity
        Eigen::MatrixXd H = Eigen::MatrixXd::Identity(n, n);
        double fx = eval_F(x);
        Eigen::VectorXd grad = eval_grad(x, fx);
        int it = 0;

        for (; it < maxIters_; ++it) {
            if (std::sqrt(2.0 * fx) <= tol_) break;

            // Search direction
            Eigen::VectorXd p = -H * grad;

            // Backtracking line search (Armijo condition)
            double alpha = 1.0;
            const double c1 = 1e-4;
            double gp = grad.dot(p);
            for (int ls = 0; ls < 20; ++ls) {
                Eigen::VectorXd x_new = x + alpha * p;
                double fx_new = eval_F(x_new);
                if (fx_new <= fx + c1 * alpha * gp) break;
                alpha *= 0.5;
            }

            Eigen::VectorXd x_new = x + alpha * p;
            double fx_new = eval_F(x_new);
            Eigen::VectorXd grad_new = eval_grad(x_new, fx_new);

            // BFGS update
            Eigen::VectorXd s = x_new - x;
            Eigen::VectorXd y = grad_new - grad;
            double ys = y.dot(s);

            if (ys > 1e-10) {
                // Sherman-Morrison-Woodbury formula for H update
                Eigen::MatrixXd I = Eigen::MatrixXd::Identity(n, n);
                Eigen::MatrixXd rho_sy = (s * y.transpose()) / ys;
                H = (I - rho_sy) * H * (I - rho_sy.transpose()) + (s * s.transpose()) / ys;
            }

            x = x_new;
            fx = fx_new;
            grad = grad_new;
        }

        write_x(x);
        double finalErr = std::sqrt(2.0 * fx);
        out.ok = (finalErr <= tol_);
        out.iterations = it;
        out.finalError = finalErr;
        out.message = out.ok ? "Converged (BFGS)" : "Stopped (BFGS max iters)";
        return out;
    }
};

ISolver* createMinimalSolver() { return new MinimalSolver(); }

ISolver* createSolver(SolverAlgorithm algo) {
    switch (algo) {
        case SolverAlgorithm::LM: return new MinimalSolver();
        case SolverAlgorithm::DogLeg: return new DogLegSolver();
        case SolverAlgorithm::BFGS: return new BFGSSolver();
        default: return new DogLegSolver();
    }
}

} // namespace core
