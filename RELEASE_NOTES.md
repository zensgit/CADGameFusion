# Release Notes

## 2025-09-16 — Export/Validation Hardening & Full glTF Holes

Highlights
- Unified glTF topology: holes included by default (`--gltf-holes full`).
- Formal JSON spec parsing via nlohmann/json (hard header gate in CI).
- Deterministic normalization: outer CCW, holes CW, lexicographic start; optional ring sorting.
- Strict CI gates: schema + structure + field-level, with Python and C++ normalization checks.
- Workflows: split build/tests and exports; trial + maintenance workflows added.
- Local CI runner script for environments without GitHub Actions.

Changes
- Export CLI
  - Added `--gltf-holes <outer|full>`; default is `full`.
  - Ensures normalized rings (orientation/start) and emits `meta.normalize`.
  - Spec parsing uses vendored official `tools/third_party/json.hpp` (guarded by `CADGF_USE_NLOHMANN_JSON`).
- Golden Samples
  - Refresh script now regenerates sample/holes/complex from CLI and concave/nested_holes from specs with full topology.
- CI
  - `.github/workflows/strict-exports.yml`: unified generation with `--gltf-holes full`; strong structure + field-level comparisons.
  - Optional vcpkg toggle, pinned commit, and caching.
  - Python pip caching; normalization tests (Python + C++).
- Tooling
  - `tools/local_ci.sh` reproduces strict exports validation locally.

Migration Notes
- If you have downstream consumers of `scene_holes` glTF expecting outer-only vertices, update them to handle full topology.
- Refresh any custom golden exports with `tools/refresh_golden_samples.sh`.
- Ensure your build enables `-DCADGF_USE_NLOHMANN_JSON=ON` and vendored `json.hpp` is the official single-header.

## 2025-09-17 — Local CI Equivalence
- Ran local strict validation: `tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full`.
- Result: PASSED end-to-end (schema, structure, field-level; normalization via Python + C++).
- Scenes validated: sample, holes, multi, units, complex, and spec-driven scenes (concave, nested_holes).
- Conclusion: Local CI is fully equivalent to the latest GitHub Actions strict exports run (SUCCESS), establishing a safe baseline for follow-up changes.

## 2025-09-14 — CI Baseline Improvements
- Split strict workflows, added schema validation, field-level comparisons.
- Added initial sample exports and validation scripts.
