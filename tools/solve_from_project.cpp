#include <iostream>
#include <fstream>
#include <string>
#include <unordered_map>
#include <vector>
#include <cmath>

#include "third_party/json.hpp"
#include "core/solver.hpp"

using json = nlohmann::json;
using namespace core;

struct VarStore {
    std::unordered_map<std::string,double> vars;
    static std::string key(const VarRef& v){ return v.id + "." + v.key; }
};

static void usage(){ std::cerr << "Usage: solve_from_project [--json] <project.json>\n"; }

static json make_action_panel_json(const std::string& label,
                                   const std::string& hint,
                                   const std::string& tag,
                                   const std::string& summary,
                                   const std::string& explanation,
                                   int anchor_constraint_index,
                                   int priority_score,
                                   const std::vector<std::string>& variable_keys,
                                   const std::vector<std::string>& free_variable_keys,
                                   const std::vector<std::string>& selection_policy) {
    return {
        {"label", label},
        {"hint", hint},
        {"tag", tag},
        {"summary", summary},
        {"selection_explanation", explanation},
        {"anchor_constraint_index", anchor_constraint_index},
        {"priority_score", priority_score},
        {"variable_keys", variable_keys},
        {"free_variable_keys", free_variable_keys},
        {"selection_policy", selection_policy},
    };
}

static std::string action_panel_severity(const std::string& category,
                                         const std::string& scope) {
    if (category == "conflict") {
        return scope == "primary" ? "warning" : "notice";
    }
    if (category == "redundancy") {
        return scope == "primary" ? "info" : "notice";
    }
    return "neutral";
}

static int action_panel_display_order(const std::string& category,
                                      const std::string& scope) {
    if (category == "conflict" && scope == "primary") return 0;
    if (category == "conflict" && scope == "smallest") return 1;
    if (category == "redundancy" && scope == "primary") return 2;
    if (category == "redundancy" && scope == "smallest") return 3;
    return 99;
}

static int conflict_priority_total(const ConstraintConflictPriorityBreakdownSummary& breakdown) {
    return breakdown.stateBias
        + breakdown.redundantConstraintContribution
        + breakdown.constraintCountContribution
        + breakdown.freeVariableContribution
        + breakdown.dofContribution;
}

static int redundancy_priority_total(const ConstraintRedundancyPriorityBreakdownSummary& breakdown) {
    return breakdown.redundantConstraintContribution + breakdown.witnessPenalty;
}

static std::vector<int> concat_constraint_indices(const std::vector<int>& basis,
                                                  const std::vector<int>& redundant) {
    std::vector<int> out = basis;
    out.insert(out.end(), redundant.begin(), redundant.end());
    return out;
}

static json make_action_panel_item_json(const std::string& id,
                                        const std::string& category,
                                        const std::string& scope,
                                        const json& panel,
                                        const std::vector<int>& constraint_indices,
                                        const std::vector<int>& basis_constraint_indices,
                                        const std::vector<int>& redundant_constraint_indices) {
    json item = panel;
    item["id"] = id;
    item["category"] = category;
    item["scope"] = scope;
    item["enabled"] = panel.value("anchor_constraint_index", -1) >= 0 && !panel.value("label", "").empty();
    item["constraint_indices"] = constraint_indices;
    item["basis_constraint_indices"] = basis_constraint_indices;
    item["redundant_constraint_indices"] = redundant_constraint_indices;
    item["ui"] = {
        {"title", panel.value("label", "")},
        {"subtitle", panel.value("summary", "")},
        {"description", panel.value("hint", "")},
        {"badge_label", category == "conflict" ? "Conflict" : "Redundancy"},
        {"severity", action_panel_severity(category, scope)},
        {"cta_label", panel.value("label", "")},
        {"recommended", scope == "primary"},
        {"display_order", action_panel_display_order(category, scope)},
    };
    return item;
}

