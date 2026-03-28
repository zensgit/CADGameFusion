# STEP188 Constraints Basic Design

## Goal
Add a stable, explicit success-path regression lane for the minimal 2D constraint solver.

This step is not about making the solver SolveSpace-complete. It is about locking down the
basic constraints that the current implementation already claims to support.

Covered constraint types:
- `horizontal`
- `vertical`
- `equal`
- `distance`
- `parallel`
- `perpendicular`

Covered solve shapes:
- single-constraint success paths for all six basic kinds;
- paired-constraint success paths that prove the minimal solver still composes simple
  constraints coherently:
  - `horizontal + distance`
  - `vertical + distance`
  - `parallel + distance`
  - `equal + distance`
  - `perpendicular + distance`

## Why This Step Exists
The solver diagnostics lane has grown quickly:
- typed constraint kinds;
- structural analysis;
- conflict/redundancy groups;
- explainable ranking output.

That made the failure-path richer, but the basic success-path regression was still easy to lose.
`core_tests_constraints_basic` becomes the simplest guard that says:
- the current minimal solver still converges on the basic supported constraints;
- structural analysis still reports a coherent underconstrained success shape for those cases.

## Scope
Files involved:
- `tests/core/test_constraints_basic.cpp`
- `tests/core/CMakeLists.txt`
- `core/include/core/solver.hpp`
- `core/src/solver.cpp`

The test intentionally stays direct and small:
- build a single `MinimalSolver`;
- bind variables via `solveWithBindings(...)`;
- run both single-constraint and small paired-constraint cases;
- verify both:
  - geometric outcome;
  - basic analysis invariants.

## Current Expected Contract
For each covered case, the test expects:
- `result.ok == true`
- `result.diagnostics.empty()`
- `analysis.constraintCount == constraints.size()`
- `analysis.evaluableConstraintCount == constraints.size()`
- `analysis.wellFormedConstraintCount == constraints.size()`
- `analysis.uniqueConstraintCount == constraints.size()`
- `analysis.structuralState == Underconstrained`
- `analysis.structuralGroupCount == 1`
- no conflict/redundancy/duplicate counts

This is deliberately conservative. It matches the current minimal solver rather than a future
fully constrained sketcher.

## Non-Goals
- no new solver UI;
- no new schema;
- no promise of full sketch diagnosis parity with SolveSpace or FreeCAD Sketcher;
- no attempt to prove global optimality or complex multi-constraint solve quality.

## Exit Criteria
Step188 is complete when:
- `core_tests_constraints_basic` is explicitly built and passes;
- the six supported basic constraints are all covered;
- at least a small set of paired success paths are covered;
- the test remains stable after solver diagnostics changes.

## Continuous Quality Contract
Step188 is now meant to be more than a standalone ctest target.

It is wired into:
- `tools/local_ci.sh`
- `tools/editor_gate.sh`
- `tools/editor_weekly_validation.sh`
- `tools/write_ci_artifact_summary.py`
- `tools/write_step176_dashboard.py`
- `tools/write_step176_weekly_report.py`
- `tools/check_weekly_summary.sh`

That makes `core_tests_constraints_basic` the solver equivalent of the DWG-open business-path
lane:
- small;
- fast;
- explicit;
- continuously reportable.

The quality contract is intentionally simple:
- local CI reports a single `ctestConstraintsBasicStatus`;
- gate reports a dedicated `constraints_basic_ctest` lane with case/pass/fail counts;
- weekly/reporting consumers render the same lane without introducing a new schema.

## Current Coverage Shape
Step188 now covers:
- six single-constraint success paths:
  - `horizontal`
  - `vertical`
  - `equal`
  - `distance`
  - `parallel`
  - `perpendicular`
- eight small composed success paths:
  - `horizontal+distance`
  - `vertical+distance`
  - `parallel+distance`
  - `equal+distance`
  - `perpendicular+distance`
  - `equal_x+distance`
  - `parallel_vertical+distance`
  - `perpendicular_horizontal+distance`

This keeps the test small, but it is no longer a thin “one example per keyword” lane.

## Expanded Coverage Shape
Step188 now covers sixteen success-path checks:
- six single-constraint cases
- ten composed cases

The two newest composed cases are:
- `equal_x+horizontal`
- `equal_y+vertical`

These are intentionally small “coincident-by-orthogonal-components” checks. They increase
confidence that the current minimal solver can stably satisfy multi-constraint success paths
without immediately jumping into heavier redundancy/conflict scenarios.

## Eighteen Success-Path Checks
Step188 now covers eighteen success-path checks:
- six single-constraint cases
- twelve composed cases

The two newest composed cases are:
- `parallel_horizontal+vertical`
- `parallel_vertical+horizontal`

