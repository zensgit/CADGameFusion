# CI Verification Report (main) — 2025-12-19

## Goal
- Keep `main` CI green after merging recent PRs and removing workflow breakages.

## Merged PRs (today)
- PR #115 — feat(ci): add Local CI Gate workflow using local_ci.sh  
  https://github.com/zensgit/CADGameFusion/pull/115  
  Merge commit: `2f6df766180333f7530c0fdbd7af4369f1f882b8`
- PR #116 — fix(ci): keep main workflows green  
  https://github.com/zensgit/CADGameFusion/pull/116  
  Merge commit: `8b77641fdb6687ab4031e5e6146cb952e4f4e9a1`
- PR #117 — fix(ci): repair cleanup-old-issues workflow YAML  
  https://github.com/zensgit/CADGameFusion/pull/117  
  Merge commit: `b0f27cd3d8eca17f1ae3e96f84914e1b0361e390`
- PR #118 — fix(ci): Test Simple build without TinyGLTF  
  https://github.com/zensgit/CADGameFusion/pull/118  
  Merge commit: `166e55ff65f356c8231ef8fb8f5ab22e273aae45`

## Issues & Fixes

### 1) `.github/workflows/cleanup-old-issues.yml` YAML parse error (workflow file issue / 0s failures)
- Symptom: GitHub Actions shows a failing “workflow file issue” for `.github/workflows/cleanup-old-issues.yml` on push (0s, no jobs).
- Root cause: The `run: |` block contained a multiline `--comment "..."` where some lines were not indented, breaking YAML syntax.
- Fix (PR #117): Build the comment via `printf '%b'` into a variable and pass it as `gh issue close --comment "$COMMENT"`, avoiding YAML indentation hazards.

### 2) `Test Simple` on Ubuntu failed: `fatal error: tiny_gltf.h: No such file or directory`
- Symptom: `Test Simple` failed while compiling `tools/export_cli.cpp` due to missing TinyGLTF headers.
- Root cause: `tools/CMakeLists.txt` always built `export_cli` even when TinyGLTF wasn’t available (the CMake logic only printed a warning, but the target still compiled).
- Fix (PR #118):
  - `tools/CMakeLists.txt`: define `CADGF_HAS_TINYGLTF` only when `tiny_gltf.h` is found.
  - `tools/export_cli.cpp`: guard the TinyGLTF include + glTF writer; without TinyGLTF, `export_cli` still builds and skips glTF export with a warning.

## Verification (main HEAD)
- Branch: `main`
- HEAD commit: `166e55ff65f356c8231ef8fb8f5ab22e273aae45` (`fix(ci): Test Simple build without TinyGLTF`)

### GitHub Actions: push runs on `main` (all green)
| Workflow | Conclusion | Run |
|---|---|---|
| Core CI | success | [20357002906](https://github.com/zensgit/CADGameFusion/actions/runs/20357002906) |
| Core Strict - Build and Tests | success | [20357002927](https://github.com/zensgit/CADGameFusion/actions/runs/20357002927) |
| Core Strict - Exports, Validation, Comparison | success | [20357002915](https://github.com/zensgit/CADGameFusion/actions/runs/20357002915) |
| Core Strict - Validation Simple | success | [20357002929](https://github.com/zensgit/CADGameFusion/actions/runs/20357002929) |
| Local CI Gate | success | [20357002924](https://github.com/zensgit/CADGameFusion/actions/runs/20357002924) |
| Quick Check - Verification + Lint | success | [20357002918](https://github.com/zensgit/CADGameFusion/actions/runs/20357002918) |
| Test Simple | success | [20357002910](https://github.com/zensgit/CADGameFusion/actions/runs/20357002910) |
| Test Actions | success | [20357002897](https://github.com/zensgit/CADGameFusion/actions/runs/20357002897) |
| Exporter Trial (Experimental Flags) | success | [20357002909](https://github.com/zensgit/CADGameFusion/actions/runs/20357002909) |

## Local spot-checks (optional)

### Compile-only `export_cli.cpp` (no TinyGLTF)
```bash
c++ -std=c++17 -I. -Icore/include -Itools -c tools/export_cli.cpp -o /tmp/export_cli.o
```

### Minimal CMake build (Ubuntu, no vcpkg)
```bash
sudo apt-get update
sudo apt-get install -y build-essential cmake libeigen3-dev

cmake -S . -B build -DBUILD_EDITOR_QT=OFF -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
./build/tests/core/test_simple
```
