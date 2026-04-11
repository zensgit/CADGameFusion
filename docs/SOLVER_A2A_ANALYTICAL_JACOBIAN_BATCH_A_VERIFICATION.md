# Solver A2a Analytical Jacobian Batch A Verification

## Clean Worktree Build

Built successfully in:

- `build-codex`

Targets built:

- `core`
- `core_tests_constraints_basic`
- `core_tests_solver_constraints`

## Clean Worktree Validation

Passed:

- `core_tests_solver_constraints`
- `core_tests_constraints_basic`

## Baseline Note

`core_tests_solver_diagnostics` is a pre-existing failure on `origin/main` and was reproduced independently against the clean baseline. It is not treated as a new regression introduced by A2a.

This batch also intentionally leaves `populate_jacobian_analysis(...)` on the numerical path; only the solver solve paths switch to mixed analytical/numerical Jacobian use.

## Hygiene

- `git diff --check` passed