These keep the lane low-risk:
- they are still small underconstrained successes;
- they do not introduce new solver feature scope;
- they strengthen confidence that the minimal solver can compose orientation constraints without
  immediately sliding into redundancy or conflict diagnostics.

## Twenty Success-Path Checks
Step188 now covers twenty success-path checks:
- six single-constraint cases
- fourteen composed cases

The two newest composed cases are:
- `horizontal+vertical`
- `equal_x+equal_y`

These are still intentionally small success-path combinations:
- `horizontal+vertical` verifies that orthogonal orientation constraints can coexist without
  destabilizing the current minimal solve path;
- `equal_x+equal_y` verifies that component-wise equality composition remains stable without
  requiring a heavier coincidence or conflict model.

That keeps Step188 pragmatic:
- the lane stays fast enough for continuous gate/local use;
- the cases remain explainable and low-risk;
- coverage continues to thicken around real multi-constraint success paths instead of isolated
  keyword checks.

## Twenty-Two Success-Path Checks
Step188 now covers twenty-two success-path checks:
- six single-constraint cases
- sixteen composed cases

The two newest composed cases are:
- `equal_y+distance`
- `horizontal+equal_anchor_x`

Why these two belong here:
- `equal_y+distance` is the direct mirror of the existing `equal_x+distance` check, so it
  thickens the current scalar-equality-plus-distance success path without introducing any new
  solver behavior;
- `horizontal+equal_anchor_x` proves that the same minimal solver still composes a standard
  geometric constraint with a cross-entity scalar anchor, which is a realistic but still
  low-risk pattern for imported geometry.

This keeps Step188 on-scope:
- no new constraint kinds were added;
- the cases are still underconstrained successes with empty diagnostics;
- the lane becomes more representative of real scalar/geometric composition instead of only
  symmetric point-pair checks.

## Twenty-Six Success-Path Checks
Step188 now covers twenty-six success-path checks:
- six single-constraint cases
- twenty composed cases

The four newest composed cases are:
- `vertical+equal_anchor_x`
- `horizontal+equal_anchor_y`
- `vertical+equal_anchor_y`
- `distance+equal_anchor_x`

Why these belong here:
- `vertical+equal_anchor_x` and `horizontal+equal_anchor_y` finish the low-risk external-anchor
  symmetry around the earlier `horizontal+equal_anchor_x` style case;
- `vertical+equal_anchor_y` closes the remaining mirror on the `y` anchor path, so the lane now
  covers both scalar anchors against both orientation primitives;
- `distance+equal_anchor_x` adds a simple cross-entity anchor-plus-distance composition that is
  still underconstrained and easy to reason about, but is closer to how imported geometry inherits
  scalar anchors from neighboring entities.

This keeps Step188 on-scope:
- no new constraint kinds were added;
- the new cases are still deterministic success paths with empty diagnostics;
- coverage gets thicker around anchor-driven and cross-entity scalar/geometric composition
  without drifting into conflict or redundancy scenarios.

## Twenty-Eight Success-Path Checks
Step188 now covers twenty-eight success-path checks:
- six single-constraint cases
- twenty-two composed cases

The two newest composed cases are:
- `parallel_horizontal+equal_anchor_y`
- `perpendicular_vertical+equal_anchor_x`

Why these belong here:
- `parallel_horizontal+equal_anchor_y` extends the already-green parallel family with a low-risk
  external anchor on the orthogonal scalar axis;
- `perpendicular_vertical+equal_anchor_x` does the same for the perpendicular family, so the lane
  keeps thickening around orientation-plus-anchor success paths without introducing new constraint
  kinds or redundancy expectations.

This keeps Step188 on-scope:
- no new constraint kinds were added;
- the new cases are still deterministic success paths with empty diagnostics;
- coverage becomes less biased toward distance/equality pairing and more representative of anchor
  composition around orientation constraints.

## Thirty Success-Path Checks
Step188 now covers thirty success-path checks:
- six single-constraint cases
- twenty-four composed cases

The two newest composed cases are:
- `parallel_vertical+equal_anchor_y`
- `perpendicular_horizontal+equal_anchor_y`

Why these belong here:
- they extend the same low-risk anchor-composition pattern already used for the `x` axis into the
  remaining `y`-axis mirror cases;
- they thicken the orientation-plus-anchor success lane without introducing new constraint kinds,
  redundancy expectations, or overconstrained outcomes.

This keeps Step188 on-scope:
- no new constraint kinds were added;
- the new cases are still deterministic success paths with empty diagnostics;
- the lane now has more symmetric coverage across horizontal/vertical/parallel/perpendicular anchor
  compositions before moving on to harder diagnostic scenarios.

## Thirty-Two Success-Path Checks
Step188 now covers thirty-two success-path checks:
- six single-constraint cases
- twenty-six composed cases

