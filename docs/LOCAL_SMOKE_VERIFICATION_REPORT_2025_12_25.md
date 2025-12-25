# Local Smoke Verification Report (2025-12-25)

## Scope
- Build directory: `build_vcpkg`
- Focus: full CTest run (core, tools, plugins, Qt, PLM)

## Command
- `ctest --test-dir build_vcpkg -V`

## Results
- Total tests: 39
- Passed: 39
- Failed: 0

## Notes
- Qt tests reported missing font family "Sans Serif" warnings; tests still passed.
- CI status: not checked in this local run.
