# CADGameFusion v0.3.2 — Two‑Week Development Plan

## Objectives (Why v0.3.2)
- Adoption & Examples: ship runnable C API examples and editor flow.
- Developer Experience (DX): faster onboarding, predictable builds/tests.
- Stability: tighten core edge cases and exporter basics.

## Scope & Workstreams (What)
- Core
  - Harden triangulation/boolean edge cases; increase golden/edge tests.
  - Validate ring sorting behavior with `-DCADGF_SORT_RINGS=ON` and document.
- Editor / Qt
  - Minimal workflow: open sample, basic selection, export via exporter path.
  - Address UI crashers from recent QA notes; keep changes small and isolated.
- Exporter
  - Stabilize default export configuration; document sample pipelines.
  - Verify paths via `docs/exporter/roadmap_v0_3_0.md` tasks.
- DX / CI
  - One‑command setup: `scripts/bootstrap_vcpkg.sh` + configure/build.
  - CTest smoke gate in CI; baseline compare script remains green.

## Timeline (When)
- Week 1: Core fixes + tests; exporter defaults; DX polish (bootstrap + docs).
- Week 2: Qt minimal flow, examples, doc updates; freeze + bugfix + release notes.

## Deliverables & Acceptance Criteria (Done)
- Build: `cmake -S . -B build && cmake --build build -j` succeeds on main platform.
- Tests: `ctest --test-dir build -V` passes; new edge/golden cases added under
  `tests/core` and `tests/tools` with `tests/<area>/test_*.cpp` naming.
- Examples: runnable binaries under `examples/` wired to CTest and documented.
- Editor: minimal open → select → export path works without crash.
- Docs: `docs/Roadmap.md` and `docs/index.md` updated; relevant guides under `docs/exporter/`.
- Tracking: GitHub milestone “v0.3.2” seeded/updated; ≥ 80% issues closed.

## Tracking & Links
- Roadmap: `docs/Roadmap.md` (index: `docs/index.md`).
- Qt plan: `QT_UI_SHELL_PLAN.md`.
- Exporter: `docs/exporter/roadmap_v0_3_0.md`.
- Milestones: `docs/milestones/v0_3_seed.md`; seeding script: `scripts/seed_v032_issues.sh`.

## Out of Scope
- Major new geometry features; large UI redesigns.

## Risks & Mitigations
- CI/vcpkg flakiness → pin/cache and retry; keep PRs small; use smoke tests.