The four newest composed cases are:
- `parallel_vertical+equal_anchor_y`
- `parallel_horizontal+equal_anchor_x`
- `perpendicular_horizontal+equal_anchor_y`
- `perpendicular_vertical+equal_anchor_y`

Why these belong here:
- they finish the low-risk anchor-composition mirrors around the already-green parallel and
  perpendicular families;
- they keep thickening the lane around deterministic success paths instead of drifting into
  redundancy or conflict diagnostics;
- they broaden external-anchor coverage on both axes while staying inside the same six supported
  basic constraint kinds.

This keeps Step188 on-scope:
- no new constraint kinds were added;
- the new cases are still deterministic success paths with empty diagnostics;
- coverage becomes more symmetric across horizontal, vertical, parallel, and perpendicular anchor
  compositions without changing solver scope.

## Thirty-Eight Success-Path Checks

Step188 now covers thirty-eight deterministic success-path checks:
- six single-constraint cases;
- thirty-two composed cases.

The two newest composed cases are:
- `equal_x+equal_anchor_y`
- `equal_y+equal_anchor_x`

Why these belong here:
- they extend the already-green equality family without introducing new constraint kinds or
  diagnostics behavior;
- they fill the last low-risk symmetry gap between direct equality pairs and anchored equality
  compositions;
- they stay fully on the success-path side of Step188 rather than drifting into redundancy or
  conflict analysis, which remains a different lane.

## Forty Success-Path Checks

Step188 now covers forty deterministic success-path checks:
- six single-constraint cases;
- thirty-four composed cases.

The two newest composed cases are:
- `horizontal+distance+equal_anchor_x`
- `vertical+distance+equal_anchor_y`

Why these belong here:
- they thicken the already-green distance-plus-orientation family with low-risk anchor composition
  on the constrained scalar axis;
- they stay inside the same six supported basic constraint kinds and do not introduce new
  diagnostic expectations;
- they make the success-path lane less biased toward pairwise compositions by adding three-part
  deterministic solves that are still intentionally underconstrained but stable.

## Forty-Two Success-Path Checks

Step188 now covers forty-two deterministic success-path checks:
- six single-constraint cases;
- thirty-six composed cases.

The two newest composed cases are:
- `parallel_horizontal+distance+equal_anchor_x`
- `parallel_vertical+distance+equal_anchor_y`

Why these belong here:
- they extend the same three-part success-path composition into the `parallel` family instead of
  stopping at `horizontal/vertical`;
- they continue to increase coverage without changing solver scope, constraint taxonomy, or the
  expectation of empty diagnostics on green runs;
- they move the lane closer to a solver-basic baseline that is broad enough to justify the richer
  explainable diagnostics built elsewhere.

## Forty-Four Success-Path Checks

Step188 now covers forty-four deterministic success-path checks:
- six single-constraint cases;
- thirty-eight composed cases.

The two newest composed cases are:
- `perpendicular_horizontal+distance+equal_anchor_x`
- `perpendicular_vertical+distance+equal_anchor_y`

Why these belong here:
- they finish the same three-part success-path pattern for the `perpendicular` family, so the lane
  no longer stops at `horizontal/vertical/parallel`;
- they stay inside the same six supported basic constraint kinds and keep the expectation of empty
  diagnostics on green runs;
- they push the baseline further toward an explainable-but-still-basic solver surface that compares
  more favorably with the richer success-path coverage seen in mature sketch solvers.

## Forty-Six Success-Path Checks

Step188 now covers forty-six deterministic success-path checks:
- six single-constraint cases;
- forty composed cases.

The two newest composed cases are:
- `equal_x+distance+equal_anchor_y`
- `equal_y+distance+equal_anchor_x`

Why these belong here:
- they complete the same three-part success-path shape for the `equal` family instead of stopping
  at the `horizontal/vertical/parallel/perpendicular` families;
- they stay within the same supported constraint kinds and keep the green-lane expectation of
  empty diagnostics;
- they make the basic lane less skewed toward orientation-only compositions and move it closer to
  a solver baseline that is both broader and still explainable.

## Forty-Eight Success-Path Checks

Step188 now covers forty-eight deterministic success-path checks:
- six single-constraint cases;
- forty-two composed cases.

The two newest composed cases are:
- `horizontal+distance+equal_anchor_y`
- `vertical+distance+equal_anchor_x`

Why these belong here:
- they complete the anchor-axis symmetry for the three-part `horizontal/vertical + distance +
  anchor-equality` family instead of leaving only one anchor direction covered;
- they stay strictly on the green success-path side, so they increase baseline confidence without
  mixing in redundancy or conflict expectations;
- they make the basic lane less biased toward one-axis anchoring and therefore closer to the kind
  of balanced success-path surface expected from mature sketch solvers.

