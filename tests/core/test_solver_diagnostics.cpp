#include <algorithm>
#include <cassert>
#include <iostream>
#include <unordered_map>
#include <vector>

#include "../../core/include/core/solver.hpp"

using namespace core;

static bool has_diag(const SolveResult& result,
                     ConstraintDiagnosticCode code,
                     const std::string& type) {
    for (const auto& diag : result.diagnostics) {
        if (diag.code == code && diag.type == type) return true;
    }
    return false;
}

static bool has_text(const std::vector<std::string>& items, const std::string& needle) {
    return std::find(items.begin(), items.end(), needle) != items.end();
}

int main() {
    ISolver* solver = createMinimalSolver();
    solver->setMaxIterations(50);
    solver->setTolerance(1e-6);

    std::unordered_map<std::string, double> vars{
        {"p0.x", 0.0}, {"p0.y", 0.0},
        {"p1.x", 1.0}, {"p1.y", 1.0},
    };

    auto get = [&](const VarRef& v, bool& ok) -> double {
        const std::string key = v.id + "." + v.key;
        auto it = vars.find(key);
        if (it == vars.end()) {
            ok = false;
            return 0.0;
        }
        ok = true;
        return it->second;
    };
    auto set = [&](const VarRef& v, double value) {
        vars[v.id + "." + v.key] = value;
    };

    std::vector<ConstraintSpec> bad_specs;

    ConstraintSpec unsupported;
    unsupported.type = "broken";
    unsupported.vars = {VarRef{"p0", "x"}, VarRef{"p1", "x"}};
    bad_specs.push_back(unsupported);

    ConstraintSpec missing_value;
    missing_value.type = "distance";
    missing_value.vars = {
        VarRef{"p0", "x"}, VarRef{"p0", "y"},
        VarRef{"p1", "x"}, VarRef{"p1", "y"},
    };
    bad_specs.push_back(missing_value);

    ConstraintSpec wrong_arity;
    wrong_arity.type = "horizontal";
    wrong_arity.vars = {VarRef{"p0", "y"}};
    bad_specs.push_back(wrong_arity);

    ConstraintSpec unbound;
    unbound.type = "equal";
    unbound.vars = {VarRef{"p0", "x"}, VarRef{"missing", "x"}};
    bad_specs.push_back(unbound);

    ConstraintSpec duplicate_a;
    duplicate_a.type = "horizontal";
    duplicate_a.vars = {VarRef{"p0", "y"}, VarRef{"p1", "y"}};
    bad_specs.push_back(duplicate_a);

    ConstraintSpec duplicate_b = duplicate_a;
    bad_specs.push_back(duplicate_b);

    const SolveResult result = solver->solveWithBindings(bad_specs, get, set);

    assert(!result.ok);
    assert(!result.diagnostics.empty());
    assert(has_diag(result, ConstraintDiagnosticCode::UnsupportedType, "broken"));
    assert(has_diag(result, ConstraintDiagnosticCode::MissingValue, "distance"));
    assert(has_diag(result, ConstraintDiagnosticCode::WrongArity, "horizontal"));
    assert(has_diag(result, ConstraintDiagnosticCode::UnboundVariable, "equal"));
    assert(has_diag(result, ConstraintDiagnosticCode::DuplicateConstraint, "horizontal"));
    assert(result.analysis.constraintCount == static_cast<int>(bad_specs.size()));
    assert(result.analysis.duplicateConstraintCount == 1);
    assert(result.analysis.duplicateConstraintGroupCount == 1);
    assert(result.analysis.largestDuplicateConstraintGroupSize == 2);
    assert(result.analysis.uniqueConstraintCount >= 2);
    assert(result.analysis.wellFormedConstraintCount >= 3);
    assert(result.analysis.evaluableConstraintCount == 0);
    assert(result.analysis.jacobianRank == 0);
    assert(result.analysis.structuralState == ConstraintStructuralState::Unknown);
    assert(result.analysis.conflictGroupCount == 0);
    assert(result.analysis.redundancySubsetCount == 0);
    assert(result.analysis.redundantConstraintCandidateCount == 0);
    assert(result.analysis.freeVariableCandidateCount == 0);
    assert(result.redundancyGroups.size() == 1);
    assert(result.conflictGroups.empty());
    assert(result.redundancySubsets.empty());
    assert(result.redundancyGroups[0].anchorConstraintIndex == 4);
    assert(result.redundancyGroups[0].constraintIndices.size() == 2);
    assert(result.redundancyGroups[0].constraintIndices[0] == 4);
    assert(result.redundancyGroups[0].constraintIndices[1] == 5);

    std::vector<ConstraintSpec> good_specs;
    ConstraintSpec horizontal;
    horizontal.type = "horizontal";
    horizontal.vars = {VarRef{"p0", "y"}, VarRef{"p1", "y"}};
    good_specs.push_back(horizontal);

    const SolveResult good_result = solver->solveWithBindings(good_specs, get, set);

    assert(good_result.analysis.constraintCount == 1);
    assert(good_result.analysis.evaluableConstraintCount == 1);
    assert(good_result.analysis.jacobianRowCount == 1);
    assert(good_result.analysis.jacobianColumnCount == 2);
    assert(good_result.analysis.jacobianRank == 1);
    assert(good_result.analysis.dofEstimate == 1);
    assert(good_result.analysis.redundantConstraintEstimate == 0);
    assert(good_result.analysis.structuralState == ConstraintStructuralState::Underconstrained);
    assert(good_result.redundancyGroups.empty());
    assert(good_result.analysis.structuralGroupCount == 1);
    assert(good_result.analysis.underconstrainedGroupCount == 1);
    assert(good_result.analysis.conflictGroupCount == 0);
    assert(good_result.analysis.redundancySubsetCount == 0);
    assert(good_result.analysis.redundantConstraintCandidateCount == 0);
    assert(good_result.analysis.freeVariableCandidateCount == 1);
    assert(good_result.analysis.problematicConstraintCount == 0);
    assert(good_result.structuralGroups.size() == 1);
    assert(good_result.conflictGroups.empty());
    assert(good_result.redundancySubsets.empty());
    assert(good_result.problematicConstraintIndices.empty());
    assert(good_result.structuralGroups[0].anchorConstraintIndex == 0);
    assert(good_result.structuralGroups[0].structuralState == ConstraintStructuralState::Underconstrained);
    assert(good_result.structuralGroups[0].constraintIndices.size() == 1);
    assert(good_result.structuralGroups[0].constraintIndices[0] == 0);
    assert(good_result.structuralGroups[0].basisVariableKeys.size() == 1);
    assert(good_result.structuralGroups[0].basisVariableKeys[0] == "p0.y");
    assert(good_result.structuralGroups[0].freeVariableKeys.size() == 1);
    assert(good_result.structuralGroups[0].freeVariableKeys[0] == "p1.y");

    std::vector<ConstraintSpec> mixed_specs;
    ConstraintSpec equal_x;
    equal_x.type = "equal";
    equal_x.vars = {VarRef{"p0", "x"}, VarRef{"p1", "x"}};
    mixed_specs.push_back(equal_x);
    ConstraintSpec vertical_x;
    vertical_x.type = "vertical";
    vertical_x.vars = {VarRef{"p0", "x"}, VarRef{"p1", "x"}};
    mixed_specs.push_back(vertical_x);

    const SolveResult mixed_result = solver->solveWithBindings(mixed_specs, get, set);
    assert(mixed_result.analysis.constraintCount == 2);
    assert(mixed_result.analysis.evaluableConstraintCount == 2);
    assert(mixed_result.analysis.jacobianRowCount == 2);
    assert(mixed_result.analysis.jacobianColumnCount == 2);
    assert(mixed_result.analysis.jacobianRank == 1);
    assert(mixed_result.analysis.dofEstimate == 1);
    assert(mixed_result.analysis.redundantConstraintEstimate == 1);
    assert(mixed_result.analysis.structuralState == ConstraintStructuralState::Mixed);
    assert(mixed_result.redundancyGroups.empty());
    assert(mixed_result.analysis.structuralGroupCount == 1);
    assert(mixed_result.analysis.mixedGroupCount == 1);
    assert(mixed_result.analysis.conflictGroupCount == 1);
    assert(mixed_result.analysis.largestConflictGroupSize == 2);
    assert(mixed_result.analysis.redundancySubsetCount == 1);
    assert(mixed_result.analysis.redundantConstraintCandidateCount == 1);
    assert(mixed_result.analysis.freeVariableCandidateCount == 1);
    assert(mixed_result.analysis.problematicConstraintCount == 2);
    assert(mixed_result.analysis.primaryConflictAnchorConstraintIndex == 0);
    assert(mixed_result.analysis.primaryConflictPriorityScore > 0);
    assert(mixed_result.analysis.primaryConflictPriorityBreakdown.stateBias
           == mixed_result.conflictGroups[0].priorityStateBias);
    assert(mixed_result.analysis.primaryConflictPriorityBreakdown.redundantConstraintContribution
           == mixed_result.conflictGroups[0].priorityRedundantConstraintContribution);
    assert(mixed_result.analysis.smallestConflictPriorityBreakdown.constraintCountContribution
           == mixed_result.conflictGroups[0].priorityConstraintCountContribution);
    assert(mixed_result.analysis.primaryConflictSelectionPolicy.size() == 3);
    assert(mixed_result.analysis.primaryConflictSelectionExplanation
           == "highest_priority_conflict_group");
    assert(mixed_result.analysis.primaryConflictSelectionTag
           == "conflict-primary-priority");
    assert(mixed_result.analysis.primaryConflictSelectionSummary
           == "highest_priority_conflict_group(state=mixed,constraints=2,score=16211,anchor=0)");
    assert(mixed_result.analysis.primaryConflictActionLabel
           == "Relax primary conflict");
    assert(mixed_result.analysis.primaryConflictSelectionPolicy[0] == "priority_score_desc");
    assert(mixed_result.analysis.smallestConflictSelectionPolicy.size() == 3);
    assert(mixed_result.analysis.smallestConflictSelectionExplanation
           == "smallest_conflict_witness");
    assert(mixed_result.analysis.smallestConflictSelectionTag
           == "conflict-smallest-witness");
    assert(mixed_result.analysis.smallestConflictSelectionSummary
           == "smallest_conflict_witness(state=mixed,constraints=2,score=16211,anchor=0)");
    assert(mixed_result.analysis.smallestConflictActionLabel
           == "Inspect smallest conflict witness");
    assert(mixed_result.analysis.smallestConflictSelectionPolicy[0] == "constraint_count_asc");
    assert(mixed_result.analysis.smallestConflictGroupAnchorConstraintIndex == 0);
    assert(mixed_result.analysis.smallestConflictGroupSize == 2);
    assert(mixed_result.analysis.primaryRedundancySubsetAnchorConstraintIndex == 0);
    assert(mixed_result.analysis.primaryRedundancyPriorityScore > 0);
    assert(mixed_result.analysis.primaryRedundancyPriorityBreakdown.redundantConstraintContribution
           == mixed_result.redundancySubsets[0].priorityRedundantConstraintContribution);
    assert(mixed_result.analysis.smallestRedundancyPriorityBreakdown.witnessPenalty
           == mixed_result.redundancySubsets[0].priorityWitnessPenalty);
    assert(mixed_result.analysis.primaryRedundancySelectionPolicy.size() == 3);
    assert(mixed_result.analysis.primaryRedundancySelectionExplanation
           == "highest_priority_redundancy_subset");
    assert(mixed_result.analysis.primaryRedundancySelectionTag
           == "redundancy-primary-priority");
    assert(mixed_result.analysis.primaryRedundancySelectionSummary
           == "highest_priority_redundancy_subset(redundant=1,witness=2,score=980,anchor=0)");
    assert(mixed_result.analysis.primaryRedundancyActionLabel
           == "Suppress primary redundancy");
    assert(mixed_result.analysis.primaryRedundancySelectionPolicy[0] == "priority_score_desc");
    assert(mixed_result.analysis.smallestRedundancySelectionPolicy.size() == 3);
    assert(mixed_result.analysis.smallestRedundancySelectionExplanation
           == "smallest_redundancy_witness");
    assert(mixed_result.analysis.smallestRedundancySelectionTag
           == "redundancy-smallest-witness");
    assert(mixed_result.analysis.smallestRedundancySelectionSummary
           == "smallest_redundancy_witness(redundant=1,witness=2,score=980,anchor=0)");
    assert(mixed_result.analysis.smallestRedundancyActionLabel
           == "Trim smallest redundancy witness");
    assert(mixed_result.analysis.smallestRedundancySelectionPolicy[0] == "witness_constraint_count_asc");
    assert(mixed_result.analysis.smallestRedundancySubsetAnchorConstraintIndex == 0);
    assert(mixed_result.analysis.smallestRedundancyWitnessConstraintCount == 2);
    assert(mixed_result.primaryConflictConstraintIndices.size() == 2);
    assert(mixed_result.primaryConflictConstraintIndices[0] == 0);
    assert(mixed_result.primaryConflictConstraintIndices[1] == 1);
    assert(mixed_result.smallestConflictConstraintIndices.size() == 2);
    assert(mixed_result.smallestConflictConstraintIndices[0] == 0);
    assert(mixed_result.smallestConflictConstraintIndices[1] == 1);
    assert(mixed_result.primaryRedundancyBasisConstraintIndices.size() == 1);
    assert(mixed_result.primaryRedundancyBasisConstraintIndices[0] == 0);
    assert(mixed_result.primaryRedundantConstraintIndices.size() == 1);
    assert(mixed_result.primaryRedundantConstraintIndices[0] == 1);
    assert(mixed_result.smallestRedundancyBasisConstraintIndices.size() == 1);
    assert(mixed_result.smallestRedundancyBasisConstraintIndices[0] == 0);
    assert(mixed_result.smallestRedundantConstraintIndices.size() == 1);
    assert(mixed_result.smallestRedundantConstraintIndices[0] == 1);
    assert(mixed_result.structuralGroups.size() == 1);
    assert(mixed_result.conflictGroups.size() == 1);
    assert(mixed_result.redundancySubsets.size() == 1);
    assert(mixed_result.problematicConstraintIndices.size() == 2);
    assert(mixed_result.problematicConstraintIndices[0] == 0);
    assert(mixed_result.problematicConstraintIndices[1] == 1);
    assert(mixed_result.structuralGroups[0].anchorConstraintIndex == 0);
    assert(mixed_result.structuralGroups[0].structuralState == ConstraintStructuralState::Mixed);
    assert(mixed_result.structuralGroups[0].constraintIndices.size() == 2);
    assert(mixed_result.structuralGroups[0].constraintIndices[0] == 0);
    assert(mixed_result.structuralGroups[0].constraintIndices[1] == 1);
    assert(mixed_result.structuralGroups[0].basisVariableKeys.size() == 1);
    assert(mixed_result.structuralGroups[0].basisVariableKeys[0] == "p0.x");
    assert(mixed_result.structuralGroups[0].freeVariableKeys.size() == 1);
    assert(mixed_result.structuralGroups[0].freeVariableKeys[0] == "p1.x");
    assert(mixed_result.conflictGroups[0].anchorConstraintIndex == 0);
    assert(mixed_result.conflictGroups[0].structuralState == ConstraintStructuralState::Mixed);
    assert(mixed_result.conflictGroups[0].constraintIndices.size() == 2);
    assert(mixed_result.conflictGroups[0].freeVariableKeys.size() == 1);
    assert(mixed_result.conflictGroups[0].freeVariableKeys[0] == "p1.x");
    assert(mixed_result.conflictGroups[0].priorityScore > 0);
    assert(mixed_result.conflictGroups[0].priorityScore
           == mixed_result.conflictGroups[0].priorityStateBias
            + mixed_result.conflictGroups[0].priorityRedundantConstraintContribution
            + mixed_result.conflictGroups[0].priorityConstraintCountContribution
            + mixed_result.conflictGroups[0].priorityFreeVariableContribution
            + mixed_result.conflictGroups[0].priorityDofContribution);
    assert(mixed_result.redundancySubsets[0].anchorConstraintIndex == 0);
    assert(mixed_result.redundancySubsets[0].basisConstraintIndices.size() == 1);
    assert(mixed_result.redundancySubsets[0].basisConstraintIndices[0] == 0);
    assert(mixed_result.redundancySubsets[0].redundantConstraintIndices.size() == 1);
    assert(mixed_result.redundancySubsets[0].redundantConstraintIndices[0] == 1);
    assert(mixed_result.redundancySubsets[0].witnessConstraintCount == 2);
    assert(mixed_result.redundancySubsets[0].priorityScore > 0);
    assert(mixed_result.redundancySubsets[0].priorityScore
           == mixed_result.redundancySubsets[0].priorityRedundantConstraintContribution
            + mixed_result.redundancySubsets[0].priorityWitnessPenalty);

    vars["p2.x"] = 5.0;
    vars["p2.y"] = 2.0;
    vars["p3.x"] = 8.0;
    vars["p3.y"] = 6.0;
    std::vector<ConstraintSpec> grouped_specs;
    grouped_specs.push_back(horizontal);
    grouped_specs.push_back(equal_x);
    grouped_specs.push_back(vertical_x);
    grouped_specs[1].vars = {VarRef{"p2", "x"}, VarRef{"p3", "x"}};
    grouped_specs[2].vars = {VarRef{"p2", "x"}, VarRef{"p3", "x"}};
    const SolveResult grouped_result = solver->solveWithBindings(grouped_specs, get, set);
    assert(grouped_result.analysis.structuralGroupCount == 2);
    assert(grouped_result.analysis.underconstrainedGroupCount == 1);
    assert(grouped_result.analysis.mixedGroupCount == 1);
    assert(grouped_result.analysis.conflictGroupCount == 1);
    assert(grouped_result.analysis.largestConflictGroupSize == 2);
    assert(grouped_result.analysis.redundancySubsetCount == 1);
    assert(grouped_result.analysis.redundantConstraintCandidateCount == 1);
    assert(grouped_result.analysis.freeVariableCandidateCount == 2);
    assert(grouped_result.analysis.problematicConstraintCount == 2);
    assert(grouped_result.analysis.primaryConflictAnchorConstraintIndex == 1);
    assert(grouped_result.analysis.primaryConflictPriorityScore > 0);
    assert(grouped_result.analysis.smallestConflictGroupAnchorConstraintIndex == 1);
    assert(grouped_result.analysis.smallestConflictGroupSize == 2);
    assert(grouped_result.analysis.primaryRedundancySubsetAnchorConstraintIndex == 1);
    assert(grouped_result.analysis.primaryRedundancyPriorityScore > 0);
    assert(grouped_result.analysis.smallestRedundancySubsetAnchorConstraintIndex == 1);
    assert(grouped_result.analysis.smallestRedundancyWitnessConstraintCount == 2);
    assert(grouped_result.primaryConflictConstraintIndices.size() == 2);
    assert(grouped_result.primaryConflictConstraintIndices[0] == 1);
    assert(grouped_result.primaryConflictConstraintIndices[1] == 2);
    assert(grouped_result.smallestConflictConstraintIndices.size() == 2);
    assert(grouped_result.smallestConflictConstraintIndices[0] == 1);
    assert(grouped_result.smallestConflictConstraintIndices[1] == 2);
    assert(grouped_result.primaryRedundancyBasisConstraintIndices.size() == 1);
    assert(grouped_result.primaryRedundancyBasisConstraintIndices[0] == 1);
    assert(grouped_result.primaryRedundantConstraintIndices.size() == 1);
    assert(grouped_result.primaryRedundantConstraintIndices[0] == 2);
    assert(grouped_result.smallestRedundancyBasisConstraintIndices.size() == 1);
    assert(grouped_result.smallestRedundancyBasisConstraintIndices[0] == 1);
    assert(grouped_result.smallestRedundantConstraintIndices.size() == 1);
    assert(grouped_result.smallestRedundantConstraintIndices[0] == 2);
    assert(grouped_result.structuralGroups.size() == 2);
    assert(grouped_result.conflictGroups.size() == 1);
    assert(grouped_result.redundancySubsets.size() == 1);
    assert(grouped_result.problematicConstraintIndices.size() == 2);
    assert(grouped_result.problematicConstraintIndices[0] == 1);
    assert(grouped_result.problematicConstraintIndices[1] == 2);
    assert(grouped_result.structuralGroups[0].anchorConstraintIndex == 0);
    assert(grouped_result.structuralGroups[0].structuralState == ConstraintStructuralState::Underconstrained);
    assert(grouped_result.structuralGroups[0].basisVariableKeys.size() == 1);
    assert(grouped_result.structuralGroups[0].basisVariableKeys[0] == "p0.y");
    assert(grouped_result.structuralGroups[0].freeVariableKeys.size() == 1);
    assert(grouped_result.structuralGroups[0].freeVariableKeys[0] == "p1.y");
    assert(grouped_result.structuralGroups[1].anchorConstraintIndex == 1);
    assert(grouped_result.structuralGroups[1].structuralState == ConstraintStructuralState::Mixed);
    assert(grouped_result.structuralGroups[1].constraintIndices.size() == 2);
    assert(grouped_result.structuralGroups[1].constraintIndices[0] == 1);
    assert(grouped_result.structuralGroups[1].constraintIndices[1] == 2);
    assert(grouped_result.structuralGroups[1].basisVariableKeys.size() == 1);
    assert(grouped_result.structuralGroups[1].basisVariableKeys[0] == "p2.x");
    assert(grouped_result.structuralGroups[1].freeVariableKeys.size() == 1);
    assert(grouped_result.structuralGroups[1].freeVariableKeys[0] == "p3.x");
    assert(grouped_result.conflictGroups[0].anchorConstraintIndex == 1);
    assert(grouped_result.conflictGroups[0].constraintIndices.size() == 2);
    assert(grouped_result.conflictGroups[0].constraintIndices[0] == 1);
    assert(grouped_result.conflictGroups[0].constraintIndices[1] == 2);
    assert(grouped_result.conflictGroups[0].freeVariableKeys.size() == 1);
    assert(grouped_result.conflictGroups[0].freeVariableKeys[0] == "p3.x");
    assert(grouped_result.conflictGroups[0].priorityScore > 0);
    assert(grouped_result.redundancySubsets[0].anchorConstraintIndex == 1);
    assert(grouped_result.redundancySubsets[0].basisConstraintIndices.size() == 1);
    assert(grouped_result.redundancySubsets[0].basisConstraintIndices[0] == 1);
    assert(grouped_result.redundancySubsets[0].redundantConstraintIndices.size() == 1);
    assert(grouped_result.redundancySubsets[0].redundantConstraintIndices[0] == 2);
    assert(grouped_result.redundancySubsets[0].witnessConstraintCount == 2);
    assert(grouped_result.redundancySubsets[0].priorityScore > 0);

    vars["p4.x"] = 20.0;
    vars["p4.y"] = 0.0;
    vars["p5.x"] = 24.0;
    vars["p5.y"] = 3.0;
    std::vector<ConstraintSpec> ranked_specs;
    ConstraintSpec equal_small;
    equal_small.type = "equal";
    equal_small.vars = {VarRef{"p0", "x"}, VarRef{"p1", "x"}};
    ranked_specs.push_back(equal_small);
    ConstraintSpec vertical_small;
    vertical_small.type = "vertical";
    vertical_small.vars = {VarRef{"p0", "x"}, VarRef{"p1", "x"}};
    ranked_specs.push_back(vertical_small);
    ConstraintSpec equal_large;
    equal_large.type = "equal";
    equal_large.vars = {VarRef{"p4", "x"}, VarRef{"p5", "x"}};
    ranked_specs.push_back(equal_large);
    ConstraintSpec vertical_large;
    vertical_large.type = "vertical";
    vertical_large.vars = {VarRef{"p4", "x"}, VarRef{"p5", "x"}};
    ranked_specs.push_back(vertical_large);
    ConstraintSpec distance_large;
    distance_large.type = "distance";
    distance_large.vars = {
        VarRef{"p4", "x"}, VarRef{"p4", "y"},
        VarRef{"p5", "x"}, VarRef{"p5", "y"}
    };
    distance_large.value = 5.0;
    ranked_specs.push_back(distance_large);
    const SolveResult ranked_result = solver->solveWithBindings(ranked_specs, get, set);
    assert(ranked_result.analysis.conflictGroupCount == 2);
    assert(ranked_result.analysis.redundancySubsetCount == 2);
    assert(ranked_result.analysis.primaryConflictAnchorConstraintIndex == 2);
    assert(ranked_result.analysis.primaryConflictPriorityBreakdown.stateBias
           == ranked_result.conflictGroups[0].priorityStateBias);
    assert(ranked_result.analysis.primaryConflictSelectionExplanation
           == "highest_priority_conflict_group");
    assert(ranked_result.analysis.primaryConflictSelectionTag
           == "conflict-primary-priority");
    assert(ranked_result.analysis.primaryConflictSelectionSummary
           == "highest_priority_conflict_group(state=mixed,constraints=3,score=16322,anchor=2)");
    assert(ranked_result.analysis.primaryConflictActionLabel
           == "Relax primary conflict");
    assert(ranked_result.analysis.primaryConflictActionHint
           == "Inspect the primary conflict group first and relax or remove one conflicting constraint near the anchor.");
    assert(ranked_result.analysis.primaryConflictVariableKeys.size() == 4);
    assert(has_text(ranked_result.analysis.primaryConflictVariableKeys, "p4.x"));
    assert(has_text(ranked_result.analysis.primaryConflictVariableKeys, "p4.y"));
    assert(has_text(ranked_result.analysis.primaryConflictVariableKeys, "p5.x"));
    assert(has_text(ranked_result.analysis.primaryConflictVariableKeys, "p5.y"));
    assert(ranked_result.analysis.primaryConflictFreeVariableKeys.size() == 2);
    assert(has_text(ranked_result.analysis.primaryConflictFreeVariableKeys, "p5.x"));
    assert(has_text(ranked_result.analysis.primaryConflictFreeVariableKeys, "p5.y"));
    assert(ranked_result.analysis.primaryConflictSelectionPolicy[1] == "constraint_count_desc");
    assert(ranked_result.analysis.smallestConflictGroupAnchorConstraintIndex == 0);
    assert(ranked_result.analysis.smallestConflictGroupSize == 2);
    assert(ranked_result.analysis.smallestConflictPriorityBreakdown.constraintCountContribution
           == ranked_result.conflictGroups[1].priorityConstraintCountContribution);
    assert(ranked_result.analysis.smallestConflictSelectionExplanation
           == "smallest_conflict_witness");
    assert(ranked_result.analysis.smallestConflictSelectionTag
           == "conflict-smallest-witness");
    assert(ranked_result.analysis.smallestConflictSelectionSummary
           == "smallest_conflict_witness(state=mixed,constraints=2,score=16211,anchor=0)");
    assert(ranked_result.analysis.smallestConflictActionLabel
           == "Inspect smallest conflict witness");
    assert(ranked_result.analysis.smallestConflictActionHint
           == "Start with the smallest conflict witness; it is the fastest subset to inspect and isolate.");
    assert(ranked_result.analysis.smallestConflictVariableKeys.size() == 2);
    assert(has_text(ranked_result.analysis.smallestConflictVariableKeys, "p0.x"));
    assert(has_text(ranked_result.analysis.smallestConflictVariableKeys, "p1.x"));
    assert(ranked_result.analysis.smallestConflictFreeVariableKeys.size() == 1);
    assert(has_text(ranked_result.analysis.smallestConflictFreeVariableKeys, "p1.x"));
    assert(ranked_result.analysis.primaryRedundancySubsetAnchorConstraintIndex == 0);
    assert(ranked_result.analysis.primaryRedundancyPriorityBreakdown.witnessPenalty
           == ranked_result.redundancySubsets[0].priorityWitnessPenalty);
    assert(ranked_result.analysis.primaryRedundancySelectionExplanation
           == "highest_priority_redundancy_subset");
    assert(ranked_result.analysis.primaryRedundancySelectionTag
           == "redundancy-primary-priority");
    assert(ranked_result.analysis.primaryRedundancySelectionSummary
           == "highest_priority_redundancy_subset(redundant=1,witness=2,score=980,anchor=0)");
    assert(ranked_result.analysis.primaryRedundancyActionLabel
           == "Suppress primary redundancy");
    assert(ranked_result.analysis.primaryRedundancyActionHint
           == "Remove or suppress one redundant constraint from the primary redundancy subset first.");
    assert(ranked_result.analysis.primaryRedundancyVariableKeys.size() == 2);
    assert(has_text(ranked_result.analysis.primaryRedundancyVariableKeys, "p0.x"));
    assert(has_text(ranked_result.analysis.primaryRedundancyVariableKeys, "p1.x"));
    assert(ranked_result.analysis.smallestRedundancySelectionPolicy[1] == "redundant_constraint_count_desc");
    assert(ranked_result.analysis.smallestRedundancySubsetAnchorConstraintIndex == 0);
    assert(ranked_result.analysis.smallestRedundancyWitnessConstraintCount == 2);
    assert(ranked_result.analysis.smallestRedundancySelectionExplanation
           == "smallest_redundancy_witness");
    assert(ranked_result.analysis.smallestRedundancySelectionTag
           == "redundancy-smallest-witness");
    assert(ranked_result.analysis.smallestRedundancySelectionSummary
           == "smallest_redundancy_witness(redundant=1,witness=2,score=980,anchor=0)");
    assert(ranked_result.analysis.smallestRedundancyActionLabel
           == "Trim smallest redundancy witness");
    assert(ranked_result.analysis.smallestRedundancyActionHint
           == "Trim the smallest redundancy witness first; it is the cheapest subset to simplify.");
    assert(ranked_result.analysis.smallestRedundancyVariableKeys.size() == 2);
    assert(has_text(ranked_result.analysis.smallestRedundancyVariableKeys, "p0.x"));
    assert(has_text(ranked_result.analysis.smallestRedundancyVariableKeys, "p1.x"));
    assert(ranked_result.primaryConflictConstraintIndices.size() == 3);
    assert(ranked_result.primaryConflictConstraintIndices[0] == 2);
    assert(ranked_result.primaryConflictConstraintIndices[1] == 3);
    assert(ranked_result.primaryConflictConstraintIndices[2] == 4);
    assert(ranked_result.smallestConflictConstraintIndices.size() == 2);
    assert(ranked_result.smallestConflictConstraintIndices[0] == 0);
    assert(ranked_result.smallestConflictConstraintIndices[1] == 1);
    assert(ranked_result.primaryRedundancyBasisConstraintIndices.size() == 1);
    assert(ranked_result.primaryRedundancyBasisConstraintIndices[0] == 0);
    assert(ranked_result.primaryRedundantConstraintIndices.size() == 1);
    assert(ranked_result.primaryRedundantConstraintIndices[0] == 1);
    assert(ranked_result.smallestRedundancyBasisConstraintIndices.size() == 1);
    assert(ranked_result.smallestRedundancyBasisConstraintIndices[0] == 0);
    assert(ranked_result.smallestRedundantConstraintIndices.size() == 1);
    assert(ranked_result.smallestRedundantConstraintIndices[0] == 1);
    assert(ranked_result.conflictGroups.size() == 2);
    assert(ranked_result.redundancySubsets.size() == 2);
    assert(ranked_result.conflictGroups[0].anchorConstraintIndex == 2);
    assert(ranked_result.conflictGroups[1].anchorConstraintIndex == 0);
    assert(ranked_result.conflictGroups[0].priorityScore > ranked_result.conflictGroups[1].priorityScore);
    assert(ranked_result.conflictGroups[0].priorityScore
           == ranked_result.conflictGroups[0].priorityStateBias
            + ranked_result.conflictGroups[0].priorityRedundantConstraintContribution
            + ranked_result.conflictGroups[0].priorityConstraintCountContribution
            + ranked_result.conflictGroups[0].priorityFreeVariableContribution
            + ranked_result.conflictGroups[0].priorityDofContribution);
    assert(ranked_result.redundancySubsets[0].anchorConstraintIndex == 0);
    assert(ranked_result.redundancySubsets[0].witnessConstraintCount == 2);
    assert(ranked_result.redundancySubsets[1].anchorConstraintIndex == 2);
    assert(ranked_result.redundancySubsets[1].witnessConstraintCount == 3);
    assert(ranked_result.redundancySubsets[0].priorityScore > ranked_result.redundancySubsets[1].priorityScore);
    assert(ranked_result.redundancySubsets[0].priorityScore
           == ranked_result.redundancySubsets[0].priorityRedundantConstraintContribution
            + ranked_result.redundancySubsets[0].priorityWitnessPenalty);

    vars["p6.x"] = 30.0;
    vars["p6.y"] = 6.0;
    std::vector<ConstraintSpec> tradeoff_specs;
    tradeoff_specs.push_back(equal_small);
    tradeoff_specs.push_back(vertical_small);
    ConstraintSpec equal_chain_a;
    equal_chain_a.type = "equal";
    equal_chain_a.vars = {VarRef{"p4", "x"}, VarRef{"p5", "x"}};
    tradeoff_specs.push_back(equal_chain_a);
    ConstraintSpec vertical_chain_a;
    vertical_chain_a.type = "vertical";
    vertical_chain_a.vars = {VarRef{"p4", "x"}, VarRef{"p5", "x"}};
    tradeoff_specs.push_back(vertical_chain_a);
    ConstraintSpec equal_chain_b;
    equal_chain_b.type = "equal";
    equal_chain_b.vars = {VarRef{"p5", "x"}, VarRef{"p6", "x"}};
    tradeoff_specs.push_back(equal_chain_b);
    ConstraintSpec vertical_chain_b;
    vertical_chain_b.type = "vertical";
    vertical_chain_b.vars = {VarRef{"p5", "x"}, VarRef{"p6", "x"}};
    tradeoff_specs.push_back(vertical_chain_b);
    const SolveResult tradeoff_result = solver->solveWithBindings(tradeoff_specs, get, set);
    assert(tradeoff_result.analysis.conflictGroupCount == 2);
    assert(tradeoff_result.analysis.redundancySubsetCount == 2);
    assert(tradeoff_result.analysis.primaryConflictAnchorConstraintIndex == 2);
    assert(tradeoff_result.analysis.primaryConflictPriorityBreakdown.redundantConstraintContribution
           == tradeoff_result.conflictGroups[0].priorityRedundantConstraintContribution);
    assert(tradeoff_result.analysis.primaryConflictSelectionExplanation
           == "highest_priority_conflict_group");
    assert(tradeoff_result.analysis.primaryConflictSelectionTag
           == "conflict-primary-priority");
    assert(tradeoff_result.analysis.primaryConflictSelectionSummary
           == "highest_priority_conflict_group(state=mixed,constraints=4,score=17411,anchor=2)");
    assert(tradeoff_result.analysis.primaryConflictActionLabel
           == "Relax primary conflict");
    assert(tradeoff_result.analysis.primaryConflictActionHint
           == "Inspect the primary conflict group first and relax or remove one conflicting constraint near the anchor.");
    assert(tradeoff_result.analysis.primaryConflictVariableKeys.size() == 3);
    assert(has_text(tradeoff_result.analysis.primaryConflictVariableKeys, "p4.x"));
    assert(has_text(tradeoff_result.analysis.primaryConflictVariableKeys, "p5.x"));
    assert(has_text(tradeoff_result.analysis.primaryConflictVariableKeys, "p6.x"));
    assert(tradeoff_result.analysis.primaryConflictFreeVariableKeys.size() == 1);
    assert(has_text(tradeoff_result.analysis.primaryConflictFreeVariableKeys, "p6.x"));
    assert(tradeoff_result.analysis.smallestConflictSelectionPolicy[2] == "anchor_constraint_index_asc");
    assert(tradeoff_result.analysis.smallestConflictGroupAnchorConstraintIndex == 0);
    assert(tradeoff_result.analysis.smallestConflictGroupSize == 2);
    assert(tradeoff_result.analysis.smallestConflictSelectionExplanation
           == "smallest_conflict_witness");
    assert(tradeoff_result.analysis.smallestConflictSelectionTag
           == "conflict-smallest-witness");
    assert(tradeoff_result.analysis.smallestConflictSelectionSummary
           == "smallest_conflict_witness(state=mixed,constraints=2,score=16211,anchor=0)");
    assert(tradeoff_result.analysis.smallestConflictActionLabel
           == "Inspect smallest conflict witness");
    assert(tradeoff_result.analysis.smallestConflictActionHint
           == "Start with the smallest conflict witness; it is the fastest subset to inspect and isolate.");
    assert(tradeoff_result.analysis.smallestConflictVariableKeys.size() == 2);
    assert(has_text(tradeoff_result.analysis.smallestConflictVariableKeys, "p0.x"));
    assert(has_text(tradeoff_result.analysis.smallestConflictVariableKeys, "p1.x"));
    assert(tradeoff_result.analysis.smallestConflictFreeVariableKeys.size() == 1);
    assert(has_text(tradeoff_result.analysis.smallestConflictFreeVariableKeys, "p1.x"));
    assert(tradeoff_result.analysis.primaryRedundancySubsetAnchorConstraintIndex == 2);
    assert(tradeoff_result.analysis.primaryRedundancyPriorityBreakdown.redundantConstraintContribution
           == tradeoff_result.redundancySubsets[0].priorityRedundantConstraintContribution);
    assert(tradeoff_result.analysis.primaryRedundancySelectionExplanation
           == "highest_priority_redundancy_subset");
    assert(tradeoff_result.analysis.primaryRedundancySelectionTag
           == "redundancy-primary-priority");
    assert(tradeoff_result.analysis.primaryRedundancySelectionSummary
           == "highest_priority_redundancy_subset(redundant=2,witness=4,score=1960,anchor=2)");
    assert(tradeoff_result.analysis.primaryRedundancyActionLabel
           == "Suppress primary redundancy");
    assert(tradeoff_result.analysis.primaryRedundancyActionHint
           == "Remove or suppress one redundant constraint from the primary redundancy subset first.");
    assert(tradeoff_result.analysis.primaryRedundancyVariableKeys.size() == 3);
    assert(has_text(tradeoff_result.analysis.primaryRedundancyVariableKeys, "p4.x"));
    assert(has_text(tradeoff_result.analysis.primaryRedundancyVariableKeys, "p5.x"));
    assert(has_text(tradeoff_result.analysis.primaryRedundancyVariableKeys, "p6.x"));
    assert(tradeoff_result.analysis.smallestRedundancySubsetAnchorConstraintIndex == 0);
    assert(tradeoff_result.analysis.smallestRedundancyWitnessConstraintCount == 2);
    assert(tradeoff_result.analysis.smallestRedundancyPriorityBreakdown.witnessPenalty
           == tradeoff_result.redundancySubsets[1].priorityWitnessPenalty);
    assert(tradeoff_result.analysis.smallestRedundancySelectionExplanation
           == "smallest_redundancy_witness");
    assert(tradeoff_result.analysis.smallestRedundancySelectionTag
           == "redundancy-smallest-witness");
    assert(tradeoff_result.analysis.smallestRedundancySelectionSummary
           == "smallest_redundancy_witness(redundant=1,witness=2,score=980,anchor=0)");
    assert(tradeoff_result.analysis.smallestRedundancyActionLabel
           == "Trim smallest redundancy witness");
    assert(tradeoff_result.analysis.smallestRedundancyActionHint
           == "Trim the smallest redundancy witness first; it is the cheapest subset to simplify.");
    assert(tradeoff_result.analysis.smallestRedundancyVariableKeys.size() == 2);
    assert(has_text(tradeoff_result.analysis.smallestRedundancyVariableKeys, "p0.x"));
    assert(has_text(tradeoff_result.analysis.smallestRedundancyVariableKeys, "p1.x"));
    assert(tradeoff_result.analysis.primaryRedundancySelectionPolicy[2] == "anchor_constraint_index_asc");
    assert(tradeoff_result.primaryConflictConstraintIndices.size() == 4);
    assert(tradeoff_result.primaryConflictConstraintIndices[0] == 2);
    assert(tradeoff_result.primaryConflictConstraintIndices[3] == 5);
    assert(tradeoff_result.smallestConflictConstraintIndices.size() == 2);
    assert(tradeoff_result.smallestConflictConstraintIndices[0] == 0);
    assert(tradeoff_result.smallestConflictConstraintIndices[1] == 1);
    assert(tradeoff_result.primaryRedundancyBasisConstraintIndices.size() == 2);
    assert(tradeoff_result.primaryRedundantConstraintIndices.size() == 2);
    assert(tradeoff_result.smallestRedundancyBasisConstraintIndices.size() == 1);
    assert(tradeoff_result.smallestRedundantConstraintIndices.size() == 1);
    assert(tradeoff_result.smallestRedundancyBasisConstraintIndices[0] == 0);
    assert(tradeoff_result.smallestRedundantConstraintIndices[0] == 1);
    assert(tradeoff_result.redundancySubsets.size() == 2);
    assert(tradeoff_result.redundancySubsets[0].anchorConstraintIndex == 2);
    assert(tradeoff_result.redundancySubsets[0].witnessConstraintCount == 4);
    assert(tradeoff_result.redundancySubsets[1].anchorConstraintIndex == 0);
    assert(tradeoff_result.redundancySubsets[1].witnessConstraintCount == 2);
    delete solver;
    std::cout << "solver diagnostics smoke passed with "
              << result.diagnostics.size() << " diagnostics\n";
    return 0;
}
