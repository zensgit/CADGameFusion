# CADGameFusion

[![Core CI](https://github.com/zensgit/CADGameFusion/actions/workflows/cadgamefusion-core.yml/badge.svg?branch=main)](https://github.com/zensgit/CADGameFusion/actions/workflows/cadgamefusion-core.yml)
[![Core Strict](https://github.com/zensgit/CADGameFusion/actions/workflows/core-strict-build-tests.yml/badge.svg?branch=main)](https://github.com/zensgit/CADGameFusion/actions/workflows/core-strict-build-tests.yml)
[![Quick Check](https://github.com/zensgit/CADGameFusion/actions/workflows/quick-check.yml/badge.svg?branch=main)](https://github.com/zensgit/CADGameFusion/actions/workflows/quick-check.yml)

High‑performance 2D CAD/geometry core with an optional Qt editor and export tooling.

## Quick Links
- Repository Guidelines: [AGENTS.md](AGENTS.md)
- Manual test guide: [MANUAL_TEST_GUIDE.md](MANUAL_TEST_GUIDE.md)
- Offline / Subset Validation Guide: [OFFLINE_MODE.md](OFFLINE_MODE.md)
- One‑Command Quick Check: `tools/quick_check.sh` or `make quick` / `make strict`
- CMake package usage: [docs/CMake-Package-Usage.md](docs/CMake-Package-Usage.md)
- Release notes: [docs/Release-Notes-2025-09-30.md](docs/Release-Notes-2025-09-30.md)
- Qt app repo: https://github.com/zensgit/cadgf-app-qt

## Build (Quick Start)
```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build -V
```

## Editor (Qt)
The standalone Qt application now lives in https://github.com/zensgit/cadgf-app-qt.
This repo still keeps `editor/qt` for now; enable with `-DBUILD_EDITOR_QT=ON` and build target `editor_qt`.

## API Stability (C ABI)
- Stable binary boundary: C ABI in `core_c` (`cadgf_*` symbols in `core/include/core/core_c_api.h`).
- Plugin ABI: `core/include/core/plugin_abi_c_v1.h` (C function table).
- `core::Document` and other C++ headers are internal and not ABI-stable across DLL/DSO boundaries.
- CMake package usage: `docs/CMake-Package-Usage.md` (find_package + `cadgf::core_c`).
- Runtime checks:
  - `cadgf_get_abi_version()` for ABI level
  - `cadgf_get_version()` for release string
  - `cadgf_get_feature_flags()` for compile-time feature flags

## Optional Dependencies
- Qt: required for the editor (`-DBUILD_EDITOR_QT=ON`).
- TinyGLTF: optional; when missing, glTF export is disabled (JSON/DXF still work).

## One-Command Health Check
```bash
# Offline quick subset + health check (allow offline)
bash tools/local_ci.sh --offline --quick --clean-exports --summary-json && \
  bash tools/check_local_summary.sh --offline-allowed

# Strict quick subset (non-offline) with summary check
bash tools/local_ci.sh --quick --clean-exports --summary-json --strict-exit && \
  bash tools/check_local_summary.sh

# Make targets
make quick   # offline quick subset
make strict  # strict quick subset
```

Notes:
- `tools/local_ci.sh` runs a small set of DXF importer CTests and records their status in `build/local_ci_summary.json`:
  - `test_dxf_hatch_dash_run` (`ctestHatchDashStatus`)
  - `test_dxf_text_alignment_partial_run` (`ctestTextAlignPartialStatus`)
  - `test_dxf_text_alignment_extended_run` (`ctestTextAlignExtendedStatus`)
  - `test_dxf_hatch_dense_cap_run` (`ctestHatchDenseCapStatus`)
  - `test_dxf_hatch_large_boundary_budget_run` (`ctestHatchLargeBoundaryBudgetStatus`)
  - `test_dxf_nonfinite_numbers_run` (`ctestNonfiniteNumbersStatus`)
- when `RUN_EDITOR_GATE=1`, `tools/local_ci.sh` also records STEP166 baseline-compare metadata from `editor_gate_summary.json` (for example `editorGateStep166BaselineCompared`, `editorGateStep166BaselineRunId`)
- when `RUN_EDITOR_SMOKE_GATE=1`, `tools/local_ci.sh` defaults editor smoke to a larger gate sample (`EDITOR_SMOKE_GATE_LIMIT`, default `20`) and can run continuous gate checks (`EDITOR_SMOKE_GATE_RUNS`, strict default `3`), with run counters written to summary fields:
  - `editorSmokeGateRunsTarget`, `editorSmokeGateRunCount`, `editorSmokeGatePassCount`, `editorSmokeGateFailCount`
  - failure attribution fields: `editorSmokeFailureCodeCounts`, `editorSmokeFailureCodeCount`, `editorSmokeFirstFailureCode`, `editorSmokeRecentFailures`
- when `RUN_EDITOR_UI_FLOW_SMOKE_GATE=1`, `tools/local_ci.sh` can run continuous UI-flow gate checks (`EDITOR_UI_FLOW_SMOKE_GATE_RUNS`, strict default `3`), with run counters written to summary fields:
  - `editorUiFlowSmokeGateRunsTarget`, `editorUiFlowSmokeGateRunCount`, `editorUiFlowSmokeGatePassCount`, `editorUiFlowSmokeGateFailCount`
  - failure attribution fields: `editorUiFlowSmokeFailureCodeCounts`, `editorUiFlowSmokeFailureCodeCount`, `editorUiFlowSmokeFirstFailureCode`
- `tools/ci_editor_light.sh` runs UI-flow smoke by default only when the Codex Playwright wrapper exists at `${CODEX_HOME:-$HOME/.codex}/skills/playwright/scripts/playwright_cli.sh`; if missing, default UI-flow smoke is skipped (explicit `RUN_EDITOR_UI_FLOW_SMOKE(_GATE)=1` still fails fast).
- `tools/editor_gate.sh` supports lightweight nightly mode via:
  - `RUN_STEP166_GATE=0` (skip STEP166 stage)
  - `EDITOR_SMOKE_NO_CONVERT=1` (round-trip smoke runs schema-only, no convert)
- CI artifact summary helper: `tools/write_ci_artifact_summary.py` (renders run_id/failure-codes summary for GitHub job summary + uploaded artifacts).
- `tools/editor_gate.sh` also supports UI-flow gate soak via `EDITOR_UI_FLOW_SMOKE_GATE_RUNS` (default local=`2`, CI=`3`; override allowed) and records counters in `build/editor_gate_summary.json`:
  - `ui_flow_smoke.gate_runs_target`, `ui_flow_smoke.gate_run_count`, `ui_flow_smoke.gate_pass_count`, `ui_flow_smoke.gate_fail_count`
  - failure attribution fields: `ui_flow_smoke.failure_code_counts`, `ui_flow_smoke.first_failure_code`, `ui_flow_smoke.runs[].failure_code|failure_detail`
- `tools/editor_gate.sh` records round-trip smoke attribution from `editor_roundtrip_smoke.js`:
  - `editor_smoke.status`, `editor_smoke.failure_code_counts`, `editor_smoke.first_failure_code`, `editor_smoke.failed_cases[]`
- `tools/editor_gate.sh` supports optional UI-flow failure-injection health check (`RUN_UI_FLOW_FAILURE_INJECTION_GATE=1`, default timeout `UI_FLOW_FAILURE_INJECTION_TIMEOUT_MS=1`):
  - default mode: local=`0` / CI=`1` (when `RUN_EDITOR_UI_FLOW_SMOKE_GATE=1`, and `RUN_UI_FLOW_FAILURE_INJECTION_GATE` is unset)
  - summary fields: `ui_flow_failure_injection.status|run_id|failure_code|failure_detail|summary_json`
  - strict mode (`UI_FLOW_FAILURE_INJECTION_STRICT=1`) turns injection health-check failure into gate failure.
- `tools/editor_gate.sh` supports optional round-trip failure-injection health check (`RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=1`):
  - default mode: local=`0` / CI=`1` (when unset)
  - default injection uses a missing plugin path (`EDITOR_SMOKE_FAILURE_INJECTION_PLUGIN`) with `EDITOR_SMOKE_FAILURE_INJECTION_LIMIT=1`
  - summary fields: `editor_smoke_failure_injection.status|run_id|failure_code|failure_detail|summary_json`
  - strict mode (`EDITOR_SMOKE_FAILURE_INJECTION_STRICT=1`) turns injection health-check failure into gate failure.
- `tools/check_local_summary.sh` treats these CTest failures/missing tests as hard errors.
- `tools/check_local_summary.sh` treats editor smoke gate run-count shortfall / gate-run failures as hard errors when `runEditorSmokeGate=true`.
- `tools/check_local_summary.sh` requires non-empty `editorSmokeFailureCodeCounts` when `runEditorSmokeGate=true` and smoke gate has failing runs.
- `tools/check_local_summary.sh` treats editor UI-flow gate run-count shortfall / gate-run failures as hard errors when `runEditorUiFlowSmokeGate=true`, and requires non-empty `failure_code_counts` when gate has failures.
- `tools/check_local_summary.sh` also treats missing STEP166 baseline-compare metadata as hard errors when `runEditorGate=true` and `editorGateStatus=ok`.

## PLM Quickstart (Router + Convert + Annotate)
Requires the PLM tools and importer plugins to be built (adjust plugin extension for your OS).

```bash
python3 tools/plm_router_service.py --port 9000
```

```bash
curl -s -X POST "http://127.0.0.1:9000/convert" \
  -F "file=@tests/plugin_data/importer_sample.json" \
  -F "plugin=build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib" \
  -F "emit=json,gltf,meta" \
  -F "project_id=demo" \
  -F "document_label=sample"
```

```bash
python3 tools/plm_annotate.py \
  --router http://127.0.0.1:9000 \
  --project-id demo \
  --document-label sample \
  --text "Reviewed" \
  --author sam
```

For a one-shot check, use `tools/plm_smoke.sh` (see `docs/Tools.md`).
For error-code regression, run `tools/plm_error_codes_smoke.sh`.

## Project Structure
- `core/` — C++17 geometric core and C API
- `editor/qt/` — Legacy Qt editor (standalone app lives in `cadgf-app-qt`)
- `tools/` — Export CLI and helpers (includes `local_ci.sh`, `quick_check.sh`)
- `tests/` — Core/tools tests (CMake + CTest)
- `docs/` — Design notes and reports

## Docs
- Repository Guidelines: `AGENTS.md`
- Offline guide: `OFFLINE_MODE.md`
- Qt UI Shell design: `docs/editor/Qt-UI-Shell-Design.md`
- Exporter experimental flags: `docs/exporter/EXPERIMENTAL_FLAGS.md`
- Reference comparison plan: `docs/REFERENCE_COMPARISON_PLAN.md`
- Reference comparison report: `docs/REFERENCE_COMPARISON_REPORT.md`
- Reference comparison actions: `docs/REFERENCE_COMPARISON_ACTIONS.md`
- PLM tools reference: `docs/Tools.md`
- PLM conversion summary (external): `docs/PLM_CONVERSION_SUMMARY_EXTERNAL.md`
- PLM conversion summary (internal): `docs/PLM_CONVERSION_SUMMARY_INTERNAL.md`
- PLM conversion verification checklist: `docs/PLM_CONVERSION_VERIFICATION_CHECKLIST.md`
- PLM conversion local verification (2025-12-25): `docs/PLM_CONVERSION_LOCAL_VERIFICATION_REPORT_2025_12_25.md`
- Local smoke verification (2025-12-25): `docs/LOCAL_SMOKE_VERIFICATION_REPORT_2025_12_25.md`
- Desktop DWG route readiness: `docs/STEP250_DESKTOP_DWG_ROUTE_READINESS_VERIFICATION.md`
- DWG matrix readiness: `docs/STEP251_DWG_OPEN_MATRIX_READINESS_VERIFICATION.md`

## Contributing
- Start with `AGENTS.md` and `docs/Contributing.md` for style, PR, and test guidance.
- Use Conventional Commits (e.g., `feat:`, `fix:`, `docs:`, `ci:`). Keep PRs focused and link issues.
- Ensure CMake builds and CTest pass locally; attach screenshots/GIFs for editor/UI changes in PRs.