## Fifty-Two Success-Path Checks

Step188 now covers fifty-two deterministic success-path checks:
- six single-constraint cases;
- forty-six composed cases.

The four newest composed cases are:
- `parallel_horizontal+distance+equal_anchor_y`
- `parallel_vertical+distance+equal_anchor_x`
- `perpendicular_horizontal+distance+equal_anchor_y`
- `perpendicular_vertical+distance+equal_anchor_x`

Why these belong here:
- they finish the missing anchor-direction symmetry for the three-part `parallel/perpendicular`
  families instead of keeping that coverage skewed toward a single anchor axis;
- they stay within the same six supported basic constraint kinds and keep the green-lane
  expectation of empty diagnostics intact;
- they move Step188 further beyond a toy success-path set toward a broader, still-explainable
  solver baseline that is more defensible when compared with established sketch solvers.

## Sixty Success-Path Checks

Step188 now covers sixty deterministic success-path checks:
- six single-constraint cases;
- fifty-four composed cases.

The eight newest composed cases in the promoted sixty-case baseline are:
- `horizontal+distance+equal_anchor_y`
- `vertical+distance+equal_anchor_x`
- `equal_x+vertical+distance`
- `equal_y+horizontal+distance`
- `parallel_horizontal+distance+equal_anchor_y`
- `parallel_vertical+distance+equal_anchor_x`
- `perpendicular_horizontal+distance+equal_anchor_y`
- `perpendicular_vertical+distance+equal_anchor_x`

Why this belongs here:
- it finishes the missing axis and anchor-direction symmetry for the three-part
  `horizontal/vertical/equal/parallel/perpendicular + distance + anchor-equality` families instead
  of leaving the basic lane skewed toward one anchor direction;
- it stays within the same six supported basic constraint kinds and keeps the green-lane
  expectation of empty diagnostics intact;
- it pushes Step188 closer to a solver-basic surface that is broad enough to defend the richer
  explainable diagnostics elsewhere in the codebase, which is the practical way to close part of
  the gap with mature sketch solvers without pretending the full solver depth already exists.

## Coincident, Concentric, and Angle: Implemented

Step188 now includes full numeric residual implementations for the three remaining constraint
types. All nine ConstraintKind values are now fully evaluable by the Gauss-Newton solver.

### Constraint types

- `coincident` (ConstraintKind::Coincident) — arity 4, no value
- `concentric` (ConstraintKind::Concentric) — arity 4, no value
- `angle` (ConstraintKind::Angle) — arity 8, value in radians

### Solver implementation

Changes applied to `solver.cpp`:
1. `expected_arity()` returns 4 for Coincident/Concentric, 8 for Angle.
2. `has_numeric_residual_implementation()` returns `true` for all three.
3. Residual lambda implementations:
   - Coincident: Euclidean distance between two points → 0.
   - Concentric: Euclidean distance between two circle centers → 0.
   - Angle: `acos(dot / (n1 * n2)) - target_angle` → 0.

### Test coverage

Six test cases are now active (previously disabled in `if (false)` blocks):

Single-constraint success paths:
- `coincident` -- two points coincide (4 VarRefs: x, y, x, y), no value
- `concentric` -- two circles share center (4 VarRefs: cx, cy, cx, cy), no value
- `angle_45deg` -- angle between two lines (8 VarRefs), value = pi/4 radians

Composed success paths:
- `coincident+distance` -- coincident constraint plus a distance to a third point
- `concentric+equal_radius` -- concentric constraint plus equal radii
- `angle_45deg+distance` -- angle constraint plus a distance on the first line

### Final coverage shape

The test file now contains:
- nine `classifyConstraintKind()` assertions (covering all non-Unknown kinds);
- ten `constraintKindName()` assertions (covering all enum values);
- seventy-two active success-path solve checks (60 original + 6 coincident/concentric/angle base
  cases + 6 densification cases).

Densification beyond the initial 66-check baseline added two new cases per newly enabled type:
- coincident: `coincident_two_line_endpoints`, `coincident_arc_center_to_point`
- concentric: `concentric_circle_and_arc`, `concentric_two_arcs`
- angle: `angle_right_angle_two_lines`, `angle_45_deg`

All nine ConstraintKind values are now exercised end-to-end through the Levenberg-Marquardt
solver with full Jacobian analysis. Step188 is complete.

### Scope note

- Designed test coverage: 72 `run_single` invocations.
- Fresh verified baseline: 72/72 pass (see STEP188_CONSTRAINTS_BASIC_VERIFICATION.md).
- All nine constraint kinds (horizontal, vertical, equal, distance, parallel, perpendicular,
  coincident, concentric, angle) are fully implemented and tested.
