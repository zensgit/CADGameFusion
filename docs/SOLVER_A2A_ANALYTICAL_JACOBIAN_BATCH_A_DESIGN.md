# Solver A2a Analytical Jacobian Batch A

## Scope

Introduce analytical Jacobian support for the first safe batch of simple constraint kinds in `core/src/solver.cpp`:

- `horizontal`
- `vertical`
- `equal`
- `coincident`
- `concentric`
- `fixed_point`
- `midpoint`
- `symmetric`

Use analytical derivatives in the solver solve paths, with per-constraint fallback to existing numerical differentiation for unsupported or invalid cases.

## Non-Goals

- No sparse Jacobian
- No tolerance changes
- No substitution/pre-elimination
- No full 14-kind analytical rollout
- No changes to `populate_jacobian_analysis(...)` in this batch

## Invariants

- Unsupported constraint kinds continue using numerical differentiation
- Non-finite analytical values fall back to numerical differentiation
- Debug-only analytical-vs-numerical verification remains non-fatal

## Expected Result

Simple linear/affine constraints stop paying full numerical-difference cost in the solve path, while unsupported nonlinear constraints keep current behavior.
