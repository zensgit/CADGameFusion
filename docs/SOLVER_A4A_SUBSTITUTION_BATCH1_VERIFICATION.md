## Build

From the worktree root:

```bash
cmake -S . -B build-codex
cmake --build build-codex --target core core_tests_constraints_basic core_tests_solver_constraints test_solver_baseline --parallel 8
```

## Required Tests

Run:

```bash
cd build-codex
ctest --output-on-failure -R "(core_tests_constraints_basic|core_tests_solver_constraints|test_solver_baseline)"
```

## Additional Checks

If focused substitution tests are added, run them explicitly through `ctest --output-on-failure -R "<new_test_name>"`.

If baseline JSON support is present, regenerate a fresh artifact and report its path:

```bash
CADGF_SOLVER_BASELINE_JSON=/tmp/solver-a4a-substitution-baseline.json ./tests/core/test_solver_baseline
```

## Acceptance Gate

- `core_tests_constraints_basic` passes
- `core_tests_solver_constraints` passes
- `test_solver_baseline` passes
- any new focused substitution tests pass
- `git diff --check` is clean

## Non-Goals For This Packet

Failure here should not be explained by:

- sparse Jacobian work
- tolerance tightening
- new analytical gradient coverage beyond batch A

