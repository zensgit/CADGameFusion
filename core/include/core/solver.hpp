#pragma once
#include <string>
#include <vector>
#include <optional>
#include <functional>

namespace core {

struct VarRef { std::string id; std::string key; }; // e.g., entity id + param key

enum class ConstraintKind {
    Unknown = 0,
    Horizontal,
    Vertical,
    Parallel,
    Perpendicular,
    Equal,
    Concentric,
    Coincident,
    Distance,
    Angle,
    Tangent,
    PointOnLine,
    Symmetric,
    Midpoint,
    FixedPoint
};

enum class SolverAlgorithm {
    LM,
    DogLeg,
    BFGS
};

enum class ConstraintDiagnosticCode {
    UnsupportedType = 0,
    WrongArity,
    MissingValue,
    UnexpectedValue,
    UnboundVariable,
    DuplicateConstraint
};

enum class ConstraintStructuralState {
    Unknown = 0,
    Underconstrained,
    WellConstrained,
    Overconstrained,
    Mixed
};

struct ConstraintSpec {
    std::string type;                 // "horizontal", "distance", ...
    std::vector<VarRef> vars;         // referenced variables (entity param bindings)
    std::optional<double> value;      // numeric value if needed
};

struct ConstraintDiagnostic {
    int constraintIndex{-1};
    int relatedConstraintIndex{-1};
    ConstraintKind kind{ConstraintKind::Unknown};
    ConstraintDiagnosticCode code{ConstraintDiagnosticCode::UnsupportedType};
    std::string type;
    std::string detail;
};

struct ConstraintRedundancyGroup {
    int anchorConstraintIndex{-1};
    ConstraintKind kind{ConstraintKind::Unknown};
    std::string type;
    std::vector<int> constraintIndices;
};

struct ConstraintStructuralGroup {
    int anchorConstraintIndex{-1};
    std::vector<int> constraintIndices;
    std::vector<std::string> variableKeys;
    std::vector<std::string> basisVariableKeys;
    std::vector<std::string> freeVariableKeys;
    int jacobianRowCount{0};
    int jacobianColumnCount{0};
    int jacobianRank{0};
    int dofEstimate{0};
    int redundantConstraintEstimate{0};
    int priorityScore{0};
    ConstraintStructuralState structuralState{ConstraintStructuralState::Unknown};
};

struct ConstraintConflictGroup {
    int anchorConstraintIndex{-1};
    std::vector<int> constraintIndices;
    std::vector<std::string> variableKeys;
    std::vector<std::string> basisVariableKeys;
    std::vector<std::string> freeVariableKeys;
    int jacobianRank{0};
    int dofEstimate{0};
    int redundantConstraintEstimate{0};
    int priorityScore{0};
    int priorityStateBias{0};
    int priorityRedundantConstraintContribution{0};
    int priorityConstraintCountContribution{0};
    int priorityFreeVariableContribution{0};
    int priorityDofContribution{0};
    ConstraintStructuralState structuralState{ConstraintStructuralState::Unknown};
};

struct ConstraintRedundancySubset {
    int anchorConstraintIndex{-1};
    std::vector<int> basisConstraintIndices;
    std::vector<int> redundantConstraintIndices;
    std::vector<std::string> variableKeys;
    int jacobianRank{0};
    int witnessConstraintCount{0};
    int priorityScore{0};
    int priorityRedundantConstraintContribution{0};
    int priorityWitnessPenalty{0};
    ConstraintStructuralState structuralState{ConstraintStructuralState::Unknown};
};

struct ConstraintConflictPriorityBreakdownSummary {
    int stateBias{0};
    int redundantConstraintContribution{0};
    int constraintCountContribution{0};
    int freeVariableContribution{0};
    int dofContribution{0};
};

struct ConstraintRedundancyPriorityBreakdownSummary {
    int redundantConstraintContribution{0};
    int witnessPenalty{0};
};

struct ConstraintAnalysis {
    int constraintCount{0};
    int referencedVariableCount{0};
    int boundVariableCount{0};
    int wellFormedConstraintCount{0};
    int uniqueConstraintCount{0};
    int duplicateConstraintCount{0};
    int duplicateConstraintGroupCount{0};
    int largestDuplicateConstraintGroupSize{0};
    int structuralDiagnosticCount{0};
    int bindingDiagnosticCount{0};
    int evaluableConstraintCount{0};
    int jacobianRowCount{0};
    int jacobianColumnCount{0};
    int jacobianRank{0};
    int dofEstimate{0};
    int redundantConstraintEstimate{0};
    ConstraintStructuralState structuralState{ConstraintStructuralState::Unknown};
    int structuralGroupCount{0};
    int unknownGroupCount{0};
    int underconstrainedGroupCount{0};
    int wellConstrainedGroupCount{0};
    int overconstrainedGroupCount{0};
    int mixedGroupCount{0};
    int conflictGroupCount{0};
    int largestConflictGroupSize{0};
    int redundancySubsetCount{0};
    int redundantConstraintCandidateCount{0};
    int freeVariableCandidateCount{0};
    int problematicConstraintCount{0};
    int primaryConflictAnchorConstraintIndex{-1};
    int primaryConflictPriorityScore{0};
    int smallestConflictGroupAnchorConstraintIndex{-1};
    int smallestConflictGroupSize{0};
    int primaryRedundancySubsetAnchorConstraintIndex{-1};
    int primaryRedundancyPriorityScore{0};
    int smallestRedundancySubsetAnchorConstraintIndex{-1};
    int smallestRedundancyWitnessConstraintCount{0};
    ConstraintConflictPriorityBreakdownSummary primaryConflictPriorityBreakdown{};
    ConstraintConflictPriorityBreakdownSummary smallestConflictPriorityBreakdown{};
    ConstraintRedundancyPriorityBreakdownSummary primaryRedundancyPriorityBreakdown{};
    ConstraintRedundancyPriorityBreakdownSummary smallestRedundancyPriorityBreakdown{};
    std::string primaryConflictSelectionExplanation;
    std::string smallestConflictSelectionExplanation;
    std::string primaryRedundancySelectionExplanation;
    std::string smallestRedundancySelectionExplanation;
    std::string primaryConflictSelectionTag;
    std::string smallestConflictSelectionTag;
    std::string primaryRedundancySelectionTag;
    std::string smallestRedundancySelectionTag;
    std::string primaryConflictSelectionSummary;
    std::string smallestConflictSelectionSummary;
    std::string primaryRedundancySelectionSummary;
    std::string smallestRedundancySelectionSummary;
    std::string primaryConflictActionLabel;
    std::string smallestConflictActionLabel;
    std::string primaryRedundancyActionLabel;
    std::string smallestRedundancyActionLabel;
    std::string primaryConflictActionHint;
    std::string smallestConflictActionHint;
    std::string primaryRedundancyActionHint;
    std::string smallestRedundancyActionHint;
    std::vector<std::string> primaryConflictVariableKeys;
    std::vector<std::string> primaryConflictFreeVariableKeys;
    std::vector<std::string> smallestConflictVariableKeys;
    std::vector<std::string> smallestConflictFreeVariableKeys;
    std::vector<std::string> primaryRedundancyVariableKeys;
    std::vector<std::string> smallestRedundancyVariableKeys;
    std::vector<std::string> primaryConflictSelectionPolicy;
    std::vector<std::string> smallestConflictSelectionPolicy;
    std::vector<std::string> primaryRedundancySelectionPolicy;
    std::vector<std::string> smallestRedundancySelectionPolicy;
};

struct SolveResult {
    bool ok{false};
    int iterations{0};
    double finalError{0.0};
    std::string message;
    std::vector<ConstraintDiagnostic> diagnostics;
    std::vector<ConstraintRedundancyGroup> redundancyGroups;
    std::vector<ConstraintStructuralGroup> structuralGroups;
    std::vector<ConstraintConflictGroup> conflictGroups;
    std::vector<ConstraintRedundancySubset> redundancySubsets;
    std::vector<int> problematicConstraintIndices;
    std::vector<int> primaryConflictConstraintIndices;
    std::vector<int> smallestConflictConstraintIndices;
    std::vector<int> primaryRedundancyBasisConstraintIndices;
    std::vector<int> primaryRedundantConstraintIndices;
    std::vector<int> smallestRedundancyBasisConstraintIndices;
    std::vector<int> smallestRedundantConstraintIndices;
    ConstraintAnalysis analysis;
};

ConstraintKind classifyConstraintKind(const std::string& type);
const char* constraintKindName(ConstraintKind kind);
const char* constraintDiagnosticCodeName(ConstraintDiagnosticCode code);
const char* constraintStructuralStateName(ConstraintStructuralState state);

class ISolver {
public:
    virtual ~ISolver() = default;
    virtual void setMaxIterations(int iters) = 0;
    virtual void setTolerance(double tol) = 0;
    // Legacy no-binding solve (kept for compatibility)
    virtual SolveResult solve(std::vector<ConstraintSpec>& constraints) = 0;

    // New: solve with variable bindings accessors
    using GetVar = std::function<double(const VarRef&, bool& ok)>;
    using SetVar = std::function<void(const VarRef&, double)>;
    virtual SolveResult solveWithBindings(std::vector<ConstraintSpec>& constraints, const GetVar& get, const SetVar& set) = 0;
};

// Factory function: DogLeg default with LM fallback
ISolver* createMinimalSolver();
ISolver* createSolver(SolverAlgorithm algo = SolverAlgorithm::DogLeg);

} // namespace core
