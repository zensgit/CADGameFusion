# Solver A0 Baseline Harness

## Scope

Add a dedicated baseline harness for current solver behavior:

- `tests/core/test_solver_baseline.cpp`
- CMake registration in `tests/core/CMakeLists.txt`

The harness records representative outcomes across:

- LM
- DogLeg
- BFGS

and writes a stable JSON artifact when `CADGF_SOLVER_BASELINE_JSON` is set.

## Non-Goals

- No solver algorithm changes
- No Jacobian changes
- No sparse work
- No tolerance changes
- No substitution/pre-elimination

## Invariants

- Existing solver implementations remain untouched
- Existing public solver APIs remain unchanged
- The new harness is additive and diagnostic-only

## Expected Result

Subsequent solver packets can be evaluated against a stable before/after baseline artifact instead of ad-hoc console output.
