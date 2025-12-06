# Repository Guidelines

## Project Structure & Module Organization
- `core/`: C++17 geometric core and C API (`core/src`, public headers under `core/include`).
- `editor/qt/`: Optional Qt-based editor (toggle with `BUILD_EDITOR_QT`).
- `tools/`: Utilities and third‑party headers used by tests/examples.
- `tests/`: CMake targets for core and tools (`tests/core`, `tests/tools`).
- `examples/`: Minimal C API samples wired into CTest.
- `scripts/`: Build/dev helpers (vcpkg bootstrap, core/editor builds).
- `docs/`: Project docs and reports.

## Build, Test, and Development Commands
- Configure: `cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_EDITOR_QT=ON`
- Build all: `cmake --build build -j`
- Build core only: `scripts/build_core.sh`
- Build editor (Qt): `scripts/build_editor.sh`
- Run CTest smoke tests: `ctest --test-dir build -V`
- Run unit test binaries directly (examples): `./build/tests/core/core_tests_triangulation`
- Feature flags: `-DCADGF_USE_NLOHMANN_JSON=ON`, `-DCADGF_SORT_RINGS=ON`

## Coding Style & Naming Conventions
- C++17, 4‑space indent, brace on same line for functions and control blocks.
- Public headers live in `core/include/...` and must not pull internal deps.
- Prefer descriptive identifiers; avoid single‑letter names outside trivial loops.
- File names: lowercase with underscores or short compounds (e.g., `geometry2d.cpp`).
- Formatting: no repo‑enforced formatter; keep diffs minimal and avoid format‑only PRs.

## Testing Guidelines
- Tests live under `tests/`; some are wired to CTest, others run as built executables.
- GoogleTest is optional (auto‑detected by CMake). Without it, tests use basic assertions.
- Add both golden and edge cases for new geometry/boolean ops.
- Naming: `tests/<area>/test_*.cpp`; small, focused cases with clear intent.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `ci:`, scopes like `(qt)` or `(ci)` are encouraged.
- Keep PRs focused; include a summary of the problem, approach, and risk.
- Link related issues; add screenshots/GIFs for editor/UI changes.
- CI (GitHub Actions) must be green; update `docs/` when behavior changes.

## Security & Configuration Tips
- Dependencies use vcpkg manifest (`vcpkg.json`). On first setup: `scripts/bootstrap_vcpkg.sh`.
- Do not commit local artifacts or credentials. Use CMake options/ENV vars for secrets.