int main(int argc, char** argv){
    bool emit_json = false;
    std::string input_path;
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--json") {
            emit_json = true;
            continue;
        }
        if (!input_path.empty()) { usage(); return 2; }
        input_path = arg;
    }
    if (input_path.empty()) { usage(); return 2; }

    std::ifstream f(input_path);
    if (!f.is_open()) { std::cerr << "Open failed: " << input_path << "\n"; return 2; }
    json proj; f >> proj;

    VarStore store;
    std::vector<ConstraintSpec> specs;

    // Map points
    if (proj.contains("scene") && proj["scene"].contains("entities")){
        for (const auto& e : proj["scene"]["entities"]) {
            std::string id = e.value("id", "");
            std::string type = e.value("type", "");
            if (type == "point") {
                auto p = e["params"];
                store.vars[id+".x"] = p.value("x", 0.0);
                store.vars[id+".y"] = p.value("y", 0.0);
            }
        }
    }

    // Map constraints
    if (proj.contains("scene") && proj["scene"].contains("constraints")){
        for (const auto& c : proj["scene"]["constraints"]) {
            ConstraintSpec s; s.type = c.value("type", "");
            if (c.contains("value") && !c["value"].is_null()) s.value = c["value"].get<double>();
            if (c.contains("refs") && c["refs"].is_array()){
                for (const auto& r : c["refs"]) {
                    // Expect refs as strings like "p1.x" or "p2.y"
                    if (r.is_string()) {
                        std::string sr = r.get<std::string>();
                        auto dot = sr.find('.');
                        if (dot!=std::string::npos){
                            s.vars.push_back(VarRef{ sr.substr(0,dot), sr.substr(dot+1) });
                        }
                    }
                }
            }
            specs.push_back(std::move(s));
        }
    }

    auto get = [&](const VarRef& v, bool& ok)->double{
        auto it = store.vars.find(VarStore::key(v));
        if (it == store.vars.end()) { ok=false; return 0.0; }
        ok=true; return it->second;
    };
    auto set = [&](const VarRef& v, double val){ store.vars[VarStore::key(v)] = val; };

    ISolver* solver = createMinimalSolver();
    solver->setMaxIterations(100);
    solver->setTolerance(1e-6);
    SolveResult res = solver->solveWithBindings(specs, get, set);
    if (emit_json) {
        const json primary_conflict_action = make_action_panel_json(
            res.analysis.primaryConflictActionLabel,
            res.analysis.primaryConflictActionHint,
            res.analysis.primaryConflictSelectionTag,
            res.analysis.primaryConflictSelectionSummary,
            res.analysis.primaryConflictSelectionExplanation,
            res.analysis.primaryConflictAnchorConstraintIndex,
            res.analysis.primaryConflictPriorityScore,
            res.analysis.primaryConflictVariableKeys,
            res.analysis.primaryConflictFreeVariableKeys,
            res.analysis.primaryConflictSelectionPolicy);
        const json smallest_conflict_action = make_action_panel_json(
            res.analysis.smallestConflictActionLabel,
            res.analysis.smallestConflictActionHint,
            res.analysis.smallestConflictSelectionTag,
            res.analysis.smallestConflictSelectionSummary,
            res.analysis.smallestConflictSelectionExplanation,
            res.analysis.smallestConflictGroupAnchorConstraintIndex,
            conflict_priority_total(res.analysis.smallestConflictPriorityBreakdown),
            res.analysis.smallestConflictVariableKeys,
            res.analysis.smallestConflictFreeVariableKeys,
            res.analysis.smallestConflictSelectionPolicy);
        const json primary_redundancy_action = make_action_panel_json(
            res.analysis.primaryRedundancyActionLabel,
            res.analysis.primaryRedundancyActionHint,
            res.analysis.primaryRedundancySelectionTag,
            res.analysis.primaryRedundancySelectionSummary,
            res.analysis.primaryRedundancySelectionExplanation,
            res.analysis.primaryRedundancySubsetAnchorConstraintIndex,
            res.analysis.primaryRedundancyPriorityScore,
            res.analysis.primaryRedundancyVariableKeys,
            {},
            res.analysis.primaryRedundancySelectionPolicy);
        const json smallest_redundancy_action = make_action_panel_json(
            res.analysis.smallestRedundancyActionLabel,
            res.analysis.smallestRedundancyActionHint,
            res.analysis.smallestRedundancySelectionTag,
            res.analysis.smallestRedundancySelectionSummary,
            res.analysis.smallestRedundancySelectionExplanation,
            res.analysis.smallestRedundancySubsetAnchorConstraintIndex,
            redundancy_priority_total(res.analysis.smallestRedundancyPriorityBreakdown),
            res.analysis.smallestRedundancyVariableKeys,
            {},
            res.analysis.smallestRedundancySelectionPolicy);
        json action_panels = json::array({
            make_action_panel_item_json(
                "primary_conflict",
                "conflict",
                "primary",
                primary_conflict_action,
                res.primaryConflictConstraintIndices,
                {},
                {}),
            make_action_panel_item_json(
                "smallest_conflict",
                "conflict",
                "smallest",
                smallest_conflict_action,
                res.smallestConflictConstraintIndices,
                {},
                {}),
            make_action_panel_item_json(
                "primary_redundancy",
                "redundancy",
                "primary",
                primary_redundancy_action,
                concat_constraint_indices(
                    res.primaryRedundancyBasisConstraintIndices,
                    res.primaryRedundantConstraintIndices),
                res.primaryRedundancyBasisConstraintIndices,
                res.primaryRedundantConstraintIndices),
            make_action_panel_item_json(
                "smallest_redundancy",
                "redundancy",
                "smallest",
                smallest_redundancy_action,
                concat_constraint_indices(
                    res.smallestRedundancyBasisConstraintIndices,
                    res.smallestRedundantConstraintIndices),
                res.smallestRedundancyBasisConstraintIndices,
                res.smallestRedundantConstraintIndices),
        });
        json out = {
            {"ok", res.ok},
            {"iterations", res.iterations},
            {"final_error", res.finalError},
            {"message", res.message},
        };
        out["analysis"] = {
            {"constraint_count", res.analysis.constraintCount},
            {"referenced_variable_count", res.analysis.referencedVariableCount},
            {"bound_variable_count", res.analysis.boundVariableCount},
            {"well_formed_constraint_count", res.analysis.wellFormedConstraintCount},
            {"unique_constraint_count", res.analysis.uniqueConstraintCount},
            {"duplicate_constraint_count", res.analysis.duplicateConstraintCount},
            {"duplicate_constraint_group_count", res.analysis.duplicateConstraintGroupCount},
            {"largest_duplicate_constraint_group_size", res.analysis.largestDuplicateConstraintGroupSize},
            {"structural_diagnostic_count", res.analysis.structuralDiagnosticCount},
            {"binding_diagnostic_count", res.analysis.bindingDiagnosticCount},
            {"evaluable_constraint_count", res.analysis.evaluableConstraintCount},
            {"jacobian_row_count", res.analysis.jacobianRowCount},
            {"jacobian_column_count", res.analysis.jacobianColumnCount},
            {"jacobian_rank", res.analysis.jacobianRank},
            {"dof_estimate", res.analysis.dofEstimate},
            {"redundant_constraint_estimate", res.analysis.redundantConstraintEstimate},
            {"structural_state", constraintStructuralStateName(res.analysis.structuralState)},
            {"structural_group_count", res.analysis.structuralGroupCount},
            {"unknown_group_count", res.analysis.unknownGroupCount},
            {"underconstrained_group_count", res.analysis.underconstrainedGroupCount},
            {"well_constrained_group_count", res.analysis.wellConstrainedGroupCount},
            {"overconstrained_group_count", res.analysis.overconstrainedGroupCount},
            {"mixed_group_count", res.analysis.mixedGroupCount},
            {"conflict_group_count", res.analysis.conflictGroupCount},
            {"largest_conflict_group_size", res.analysis.largestConflictGroupSize},
            {"redundancy_subset_count", res.analysis.redundancySubsetCount},
            {"redundant_constraint_candidate_count", res.analysis.redundantConstraintCandidateCount},
            {"free_variable_candidate_count", res.analysis.freeVariableCandidateCount},
            {"problematic_constraint_count", res.analysis.problematicConstraintCount},
            {"primary_conflict_anchor_constraint_index", res.analysis.primaryConflictAnchorConstraintIndex},
            {"primary_conflict_priority_score", res.analysis.primaryConflictPriorityScore},
            {"primary_conflict_priority_breakdown", {
                {"state_bias", res.analysis.primaryConflictPriorityBreakdown.stateBias},
                {"redundant_constraint_contribution", res.analysis.primaryConflictPriorityBreakdown.redundantConstraintContribution},
                {"constraint_count_contribution", res.analysis.primaryConflictPriorityBreakdown.constraintCountContribution},
                {"free_variable_contribution", res.analysis.primaryConflictPriorityBreakdown.freeVariableContribution},
                {"dof_contribution", res.analysis.primaryConflictPriorityBreakdown.dofContribution}
            }},
            {"primary_conflict_selection_explanation", res.analysis.primaryConflictSelectionExplanation},
            {"primary_conflict_selection_tag", res.analysis.primaryConflictSelectionTag},
            {"primary_conflict_selection_summary", res.analysis.primaryConflictSelectionSummary},
            {"primary_conflict_action_label", res.analysis.primaryConflictActionLabel},
            {"primary_conflict_action_hint", res.analysis.primaryConflictActionHint},
            {"primary_conflict_action", primary_conflict_action},
            {"primary_conflict_variable_keys", res.analysis.primaryConflictVariableKeys},
            {"primary_conflict_free_variable_keys", res.analysis.primaryConflictFreeVariableKeys},
            {"primary_conflict_selection_policy", res.analysis.primaryConflictSelectionPolicy},
            {"smallest_conflict_group_anchor_constraint_index", res.analysis.smallestConflictGroupAnchorConstraintIndex},
            {"smallest_conflict_group_size", res.analysis.smallestConflictGroupSize},
            {"smallest_conflict_priority_breakdown", {
                {"state_bias", res.analysis.smallestConflictPriorityBreakdown.stateBias},
                {"redundant_constraint_contribution", res.analysis.smallestConflictPriorityBreakdown.redundantConstraintContribution},
                {"constraint_count_contribution", res.analysis.smallestConflictPriorityBreakdown.constraintCountContribution},
                {"free_variable_contribution", res.analysis.smallestConflictPriorityBreakdown.freeVariableContribution},
                {"dof_contribution", res.analysis.smallestConflictPriorityBreakdown.dofContribution}
            }},
            {"smallest_conflict_selection_explanation", res.analysis.smallestConflictSelectionExplanation},
            {"smallest_conflict_selection_tag", res.analysis.smallestConflictSelectionTag},
            {"smallest_conflict_selection_summary", res.analysis.smallestConflictSelectionSummary},
            {"smallest_conflict_action_label", res.analysis.smallestConflictActionLabel},
            {"smallest_conflict_action_hint", res.analysis.smallestConflictActionHint},
            {"smallest_conflict_action", smallest_conflict_action},
            {"smallest_conflict_variable_keys", res.analysis.smallestConflictVariableKeys},
            {"smallest_conflict_free_variable_keys", res.analysis.smallestConflictFreeVariableKeys},
            {"smallest_conflict_selection_policy", res.analysis.smallestConflictSelectionPolicy},
            {"primary_redundancy_subset_anchor_constraint_index", res.analysis.primaryRedundancySubsetAnchorConstraintIndex},
            {"primary_redundancy_priority_score", res.analysis.primaryRedundancyPriorityScore},
            {"primary_redundancy_priority_breakdown", {
                {"redundant_constraint_contribution", res.analysis.primaryRedundancyPriorityBreakdown.redundantConstraintContribution},
                {"witness_penalty", res.analysis.primaryRedundancyPriorityBreakdown.witnessPenalty}
            }},
            {"primary_redundancy_selection_explanation", res.analysis.primaryRedundancySelectionExplanation},
            {"primary_redundancy_selection_tag", res.analysis.primaryRedundancySelectionTag},
            {"primary_redundancy_selection_summary", res.analysis.primaryRedundancySelectionSummary},
            {"primary_redundancy_action_label", res.analysis.primaryRedundancyActionLabel},
            {"primary_redundancy_action_hint", res.analysis.primaryRedundancyActionHint},
            {"primary_redundancy_action", primary_redundancy_action},
            {"primary_redundancy_variable_keys", res.analysis.primaryRedundancyVariableKeys},
            {"primary_redundancy_selection_policy", res.analysis.primaryRedundancySelectionPolicy},
            {"smallest_redundancy_subset_anchor_constraint_index", res.analysis.smallestRedundancySubsetAnchorConstraintIndex},
            {"smallest_redundancy_witness_constraint_count", res.analysis.smallestRedundancyWitnessConstraintCount},
            {"smallest_redundancy_priority_breakdown", {
                {"redundant_constraint_contribution", res.analysis.smallestRedundancyPriorityBreakdown.redundantConstraintContribution},
                {"witness_penalty", res.analysis.smallestRedundancyPriorityBreakdown.witnessPenalty}
            }},
            {"smallest_redundancy_selection_explanation", res.analysis.smallestRedundancySelectionExplanation},
            {"smallest_redundancy_selection_tag", res.analysis.smallestRedundancySelectionTag},
            {"smallest_redundancy_selection_summary", res.analysis.smallestRedundancySelectionSummary},
            {"smallest_redundancy_action_label", res.analysis.smallestRedundancyActionLabel},
            {"smallest_redundancy_action_hint", res.analysis.smallestRedundancyActionHint},
            {"smallest_redundancy_action", smallest_redundancy_action},
            {"smallest_redundancy_variable_keys", res.analysis.smallestRedundancyVariableKeys},
            {"smallest_redundancy_selection_policy", res.analysis.smallestRedundancySelectionPolicy},
            {"action_panel_count", static_cast<int>(action_panels.size())},
            {"action_panels", action_panels},
        };
        out["structural_summary"] = {
            {"state", constraintStructuralStateName(res.analysis.structuralState)},
            {"dof_estimate", res.analysis.dofEstimate},
            {"redundant_constraint_estimate", res.analysis.redundantConstraintEstimate},
            {"duplicate_constraint_group_count", res.analysis.duplicateConstraintGroupCount},
            {"largest_duplicate_constraint_group_size", res.analysis.largestDuplicateConstraintGroupSize},
            {"structural_group_count", res.analysis.structuralGroupCount},
            {"underconstrained_group_count", res.analysis.underconstrainedGroupCount},
            {"well_constrained_group_count", res.analysis.wellConstrainedGroupCount},
            {"overconstrained_group_count", res.analysis.overconstrainedGroupCount},
            {"mixed_group_count", res.analysis.mixedGroupCount},
            {"conflict_group_count", res.analysis.conflictGroupCount},
            {"largest_conflict_group_size", res.analysis.largestConflictGroupSize},
            {"redundancy_subset_count", res.analysis.redundancySubsetCount},
            {"redundant_constraint_candidate_count", res.analysis.redundantConstraintCandidateCount},
            {"free_variable_candidate_count", res.analysis.freeVariableCandidateCount},
            {"problematic_constraint_count", res.analysis.problematicConstraintCount},
            {"primary_conflict_anchor_constraint_index", res.analysis.primaryConflictAnchorConstraintIndex},
            {"primary_conflict_priority_score", res.analysis.primaryConflictPriorityScore},
            {"primary_conflict_priority_breakdown", {
                {"state_bias", res.analysis.primaryConflictPriorityBreakdown.stateBias},
                {"redundant_constraint_contribution", res.analysis.primaryConflictPriorityBreakdown.redundantConstraintContribution},
                {"constraint_count_contribution", res.analysis.primaryConflictPriorityBreakdown.constraintCountContribution},
                {"free_variable_contribution", res.analysis.primaryConflictPriorityBreakdown.freeVariableContribution},
                {"dof_contribution", res.analysis.primaryConflictPriorityBreakdown.dofContribution}
            }},
            {"primary_conflict_selection_explanation", res.analysis.primaryConflictSelectionExplanation},
            {"primary_conflict_selection_tag", res.analysis.primaryConflictSelectionTag},
            {"primary_conflict_selection_summary", res.analysis.primaryConflictSelectionSummary},
            {"primary_conflict_action_label", res.analysis.primaryConflictActionLabel},
            {"primary_conflict_action_hint", res.analysis.primaryConflictActionHint},
            {"primary_conflict_action", primary_conflict_action},
            {"primary_conflict_variable_keys", res.analysis.primaryConflictVariableKeys},
            {"primary_conflict_free_variable_keys", res.analysis.primaryConflictFreeVariableKeys},
            {"primary_conflict_selection_policy", res.analysis.primaryConflictSelectionPolicy},
            {"smallest_conflict_group_anchor_constraint_index", res.analysis.smallestConflictGroupAnchorConstraintIndex},
            {"smallest_conflict_group_size", res.analysis.smallestConflictGroupSize},
            {"smallest_conflict_priority_breakdown", {
                {"state_bias", res.analysis.smallestConflictPriorityBreakdown.stateBias},
                {"redundant_constraint_contribution", res.analysis.smallestConflictPriorityBreakdown.redundantConstraintContribution},
                {"constraint_count_contribution", res.analysis.smallestConflictPriorityBreakdown.constraintCountContribution},
                {"free_variable_contribution", res.analysis.smallestConflictPriorityBreakdown.freeVariableContribution},
                {"dof_contribution", res.analysis.smallestConflictPriorityBreakdown.dofContribution}
            }},
            {"smallest_conflict_selection_explanation", res.analysis.smallestConflictSelectionExplanation},
            {"smallest_conflict_selection_tag", res.analysis.smallestConflictSelectionTag},
            {"smallest_conflict_selection_summary", res.analysis.smallestConflictSelectionSummary},
            {"smallest_conflict_action_label", res.analysis.smallestConflictActionLabel},
            {"smallest_conflict_action_hint", res.analysis.smallestConflictActionHint},
            {"smallest_conflict_action", smallest_conflict_action},
            {"smallest_conflict_variable_keys", res.analysis.smallestConflictVariableKeys},
            {"smallest_conflict_free_variable_keys", res.analysis.smallestConflictFreeVariableKeys},
            {"smallest_conflict_selection_policy", res.analysis.smallestConflictSelectionPolicy},
            {"primary_redundancy_subset_anchor_constraint_index", res.analysis.primaryRedundancySubsetAnchorConstraintIndex},
            {"primary_redundancy_priority_score", res.analysis.primaryRedundancyPriorityScore},
            {"primary_redundancy_priority_breakdown", {
                {"redundant_constraint_contribution", res.analysis.primaryRedundancyPriorityBreakdown.redundantConstraintContribution},
                {"witness_penalty", res.analysis.primaryRedundancyPriorityBreakdown.witnessPenalty}
            }},
            {"primary_redundancy_selection_explanation", res.analysis.primaryRedundancySelectionExplanation},
            {"primary_redundancy_selection_tag", res.analysis.primaryRedundancySelectionTag},
            {"primary_redundancy_selection_summary", res.analysis.primaryRedundancySelectionSummary},
            {"primary_redundancy_action_label", res.analysis.primaryRedundancyActionLabel},
            {"primary_redundancy_action_hint", res.analysis.primaryRedundancyActionHint},
            {"primary_redundancy_action", primary_redundancy_action},
            {"primary_redundancy_variable_keys", res.analysis.primaryRedundancyVariableKeys},
            {"primary_redundancy_selection_policy", res.analysis.primaryRedundancySelectionPolicy},
            {"smallest_redundancy_subset_anchor_constraint_index", res.analysis.smallestRedundancySubsetAnchorConstraintIndex},
            {"smallest_redundancy_witness_constraint_count", res.analysis.smallestRedundancyWitnessConstraintCount},
            {"smallest_redundancy_priority_breakdown", {
                {"redundant_constraint_contribution", res.analysis.smallestRedundancyPriorityBreakdown.redundantConstraintContribution},
                {"witness_penalty", res.analysis.smallestRedundancyPriorityBreakdown.witnessPenalty}
            }},
            {"smallest_redundancy_selection_explanation", res.analysis.smallestRedundancySelectionExplanation},
            {"smallest_redundancy_selection_tag", res.analysis.smallestRedundancySelectionTag},
            {"smallest_redundancy_selection_summary", res.analysis.smallestRedundancySelectionSummary},
            {"smallest_redundancy_action_label", res.analysis.smallestRedundancyActionLabel},
            {"smallest_redundancy_action_hint", res.analysis.smallestRedundancyActionHint},
            {"smallest_redundancy_action", smallest_redundancy_action},
            {"smallest_redundancy_variable_keys", res.analysis.smallestRedundancyVariableKeys},
            {"smallest_redundancy_selection_policy", res.analysis.smallestRedundancySelectionPolicy},
            {"action_panel_count", static_cast<int>(action_panels.size())},
            {"action_panels", action_panels},
        };
        out["problematic_constraint_indices"] = res.problematicConstraintIndices;
        out["primary_conflict_constraint_indices"] = res.primaryConflictConstraintIndices;
        out["smallest_conflict_constraint_indices"] = res.smallestConflictConstraintIndices;
        out["primary_redundancy_basis_constraint_indices"] = res.primaryRedundancyBasisConstraintIndices;
        out["primary_redundant_constraint_indices"] = res.primaryRedundantConstraintIndices;
        out["smallest_redundancy_basis_constraint_indices"] = res.smallestRedundancyBasisConstraintIndices;
        out["smallest_redundant_constraint_indices"] = res.smallestRedundantConstraintIndices;
        out["redundancy_groups"] = json::array();
        for (const auto& group : res.redundancyGroups) {
            out["redundancy_groups"].push_back({
                {"anchor_constraint_index", group.anchorConstraintIndex},
                {"kind", constraintKindName(group.kind)},
                {"type", group.type},
                {"constraint_indices", group.constraintIndices},
                {"group_size", static_cast<int>(group.constraintIndices.size())},
                {"redundant_count", std::max(0, static_cast<int>(group.constraintIndices.size()) - 1)}
            });
        }
        out["structural_groups"] = json::array();
        for (const auto& group : res.structuralGroups) {
            out["structural_groups"].push_back({
                {"anchor_constraint_index", group.anchorConstraintIndex},
                {"constraint_indices", group.constraintIndices},
                {"variable_keys", group.variableKeys},
                {"basis_variable_keys", group.basisVariableKeys},
                {"free_variable_keys", group.freeVariableKeys},
                {"jacobian_row_count", group.jacobianRowCount},
                {"jacobian_column_count", group.jacobianColumnCount},
                {"jacobian_rank", group.jacobianRank},
                {"dof_estimate", group.dofEstimate},
                {"redundant_constraint_estimate", group.redundantConstraintEstimate},
                {"priority_score", group.priorityScore},
                {"state", constraintStructuralStateName(group.structuralState)}
            });
        }
        out["conflict_groups"] = json::array();
        for (const auto& group : res.conflictGroups) {
            out["conflict_groups"].push_back({
                {"anchor_constraint_index", group.anchorConstraintIndex},
                {"constraint_indices", group.constraintIndices},
                {"variable_keys", group.variableKeys},
                {"basis_variable_keys", group.basisVariableKeys},
                {"free_variable_keys", group.freeVariableKeys},
                {"jacobian_rank", group.jacobianRank},
                {"dof_estimate", group.dofEstimate},
                {"redundant_constraint_estimate", group.redundantConstraintEstimate},
                {"priority_score", group.priorityScore},
                {"priority_breakdown", {
                    {"state_bias", group.priorityStateBias},
                    {"redundant_constraint_contribution", group.priorityRedundantConstraintContribution},
                    {"constraint_count_contribution", group.priorityConstraintCountContribution},
                    {"free_variable_contribution", group.priorityFreeVariableContribution},
                    {"dof_contribution", group.priorityDofContribution}
                }},
                {"state", constraintStructuralStateName(group.structuralState)}
            });
        }
        out["redundancy_subsets"] = json::array();
        for (const auto& subset : res.redundancySubsets) {
            out["redundancy_subsets"].push_back({
                {"anchor_constraint_index", subset.anchorConstraintIndex},
                {"basis_constraint_indices", subset.basisConstraintIndices},
                {"redundant_constraint_indices", subset.redundantConstraintIndices},
                {"variable_keys", subset.variableKeys},
                {"jacobian_rank", subset.jacobianRank},
                {"witness_constraint_count", subset.witnessConstraintCount},
                {"priority_score", subset.priorityScore},
                {"priority_breakdown", {
                    {"redundant_constraint_contribution", subset.priorityRedundantConstraintContribution},
                    {"witness_penalty", subset.priorityWitnessPenalty}
                }},
                {"state", constraintStructuralStateName(subset.structuralState)}
            });
        }
        out["diagnostics"] = json::array();
        for (const auto& diag : res.diagnostics) {
            json item = {
                {"constraint_index", diag.constraintIndex},
                {"type", diag.type},
                {"kind", constraintKindName(diag.kind)},
                {"code", constraintDiagnosticCodeName(diag.code)},
                {"detail", diag.detail},
            };
            if (diag.relatedConstraintIndex >= 0) {
                item["related_constraint_index"] = diag.relatedConstraintIndex;
            }
            out["diagnostics"].push_back(std::move(item));
        }
        json vars = json::object();
        for (const auto& kv : store.vars) vars[kv.first] = kv.second;
        out["vars"] = vars;
        std::cout << out.dump(2) << "\n";
    } else {
        std::cout << "SolveResult: ok=" << res.ok << ", iters=" << res.iterations << ", err=" << res.finalError << "\n";
        std::cout << "analysis: constraints=" << res.analysis.constraintCount
                  << " refs=" << res.analysis.referencedVariableCount
                  << " bound_refs=" << res.analysis.boundVariableCount
                  << " well_formed=" << res.analysis.wellFormedConstraintCount
                  << " unique=" << res.analysis.uniqueConstraintCount
                  << " duplicates=" << res.analysis.duplicateConstraintCount
                  << " duplicate_groups=" << res.analysis.duplicateConstraintGroupCount
                  << " largest_duplicate_group=" << res.analysis.largestDuplicateConstraintGroupSize
                  << " structural_diags=" << res.analysis.structuralDiagnosticCount
                  << " binding_diags=" << res.analysis.bindingDiagnosticCount
                  << " evaluable=" << res.analysis.evaluableConstraintCount
                  << " jacobian_rows=" << res.analysis.jacobianRowCount
                  << " jacobian_cols=" << res.analysis.jacobianColumnCount
                  << " rank=" << res.analysis.jacobianRank
                  << " dof=" << res.analysis.dofEstimate
                  << " redundant_est=" << res.analysis.redundantConstraintEstimate
                  << " state=" << constraintStructuralStateName(res.analysis.structuralState)
                  << " structural_groups=" << res.analysis.structuralGroupCount
                  << " conflict_groups=" << res.analysis.conflictGroupCount
                  << " redundancy_subsets=" << res.analysis.redundancySubsetCount
                  << " redundant_candidates=" << res.analysis.redundantConstraintCandidateCount
                  << " free_var_candidates=" << res.analysis.freeVariableCandidateCount
                  << " problematic_constraints=" << res.analysis.problematicConstraintCount
                  << " primary_conflict_anchor=" << res.analysis.primaryConflictAnchorConstraintIndex
                  << " smallest_conflict_anchor=" << res.analysis.smallestConflictGroupAnchorConstraintIndex
                  << " primary_redundancy_anchor=" << res.analysis.primaryRedundancySubsetAnchorConstraintIndex
                  << " smallest_redundancy_anchor=" << res.analysis.smallestRedundancySubsetAnchorConstraintIndex
                  << "\n";
        if (!res.primaryConflictConstraintIndices.empty()) {
            std::cout << "primary_conflict_constraints=";
            for (size_t i = 0; i < res.primaryConflictConstraintIndices.size(); ++i) {
                if (i) std::cout << ",";
                std::cout << res.primaryConflictConstraintIndices[i];
            }
            std::cout << "\n";
        }
        if (!res.smallestConflictConstraintIndices.empty()) {
            std::cout << "smallest_conflict_constraints=";
            for (size_t i = 0; i < res.smallestConflictConstraintIndices.size(); ++i) {
                if (i) std::cout << ",";
                std::cout << res.smallestConflictConstraintIndices[i];
            }
            std::cout << "\n";
        }
        if (!res.primaryRedundancyBasisConstraintIndices.empty() || !res.primaryRedundantConstraintIndices.empty()) {
            std::cout << "primary_redundancy_basis=";
            for (size_t i = 0; i < res.primaryRedundancyBasisConstraintIndices.size(); ++i) {
                if (i) std::cout << ",";
                std::cout << res.primaryRedundancyBasisConstraintIndices[i];
            }
            std::cout << " redundant=";
            for (size_t i = 0; i < res.primaryRedundantConstraintIndices.size(); ++i) {
                if (i) std::cout << ",";
                std::cout << res.primaryRedundantConstraintIndices[i];
            }
            std::cout << "\n";
        }
        if (!res.smallestRedundancyBasisConstraintIndices.empty() || !res.smallestRedundantConstraintIndices.empty()) {
            std::cout << "smallest_redundancy_basis=";
            for (size_t i = 0; i < res.smallestRedundancyBasisConstraintIndices.size(); ++i) {
                if (i) std::cout << ",";
                std::cout << res.smallestRedundancyBasisConstraintIndices[i];
            }
            std::cout << " redundant=";
            for (size_t i = 0; i < res.smallestRedundantConstraintIndices.size(); ++i) {
                if (i) std::cout << ",";
                std::cout << res.smallestRedundantConstraintIndices[i];
            }
            std::cout << "\n";
        }
        for (const auto& diag : res.diagnostics) {
            std::cout << "diagnostic[" << diag.constraintIndex << "]: "
                      << constraintDiagnosticCodeName(diag.code)
                      << " type=" << diag.type
                      << " detail=" << diag.detail;
            if (diag.relatedConstraintIndex >= 0) {
                std::cout << " related_constraint_index=" << diag.relatedConstraintIndex;
            }
            std::cout << "\n";
        }
        for (const auto& group : res.redundancyGroups) {
            std::cout << "redundancy_group anchor=" << group.anchorConstraintIndex
                      << " kind=" << constraintKindName(group.kind)
                      << " type=" << group.type
                      << " members=";
            for (size_t i = 0; i < group.constraintIndices.size(); ++i) {
                if (i) std::cout << ",";
                std::cout << group.constraintIndices[i];
            }
            std::cout << "\n";
        }
        for (const auto& group : res.structuralGroups) {
            std::cout << "structural_group anchor=" << group.anchorConstraintIndex
                      << " state=" << constraintStructuralStateName(group.structuralState)
                      << " rows=" << group.jacobianRowCount
                      << " cols=" << group.jacobianColumnCount
                      << " rank=" << group.jacobianRank
                      << " dof=" << group.dofEstimate
                      << " redundant_est=" << group.redundantConstraintEstimate
                      << " priority=" << group.priorityScore
                      << " constraints=";
            for (size_t i = 0; i < group.constraintIndices.size(); ++i) {
                if (i) std::cout << ",";
                std::cout << group.constraintIndices[i];
            }
            std::cout << " vars=";
            for (size_t i = 0; i < group.variableKeys.size(); ++i) {
                if (i) std::cout << ",";
                std::cout << group.variableKeys[i];
            }
            std::cout << " basis_vars=";
            for (size_t i = 0; i < group.basisVariableKeys.size(); ++i) {
                if (i) std::cout << ",";
                std::cout << group.basisVariableKeys[i];
            }
            std::cout << " free_vars=";
            for (size_t i = 0; i < group.freeVariableKeys.size(); ++i) {
                if (i) std::cout << ",";
                std::cout << group.freeVariableKeys[i];
            }
            std::cout << "\n";
        }
        for (const auto& group : res.conflictGroups) {
            std::cout << "conflict_group anchor=" << group.anchorConstraintIndex
                      << " state=" << constraintStructuralStateName(group.structuralState)
                      << " rank=" << group.jacobianRank
                      << " dof=" << group.dofEstimate
                      << " redundant_est=" << group.redundantConstraintEstimate
                      << " priority=" << group.priorityScore
                      << " constraints=";
            for (size_t i = 0; i < group.constraintIndices.size(); ++i) {
                if (i) std::cout << ",";
                std::cout << group.constraintIndices[i];
            }
            std::cout << " free_vars=";
            for (size_t i = 0; i < group.freeVariableKeys.size(); ++i) {
                if (i) std::cout << ",";
                std::cout << group.freeVariableKeys[i];
            }
            std::cout << "\n";
        }
        for (const auto& subset : res.redundancySubsets) {
            std::cout << "redundancy_subset anchor=" << subset.anchorConstraintIndex
                      << " state=" << constraintStructuralStateName(subset.structuralState)
                      << " rank=" << subset.jacobianRank
                      << " witness=" << subset.witnessConstraintCount
                      << " priority=" << subset.priorityScore
                      << " basis=";
            for (size_t i = 0; i < subset.basisConstraintIndices.size(); ++i) {
                if (i) std::cout << ",";
                std::cout << subset.basisConstraintIndices[i];
            }
            std::cout << " redundant=";
            for (size_t i = 0; i < subset.redundantConstraintIndices.size(); ++i) {
                if (i) std::cout << ",";
                std::cout << subset.redundantConstraintIndices[i];
            }
            std::cout << "\n";
        }
        if (!res.problematicConstraintIndices.empty()) {
            std::cout << "problematic_constraints=";
            for (size_t i = 0; i < res.problematicConstraintIndices.size(); ++i) {
                if (i) std::cout << ",";
                std::cout << res.problematicConstraintIndices[i];
            }
            std::cout << "\n";
        }
        for (auto& kv : store.vars) std::cout << kv.first << " = " << kv.second << "\n";
    }
    delete solver; return res.ok ? 0 : 1;
}
