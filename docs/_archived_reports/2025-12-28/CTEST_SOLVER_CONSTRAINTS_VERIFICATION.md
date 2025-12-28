# CTest Solver Constraints Verification

## Scope
- Register solver tests in CTest.
- Confirm `core_tests_solver_constraints` is discoverable and runnable via CTest.

## Configure
- `cmake -S . -B build`

## Run
- `ctest --test-dir build -R core_tests_solver_constraints -V`

## Results
- Test discovered and executed via CTest.
- Output: `Solver constraints tests passed`.
