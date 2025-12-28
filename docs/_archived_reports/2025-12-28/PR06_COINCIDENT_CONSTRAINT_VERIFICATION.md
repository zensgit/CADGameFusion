# PR-06 Coincident Constraint Verification

## Scope
- Add `ElementRef`/`PointRole` types (internal scaffolding).
- Add `coincident` residual handling in solver.
- Extend solver constraints test coverage.

## Build
- `cmake --build build -j --target core_tests_solver_constraints`

## Test
- `ctest --test-dir build -R core_tests_solver_constraints -V`
  - Note: CTest reported no tests registered in this build.
- Manual run: `./build/tests/core/core_tests_solver_constraints`

## Results
- Manual run passed: `Solver constraints tests passed`.
