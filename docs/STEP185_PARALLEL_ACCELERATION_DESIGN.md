# STEP185 Parallel Acceleration Design

## Background
- Goal: continue parallel acceleration on Level A stability without changing current product scope.
- Scope in this step:
  1) Trigger and validate GitHub nightly in both `observe` and `gate` modes.
  2) Add case-selection quality trend (`matched_count` / `used_fallback`) across 7/14 day windows.
  3) Integrate trend output into weekly summary and STEP176 verification report.

## Parallel Lanes

### Lane A: Nightly remote verification
- Use GitHub Actions `cadgamefusion-editor-nightly` workflow dispatch in:
  - `mode=observe`
  - `mode=gate`
- Collect run metadata (`run_id`, conclusion, URL, key log fields).

### Lane B: Trend data pipeline
- Add script:
  - `tools/editor_case_selection_trend.py`
- Inputs:
  - `build/editor_gate_history/*.json`
- Outputs:
  - `build/editor_case_selection_trend.json`
  - `build/editor_case_selection_trend.md`
- Aggregation windows:
  - default `7,14` days
- Key metrics:
  - `matched_ratio`
  - `selected_ratio`
  - `fallback_rate`
  - `samples_with_selection`

### Lane C: Weekly + STEP176 integration
- Update:
  - `tools/editor_weekly_validation.sh`
  - `tools/write_step176_weekly_report.py`
- Add weekly execution step:
  - `10) Case selection trend summary`
- Add report fields:
  - `case_selection_trend`
  - `case_selection_trend_windows`
  - `case_selection_trend_json`
- Keep existing `editor_smoke_filters` + `*_case_selection` lines.
- Weekly case-file guard:
  - `EDITOR_SMOKE_MIN_CASES` (default `4`)
  - when `EDITOR_SMOKE_CASES` count is below threshold, try fixture fallback only if fixture count is better and meets threshold.

### Lane B (incremental): Fillet/Chamfer failure-retry usability
- Keep command active on `selection.filletByPick` / `selection.chamferByPick` failure.
- Preserve first pick (`firstId`, `pick1`) so user retries only second pick.
- Surface `error_code` in status text (`[CODE]`) for direct triage.
- Slightly increase pick tolerance to reduce near-hit misses.
- Add UI-flow assertion: once failure happens, retry without re-picking first target must succeed (`retrySucceeded=true`).

## Interface/Contract
- Weekly env:
  - `CASE_SELECTION_TREND_WINDOWS` (default `7,14`)
  - `CASE_SELECTION_TREND_JSON` (default `build/editor_case_selection_trend.json`)
  - `CASE_SELECTION_TREND_MD` (default `build/editor_case_selection_trend.md`)
- Gate env (new stability guard):
  - `RUN_PERF_TREND=0|1`
  - `RUN_REAL_SCENE_TREND=0|1`
  - when disabled, `editor_gate_summary.json` must report `status=skipped`, `coverage_days=0`, `selected_samples_in_window=0`
- Gate profile contract:
  - `EDITOR_GATE_PROFILE=lite` => `RUN_STEP166_GATE=0`, `EDITOR_SMOKE_NO_CONVERT=1` (unless explicitly overridden by caller)
  - `EDITOR_GATE_PROFILE=full` => `RUN_STEP166_GATE=1`, `EDITOR_SMOKE_NO_CONVERT=0` (unless explicitly overridden by caller)
- local_ci forwarding contract:
  - `tools/local_ci.sh` forwards `EDITOR_GATE_PROFILE` to `tools/editor_gate.sh` (default `full`)
  - `EDITOR_GATE_RUN_PERF_TREND` / `EDITOR_GATE_RUN_REAL_SCENE_TREND` map to gate `RUN_PERF_TREND` / `RUN_REAL_SCENE_TREND` (default `0`)
- nightly case-source guard:
  - `.github/workflows/cadgamefusion_editor_nightly.yml` uses `MIN_GENERATED_CASES` (default `4`)
  - generated cases are used only when count >= required threshold; otherwise fallback to fixture.
- Weekly summary JSON:
  - `case_selection_trend.status`
  - `case_selection_trend.window_summaries[]`
- STEP176 appended lines:
  - `case_selection_trend: ...`
  - `case_selection_trend_windows: ...`
  - artifact path for trend json

## Risk and Control
- Risk: remote nightly workflow on `main` may lag local changes.
  - Control: explicitly record remote run IDs and note log behavior.
- Risk: trend sample count is low when filtered gate runs are sparse.
  - Control: output `samples_with_selection` and keep `observe` policy when needed.
- Risk: stale trend JSON can leak old values into gate summary when trend step is disabled.
  - Control: gate summary now treats disabled trend as first-class `skipped` state and ignores old coverage counters.

## Lane A (incremental): editor_gate case coverage guard
- Add `EDITOR_SMOKE_MIN_CASES` (default `4`) to `tools/editor_gate.sh`.
- Guard policy for `EDITOR_SMOKE_CASES`:
  - missing file -> fallback to discovery;
  - case count below threshold -> use fixture only when fixture count is both `>= min` and better than current;
  - otherwise fallback to discovery.
- Gate summary contract (`build/editor_gate_summary.json -> editor_smoke`):
  - `case_source` in `explicit|fixture|discovery`
  - `cases_count`
  - `min_cases_required`
- `tools/local_ci.sh` forwards `EDITOR_SMOKE_MIN_CASES` to `tools/editor_gate.sh` and emits parsed fields in `local_ci_summary.json`.
- CI compatibility: `.github/workflows/cadgamefusion_editor_nightly.yml` pins `EDITOR_SMOKE_MIN_CASES=1` because nightly already performs source-thresholding by `MIN_GENERATED_CASES`.

## Lane B (incremental): unsupported proxy read-only hardening
- Goal: keep `unsupported` entities as visible passthrough proxies but prevent accidental edits.
- Command-layer behavior (`tools/web_viewer/commands/command_registry.js`):
  - `selection.move/copy/rotate/propertyPatch/delete` now treats `entity.readOnly===true || type==='unsupported'` as read-only.
  - unsupported-only selection returns `error_code=UNSUPPORTED_READ_ONLY`.
  - mixed selection applies to editable entities and reports skipped read-only counts in message.
- Property panel behavior (`tools/web_viewer/ui/property_panel.js`):
  - show explicit read-only note when selection contains unsupported proxies.
  - all-read-only selection disables form editing.
  - mixed selection keeps editing enabled for editable entities only.
- UI polish (`tools/web_viewer/style.css`):
  - add `.cad-readonly-note` style for deterministic warning visibility.

## Lane C (incremental): Web/Qt shortcut semantic sync
- Web editor now supports AutoCAD-like function key toggles in workspace key handler:
  - `F7` => Grid toggle
  - `F8` => Ortho toggle
  - `F3` => Snap master toggle
- Implementation keeps a single toggle source (`toggleGrid/toggleOrtho/toggleSnap`) shared by:
  - status bar buttons
  - keyboard shortcuts
- Behavior details:
  - only active when focus is not in input/textarea;
  - repeats are ignored (`event.repeat`) to avoid accidental double toggles.
- Files:
  - `tools/web_viewer/ui/workspace.js`
  - `tools/web_viewer/scripts/editor_ui_flow_smoke.sh` (adds keyboard assertions in `toggles_and_snap` step)

### Qt semantic mirror note
- Qt now mirrors the Web hotkey semantic set for editing session toggles:
  - `F7` Grid Snap
  - `F8` Ortho
  - `F3` Object Snap master toggle (endpoint/midpoint/center/intersection)
- Implementation is intentionally semantic-only (no Qt tool-surface expansion in this sprint).

## Lane A (incremental): failure attribution completeness hard constraint
- Goal: when gate reports fail, summary must carry machine-readable `failure_code_counts`; avoid opaque FAIL without root cause.
- Gate enforcement (`tools/editor_gate.sh`):
  - UI flow gate fail + empty `failure_code_counts` => append `UI_FLOW_ATTRIBUTION_MISSING`, gate fails.
  - Editor smoke gate fail + empty `failure_code_counts` => append `EDITOR_SMOKE_ATTRIBUTION_MISSING`, gate fails.
- Summary contract (`build/editor_gate_summary.json`):
  - `editor_smoke.failure_code_total` (int)
  - `editor_smoke.failure_attribution_complete` (bool)
  - `ui_flow_smoke.failure_code_total` (int)
  - `ui_flow_smoke.failure_attribution_complete` (bool)
- Reporting (`tools/write_editor_gate_report.py`):
  - STEP170 append now includes `failure_attribution_complete` and `code_total` for editor smoke and UI flow sections.

## Lane A (incremental): attribution fields propagated to local CI + weekly/CI reports
- `tools/local_ci.sh` now parses from `editor_gate_summary.json`:
  - `editor_smoke.fail_count / failure_code_total / failure_attribution_complete`
  - `ui_flow_smoke.gate_fail_count / failure_code_total / failure_attribution_complete`
- `build/local_ci_summary.json` adds fields:
  - `editorGateEditorSmokeFailCount`
  - `editorGateEditorSmokeFailureCodeTotal`
  - `editorGateEditorSmokeFailureAttributionComplete`
  - `editorGateUiFlowFailCount`
  - `editorGateUiFlowFailureCodeTotal`
  - `editorGateUiFlowFailureAttributionComplete`
- strict-exit now enforces attribution completeness for editor_gate-derived failures.
- `tools/check_local_summary.sh` now validates the same fields when `runEditorGate=true`.
- report harmonization:
  - `tools/write_step176_gate_report.py` adds attribution lines (`complete/code_total`).
  - `tools/write_ci_artifact_summary.py` adds attribution lines for gate markdown artifacts.

## Lane B (incremental): fillet/chamfer preselection fast-path
- UX goal: when exactly one valid line/polyline is selected before activating Fillet/Chamfer, user can click the second target directly (one-click pairing).
- Tool behavior (`tools/web_viewer/tools/fillet_tool.js`, `tools/web_viewer/tools/chamfer_tool.js`):
  - on activation, capture `activationSelectedId` if and only if there is exactly one valid selected target.
  - in `pickFirst` stage:
    - if user clicks a different valid target and `activationSelectedId` is still active, auto-use selected entity as first target and current click as second target.
    - first pick (`pick1`) is resolved by projecting the click point to the selected entity (line/polyline nearest segment projection), avoiding arbitrary origin points.
  - Escape cancels this fast-path (`activationSelectedId=null`) to avoid stale selection causing unintended auto-pair.
- Compatibility:
  - existing miss->fallback path remains unchanged.
  - same-entity (polyline corner) flow remains supported.

## Lane B (incremental): UI-flow smoke coverage for preselection fast-path
- File: `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- New flow step: `fillet_chamfer_preselection`
  - builds a deterministic two-line corner fixture via debug command (`entity.create`) to avoid pointer-jitter flakiness.
  - verifies preselection + one-click second-target path for both Fillet and Chamfer.
  - success criteria:
    - Fillet: operation applies and creates at least one `arc` entity.
    - Chamfer: operation applies and line count increases to at least 3 (connector line created).
- This gives browser-level regression coverage for the exact interaction issue users hit in manual editing sessions.

## Lane B (incremental): grip insert/delete verification hardening
- Added command-level tests for Select grip editing lifecycle:
  - midpoint grip insert on polyline creates one vertex and is undo/redo reversible.
  - double-click vertex grip delete on polyline removes one vertex and is undo/redo reversible.
- Extended with closed-polyline edge cases:
  - midpoint grip on closing segment inserts vertex at wrapped edge.
  - vertex delete is allowed above closed minimum (`>3`) and blocked at minimum (`=3`).
- Files:
  - `tools/web_viewer/tests/editor_commands.test.js`
- Purpose:
  - lock down `select_tool` grip behavior so interaction refactors (snap/hover/history) do not silently break vertex editability.

## Lane A (incremental): full-profile gate checkpoint policy
- In addition to daily `lite` gate loops, run periodic `full` checkpoints:
  - `EDITOR_GATE_PROFILE=full` with STEP166 gate enabled.
- Objective:
  - detect integration regressions that only surface when editor smoke + UI flow + STEP166 baseline compare run together.
- Current default remains pragmatic:
  - `lite` for high-frequency local cycles,
  - `full` for milestone/merge checkpoints.

## Lane B (incremental): UI-flow grip lifecycle coverage extension
- File: `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- Added step: `polyline_grip_insert_delete`
  - deterministic fixture creation through debug command (`entity.create`) to avoid pointer-draw drift.
  - hard-verifies midpoint grip insert with Undo/Redo in browser flow.
  - tries vertex double-click delete first; if browser double-click detail is not stable, falls back to deterministic `selection.propertyPatch` delete command so delete+Undo/Redo remains gate-covered.
  - records delete execution path and status (`vertexDeleteAttempted`, `vertexDeleteApplied`, `vertexDeletePath`, `vertexDeleteUndoRedoVerified`) for trend analysis.
- Why this shape:
  - command-level tests hard-gate true double-click behavior.
  - UI-flow gate hard-covers full delete lifecycle while still exposing whether the browser run used native double-click path or deterministic fallback path.

## Lane B (incremental): Fillet/Chamfer cross-layer usability alignment
- Goal: allow common CAD editing flow where two targets are on different unlocked layers.
- Command behavior update (`tools/web_viewer/commands/command_registry.js`):
  - `selection.fillet` / `selection.filletByPick` no longer hard-fail on `LAYER_MISMATCH`.
  - `selection.chamfer` / `selection.chamferByPick` no longer hard-fail on `LAYER_MISMATCH`.
  - lock checks are now per-target layer:
    - if either target layer is locked, return `LAYER_LOCKED` with concrete layer name (`L<n>` fallback).
- Geometry/output behavior:
  - existing trim logic stays unchanged;
  - newly created fillet arc/chamfer connector continues to follow first target layer for deterministic output.
- Rationale:
  - matches real editing expectations (cross-layer corner edits are common),
  - resolves UI friction observed in mixed-layer fixtures without broad model changes.
- Regression coverage:
  - `tools/web_viewer/tests/editor_commands.test.js` adds command-level cross-layer pass/lock checks.
  - `tools/web_viewer/scripts/editor_ui_flow_smoke.sh` now includes cross-layer preselection checks and emits:
    - `fillet_cross_layer_preselection_ok`
    - `chamfer_cross_layer_preselection_ok`

## Lane A (incremental): gate input traceability in summary
- Goal: make gate summaries self-describing when comparing `lite` vs `full` runs.
- File: `tools/editor_gate.sh`
- Added `inputs` block to `editor_gate_summary.json`:
  - `editor_gate_profile`
  - `editor_smoke_limit`
  - `editor_smoke_no_convert`
  - `run_step166_gate`
  - `run_editor_ui_flow_smoke_gate`
  - `run_perf_trend`
  - `run_real_scene_trend`
- Benefit:
  - reports/debug scripts can read one JSON and immediately know the effective run profile without parsing console logs.
- Report propagation:
  - `tools/write_editor_gate_report.py`
  - `tools/write_step176_gate_report.py`
  - both now emit `gate_inputs` line when `inputs` exists.

## Lane Orchestration (incremental): one-command 3-lane cycle runner
- Add script: `tools/editor_parallel_cycle.sh`
- Goal: keep 1-engineer lane rotation reproducible with one command while preserving lane-level logs/artifacts.
- Default lane mapping:
  - Lane A: `tools/editor_gate.sh` (lite profile, STEP166/perf toggles controlled by env)
  - Lane B: Node command tests + optional UI-flow smoke
  - Lane C: case-selection trend + gate trend summaries
- Output contract (per run):
  - `build/editor_parallel_cycle/<run_id>/summary.json`
  - `build/editor_parallel_cycle/<run_id>/summary.md`
  - lane logs under the same run folder
- Key env knobs:
  - `RUN_LANE_A|B|C` (0/1)
  - `LANE_A_PROFILE`, `LANE_A_LIMIT`, `LANE_A_RUN_STEP166`, `LANE_A_RUN_UI_FLOW`
  - `LANE_B_RUN_UI_FLOW`, `LANE_B_UI_FLOW_MODE`
  - `LANE_C_WINDOWS`, `LANE_C_DAYS`, `LANE_C_HISTORY_DIR`
- Exit behavior:
  - non-zero if any enabled lane fails; zero only when all enabled lanes pass.

## Lane Orchestration (incremental): gate-decision payload + local_ci integration
- `tools/editor_parallel_cycle.sh` now computes `gate_decision` in `summary.json`:
  - `decision`: `pass|watch|fail`
  - `should_merge`: bool (true only when decision is `pass`)
  - `fail_reasons[]`: lane/gate blocking reasons
  - `warning_codes[]`: trend warnings (e.g., `GENERATED_COUNT_MISMATCH`)
  - `failure_code_counts{}`: merged failure-code counts from lane outputs
- `summary.md` now renders gate decision/fail reasons/warnings/failure-code counts at top for quick triage.
- `tools/local_ci.sh` integration:
  - new switch: `RUN_EDITOR_PARALLEL_CYCLE=1`
  - lane controls forwarded:
    - `PARALLEL_CYCLE_RUN_LANE_A|B|C`
    - `PARALLEL_CYCLE_LANE_A_PROFILE`, `PARALLEL_CYCLE_LANE_A_LIMIT`, `PARALLEL_CYCLE_LANE_A_RUN_STEP166`
    - `PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW`, `PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE`
    - `PARALLEL_CYCLE_LANE_C_WINDOWS`, `PARALLEL_CYCLE_LANE_C_DAYS`
  - local CI writes cycle result fields into `build/local_ci_summary.json`:
    - `editorParallelCycleStatus`, `editorParallelCycleRc`, `editorParallelCycleRunId`
    - `editorParallelCycleSummaryJson`, `editorParallelCycleSummaryMd`
    - `editorParallelCycleGateDecision`, `editorParallelCycleGateShouldMerge`
    - `editorParallelCycleGateFailReasons`, `editorParallelCycleGateWarningCodes`
    - `editorParallelCycleFailureCodeCounts`
- strict-gate behavior:
  - when `RUN_EDITOR_PARALLEL_CYCLE=1`, strict-exit fails if cycle status is not `ok` or `gate_decision` is `fail|unknown`.
- `tools/check_local_summary.sh` now validates the same parallel-cycle gate signals when present.

## Lane A+C (incremental): weekly Qt require_on auto-policy
- Goal: avoid hard-coding `QT_PROJECT_PERSISTENCE_REQUIRE_ON` in weekly runs while keeping deterministic rules.
- New script:
  - `tools/qt_project_persistence_gate_policy.py`
- Inputs:
  - `build/editor_gate_history/gate_*.json` (windowed by `--days`, default `14`)
  - thresholds: `--min-samples` (default `5`), `--min-consecutive-passes` (default `3`)
- Outputs:
  - `build/qt_project_persistence_gate_policy.json`
  - `build/qt_project_persistence_gate_policy.md`
  - stdout contract:
    - `qt_policy_status=...`
    - `qt_policy_recommended_require_on=0|1`
- Weekly integration (`tools/editor_weekly_validation.sh`):
  - new env:
    - `GATE_QT_PROJECT_PERSISTENCE_REQUIRE_ON=auto|0|1` (default `auto`)
    - `QT_PROJECT_POLICY_DAYS`, `QT_PROJECT_POLICY_MIN_SAMPLES`, `QT_PROJECT_POLICY_MIN_CONSECUTIVE_PASSES`
    - `QT_PROJECT_POLICY_JSON`, `QT_PROJECT_POLICY_MD`
  - behavior:
    - `auto` => consume policy recommendation and pass resolved value to `editor_gate.sh`
    - `0|1` => manual override
  - weekly summary JSON gains `qt_project_persistence_policy` with:
    - `status`, `recommended_require_on`, `effective_require_on`, `effective_source`
    - thresholds/metrics/recommendation
    - summary artifacts paths
- STEP176 integration:
  - `tools/write_step176_weekly_report.py` includes policy status and artifact path.
  - `tools/write_step176_dashboard.py` weekly history table includes `qt_policy` column.

## Lane A (incremental): workflow artifact policy override at dispatch
- Goal: keep default `on_failure` behavior while allowing manual reruns to force upload or disable upload.
- Workflow contract:
  - `.github/workflows/cadgamefusion_editor_nightly.yml`
  - `.github/workflows/cadgamefusion_editor_light.yml`
  - new `workflow_dispatch` input:
    - `upload_artifacts: on_failure|always|off`
  - `UPLOAD_CI_ARTIFACTS` resolves as:
    - dispatch run: selected input
    - non-dispatch run: default `on_failure`

## Lane A (incremental): nightly case-source provenance pass-through
- Goal: keep generated/fixture source attribution consistent between workflow selection and `editor_gate_summary.json`.
- Workflow contract:
  - `.github/workflows/cadgamefusion_editor_nightly.yml`
  - after nightly case selection, export `EDITOR_SMOKE_CASE_SOURCE=$CASE_SOURCE` before invoking `tools/editor_gate.sh`.
- Reporting contract:
  - `tools/write_ci_artifact_summary.py` now renders:
    - `editor_smoke_cases: source/count/min_required/cases`
    - `editor_smoke_generated_runs: run_id/run_ids` (when workflow provides generated-run metadata envs).
- Outcome:
  - nightly Step Summary and artifact markdown can be traced back to the exact source decision (`generated|fixture`) without relying on inferred defaults.

## Lane A/C (incremental): generated-case metadata propagation into gate artifacts
- Goal: preserve `generated case pool` provenance end-to-end (weekly -> gate summary -> reports/dashboard).
- Contracts:
  - `tools/editor_weekly_validation.sh` forwards gate-side generated metadata:
    - `EDITOR_SMOKE_GENERATED_CASES_PATH`
    - `EDITOR_SMOKE_GENERATED_COUNT`
    - `EDITOR_SMOKE_GENERATED_MIN_CASES`
    - `EDITOR_SMOKE_GENERATED_PRIORITIES`
    - `EDITOR_SMOKE_GENERATED_RUN_ID`
    - `EDITOR_SMOKE_GENERATED_RUN_IDS`
  - `tools/editor_gate.sh` persists the fields under `editor_smoke.*` in `editor_gate_summary.json`.
  - report readers consume the new fields:
    - `tools/write_editor_gate_report.py`
    - `tools/write_step176_gate_report.py`
    - `tools/write_step176_dashboard.py`
    - `tools/write_ci_artifact_summary.py`
- Outcome:
  - gate snapshots, CI summaries, and STEP176 dashboard can show both selection source and generated run lineage without relying on ad-hoc env-only context.

## Lane A (incremental): nightly step-summary consistency from gate summary
- Problem:
  - nightly `GITHUB_STEP_SUMMARY` previously mixed pre-gate env values and post-gate metrics, which could diverge when gate fallback/policy changed source.
- Change:
  - `.github/workflows/cadgamefusion_editor_nightly.yml` now reads `editor_smoke` case/source/generated fields directly from `build/editor_gate_summary_nightly.json` in the summary step.
  - env outputs remain fallback only.
- Outcome:
  - step summary reflects final gate decision state (`source/cases/generated_runs`) rather than dispatch-time assumptions.

## Lane C (incremental): local_ci provenance forwarding + step166-aware summary checks
- `tools/local_ci.sh` now:
  - forwards optional `EDITOR_SMOKE_CASE_SOURCE` + `EDITOR_SMOKE_GENERATED_*` into `tools/editor_gate.sh`;
  - parses generated metadata back from `editor_gate_summary.json` into `local_ci_summary.json`:
    - `editorGateEditorSmokeGeneratedCount`
    - `editorGateEditorSmokeGeneratedMinCases`
    - `editorGateEditorSmokeGeneratedPath`
    - `editorGateEditorSmokeGeneratedPriorities`
    - `editorGateEditorSmokeGeneratedRunId`
    - `editorGateEditorSmokeGeneratedRunIds`
  - records `editorGateStep166Enabled` to distinguish lite/full gate profiles.
- `tools/check_local_summary.sh` now gates STEP166 baseline requirements only when `editorGateStep166Enabled=true`.
- Outcome:
  - `local_ci` can verify provenance-rich gate runs in lite mode without false failures from intentionally skipped STEP166.

## Lane C (incremental): CI artifact summary parity for light workflow
- Problem:
  - `cadgamefusion_editor_light.yml` only passes roundtrip summary to `write_ci_artifact_summary.py`; previously it lacked case-selection/proxy coverage detail.
- Change:
  - `tools/write_ci_artifact_summary.py` roundtrip section now includes:
    - `roundtrip_filters`
    - `roundtrip_case_selection`
    - `roundtrip_unsupported` (aggregated from per-case `export.unsupported_passthrough`)
- Outcome:
  - light workflow markdown artifact now carries the same decision-critical metrics (selection quality + unsupported passthrough health) without requiring a full `editor_gate_summary.json`.

## Lane A/C (incremental): editor-light workflow context alignment
- `tools/ci_editor_light.sh` now accepts env-overridable smoke context:
  - `EDITOR_SMOKE_LIMIT`
  - `EDITOR_SMOKE_CASES`
  - `EDITOR_SMOKE_CASE_SOURCE`
  - `EDITOR_SMOKE_NO_CONVERT`
  - optional `EDITOR_SMOKE_PRIORITY_SET`, `EDITOR_SMOKE_TAG_ANY`
- `.github/workflows/cadgamefusion_editor_light.yml` now sets explicit defaults for these vars at job scope.
- `write_ci_artifact_summary.py` reads the context envs and emits:
  - `roundtrip_cases: source/limit/cases`
- Outcome:
  - editor-light job summary and artifact markdown carry explicit case provenance instead of implicit hard-coded assumptions.

## Lane B (incremental): fillet/chamfer same-polyline fallback execution
- Problem:
  - In second-pick stage, when editing a preselected polyline corner, pointer hit-test can miss thin segments.
  - Previous behavior treated this as "refine first pick" and stayed in second-pick stage, so same-entity fillet/chamfer could appear unresponsive.
- Implementation:
  - `tools/web_viewer/tools/fillet_tool.js`
  - `tools/web_viewer/tools/chamfer_tool.js`
  - In second-pick stage, when:
    - `hit.id === firstId`
    - `hit.fromSelection === true`
    - first target is `polyline`
    - `firstPick` already exists
  - tool now executes `selection.*ByPick` immediately with current pointer as `pick2`.
  - Command layer remains source of truth for segment resolution/validation (`PICK_SIDE_MISMATCH`, `UNSUPPORTED`, etc.).
- Test contract:
  - `tools/web_viewer/tests/editor_commands.test.js` adds two cases:
    - fillet same-entity fallback execution
    - chamfer same-entity fallback execution

## Lane B (incremental): polyline fallback-miss UI-flow telemetry + deterministic recovery
- File:
  - `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- Goal:
  - keep browser gate stable while still observing whether "miss -> selection fallback" path applies directly in real pointer conditions.
- Implementation:
  - extend `fillet_chamfer_polyline_preselection` step with an extra scenario:
    - preselect single polyline
    - refine first side
    - second click uses an intentional miss point (`fallbackMissSecond`)
  - if fallback-miss does not apply within short timeout, script performs deterministic recovery click on `secondSide` so the step remains gate-stable.
  - output fields:
    - `filletFallbackPromptSecond`
    - `filletFallbackApplied`
    - `filletFallbackRecovered`
    - `filletFallbackArcCount`
    - `chamferFallbackPromptSecond`
    - `chamferFallbackApplied`
    - `chamferFallbackRecovered`
    - `chamferFallbackLineCount`
- Rationale:
  - command-level tests hard-verify fallback behavior.
  - UI-flow now captures real-browser fallback hit quality as telemetry without making gate flaky.

## Lane A (incremental): keep gate summary/report generation on STEP166 failure
- File:
  - `tools/editor_gate.sh`
- Problem:
  - when STEP166 gate returned non-zero, script exited early before writing `editor_gate_summary.json`.
  - this blocked downstream report appenders and broke traceability for failing runs.
- Implementation:
  - replace STEP166 fail-fast exits with gate-fail accumulation:
    - set `GATE_FAIL_RC=2`
    - append `STEP166:RC_<rc>` to `GATE_FAIL_REASONS`
    - continue into unified summary/report stage
  - keep final process exit semantics unchanged:
    - script still exits non-zero when gate decision is fail.
- Outcome:
  - failing STEP166 runs now always produce gate summary artifacts and can be appended into STEP170/STEP176 reports.

## Lane A (incremental): weekly summary/report persistence on gate failure
- File:
  - `tools/editor_weekly_validation.sh`
- Problem:
  - weekly pipeline called `tools/editor_gate.sh` in strict mode; when gate failed (for example STEP166 drift), weekly script exited before writing weekly summary JSON/MD and before STEP170/STEP176 appenders.
- Implementation:
  - weekly gate step now captures gate exit code (`GATE_RC`) with `set +e`, records:
    - `GATE_STATUS=ok|fail`
    - `GATE_RC`
  - pipeline continues through:
    - trend steps
    - weekly summary JSON/MD generation
    - STEP170/STEP176 weekly appenders
  - after all outputs are persisted, script re-raises failure:
    - `if RUN_GATE=1 && GATE_RC!=0 => exit GATE_RC`
  - weekly summary payload/markdown now includes:
    - `gate.exit_code`
    - `gate_exit_code` line in MD.
- Outcome:
  - failed weekly gate runs are now fully attributable and documented, without losing non-zero CI signal.

## Lane C (incremental): round-trip unsupported passthrough hard check
- File: `tools/web_viewer/scripts/editor_roundtrip_smoke.js`
- Added explicit unsupported passthrough validation per case:
  - capture imported `unsupported` entities (`id + cadgf` snapshot) before deterministic edits.
  - after export, verify by `id`:
    - entity still exists
    - exported entity still contains original payload as deep subset (allows normalized defaults, disallows data loss/mutation of original keys).
- New per-case output:
  - `export.unsupported_passthrough.{ok,checked_count,missing_count,drifted_count,missing_ids,drifted_ids,message}`
- New gate failure code:
  - `UNSUPPORTED_PASSTHROUGH_DRIFT`
- Gate implication:
  - case PASS now requires schema pass + (optional convert pass) + roundtrip stable + unsupported passthrough pass.

## Lane B (incremental): closed polyline vertex-delete UI-flow hard coverage
- File: `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- Added step: `polyline_closed_vertex_delete`
  - creates deterministic closed polyline fixture.
  - verifies vertex delete on closed polyline + Undo/Redo lifecycle in gate flow.
  - uses same execution policy as open polyline step:
    - try native double-click grip delete first;
    - fallback to deterministic `selection.propertyPatch` delete when browser click detail is unstable.
- Output contract:
  - `flow.polyline_closed_vertex_delete.{deletePath,deleteApplied,undoRedoVerified,basePointCount,finalPointCount}`

## Lane A (incremental): unsupported passthrough rollup propagation
- `tools/editor_gate.sh` now aggregates editor smoke unsupported passthrough metrics:
  - `editor_smoke.unsupported_passthrough.cases_with_checks`
  - `editor_smoke.unsupported_passthrough.checked_entities`
  - `editor_smoke.unsupported_passthrough.missing_entities`
  - `editor_smoke.unsupported_passthrough.drifted_entities`
  - `editor_smoke.unsupported_passthrough.failed_cases`
  - `editor_smoke.unsupported_passthrough.first_failed_case`
- Propagated to local and report layers:
  - `tools/local_ci.sh` -> `build/local_ci_summary.json` (`editorGateEditorSmokeUnsupported*`)
  - `tools/check_local_summary.sh` parses/prints unsupported rollup and adds consistency check
- `tools/write_editor_gate_report.py`, `tools/write_step176_gate_report.py`, `tools/write_ci_artifact_summary.py` include unsupported passthrough summary lines

## Lane C (incremental): unsupported proxy interaction closure (visible + pickable + read-only)
- Goal: unsupported placeholders should not be "render-only ghosts"; users must be able to click/select them for inspection while keeping edit protection.
- Adapter/state defaults:
  - `tools/web_viewer/adapters/cadgf_document_adapter.js` now sets unsupported `visible=true` when `display_proxy` is available.
  - `tools/web_viewer/state/documentState.js` normalizes unsupported visibility to proxy-driven default unless explicitly overridden.
- Spatial/hit-test support:
  - `tools/web_viewer/state/spatialIndex.js` computes AABB for unsupported proxies (`point/polyline/ellipse`) so viewport queries and box/pick are stable.
  - `tools/web_viewer/tools/geometry.js` adds unsupported hit testing by proxy geometry:
    - point distance
    - polyline segment distance
    - ellipse sampled arc distance (bounded samples, deterministic).
- Rendering/selection UX:
  - `tools/web_viewer/ui/canvas_view.js` draws selected unsupported proxies with explicit highlight/handles.
  - unsupported proxy rendering order now follows regular entities, ensuring selection highlight visibility.
- Fit-view compatibility:
  - `tools/web_viewer/ui/workspace.js` includes unsupported proxy extents in `fit/extents` computation.
- Protection model unchanged:
  - commands still enforce read-only (`UNSUPPORTED_READ_ONLY`) for unsupported entities; selection is inspectable, editing remains blocked.

## Lane B (incremental): UI-flow unsupported proxy selectability hard-check
- File: `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- Added step: `unsupported_proxy_select`
  - creates deterministic unsupported fixtures via debug command (`entity.create`):
    - spline proxy (`display_proxy.kind=polyline`)
    - ellipse proxy (`display_proxy.kind=ellipse`)
  - verifies browser-level interaction contract:
    - unsupported proxy is pickable through Select tool;
    - selection summary includes `unsupported`;
    - property panel renders read-only note (`.cad-readonly-note`);
    - `Delete` key does not remove unsupported entities (read-only guard still effective).
- Output contract:
  - `flow.unsupported_proxy_select.{summary,readOnlyNote,selectedId,entityCountBeforeDelete,entityCountAfterDelete,status}`

## Lane A (incremental): UI-flow smoke fail-fast guard for restricted networks
- File: `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- Problem:
  - when `playwright-cli` bootstrap cannot access npm registry, repeated CLI calls may block the validation loop.
- Guard:
  - add `pwcli_cmd()` wrapper with subprocess timeout (`PWCLI_TIMEOUT_SEC`, default 45s; CLI override `--pwcli-timeout-sec`).
  - apply timeout guard to all pwcli invocations: `open/resize/run-code/screenshot/console/session-stop`.
  - skip screenshot/console collection when flow already failed (`FLOW_EXIT_CODE != 0`) to avoid repeated slow retries.
- Effect:
  - `observe` mode exits quickly with `ok=false` summary and deterministic `exit_code` (`124` timeout), instead of hanging.

## Lane A (incremental): weekly report parity for unsupported passthrough rollup
- Updated weekly appenders so weekly docs carry the same unsupported passthrough signal as gate reports:
  - `tools/write_step170_weekly_report.py`
  - `tools/write_step176_weekly_report.py`
- Added lines:
  - `editor_smoke_unsupported_passthrough`
  - `gate_editor_smoke_unsupported_passthrough`

## Lane A (incremental): editor_gate UI-flow port-allocation hardening
- File: `tools/editor_gate.sh`
- Problem:
  - restricted sandbox/container environments can deny loopback bind (`PermissionError`) for dynamic port probing.
  - previous behavior crashed gate script before smoke summary generation.
- Implementation:
  - add `allocate_ui_flow_port()` helper:
    - explicit `EDITOR_UI_FLOW_PORT` -> reuse directly.
    - auto probe with python bind -> success sets dynamic port.
    - probe failure no longer aborts script; captures allocator diagnostics.
  - add explicit-intent tracking:
    - `RUN_EDITOR_UI_FLOW_SMOKE_GATE_SET` records whether gate requirement was user/CI explicit.
  - gate behavior:
    - UI-flow port unavailable + explicit gate requirement -> `GATE_FAIL_RC=2`, reason `UI_FLOW_SMOKE:PORT_UNAVAILABLE`.
    - UI-flow port unavailable + implicit default gate requirement -> skip UI-flow run, continue remaining checks.
  - failure-injection behavior:
    - `RUN_UI_FLOW_FAILURE_INJECTION_GATE=1` and port unavailable -> mark injection `SKIPPED` with `UI_FLOW_PORT_UNAVAILABLE` (strict mode can still fail gate).
  - summary payload extension (`build/editor_gate_summary.json`):
    - `ui_flow_smoke.gate_required`
    - `ui_flow_smoke.gate_required_explicit`
    - `ui_flow_smoke.port_allocation.{available,reason,status,detail,rc}`
- Outcome:
  - converts infra bind denial from hard crash to attributed behavior, while keeping explicit gate requests enforceable.

## Lane B (incremental): fillet/chamfer preselection interaction closure
- Files:
  - `tools/web_viewer/tools/fillet_tool.js`
  - `tools/web_viewer/tools/chamfer_tool.js`
  - `tools/web_viewer/tests/editor_commands.test.js`
  - `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- Problem:
  - when a single line/polyline is already selected, users still had to infer whether the tool is waiting for first pick or second pick.
  - this created ambiguous UX (especially for chamfer/fillet side picking) and occasional misclick loops.
- Implementation:
  - activation behavior:
    - if a single valid entity is preselected on tool activate, initialize directly into `pickSecond` stage.
    - status prompt immediately switches to `Click second line/polyline`.
  - second-stage side refinement:
    - in `pickSecond`, clicking the same first entity (or selection-fallback hit) refines `pick1` and keeps the tool in second-pick stage.
    - avoids accidental command execution when fallback resolves to the preselected entity.
  - preserve one-click fast path:
    - with preselection and direct click on second target, command still executes immediately.
- Test/flow coverage added:
  - Node tests:
    - `fillet tool starts in second-pick mode with single preselection and accepts first-side click refinement`
    - `chamfer tool starts in second-pick mode with single preselection and accepts first-side click refinement`
  - UI-flow smoke:
    - `fillet_chamfer_preselection` now explicitly asserts preselection enters `Click second line/polyline` prompt before applying.

## Lane B (incremental): preselection fallback-miss determinism
- Files:
  - `tools/web_viewer/tools/fillet_tool.js`
  - `tools/web_viewer/tools/chamfer_tool.js`
  - `tools/web_viewer/tests/editor_commands.test.js`
- Problem:
  - in second-pick stage with single preselection, hit-test miss may fall back to selected entity id.
  - if that fallback mutates `pick1`, an accidental blank click can silently change trim/chamfer side.
- Implementation:
  - in second-pick stage, fallback hit (`fromSelection=true`) keeps tool active but does not mutate `pick1`.
  - only real geometry hit on the first entity updates `pick1` (explicit side refinement).
- Added tests:
  - `fillet tool preselection ignores fallback miss for first-side pick`
  - `chamfer tool preselection ignores fallback miss for first-side pick`
- Outcome:
  - side-pick behavior is now stable under miss-click noise while preserving explicit refine-on-hit UX.

## Lane A (incremental): UI-flow failure attribution normalization + report propagation
- Files:
  - `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
  - `tools/editor_gate.sh`
  - `tools/write_editor_gate_report.py`
  - `tools/write_step176_gate_report.py`
  - `tools/write_ci_artifact_summary.py`
- Problem:
  - UI-flow failures were classified mostly by downstream heuristics; step-level context and infra gating context were not always surfaced consistently in reports.
- Implementation:
  - `editor_ui_flow_smoke.sh` summary now emits:
    - `flow_failure_code`
    - `flow_failure_detail`
  - `editor_gate.sh` UI-flow classifiers now prefer direct summary fields above heuristic fallback.
  - report writers now include UI-flow gate context:
    - `gate_required` / `gate_required_explicit`
    - `port_allocation` (`available/status/reason`) when present.
- Outcome:
  - failure attribution is deterministic across smoke/gate/report layers.
  - infra skips and explicit gate intent are visible in STEP170/STEP176/CI summaries.

## Lane A (incremental): weekly report parity for UI-flow gate context
- Files:
  - `tools/write_step170_weekly_report.py`
  - `tools/write_step176_weekly_report.py`
- Problem:
  - weekly reports had UI-flow pass/fail counters but did not always expose gate intent (`required/explicit`) or port-allocation context.
- Implementation:
  - both weekly writers now emit:
    - `ui_flow_gate_required` (`required`, `explicit`)
    - `port_allocation` (`available`, `status`, `reason`) when present
    - `failure_attribution` (`complete`, `code_total`) and `first_failure_code`
  - add fallback output path when UI-flow was skipped yet gate/port context exists.
- Outcome:
  - weekly snapshots align with gate-snapshot semantics and remain diagnosable even when UI-flow is skipped by infra.

## Lane A (incremental): STEP176 dashboard parity for UI-flow gate context
- File:
  - `tools/write_step176_dashboard.py`
- Problem:
  - dashboard table rows only showed `ui_flow` pass/fail/skipped, but missed gate intent and port-allocation status for skipped rows.
- Implementation:
  - latest gate section now includes:
    - `ui_flow_gate_required` (`required`, `explicit`)
    - `ui_flow_port_allocation` (`available`, `status`, `reason`) when present
  - history tables (`Gate History`, `Weekly History`) now enrich skipped UI-flow cells with:
    - required mode marker (`req=exp|imp`)
    - port status suffix (`FAILED`, etc.) when available.
- Outcome:
  - dashboard provides quick root-cause hints for UI-flow skips/fails without opening each summary JSON.

## Lane B (incremental): preselected same-polyline Fillet/Chamfer interaction closure
- Files:
  - `tools/web_viewer/tests/editor_commands.test.js`
  - `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- Problem:
  - preselection fast-path was covered for two-entity pairing, but not for the high-frequency CAD interaction where user preselects one polyline corner and performs Fillet/Chamfer on two adjacent segments of the same polyline.
- Implementation:
  - command-level tests now lock second-stage behavior for preselected polyline:
    - first click refines first-side pick on the same entity;
    - second click on another segment of the same entity executes `selection.filletByPick` / `selection.chamferByPick` with `firstId==secondId`.
  - UI-flow smoke adds `fillet_chamfer_polyline_preselection` step:
    - deterministic fixture via debug command (`entity.create` polyline corner),
    - asserts prompt transition to `Click second line/polyline`,
    - verifies same-entity refine+apply path for both fillet/chamfer.
  - UI-flow failure code map adds:
    - `UI_FLOW_PRESELECTION_POLYLINE_FAIL`.
- Outcome:
  - the exact manual editing path from single-polyline preselection is now regression-covered in both Node and browser flow gate.

## Lane B (incremental): two-segment polyline Fillet/Chamfer auto-pair fallback
- Files:
  - `tools/web_viewer/commands/command_registry.js`
  - `tools/web_viewer/tests/editor_commands.test.js`
  - `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- Problem:
  - in practical editing, users may click twice on the same leg of a simple L polyline (2 segments, 1 corner). Previously this could resolve to same segment and fail before corner pairing.
- Implementation:
  - command layer fallback (`selection.filletByPick` / `selection.chamferByPick`):
    - when `firstId===secondId`, entity is open polyline with exactly 2 segments (`points.length===3`), and both picks resolve to same/non-adjacent segment,
    - auto-pair to the only valid corner pair (`seg0` + `seg1`) before intersection/trim calculations.
  - added helper for synthetic polyline segment refs:
    - `makePolylineSegmentRef(...)`.
  - existing behavior for larger polylines remains unchanged (still requires adjacent segments).
  - command tests now cover same-segment ambiguous picks for both fillet/chamfer.
  - UI-flow `fillet_chamfer_polyline_preselection` now intentionally uses same-leg second click to hard-cover fallback in browser gate path.
- Outcome:
  - common same-leg mis-pick path is converted from failure-prone to deterministic success for 2-segment L polylines, while preserving strict rules on general polylines.

## Lane A (incremental): UI-flow run_id traceability + weekly first-failure visibility fix
- Files:
  - `tools/editor_gate.sh`
  - `tools/write_editor_gate_report.py`
  - `tools/write_step176_gate_report.py`
  - `tools/write_ci_artifact_summary.py`
  - `tools/write_step170_weekly_report.py`
  - `tools/write_step176_weekly_report.py`
- Problem:
  - UI-flow gate currently emits per-run details (`runs[]`) but reports rely on mixed fields (`run_id`, `run_summaries`), making quick run tracing slower.
  - STEP170 weekly writer only emitted `first_failed_run` when detail text exceeded truncation threshold (indent bug), hiding attribution in normal-length failures.
- Implementation:
  - `editor_gate.sh` now emits canonical `ui_flow_smoke.run_ids: string[]` alongside `runs[]` and `run_summaries`.
  - report writers consume `run_ids` with fallback to `runs[].run_id`, and print explicit `ui_flow_run_ids` / `run_ids` lines.
  - STEP170 weekly writer bugfix:
    - `first_failed_run` is now emitted whenever a failed run exists (not gated by detail length).
- Outcome:
  - gate/CI/weekly markdown now gives immediate UI-flow run traceability.
  - weekly first-failure attribution stays visible for both short and long failure details.

## Lane A (incremental): STEP176 dashboard run_id parity
- File:
  - `tools/write_step176_dashboard.py`
- Problem:
  - dashboard `Latest Gate` showed UI-flow pass/fail and run counts, but lacked explicit per-run IDs, forcing manual drill-down into summary JSON for quick traceability.
- Implementation:
  - dashboard writer now reads `ui_flow_smoke.run_ids` (fallback: `ui_flow_smoke.runs[].run_id`) and emits:
    - `ui_flow_run_ids: <run_id list>` in `Latest Gate`.
- Outcome:
  - dashboard now matches gate/weekly/CI traceability surface, enabling immediate cross-check of the two gate UI-flow runs.

## Lane B (incremental): Fillet/Chamfer runtime-single-selection fast-path
- Files:
  - `tools/web_viewer/tools/fillet_tool.js`
  - `tools/web_viewer/tools/chamfer_tool.js`
  - `tools/web_viewer/tests/editor_commands.test.js`
  - `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- Problem:
  - preselection fast-path previously depended on "selected before tool activation".
  - if one target was selected after tool activation (common recovery flow), users were forced back into first-pick flow and saw inconsistent prompt progression.
- Implementation:
  - in `pickFirst`, Fillet/Chamfer now accepts fast-path when:
    - current selection has exactly one valid line/polyline target,
    - clicked target is different,
    - and either:
      - matches activation preselection (`activationSelectedId`), or
      - selection changed since entering `pickFirst` (`pickFirstSelectionKey` delta).
  - this avoids stale-selection leakage after `Esc`:
    - `reset()` snapshots `pickFirstSelectionKey`, so unchanged stale selection does not auto-trigger.
  - Node coverage added:
    - `fillet tool fast-path also applies when single selection is set after activation`
    - `chamfer tool fast-path also applies when single selection is set after activation`
  - UI-flow coverage extended in `fillet_chamfer_preselection`:
    - activate tool with no preselection,
    - inject a single selected line via `selection.box`,
    - one click on second target must apply (Fillet creates arc / Chamfer creates connector line).
- Outcome:
  - fast-path UX works for both "selected before activation" and "selected during tool session" flows,
  - while `Esc` restart semantics remain deterministic.

## Lane C (incremental): Qt snap semantic persistence parity
- Files:
  - `editor/qt/src/project/project.cpp`
  - `tests/qt/test_qt_project_roundtrip.cpp`
  - `tests/qt/test_qt_project_legacy_load.cpp`
- Problem:
  - Qt already supports `center/intersection/ortho` runtime toggles, but project save/load only persisted `endpoints/midpoints/grid/radius/gridPixelSpacing`.
  - reopening a project could silently lose part of snap semantics even when UI/runtime had the values.
- Implementation:
  - project save (`Project::save`) now writes extra snap fields:
    - `centers`
    - `intersections`
    - `ortho`
  - project load (`Project::load`) now reads these fields with backward-compatible defaults:
    - missing fields keep in-memory current values.
  - Qt tests updated:
    - roundtrip test now sets and validates `centers/intersections/ortho`.
    - legacy-load test now asserts old-format files keep snap defaults intact.
- Outcome:
  - Qt project persistence matches the current semantic snap surface,
  - and legacy files remain compatible.

## Lane B (incremental): Fillet/Chamfer stale-preselection reset hardening
- Files:
  - `tools/web_viewer/tests/editor_commands.test.js`
- Problem:
  - runtime single-selection fast-path introduced a subtle risk: after `Esc` reset, stale single selection could accidentally re-enter fast-path and skip intended first pick.
- Implementation:
  - add explicit command tests:
    - `fillet tool does not reuse stale preselection after Escape reset`
    - `chamfer tool does not reuse stale preselection after Escape reset`
  - expected behavior:
    - after `Esc`, first click sets fresh first target (no immediate execute),
    - second click executes against new pair.
- Outcome:
  - the new fast-path remains available, while reset semantics stay CAD-predictable.

## Lane A (incremental): editor_gate auto-local cases warning normalization
- File:
  - `tools/editor_gate.sh`
- Problem:
  - local developer default file `local/editor_roundtrip_smoke_cases.json` (often tiny/temporary) produced repeated WARN noise every gate run even when graceful discovery fallback succeeded.
- Implementation:
  - track auto-injected local cases (`EDITOR_SMOKE_CASES_AUTO_LOCAL=1`).
  - when that auto-local file is below `EDITOR_SMOKE_MIN_CASES` and fixture is not better, log `INFO` instead of `WARN`, then fallback to discovery unchanged.
- Outcome:
  - preserves fallback behavior and gate rigor,
  - reduces false-alarm noise in local continuous loops.

## Lane B (incremental): UI-flow stale-preselection Esc reset hard coverage
- File:
  - `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- Problem:
  - command-level tests already guarded Esc reset semantics, but browser flow had no hard check that stale preselection is not reused after Esc.
- Implementation:
  - extend `fillet_chamfer_preselection` with Esc reset scenario for both Fillet and Chamfer:
    1) start from single-preselected line
    2) activate tool (second-pick prompt)
    3) press `Esc`
    4) first click must *not* auto-apply (must transition to second-pick prompt with unchanged geometry count)
    5) second click applies successfully
  - emit structured fields:
    - `filletEscNoAutoApply`, `filletEscApplied`
    - `chamferEscNoAutoApply`, `chamferEscApplied`
- Outcome:
  - stale preselection regression is now covered in both command and UI-flow layers.

## Lane C (incremental): Qt persistence check script for mixed build profiles
- File:
  - `tools/qt_project_persistence_check.sh`
- Problem:
  - default local build profile often uses `BUILD_EDITOR_QT=OFF`, so direct `cmake --build build --target test_qt_project_roundtrip` fails with unknown target even when code is correct.
- Implementation:
  - add standalone checker with `observe|gate` modes:
    - detects `BUILD_EDITOR_QT` from `CMakeCache.txt`
    - searches candidate build dirs for Qt-enabled target (`test_qt_project_roundtrip`)
    - when available: builds + runs `qt_project_roundtrip_run` and `qt_project_legacy_load_run`
    - when unavailable: writes explicit `skipped` reason (`BUILD_EDITOR_QT_OFF` / `QT_TARGET_UNAVAILABLE`)
  - emits machine-readable summary JSON (default `build/qt_project_persistence_check.json`).
- Outcome:
  - Qt persistence verification can be invoked reliably in mixed local profiles without ambiguous target-not-found failures.

## Lane A + C (incremental): editor_gate/report integration for Qt persistence
- Files:
  - `tools/editor_gate.sh`
  - `tools/write_editor_gate_report.py`
  - `tools/write_step176_gate_report.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/write_step176_dashboard.py`
  - `tools/write_ci_artifact_summary.py`
  - `tools/editor_weekly_validation.sh`
- Problem:
  - Qt persistence had a standalone checker, but gate/report surfaces could not consistently show:
    - whether Qt persistence check ran in observe/gate mode,
    - why it skipped/failed in mixed build profiles,
    - and whether gate failures were attributable to Qt persistence checks.
- Implementation:
  - `editor_gate.sh` adds step `2.8` to invoke `tools/qt_project_persistence_check.sh` with configurable controls:
    - `RUN_QT_PROJECT_PERSISTENCE_CHECK=0|1` (default `1`)
    - `RUN_QT_PROJECT_PERSISTENCE_GATE=0|1` (default `0`)
    - `QT_PROJECT_PERSISTENCE_REQUIRE_ON=0|1` (default `0`)
    - `QT_PROJECT_PERSISTENCE_BUILD_DIR`, `QT_PROJECT_PERSISTENCE_FALLBACK_DIRS`, `QT_PROJECT_PERSISTENCE_OUT`
  - gate summary schema adds `qt_project_persistence` section:
    - `enabled`, `mode`, `gate_required`, `require_on`
    - `status`, `reason`, `run_id`
    - `build_dir`, `build_editor_qt`, `target_available`
    - `exit_code`, `build_exit_code`, `test_exit_code`, `summary_json`
  - gate fail reason integration:
    - when Qt check runs in gate mode and returns fail/non-zero, gate emits:
      - `QT_PROJECT_PERSISTENCE:FAIL`
      - `QT_PROJECT_PERSISTENCE_REASON:<reason>` (or attribution-missing fallback).
  - report/dashboard/CI writers now render Qt persistence status and artifact paths.
  - weekly summary pipeline (`editor_weekly_validation.sh` + weekly writer) now carries `gate.qt_project_persistence`.
- Outcome:
  - Qt semantic persistence now has first-class, attributable visibility in gate/weekly/dashboard/CI outputs.
  - observe->gate transition for Qt checks can be controlled with one flag, without breaking non-Qt local profiles.

## Lane A (incremental): local_ci + nightly wire-up for Qt persistence gate policy
- Files:
  - `tools/local_ci.sh`
  - `.github/workflows/cadgamefusion_editor_nightly.yml`
- Problem:
  - Qt persistence controls were available in `editor_gate.sh`, but:
    - `local_ci.sh` could not pass/record those controls or expose their outcomes in local summary JSON.
    - nightly workflow did not explicitly enforce the desired phase-1 policy (`qt gate on`, `require_on=0`), reducing consistency.
- Implementation:
  - `tools/local_ci.sh` now supports and forwards:
    - `EDITOR_GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK`
    - `EDITOR_GATE_RUN_QT_PROJECT_PERSISTENCE_GATE`
    - `EDITOR_GATE_QT_PROJECT_PERSISTENCE_REQUIRE_ON`
  - local CI parsing now extracts `qt_project_persistence` from gate summary and emits:
    - status/mode/gate_required/require_on/reason/run_id
    - script/build/test exit codes
  - local summary text + `local_ci_summary.json` now include Qt persistence status fields.
  - nightly workflow (`cadgamefusion_editor_nightly.yml`) now sets:
    - `RUN_QT_PROJECT_PERSISTENCE_CHECK=1`
    - `RUN_QT_PROJECT_PERSISTENCE_GATE=1`
    - `QT_PROJECT_PERSISTENCE_REQUIRE_ON=0`
    - and uploads `build/qt_project_persistence_check.json` as artifact.
- Outcome:
  - local and nightly now share the same stage-1 Qt gate policy.
  - Qt persistence regressions become visible in nightly gate summaries without blocking mixed non-Qt build profiles.

## Lane A+C (incremental): STEP166 compare alignment robustness recovery
- File:
  - `scripts/compare_autocad_pdf.py`
- Problem:
  - After Web editor UI expansion, PDF-vs-viewer compare could hit two false-drift patterns:
    - alignment search saturated at the fixed window edge (`shift_dx` stuck near +/-80),
    - rotation choice was decided by raw (unaligned) jaccard, so some layouts picked suboptimal rotation before alignment.
  - This produced gate noise (`RENDER_DRIFT` / `TEXT_METRIC_DRIFT`) in STEP166/full gate despite stable conversion output.
- Implementation:
  - add center-of-mass prefit (`mask_center_of_mass`) and pass it as base shift to local brute-force alignment.
  - evaluate all 4 rotations (`0/90/180/270`) by **aligned** jaccard instead of raw jaccard, then keep the best candidate.
  - fix aligned-union calculation to always use the selected best-rotation edge counts.
  - expose `shift_prefit_dx` / `shift_prefit_dy` in metrics JSON for traceability.
- Outcome:
  - STEP166 gate regains stable pass on current baseline.
  - full editor gate and weekly gate pipelines return to `would_fail=false` without relaxing thresholds.

## Lane A+C (incremental): weekly gate snapshot completeness (step166/ui-flow parity)
- Files:
  - `tools/editor_weekly_validation.sh`
  - `tools/write_step170_weekly_report.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/write_step176_dashboard.py`
- Problem:
  - weekly summary `gate` block previously carried `editor_smoke` and `qt_project_persistence`, but missed:
    - `gate.step166`
    - `gate.ui_flow_smoke`
  - result: weekly reports could not directly show gate-stage STEP166 run_id / decision and gate-stage UI-flow context.
- Implementation:
  - weekly summary payload now forwards from `editor_gate_summary.json`:
    - `gate.ui_flow_smoke`
    - `gate.step166`
  - weekly markdown (`tools/editor_weekly_validation.sh`) adds:
    - `gate_ui_flow_smoke`
    - `gate_ui_flow_run_ids`
    - `gate_step166`
  - STEP170 weekly appender adds:
    - `gate_ui_flow_smoke` + run_ids/port allocation
    - `gate_step166` + `gate_step166_summary_json`
  - STEP176 weekly appender adds:
    - `gate_ui_flow_smoke` + run_ids
    - `gate_step166_run_id`
    - `gate_step166_baseline_compare`
  - STEP176 dashboard weekly-history `step166` column now displays observe+gate pair:
    - `obs=<run>|gate=<run>:<would_fail>`
- Outcome:
  - weekly report链路实现 gate-stage 与 observe-stage 对齐，失败归因和 run_id 追踪不再缺口。

## Lane A (incremental): report/dashboard path anchoring hardening
- Files:
  - `tools/write_step170_weekly_report.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/write_step176_dashboard.py`
- Problem:
  - these scripts previously resolved relative paths against current working directory.
  - when invoked from monorepo root (instead of `deps/cadgamefusion`), output could be written to wrong location (for example top-level `docs/`), creating report drift.
- Implementation:
  - introduce workspace-root anchoring via script location:
    - `WORKSPACE_ROOT = Path(__file__).resolve().parents[1]`
  - resolve CLI-relative paths against `WORKSPACE_ROOT` (not `cwd`).
  - resolve weekly summary referenced relative artifact paths against `WORKSPACE_ROOT`.
- Outcome:
  - report/dashboard scripts become cwd-independent.
  - same command now deterministically writes to `deps/cadgamefusion/docs/*` from any caller location.

## Lane A+C (incremental): round-trip case pool densification for filtered nightly
- Files:
  - `tools/generate_editor_roundtrip_cases.py`
  - `tools/web_viewer/scripts/editor_roundtrip_smoke.js`
  - `.github/workflows/cadgamefusion_editor_nightly.yml`
- Problem:
  - nightly defaults (`priority=P0,P1` + `tag_any=text-heavy,arc-heavy,polyline-heavy,import-stress`) could under-select in low-variance STEP166 preview pools.
  - historical runs often reuse the same case names, so single-run generation kept case count low and made fallback/discovery more likely.
- Implementation:
  - generator now accumulates matching cases across multiple recent `build/cad_regression/<run_id>` runs (instead of stopping at first non-empty run).
  - duplicate names are disambiguated by suffixing run id (`name@<run_id>`) to keep case keys stable for smoke summary.
  - generator now emits both:
    - `selected_run_id=<first run used>`
    - `selected_run_ids=<comma-separated runs used>`
  - tag inference thresholds were tuned (and kept aligned in both generator + smoke script):
    - `text-heavy`: `>=60` or `>=15%`
    - `arc-heavy`: `>=40` or `>=10%`
    - `polyline-heavy`: `>=40` or `>=12%`
    - `import-stress`: unchanged (`>=2000`)
  - nightly workflow now parses and surfaces generation provenance in Step Summary:
    - `editor_smoke_generated_run_id`
    - `editor_smoke_generated_run_ids`
- Outcome:
  - filtered generated case files can reach target sample size from recent history without immediate fallback.
  - nightly has direct visibility into where generated cases came from (run traceability).

## Lane A+C (incremental): weekly case-source/provenance alignment with nightly
- Files:
  - `tools/editor_weekly_validation.sh`
  - `tools/write_step170_weekly_report.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/write_step176_dashboard.py`
- Problem:
  - weekly pipeline had no built-in generated-case provenance surface, so `editor_smoke` case source often appeared as implicit discovery/auto-local without showing generation context.
  - STEP170/STEP176 weekly append and dashboard lacked a consistent "which pool was used" signal.
- Implementation:
  - weekly adds generated-case knobs:
    - `EDITOR_SMOKE_GENERATE_CASES=0|1` (default `1`)
    - `EDITOR_SMOKE_GENERATED_CASES_PATH` (default `local/editor_roundtrip_smoke_cases_weekly.json`)
    - `EDITOR_SMOKE_GENERATED_MIN_CASES` (default follows `EDITOR_SMOKE_MIN_CASES`)
    - `EDITOR_SMOKE_GENERATED_PRIORITIES` (default `EDITOR_SMOKE_PRIORITY_SET` or `P0,P1`)
  - when no explicit `EDITOR_SMOKE_CASES`, weekly runs generator first and records:
    - `EDITOR_SMOKE_CASE_SOURCE=generated|auto-local|fixture|discovery|explicit`
    - `EDITOR_SMOKE_GENERATED_RUN_ID`
    - `EDITOR_SMOKE_GENERATED_RUN_IDS`
    - generated case count and min-threshold.
  - weekly one-button gate now forwards `EDITOR_SMOKE_CASES` to `tools/editor_gate.sh` so observe/gate can use the same case pool when desired.
  - weekly summary JSON/MD now includes source + generation provenance fields under `inputs`.
  - STEP170/STEP176 weekly appenders now render:
    - case source
    - generated case file/count/min/priorities
    - generated run id(s)
  - STEP176 dashboard weekly history adds `case_sel` column:
    - format `source:selected/matched/total[:fb]`.
- Outcome:
  - weekly and nightly now share the same case-pool observability model.
  - gate attribution keeps run-id traceability from generated pool back to source STEP166 runs.

## Lane A+C (incremental): weekly gate pool forwarding + post-STEP166 regeneration
- File:
  - `tools/editor_weekly_validation.sh`
- Problem:
  - weekly `RUN_GATE=1` path previously relied on `editor_gate.sh` default case resolution, so observe/gate could diverge unintentionally.
  - even when observe used generated cases, gate had no explicit post-STEP166 regeneration attempt pinned to the current weekly STEP166 run.
- Implementation:
  - weekly now forwards selected observe pool into gate explicitly:
    - `EDITOR_SMOKE_CASES="$GATE_EDITOR_SMOKE_CASES"` in one-button gate call.
  - weekly tracks separate gate-pool provenance:
    - `GATE_EDITOR_SMOKE_CASES`
    - `GATE_EDITOR_SMOKE_CASE_SOURCE`
    - `GATE_EDITOR_SMOKE_GENERATED_CASES_PATH`
    - `GATE_EDITOR_SMOKE_GENERATED_COUNT`
    - `GATE_EDITOR_SMOKE_GENERATED_RUN_ID(S)`
    - `GATE_EDITOR_SMOKE_GENERATED_PRIORITIES`
  - after weekly STEP166 observe run completes, weekly attempts gate-only regeneration pinned to latest run:
    - `tools/generate_editor_roundtrip_cases.py --run-id "$CAD_RUN_ID" --limit "$GATE_SMOKE_LIMIT" ...`
    - if generated count reaches threshold (`EDITOR_SMOKE_GENERATED_MIN_CASES`), gate case pool is switched to this fresh generated file.
    - otherwise gate keeps the previously selected observe pool.
  - summary/report surfaces now include both observe and gate case-pool provenance fields.
- Outcome:
  - observe/gate pool choice is deterministic and auditable.
  - gate can opportunistically use latest STEP166 artifacts without dropping below minimum case coverage.

## Lane A (incremental): generated-case provenance consistency hardening
- Files:
  - `tools/editor_gate.sh`
  - `tools/local_ci.sh`
  - `tools/write_ci_artifact_summary.py`
  - `tools/write_editor_gate_report.py`
  - `tools/write_step176_gate_report.py`
  - `tools/write_step176_dashboard.py`
- Problem:
  - `EDITOR_SMOKE_GENERATED_COUNT` was treated as trusted input and could drift from the actual case-file count (or file-missing state), producing misleading gate/report provenance.
- Implementation:
  - `editor_gate.sh` now computes and exports:
    - `EDITOR_SMOKE_GENERATED_COUNT_DECLARED`
    - `EDITOR_SMOKE_GENERATED_COUNT_ACTUAL`
    - `EDITOR_SMOKE_GENERATED_COUNT_MISMATCH` (`0|1`)
  - count resolution rule:
    - if generated cases path exists: count JSON list length as actual
    - if path missing: actual forced to `0`
    - if declared != actual: emit warning and set mismatch flag
  - gate summary contract under `editor_smoke`:
    - `generated_count` (effective/actual)
    - `generated_count_declared`
    - `generated_count_actual`
    - `generated_count_mismatch`
  - `local_ci.sh` now parses and writes these fields into `build/local_ci_summary.json`.
  - CI/gate/STEP176 report renderers now surface declared/actual/mismatch instead of a single opaque count.
- Outcome:
  - generated-case lineage is now self-consistent and debuggable.
  - mismatches become explicit diagnostics instead of silent provenance drift.

## Lane A+C (incremental): mismatch warning in weekly/gate trend summaries
- Files:
  - `tools/editor_case_selection_trend.py`
  - `tools/editor_gate_trend.py`
  - `tools/editor_weekly_validation.sh`
  - `tools/write_step176_weekly_report.py`
  - `tools/write_step170_weekly_report.py`
  - `tools/write_step176_dashboard.py`
- Goal:
  - promote `generated_count_mismatch` from hidden gate detail to first-class weekly/trend signal.
- Implementation:
  - case-selection trend (`editor_case_selection_trend.py`) now tracks per-window:
    - `generated_count_mismatch_runs`
    - `generated_count_mismatch_rate`
    - declared/actual totals
    - `warning_codes` (includes `GENERATED_COUNT_MISMATCH`)
  - gate trend (`editor_gate_trend.py`) now includes provenance mismatch metrics under `metrics.case_source` and recent-run table.
  - weekly summary JSON (`editor_weekly_validation.sh`) now carries:
    - observe generated declared/actual/mismatch fields
    - gate generated declared/actual/mismatch fields (from gate summary when available)
    - case-selection trend mismatch rollups and warning codes.
  - weekly markdown/report/dashboard:
    - render declared/actual/mismatch for observe/gate generated pools;
    - render mismatch rollups in `case_selection_trend` lines;
    - weekly history `case_sel` column appends `:mm=<runs>` when mismatch exists.
- Outcome:
  - weekly and trend artifacts now expose provenance drift directly, enabling faster gate triage.

## Lane A (incremental): remote nightly dispatch verification constraints
- Workflow target:
  - `.github/workflows/cadgamefusion_editor_nightly.yml`
- Runtime reality on GitHub:
  - dispatch API currently rejects `upload_artifacts` input on remote (local workflow change not yet available remotely).
  - workflow runs are blocked by repository Actions budget quota.
- Handling:
  - keep local/weekly validation as primary evidence path;
  - keep remote dispatch evidence (run IDs + annotations) in verification report until budget recovers and workflow syncs.

## Lane Orchestration (incremental): watch-policy escalation for gate_decision
- File: `tools/editor_parallel_cycle.sh`
- New policy:
  - `PARALLEL_WATCH_POLICY=observe|gate` (default `observe`)
  - `raw_decision` remains `pass|watch|fail`
  - when `raw_decision=watch` and policy is `gate`, final `decision` escalates to `fail`
  - escalation marker: `watch_escalated=true`, fail reason includes `WATCH_POLICY_GATE`
- Behavior:
  - cycle command now exits non-zero when effective `decision=fail`
  - summary includes:
    - `gate_decision.raw_decision`
    - `gate_decision.watch_policy`
    - `gate_decision.watch_escalated`

## Lane Orchestration (incremental): precomputed lane-A summary reuse
- File: `tools/editor_parallel_cycle.sh`
- New inputs:
  - `LANE_A_GATE_SUMMARY`
  - `LANE_A_GATE_SUMMARY_MD` (optional)
- Purpose:
  - allow workflows to reuse existing `editor_gate` output for lane A without rerunning gate.
  - reduces duplicate runtime while still generating a full parallel-cycle summary.

## Lane A/C (incremental): local_ci + summary checker support watch policy
- Files:
  - `tools/local_ci.sh`
  - `tools/check_local_summary.sh`
- `local_ci` additions:
  - input: `PARALLEL_CYCLE_WATCH_POLICY=observe|gate`
  - parsed outputs now include:
    - `editorParallelCycleGateRawDecision`
    - `editorParallelCycleGateWatchPolicy`
    - `editorParallelCycleGateWatchEscalated`
  - strict mode treats `editorParallelCycleGateDecision=fail|unknown` as blocking.
- `check_local_summary.sh` now validates and reports the same fields.

## Workflow integration (incremental): nightly/light parallel summary artifact + CI markdown
- Files:
  - `.github/workflows/cadgamefusion_editor_nightly.yml`
  - `.github/workflows/cadgamefusion_editor_light.yml`
  - `tools/write_ci_artifact_summary.py`
- Nightly:
  - builds parallel summary via `tools/editor_parallel_cycle.sh` using precomputed lane-A gate summary.
  - uploads `editor_parallel_cycle_*` artifacts under existing `UPLOAD_CI_ARTIFACTS` policy.
- Light:
  - builds lane-C-only parallel summary for trend visibility with minimal runtime impact.
  - uploads `editor_parallel_cycle_light_*` artifacts under existing artifact policy.
- CI markdown:
  - `write_ci_artifact_summary.py` accepts `--parallel-summary` and renders a `Parallel Cycle` section.

## Lane B (incremental): fillet/chamfer two-target preselection one-click path
- Goal:
  - reduce interactive friction when users preselect two editable targets before entering Fillet/Chamfer.
  - align with CAD habit: keep the two selected targets and finish with one click near the intended corner.
- Files:
  - `tools/web_viewer/tools/fillet_tool.js`
  - `tools/web_viewer/tools/chamfer_tool.js`
  - `tools/web_viewer/tests/editor_commands.test.js`
  - `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- Behavior contract:
  - if exactly two valid targets (`line|polyline`) are selected on tool activation:
    - tool enters second-pick stage directly with pair prompt (`either selected target`);
    - one click on either selected target executes command:
      - clicked target becomes `firstId`;
      - other selected target becomes `secondId`;
      - `pick1/pick2` are projected from click point onto each target.
  - keep prior single-preselection path unchanged.
  - on failure, keep pair context and second-pick stage so retry is one-click.
  - on success or `Esc`, reset pair context and return to normal first-pick stage.
- Verification coverage:
  - command tests add explicit two-selected activation cases for Fillet/Chamfer.
  - UI-flow smoke adds two-selected preselection scenario and validates arc/connector creation.

## Lane A+B (incremental): UI-flow interaction attribution fields (pair/runtime/reset/polyline)
- Problem:
  - UI-flow failure attribution was mostly step-level; failures inside preselection sub-paths (single/pair/runtime/reset/polyline) collapsed into coarse codes.
- Changes:
  - `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
    - emits `interaction_checks` in `summary.json` with normalized booleans:
      - single preselection, pair preselection, runtime-selection preselection, stale-preselection reset guard, polyline preselection (fillet/chamfer split).
      - includes top-level `complete`.
    - failure-code classification now recognizes detail-level sub-paths:
      - `UI_FLOW_PRESELECTION_PAIR_FAIL`
      - `UI_FLOW_PRESELECTION_RUNTIME_FAIL`
      - `UI_FLOW_PRESELECTION_RESET_FAIL`
  - `tools/editor_gate.sh`
    - aggregates per-run interaction checks into `ui_flow_smoke.interaction_checks_coverage`:
      - `{ pass_runs, total_runs, all_pass }` per check key.
    - computes `ui_flow_smoke.interaction_checks_complete`.
  - `tools/editor_weekly_validation.sh`
    - aligns UI-flow run classification with gate (honors direct `flow_failure_code`).
    - propagates `interaction_checks_coverage`, `interaction_checks_complete`, `failure_code_total`, `failure_attribution_complete` into weekly summary JSON/MD.

## Lane C (incremental): STEP170/STEP176 report surfaces for interaction checks
- Reports now render interaction-check coverage from gate/weekly payloads:
  - `tools/write_editor_gate_report.py`
  - `tools/write_step176_gate_report.py`
  - `tools/write_step170_weekly_report.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/write_step176_dashboard.py`
- Output shape:
  - `fillet_pair/chamfer_pair/fillet_runtime/chamfer_runtime/fillet_reset/chamfer_reset/fillet_poly/chamfer_poly = pass/total`
  - `!` suffix marks partial coverage/fail.

## Lane A/C (incremental): weekly gate-runtime traceability
- Goal:
  - keep weekly summary/report aligned with `editor_gate_summary.inputs`, so weekly artifacts can explain gate runtime profile without scanning raw logs.
- Files:
  - `tools/editor_weekly_validation.sh`
  - `tools/write_step170_weekly_report.py`
  - `tools/write_step176_weekly_report.py`
- Contract:
  - weekly summary JSON now carries gate runtime flags in `inputs`:
    - `gate_editor_profile`
    - `gate_editor_smoke_no_convert`
    - `gate_run_step166_gate`
    - `gate_run_editor_ui_flow_smoke_gate`
    - `gate_run_perf_trend`
    - `gate_run_real_scene_trend`
  - weekly `gate` payload includes passthrough `gate.inputs` from gate summary.
  - weekly markdown/report now emits one consolidated line:
    - `gate_runtime: profile/step166_gate/ui_flow_gate/convert_disabled/perf_trend/real_scene_trend`

## Lane C (incremental): dashboard/CI summary runtime traceability alignment
- Goal:
  - propagate gate runtime profile (`lite/full` and key toggles) into top-level dashboard and CI artifact markdown, not only STEP170/STEP176 reports.
- Files:
  - `tools/write_step176_dashboard.py`
  - `tools/write_ci_artifact_summary.py`
- Contract:
  - dashboard `Latest Gate` section now renders:
    - `gate_inputs: profile/step166_gate/ui_flow_gate/convert_disabled/perf_trend/real_scene_trend`
  - dashboard `Gate History (Recent)` table adds compact `runtime` column:
    - `p=<profile> s166=<0|1> ui=<0|1> conv=<0|1>`
  - dashboard `Weekly History (Recent)` table adds compact `gate_runtime` column:
    - derived from weekly `inputs` (`gate_*`) with fallback to nested `gate.inputs`.
  - CI artifact markdown `Editor Gate` section now renders `gate_inputs` line using gate summary `inputs`.
- Benefit:
  - lane owners can compare runtime mode differences directly from dashboard/CI artifacts during cross-run triage, without opening raw JSON.

## Lane Orchestration (incremental): parallel-cycle lane-A runtime passthrough + gate decision fix
- Goal:
  - make `editor_parallel_cycle` summaries self-describing for lane-A execution profile;
  - fix fail-attribution gap when precomputed gate summaries expose `gate_decision` at top-level.
- File:
  - `tools/editor_parallel_cycle.sh`
- Contract updates:
  - `summary.json` now includes `lanes.lane_a.runtime_inputs`:
    - `editor_gate_profile`
    - `editor_smoke_no_convert`
    - `run_step166_gate`
    - `run_editor_ui_flow_smoke_gate`
    - `run_perf_trend`
    - `run_real_scene_trend`
  - runtime source:
    - prefer precomputed gate summary `inputs`;
    - fallback to lane-A env (`LANE_A_PROFILE`, `LANE_A_RUN_*`) when summary lacks `inputs`.
    - when lane A is skipped and no runtime context exists, markdown shows `runtime: n/a` (avoid false boolean defaults).
  - fail detection fix:
    - lane-A gate status now reads `gate_decision.would_fail` first, then legacy `gate.would_fail` fallback.
- CI/report propagation:
  - `tools/write_ci_artifact_summary.py` now renders `lane_a_runtime` in `Parallel Cycle` section when available.
- Benefit:
  - nightly Step Summary can compare lane-A runtime mode and parallel-cycle decision in one page;
  - precomputed gate summary with `would_fail=true` now deterministically flips parallel decision to fail.

## Workflow integration (incremental): GitHub Step Summary runtime alignment
- Goal:
  - keep GitHub Actions Step Summary one-glance fields aligned with local markdown/runtime contracts.
- Files:
  - `.github/workflows/cadgamefusion_editor_nightly.yml`
  - `.github/workflows/cadgamefusion_editor_light.yml`
- Nightly step-summary additions:
  - `nightly_gate_runtime` from `build/editor_gate_summary_nightly.json -> inputs`
  - `nightly_parallel_lane_a_runtime` from `parallel_summary -> lanes.lane_a.runtime_inputs`
  - both appended after `write_ci_artifact_summary.py` output, before exit-code lines.
- Light step-summary additions:
  - `light_editor_runtime` from workflow env (`EDITOR_SMOKE_CASE_SOURCE/EDITOR_SMOKE_LIMIT/EDITOR_SMOKE_NO_CONVERT`)
  - `light_parallel_lane_a_runtime` from `parallel_summary -> lanes.lane_a.runtime_inputs` (or `n/a`)
- Robustness:
  - runtime extraction uses inline Python with tolerant JSON loading (missing files -> empty dict).
  - this avoids workflow flakiness when optional summaries are absent.
- Artifact visibility:
  - nightly uploads `build/ci_editor_nightly_runtime_lines.md`
  - light uploads `build/ci_editor_light_runtime_lines.md`
  - gated by existing `UPLOAD_CI_ARTIFACTS` policy.

## Lane C (incremental): weekly/runtime canonical object + report fallback convergence
- Goal:
  - avoid each consumer reconstructing gate runtime from scattered prefixed input fields.
- Producer update:
  - `tools/editor_weekly_validation.sh` now writes canonical object:
    - top-level `gate_runtime`
    - mirrored at `gate.runtime`
  - fields:
    - `profile`
    - `step166_gate`
    - `ui_flow_gate`
    - `convert_disabled`
    - `perf_trend`
    - `real_scene_trend`
    - `source` (`gate.inputs` or `weekly.inputs`)
- Backward compatibility:
  - existing `inputs.gate_*` keys remain unchanged for older tooling.
- Consumer convergence:
  - `tools/write_step170_weekly_report.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/write_step176_dashboard.py`
  - all prefer `weekly.gate_runtime`; fallback to `inputs.gate_*` + `gate.inputs` when absent.
- Benefit:
  - one runtime schema across weekly JSON, dashboard, and verification reports;
  - lower risk of drift when new runtime toggles are introduced.

## Lane A/C (incremental): local_ci/check_local_summary runtime-object convergence
- Goal:
  - align local developer gate diagnostics with CI/dashboard runtime contracts.
- Producer update:
  - `tools/local_ci.sh` now exports canonical runtime objects in `build/local_ci_summary.json`:
    - `editorGateRuntime`
    - `editorParallelCycleLaneARuntime`
  - each object includes:
    - `profile`
    - `step166_gate`
    - `ui_flow_gate`
    - `convert_disabled`
    - `perf_trend`
    - `real_scene_trend`
    - `source`
  - backward-compatible flat fields remain (`editorGateRuntimeProfile`, `editorParallelCycleLaneARuntimeProfile`, etc.).
- Consumer update:
  - `tools/check_local_summary.sh` now reads canonical objects first, then falls back to flat fields.
  - check output now prints an additional runtime line:
    - `gateRuntime ...`
    - `parallelLaneARuntime ...`
- Benefit:
  - same runtime-shape semantics across local summary, weekly summary, dashboard, and CI markdown.

## Lane A/C (incremental): local artifact markdown runtime convergence
- Goal:
  - reuse `write_ci_artifact_summary.py` as the single markdown renderer for CI/local runtime diagnostics.
- Renderer extension:
  - `tools/write_ci_artifact_summary.py` adds optional `--local-summary` input.
  - when provided, renderer appends `Local CI Runtime` section:
    - `local_gate_runtime`
    - `local_parallel_lane_a_runtime`
    - `local_summary_core`
  - object-first read policy:
    - prefer `editorGateRuntime` / `editorParallelCycleLaneARuntime`
    - fallback to legacy flat fields.
- local_ci integration:
  - `tools/local_ci.sh` now auto-generates:
    - `build/local_ci_artifact_summary.md`
  - command shape:
    - `write_ci_artifact_summary.py --local-summary build/local_ci_summary.json ...`
  - `build/local_ci_summary.json` now includes:
    - `localCiArtifactSummaryMd`
- Benefit:
  - local runs and workflow runs share one markdown vocabulary and one runtime decoding path.

## Lane A/C (incremental): local runtime defaults + checker path flexibility
- Goal:
  - keep `local_ci_summary.json` runtime blocks informative even when `RUN_EDITOR_GATE=0` / lane-A is disabled;
  - allow checker reuse across non-default build directories and archived summaries.
- Producer update:
  - `tools/local_ci.sh` now initializes runtime defaults from effective local knobs before optional gate/cycle execution:
    - `editorGateRuntime` defaults from `EDITOR_GATE_PROFILE` + trend toggles
    - `editorParallelCycleLaneARuntime` defaults from lane-A profile/toggles
  - default sources:
    - gate: `local_ci_defaults`
    - lane A: `lane_a_defaults` or `lane_a_disabled`
  - when gate summary lacks `inputs`, parser fallback reuses these defaults (no `<none>` drift).
- Checker update:
  - `tools/check_local_summary.sh` adds:
    - `--summary <path>` for direct file checks
    - `--build-dir <dir>` for derived `<dir>/local_ci_summary.json`
  - keeps backward compatibility with no-arg default (`build/local_ci_summary.json`).
- Markdown update:
  - `tools/write_ci_artifact_summary.py` local section now also emits:
    - `local_parallel_cycle` (`run_lane_a/b/c`, decision/raw/watch fields)
- Benefit:
  - lane-level runtime provenance remains visible in local markdown/checks even for partial runs,
  - easier CI/debug reuse when local outputs are generated under custom build dirs.

## Lane B (incremental): arc radius grip lifecycle regression coverage
- Goal:
  - lock down `select_tool` arc radius grip behavior with an end-to-end command-level test (drag + undo/redo).
- File:
  - `tools/web_viewer/tests/editor_commands.test.js`
- Added coverage:
  - select an arc, drag `ARC_RADIUS` grip along arc mid-angle direction,
  - assert radius updates while `center/startAngle/endAngle` stay unchanged,
  - assert single-step `history.undo` / `history.redo` returns exact radius values.
- Benefit:
  - protects the recently landed arc radius grip UX from future interaction refactors.

## Lane A/C (incremental): parallel-cycle duration telemetry convergence
- Goal:
  - expose lane-level wall-time in local/CI summaries so performance regressions are visible without opening raw logs.
- Producer update:
  - `tools/editor_parallel_cycle.sh` now emits duration telemetry in summary:
    - top-level: `duration_sec`
    - lane A: `duration_sec`
    - lane B: `duration_sec`, `node_test_duration_sec`, `ui_flow.duration_sec`
    - lane C: `duration_sec`, `case_selection.duration_sec`, `gate_trend.duration_sec`
  - duration semantics:
    - second granularity;
    - executed stages are clamped to minimum `1s` to avoid ambiguous `0s` in fast runs.
- local summary propagation:
  - `tools/local_ci.sh` parses parallel durations and writes:
    - `editorParallelCycleDurationSec`
    - `editorParallelCycleLaneADurationSec`
    - `editorParallelCycleLaneBDurationSec`
    - `editorParallelCycleLaneBNodeTestDurationSec`
    - `editorParallelCycleLaneBUiFlowDurationSec`
    - `editorParallelCycleLaneCDurationSec`
    - `editorParallelCycleLaneCCaseSelectionDurationSec`
    - `editorParallelCycleLaneCGateTrendDurationSec`
  - local console summary adds one compact duration line.
- consumer/report updates:
  - `tools/check_local_summary.sh` now surfaces `parallelDuration ...` line.
  - `tools/write_ci_artifact_summary.py` adds:
    - `Parallel Cycle` section duration line (`--parallel-summary`)
    - `Local CI Runtime` duration line (`--local-summary`)
- Benefit:
  - runtime semantics + time cost are visible in one place for lane rotation tuning and regression triage.

## Lane A/B (incremental): local UI-flow interaction-check propagation
- Goal:
  - make standalone local UI-flow smoke (`RUN_EDITOR_UI_FLOW_SMOKE=1`, no editor_gate) carry the same attribution/interaction observability used in weekly gate reports.
- Producer update:
  - `tools/local_ci.sh` now aggregates per-run `summary.json` from `editor_ui_flow_smoke.sh` and writes:
    - `editorUiFlowSmokeFailureAttributionComplete`
    - `editorUiFlowSmokeInteractionChecksCoverage`
    - `editorUiFlowSmokeInteractionChecksComplete`
  - existing fields remain:
    - `editorUiFlowSmokeFailureCodeCounts`
    - `editorUiFlowSmokeFailureCodeCount`
    - `editorUiFlowSmokeFirstFailureCode`
  - summary console adds:
    - `Editor UI flow smoke attribution: ... attr_complete=... interaction_complete=...`
- Checker update:
  - `tools/check_local_summary.sh` now parses and prints:
    - `editorUiFlowAttr`
    - `editorUiFlowInteractionComplete`
  - gate-mode enforcement:
    - when `runEditorUiFlowSmokeGate=true` and failures exist, attribution must be complete;
    - when `runEditorUiFlowSmokeGate=true` and status is `ok`, interaction checks must be complete.
- Renderer update:
  - `tools/write_ci_artifact_summary.py --local-summary` now appends:
    - `local_ui_flow_smoke`
    - `local_ui_flow_attribution`
    - `local_ui_flow_interaction_checks`
- Benefit:
  - local observe/gate loops now expose UI interaction health directly in `local_ci_summary.json`, checker output, and artifact markdown without requiring `editor_gate.sh`.

## Lane A/B (incremental): parallel-cycle lane-B UI-flow gate convergence
- Goal:
  - make lane-B UI-flow in `editor_parallel_cycle.sh` carry explicit attribution/interaction completeness, and let local/CI summaries enforce it in gate mode.
- Producer update (`tools/editor_parallel_cycle.sh`):
  - lane-B UI-flow now emits:
    - `failure_code`, `failure_detail`
    - `failure_attribution_complete`
    - `interaction_checks_coverage`
    - `interaction_checks_complete`
    - `interaction_checks_failed`
  - gate semantics:
    - when lane-B UI-flow mode is `gate` and interaction checks are incomplete, add fail reason `LANE_B_UI_FLOW_INTERACTION_INCOMPLETE`;
    - missing failure attribution adds `LANE_B_UI_FLOW_ATTR_INCOMPLETE` / `LANE_B_UI_FLOW_ATTR_MISSING`.
- local summary propagation (`tools/local_ci.sh`):
  - parses parallel summary and exports:
    - `editorParallelCycleLaneBUiFlowFailureAttributionComplete`
    - `editorParallelCycleLaneBUiFlowInteractionChecksCoverage`
    - `editorParallelCycleLaneBUiFlowInteractionChecksComplete`
    - plus runtime context: `editorParallelCycleLaneBRunUiFlow`, `editorParallelCycleLaneBUiFlowMode`
  - local summary console adds:
    - `Editor parallel cycle lane B ui-flow checks: ...`
- checker/report updates:
  - `tools/check_local_summary.sh` now validates lane-B UI-flow completeness when:
    - `runEditorParallelCycle=true`, lane-B enabled, lane-B ui-flow enabled, mode=`gate`.
  - `tools/write_ci_artifact_summary.py` now renders:
    - `lane_b_ui_flow_checks`
    - `lane_b_ui_flow_interaction_coverage`
    - `local_parallel_lane_b_ui_flow`
    - `local_parallel_lane_b_ui_interaction_checks`
- Benefit:
  - lane-B gate readiness is explicit and testable, with the same signal available in raw summary JSON, checker output, and markdown artifacts.

## Lane A/C (incremental): STEP176 weekly/dashboard parallel-cycle convergence
- Goal:
  - make STEP176 weekly outputs carry lane-B parallel-cycle gate-readiness signals (attribution + interaction completeness) in a stable, machine-readable shape.
- Producer update (`tools/editor_weekly_validation.sh`):
  - adds optional weekly parallel-cycle step (default enabled, lane-B focused):
    - `RUN_EDITOR_PARALLEL_CYCLE` (default `1`)
    - `PARALLEL_CYCLE_WATCH_POLICY`
    - `PARALLEL_CYCLE_RUN_LANE_A/B/C` (defaults `0/1/0`)
    - `PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW` (default follows `RUN_EDITOR_UI_FLOW_SMOKE`)
    - `PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE` (default `gate`)
    - `PARALLEL_CYCLE_STRICT` (default `0`, optional hard-fail)
  - captures `editor_parallel_cycle.sh` outputs (`run_id/out_dir/summary_json/summary_md/gate_decision`) and writes canonical `parallel_cycle` object into weekly summary JSON:
    - `status`, `exit_code`, `run_id`, `summary_json`, `summary_md`, `watch_policy`
    - nested `gate_decision`, `lanes`, duration, and load-status metadata.
  - weekly markdown summary adds:
    - `parallel_cycle` status/decision line
    - lane-B ui-flow attribution + interaction coverage lines
    - artifact links for `parallel_cycle_summary_json/md`.
- Consumer update (`tools/write_step176_weekly_report.py`):
  - reads `weekly.parallel_cycle` and appends:
    - weekly input knobs for parallel cycle,
    - run outcome + lane-B ui-flow completeness details,
    - artifact links.
- Consumer update (`tools/write_step176_dashboard.py`):
  - weekly history table adds `parallel_cycle` column.
  - latest-weekly section adds compact `weekly_parallel_cycle` line and summary-json pointer.
- Benefit:
  - STEP176 weekly views now expose lane-B UI-flow gate semantics without opening raw parallel-cycle JSON, while keeping backward compatibility for older weekly summaries.

## Lane A/C (incremental): STEP170 weekly report parallel-cycle convergence
- Goal:
  - keep STEP170 weekly verification view aligned with STEP176 when weekly summary includes `parallel_cycle`.
- File:
  - `tools/write_step170_weekly_report.py`
- Behavior:
  - reads `weekly.inputs.parallel_cycle_*` and emits one compact input line:
    - `parallel_cycle_inputs` (`watch_policy`, lane toggles, lane-B ui-flow mode, strict flag).
  - reads `weekly.parallel_cycle` and emits:
    - top-level decision/status/run-id/duration line,
    - lane-B status/duration line,
    - lane-B ui-flow attribution + interaction completeness line,
    - optional lane-B failure code / interaction coverage,
    - summary artifact pointers (`parallel_cycle_summary_json/md`).
- Benefit:
  - STEP170 and STEP176 weekly reports now share the same lane-B parallel-cycle observability contract, reducing cross-report drift.

## Lane A/C (incremental): weekly parallel decision policy + gate detail convergence
- Goal:
  - make weekly flow able to **optionally** treat parallel-cycle decision as a blocking gate, and expose exact gate reasons in STEP170/STEP176 outputs.
- Producer update (`tools/editor_weekly_validation.sh`):
  - adds `WEEKLY_PARALLEL_DECISION_POLICY=observe|gate` (default `observe`).
  - when `RUN_EDITOR_PARALLEL_CYCLE=1` and policy=`gate`:
    - if parallel decision is `fail` (or parallel status fail), weekly exits non-zero.
  - weekly JSON inputs now include:
    - `weekly_parallel_decision_policy`
  - weekly markdown now includes:
    - `parallel_cycle_gate` (`raw`, `should_merge`, `watch_escalated`, `fail_reasons`, `warning_codes`)
    - `parallel_cycle_failure_codes` (when present).
- Consumer convergence:
  - `tools/write_step176_weekly_report.py`:
    - adds `weekly_policy` in inputs section;
    - adds `parallel_cycle_gate` line + failure code map.
  - `tools/write_step176_dashboard.py`:
    - weekly table parallel column now includes policy/watch-escalation markers;
    - latest weekly adds `weekly_parallel_cycle_gate` line.
  - `tools/write_step170_weekly_report.py`:
    - adds `weekly_policy`, `watch_escalated`, and `parallel_cycle_gate` details.
- Benefit:
  - observe->gate promotion for parallel-cycle can be toggled without changing script wiring;
  - all weekly-facing reports show the same decision semantics and root causes.

## Lane B/A (incremental): lane-B UI-flow hardening + timeout-based gate injection
- Goal:
  - make lane-B UI-flow checks default-active in weekly parallel cycle and provide deterministic fail-injection for gate-path verification.
- `tools/editor_parallel_cycle.sh` updates:
  - new input:
    - `LANE_B_UI_FLOW_TIMEOUT_MS` (optional, forwarded to `editor_ui_flow_smoke.sh --timeout-ms`).
  - lane-B UI-flow summary now carries:
    - `timeout_ms`
  - gate hardening:
    - in `mode=gate`, missing/failed interaction completeness now always contributes `LANE_B_UI_FLOW_INTERACTION_INCOMPLETE`;
    - if lane-B is enabled but ui-flow is disabled in gate mode, adds `LANE_B_UI_FLOW_DISABLED`.
  - default skipped state normalization:
    - when ui-flow not enabled, `interaction_checks_complete=true` by default to avoid false-negative semantics in non-gate runs.
- `tools/editor_weekly_validation.sh` updates:
  - `PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW` default changed to `1` (independent from weekly standalone `RUN_EDITOR_UI_FLOW_SMOKE`).
  - new pass-through:
    - `PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS`
  - summary/report fields include timeout for reproducibility.
  - with `WEEKLY_PARALLEL_DECISION_POLICY=gate`, parallel decision fail now blocks weekly run (explicit error + non-zero exit).
- report convergence:
  - `tools/write_step170_weekly_report.py`, `tools/write_step176_weekly_report.py`, `tools/write_step176_dashboard.py`
  - now include `lane_b_ui_timeout_ms` in parallel-cycle input/latest snapshot lines.
- Benefit:
  - weekly gate branch can be verified deterministically (`timeout_ms=1`) without mutating product logic;
  - lane-B UI-flow gate semantics are strict, visible, and reproducible.

## Lane A/B/C (incremental): local CI summary/checker/artifact parity for lane-B timeout + enabled
- Goal:
  - ensure lane-B UI-flow timeout/enablement signals from `editor_parallel_cycle.sh` are preserved end-to-end in local CI outputs and local checker/report tooling.
- `tools/local_ci.sh` updates:
  - forwards `LANE_B_UI_FLOW_TIMEOUT_MS` into `tools/editor_parallel_cycle.sh`.
  - parses and exposes effective lane-B ui-flow fields from parallel summary:
    - `PARALLEL_CYCLE_LANE_B_UI_FLOW_ENABLED`
    - `PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS_EFFECTIVE`
  - writes canonical local summary keys:
    - `editorParallelCycleLaneBUiFlowEnabled`
    - `editorParallelCycleLaneBUiFlowTimeoutMs`
  - summary log now prints:
    - `enabled=<bool> timeout_ms=<int> attr_complete=<bool> interaction_complete=<bool>`
  - strict-exit refinement:
    - when lane-B ui-flow is required in gate mode but resolved as disabled, fail reason includes `editorParallelCycleLaneBUiFlow=disabled`.
- `tools/check_local_summary.sh` updates:
  - parses new local summary keys:
    - `editorParallelCycleLaneBUiFlowEnabled`
    - `editorParallelCycleLaneBUiFlowTimeoutMs`
  - summary output includes `parallelLaneBUiEnabled` and `parallelLaneBUiTimeoutMs`.
  - gate checks now enforce:
    - if lane-B ui-flow is expected in gate mode, `enabled` must be `true` in addition to attribution/interaction completeness.
- `tools/write_ci_artifact_summary.py` updates:
  - parallel-cycle section:
    - `lane_b_ui_flow_checks` now includes `enabled` and `timeout_ms`.
  - local runtime section:
    - `local_parallel_lane_b_ui_flow` now differentiates `configured` vs effective `enabled`, and includes `timeout_ms`.
- Benefit:
  - local non-weekly debugging and weekly/parallel pipelines use the same lane-B ui-flow observability contract;
  - timeout-based fail injection remains traceable from raw summary JSON to checker output to markdown artifacts.

## Lane B (incremental): preserve UI-flow attribution on fail path in parallel cycle
- Goal:
  - avoid losing lane-B ui-flow failure attribution when `editor_ui_flow_smoke.sh` exits non-zero (including timeout/fail injection paths).
- File:
  - `tools/editor_parallel_cycle.sh`
  - `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- Change:
  - add `extract_summary_json_from_log()` helper:
    - resolves `summary_json=...` from lane-B ui-flow log,
    - falls back to `out_dir=<...>/summary.json`,
    - returns only existing files.
  - apply summary-path extraction for both pass and fail branches of lane-B ui-flow execution (previously pass-only).
  - fail-code normalization in ui-flow summary:
    - when `FLOW_EXIT_CODE==124`, emit `flow_failure_code=UI_FLOW_TIMEOUT` directly, instead of falling back to `UI_FLOW_FLOW_JSON_INVALID`.
- Gate impact:
  - fail-path gate reasons no longer degrade to `LANE_B_UI_FLOW_ATTR_MISSING` when summary exists;
  - lane-B retains concrete `failure_code` and interaction coverage in `summary.json`.
- Benefit:
  - fail-path triage remains machine-readable and reproducible in:
    - `editor_parallel_cycle` summary,
    - `local_ci_summary.json`,
    - `write_ci_artifact_summary.py` markdown.

## Lane A/B/C (incremental): UI-flow setup-stage attribution propagation
- Goal:
  - when lane-B/UI-flow fails in setup (`open`/`resize`) or runtime (`run-code`), keep stage + exit codes visible in gate/parallel/local-ci/report layers.
- Source summary contract (`tools/web_viewer/scripts/editor_ui_flow_smoke.sh`):
  - adds `flow_failure_stage` with values: `open|resize|run_code|flow`.
  - keeps setup/runtime return codes:
    - `open_exit_code`
    - `resize_exit_code`
    - `run_code_exit_code`
- Gate aggregation (`tools/editor_gate.sh`):
  - per-run `ui_flow_smoke.runs[]` now includes:
    - `failure_stage`
    - `open_exit_code`, `resize_exit_code`, `run_code_exit_code`
  - rollup fields:
    - `ui_flow_smoke.failure_stage_counts`
    - `ui_flow_smoke.first_failure_stage`
    - top-level `ui_flow_smoke.open_exit_code|resize_exit_code|run_code_exit_code`
- Parallel cycle (`tools/editor_parallel_cycle.sh`):
  - lane-B ui-flow summary now carries:
    - `failure_stage`
    - setup/runtime exit codes
  - markdown summary adds one compact line:
    - `ui_flow_failure_stage: stage/open_exit/resize_exit/run_code_exit`
- Local CI/report propagation:
  - `tools/local_ci.sh` parses and emits:
    - gate: `editorGateUiFlowFirstFailureStage`, `editorGateUiFlowOpenExitCode`, `editorGateUiFlowResizeExitCode`, `editorGateUiFlowRunCodeExitCode`
    - parallel: `editorParallelCycleLaneBUiFlowFailureStage`, `editorParallelCycleLaneBUiFlowOpenExitCode`, `editorParallelCycleLaneBUiFlowResizeExitCode`, `editorParallelCycleLaneBUiFlowRunCodeExitCode`
  - report writers now render setup-stage hints:
    - `tools/write_editor_gate_report.py`
    - `tools/write_step176_gate_report.py`
    - `tools/write_ci_artifact_summary.py`
- Benefit:
  - setup-time infra failures (e.g. Playwright open timeout) are no longer opaque FAIL; they are attributed with stable machine-readable stage + rc across weekly/gate/parallel artifacts.

## Lane A/B/C (incremental): stage attribution into weekly/dashboard reports
- Goal:
  - make `flow_failure_stage` visible not only in raw JSON, but also in STEP170/STEP176 weekly reports and STEP176 dashboard rollups.
- Weekly report writers:
  - `tools/write_step170_weekly_report.py`
  - `tools/write_step176_weekly_report.py`
- Added behavior:
  - both writers resolve `ui_flow.run_summaries` and derive setup stage when weekly payload lacks direct rollups.
  - render:
    - `setup_exits: open/resize/run_code + first_failure_stage`
    - `failure_stage_counts` when available
  - parallel lane-B subsection now renders:
    - `lane_b_ui_setup_exits`
    - `lane_b_ui_failure_stage_counts` (when available)
- Dashboard writer:
  - `tools/write_step176_dashboard.py`
  - latest gate block now includes:
    - `ui_flow_failure_stages`
    - `ui_flow_setup_exits`
  - gate/weekly history compact columns now append stage hints:
    - gate history `ui_flow` column adds `st=<stage>`
    - weekly history `ui_flow` and `parallel_cycle` columns include stage markers
    - latest weekly parallel snapshot includes `lane_b_ui_stage` + `lane_b_ui_setup`
- CI markdown artifact writer:
  - `tools/write_ci_artifact_summary.py`
  - adds:
    - `ui_flow_failure_stages`
    - `lane_b_ui_flow_failure_stages`
    - existing setup exit lines kept (`*_setup_exits`)
  - `local_ci_summary.json` keys extended:
    - `editorGateUiFlowFailureStageCounts`
    - `editorParallelCycleLaneBUiFlowFailureStageCounts`

## Lane A/B/C (incremental): UI-flow stage trend aggregator + weekly integration
- Goal:
  - convert raw UI-flow stage attribution (`open|resize|run_code|flow`) into a rolling trend summary that can drive observe->gate decisions.
- New script:
  - `tools/editor_ui_flow_stage_trend.py`
  - input: `build/editor_gate_history/*.json`
  - outputs:
    - `build/editor_ui_flow_stage_trend.json`
    - `build/editor_ui_flow_stage_trend.md`
  - CLI contract:
    - `--history-dir`
    - `--days`
    - `--out-json`
    - `--out-md`
  - stdout contract:
    - `ui_flow_stage_trend_json=...`
    - `ui_flow_stage_trend_md=...`
    - `ui_flow_stage_trend_status=stable|watch|unstable|no_data`
    - `ui_flow_stage_trend_gate_mode=observe|gate`
- Weekly integration:
  - `tools/editor_weekly_validation.sh` adds stage-trend step right after gate trend:
    - `7.5) UI-flow stage trend summary`
  - new weekly env knobs:
    - `UI_FLOW_STAGE_TREND_DAYS`
    - `UI_FLOW_STAGE_TREND_JSON`
    - `UI_FLOW_STAGE_TREND_MD`
  - weekly summary JSON adds `ui_flow_stage_trend` section:
    - `status`, `recommended_gate_mode`
    - `enabled_samples_in_window`, `fail_ratio`, `attribution_ratio`
    - `failure_stage_counts`, `first_failure_stage_counts`, `setup_exit_nonzero_runs`
    - `summary_json`, `summary_md`, `policy`
- Report/dashboard propagation:
  - `tools/write_step170_weekly_report.py` renders:
    - `ui_flow_stage_trend`
    - `ui_flow_stage_counts`
    - artifact path `ui_flow_stage_trend_json`
  - `tools/write_step176_weekly_report.py` renders:
    - `ui_flow_stage_trend`
    - `ui_flow_stage_trend_counts`
    - `ui_flow_stage_trend_first_stage_counts`
  - `tools/write_step176_dashboard.py` renders:
    - weekly table `trend(ui_stage)` compact cell (`trend | ui:<status>/<mode>`)
    - latest weekly block `weekly_ui_flow_stage_trend`
- Benefit:
  - gate-readiness recommendation for UI-flow stops relying on single-run signals;
  - setup-stage instability is visible as a trend in weekly and dashboard artifacts.

## Lane A/B (incremental): editor_gate trend policy switch + local_ci trend wiring
- Goal:
  - make UI-flow stage trend actionable in `editor_gate.sh`, with explicit policy control:
    - `observe`: only report trend (default behavior compatibility)
    - `auto`: auto-switch UI-flow gate requirement by trend recommendation
    - `gate`: hard gate on trend stability
- `tools/editor_gate.sh` changes:
  - new env interface:
    - `RUN_UI_FLOW_STAGE_TREND=0|1`
    - `UI_FLOW_STAGE_TREND_POLICY=observe|auto|gate`
    - `UI_FLOW_STAGE_TREND_DAYS=<N>`
    - `UI_FLOW_STAGE_TREND_JSON`, `UI_FLOW_STAGE_TREND_MD`
  - trend evaluation runs before UI-flow smoke execution.
  - auto policy behavior:
    - if recommendation=`gate` -> set `RUN_EDITOR_UI_FLOW_SMOKE_GATE=1` (when not explicitly overridden).
    - if recommendation=`observe` -> set `RUN_EDITOR_UI_FLOW_SMOKE_GATE=0`; if user did not explicitly set observe-run switch, force `RUN_EDITOR_UI_FLOW_SMOKE=1` to keep sample continuity.
  - gate policy behavior:
    - if trend status != `stable`, gate fails with reason:
      - `UI_FLOW_STAGE_TREND:<status>`
  - summary contract (`editor_gate_summary.json`) extended:
    - `inputs.run_ui_flow_stage_trend`
    - `inputs.ui_flow_stage_trend_policy|days|effective_mode|gate_source|gate_applied|recommended_gate_mode`
    - top-level `ui_flow_stage_trend` block (status/recommendation/effective mode/metrics/stage counts/artifact paths).
- `tools/local_ci.sh` changes:
  - forwards gate policy knobs:
    - `EDITOR_GATE_RUN_UI_FLOW_STAGE_TREND`
    - `EDITOR_GATE_UI_FLOW_STAGE_TREND_POLICY`
    - `EDITOR_GATE_UI_FLOW_STAGE_TREND_DAYS`
  - captures `ui_flow_stage_trend` fields from gate summary into local summary JSON:
    - `editorGateUiFlowStageTrendStatus`
    - `editorGateUiFlowStageTrendRecommendedMode`
    - `editorGateUiFlowStageTrendEffectiveMode`
    - `editorGateUiFlowStageTrendGateSource`
    - `editorGateUiFlowStageTrendGateApplied`
    - `editorGateUiFlowStageTrendEnabledSamples`
    - `editorGateUiFlowStageTrendFailRatio`
    - `editorGateUiFlowStageTrendAttributionRatio`
    - `editorGateUiFlowStageTrendFailureStageCounts`
  - local console summary adds one compact trend line for gate-readiness triage.
- `tools/write_ci_artifact_summary.py`:
  - local runtime section now renders:
    - `local_gate_ui_flow_stage_trend`
    - `local_gate_ui_flow_stage_trend_counts`

## Lane A (incremental): nightly workflow default policy integration
- Goal:
  - wire UI-flow stage trend policy into nightly pipeline defaults so rollout can stay in `auto` track, with safe fallback on runners lacking Playwright wrapper.
- Workflow file:
  - `.github/workflows/cadgamefusion_editor_nightly.yml`
- New dispatch inputs:
  - `ui_flow_stage_trend_policy` (`observe|auto|gate`, default `auto`)
  - `ui_flow_stage_trend_days` (default `7`)
- Nightly gate step behavior:
  - always enables trend computation:
    - `RUN_UI_FLOW_STAGE_TREND=1`
  - forwards policy + days into `editor_gate.sh`.
  - capability guard:
    - if `${CODEX_HOME}/skills/playwright/scripts/playwright_cli.sh` is missing, force:
      - `RUN_EDITOR_UI_FLOW_SMOKE=0`
      - `RUN_EDITOR_UI_FLOW_SMOKE_GATE=0`
      - `UI_FLOW_STAGE_TREND_POLICY=observe`
    - records capability as `no_playwright_wrapper`.
  - if wrapper exists:
    - keep `RUN_EDITOR_UI_FLOW_SMOKE=0`
    - leave `RUN_EDITOR_UI_FLOW_SMOKE_GATE` unset so `UI_FLOW_STAGE_TREND_POLICY=auto` can control gate mode.
- Nightly outputs and artifacts:
  - step outputs include:
    - `ui_flow_stage_trend_policy`
    - `ui_flow_stage_trend_days`
    - `ui_flow_stage_trend_capability`
  - runtime summary lines include gate trend snapshot:
    - `nightly_ui_flow_stage_trend`
  - uploaded artifacts include:
    - `build/editor_ui_flow_stage_trend.json`
    - `build/editor_ui_flow_stage_trend.md`

## Lane A/B (stabilization): trend policy behavior under capability limits
- Goal:
  - keep `observe|auto|gate` deterministic when UI-flow runtime prerequisites are unavailable (CI runner missing wrapper, local sandbox port bind denied).
- Contract:
  - `auto` always follows trend recommendation and records source:
    - `ui_flow_stage_trend.gate_source=auto_recommended_observe|auto_recommended_gate`
  - `gate` fails hard with explicit reason:
    - `UI_FLOW_STAGE_TREND:<status>`
  - summary fields remain populated even when UI-flow execution is skipped:
    - `ui_flow_stage_trend.status`
    - `ui_flow_stage_trend.recommended_gate_mode`
    - `ui_flow_stage_trend.effective_mode`
    - `ui_flow_stage_trend.gate_applied`
- Why:
  - this avoids silent policy drift and guarantees that gate decisions remain explainable in both local and nightly artifacts.

## Lane A (incremental): `check_local_summary` stage-trend contract enforcement
- Goal:
  - ensure local strict checks fail early when `editor_gate` trend-policy fields stop being emitted.
- File:
  - `tools/check_local_summary.sh`
- New checks (when `runEditorGate=true` and `editorGateRunUiFlowStageTrend=true`):
  - `editorGateUiFlowStageTrendPolicyInput` is non-empty.
  - `editorGateUiFlowStageTrendDaysInput > 0`.
  - `editorGateUiFlowStageTrendStatus` is present (`!= unknown`).
  - `editorGateUiFlowStageTrendRecommendedMode` in `observe|gate`.
  - `editorGateUiFlowStageTrendEffectiveMode` in `observe|gate`.
  - `editorGateUiFlowStageTrendGateSource` is non-empty.
- Reporting:
  - checker prints compact line:
    - `gateUiStageTrend run/policy/days/status/recommended/effective/source/applied/enabledSamples`
- Benefit:
  - local CI catches missing trend metadata immediately before weekly/nightly report generation.

## Lane A/C (incremental): weekly summary + dashboard trend-contract guard
- Goal:
  - make weekly trend fields (`ui_flow_stage_trend`) machine-validated before reports/dashboard are consumed.
- New tool:
  - `tools/check_weekly_summary.sh`
  - validates weekly summary contract:
    - `ui_flow_stage_trend.days/status/recommended_gate_mode`
    - `summary_json/summary_md` presence + file existence
    - `failure_stage_counts/first_failure_stage_counts/setup_exit_nonzero_runs` object shape
  - optional dashboard cross-check:
    - verifies `weekly_ui_flow_stage_trend` line exists and matches summary `status/mode`.
- Weekly pipeline integration:
  - `tools/editor_weekly_validation.sh` adds post-summary hook:
    - `RUN_WEEKLY_SUMMARY_CHECK=0|1` (default `1`)
    - `WEEKLY_SUMMARY_CHECK_STRICT=0|1` (default `1`)
    - `WEEKLY_SUMMARY_CHECK_DASHBOARD=<path>` (optional)
    - `WEEKLY_SUMMARY_CHECK_REQUIRE_DASHBOARD=0|1` (default `0`)
  - weekly summary `inputs` now records these knobs for audit.
- Dashboard visibility:
  - `tools/write_step176_dashboard.py` adds:
    - `weekly_ui_flow_stage_trend_contract: ok/issues`
    - weekly history trend cell marks invalid contracts with `:contract!`.

## Lane A (bugfix): STEP166 gate failure propagation under retry-exhaustion
- Problem:
  - when STEP166 retries were exhausted by transient-classified failures, `editor_gate.sh` could end with `gate_decision.would_fail=false` despite `step166.gate_would_fail=true`.
- Fix (`tools/editor_gate.sh`):
  - capture `gate_would_fail` from `cad_regression_run.py` output per attempt.
  - when command exits `0` but `gate_would_fail=True`, append `STEP166:GATE_WOULD_FAIL` and fail gate.
  - after retry loop, if `cad_rc != 0` and no existing STEP166 reason, append `STEP166:RC_<rc>` to guarantee fail propagation.
- Result:
  - full-profile gate now exits non-zero consistently when STEP166 indicates regression/failure.

## Lane C (incremental): CI artifact markdown exposes stage-trend contract status
- Goal:
  - let nightly/light/local artifacts show whether `ui_flow_stage_trend` contract is structurally valid, without opening raw JSON.
- File:
  - `tools/write_ci_artifact_summary.py`
- Added output in gate/local sections:
  - gate:
    - `ui_flow_stage_trend`
    - `ui_flow_stage_trend_contract` (`ok=true|false`, `issues=...`)
    - `ui_flow_stage_trend_counts` (`stages/first_stages/setup_nonzero`)
  - local:
    - `local_gate_ui_flow_stage_trend_contract`
- Benefit:
  - CI step summary directly exposes trend-data quality and prevents silent schema drift.

## Lane A/C (incremental): workflow-level stage-trend contract check (nightly/light)
- Goal:
  - ensure workflow step summary and uploaded artifacts always include explicit contract verdict for `ui_flow_stage_trend`.
- New tool:
  - `tools/check_ui_flow_stage_trend_contract.py`
  - supports:
    - `--gate-summary`
    - `--weekly-summary`
    - `--local-summary`
    - `--strict`
    - `--out-json` / `--out-md`
  - stdout contract:
    - `ui_flow_stage_trend_contract_source`
    - `ui_flow_stage_trend_contract_ok`
    - `ui_flow_stage_trend_contract_issues`
    - `ui_flow_stage_trend_contract_status|mode|days`
- Workflow integration:
  - `.github/workflows/cadgamefusion_editor_nightly.yml`
    - new step `Validate UI-flow stage trend contract` (uses gate summary, writes nightly contract json/md).
    - step summary now includes `nightly_ui_flow_stage_trend_contract`.
    - artifacts now include:
      - `build/editor_ui_flow_stage_trend_contract_nightly.json`
      - `build/editor_ui_flow_stage_trend_contract_nightly.md`
  - `.github/workflows/cadgamefusion_editor_light.yml`
    - new step `Validate UI-flow stage trend contract (light)`:
      - if gate summary exists: validate it;
      - otherwise write explicit `light_no_editor_gate` contract artifact (non-error, documented).
    - step summary now includes `light_ui_flow_stage_trend_contract`.
    - artifacts now include:
      - `build/editor_ui_flow_stage_trend_contract_light.json`
      - `build/editor_ui_flow_stage_trend_contract_light.md`
- Benefit:
  - workflow operators can see contract health directly in Actions summary without digging raw JSON.

## Lane A/C (incremental): unified workflow contract fields (rc + issue_count)
- Goal:
  - standardize workflow-level contract signals so nightly/light summaries can be parsed uniformly.
- Added contract fields:
  - `ui_flow_stage_trend_contract_issue_count` (workflow step output)
  - `UI_STAGE_CONTRACT_*` env forwarding into `write_ci_artifact_summary.py`
  - markdown line:
    - `workflow_ui_flow_stage_trend_contract: ok/issues/issue_count/source/status/mode/days/rc`
- Workflow updates:
  - nightly + light now both emit `issue_count` in:
    - step outputs
    - `$GITHUB_STEP_SUMMARY` line
- Reporter update:
  - `tools/write_ci_artifact_summary.py` now renders workflow-level contract line when `UI_STAGE_CONTRACT_*` env exists.
- Benefit:
  - one stable contract schema for downstream parsers and report diffing across nightly/light/local contexts.

## Lane A/C (incremental): workflow-level contract policy enforcement (observe -> gate)
- Goal:
  - make workflow-level `ui_flow_stage_trend` contract checks enforceable without breaking current default observe behavior.
- Workflow changes:
  - `.github/workflows/cadgamefusion_editor_nightly.yml`
    - adds dispatch input `ui_flow_stage_contract_policy=observe|auto|gate` (default `auto`).
    - contract step resolves effective policy:
      - `auto` -> `gate` when nightly mode is `gate`, else `observe`.
    - emits new outputs:
      - `ui_flow_stage_trend_contract_policy`
      - `ui_flow_stage_trend_contract_decision` (`pass|fail`)
    - adds explicit enforcement step:
      - `Enforce UI-flow stage trend contract policy`
      - fails workflow only when `policy=gate` and `decision=fail`.
  - `.github/workflows/cadgamefusion_editor_light.yml`
    - adds dispatch input `ui_flow_stage_contract_policy=observe|auto|gate` (default `observe`).
    - contract step emits the same `policy/decision` outputs.
    - fallback branch (`light_no_editor_gate`) behavior:
      - observe policy: keep non-blocking `ok=true`, `rc=0`.
      - gate policy: mark `issues=gate_summary_missing`, `ok=false`, `rc=2`, `decision=fail`.
    - adds enforcement step:
      - `Enforce UI-flow stage trend contract policy (light)`.
- Reporter update:
  - `tools/write_ci_artifact_summary.py` now prints workflow contract line with:
    - `policy=...`
    - `decision=...`
- Benefit:
  - policy can be promoted to gate incrementally while preserving existing observe-first defaults and clear failure attribution.

## Lane A/C (incremental): local_ci contract-policy parity with workflows
- Goal:
  - keep local `editor_gate` behavior aligned with nightly/light contract-policy semantics to avoid local/CI drift.
- `tools/local_ci.sh` changes:
  - new env:
    - `EDITOR_GATE_UI_FLOW_STAGE_CONTRACT_POLICY=observe|auto|gate` (default `auto`).
  - effective policy resolution:
    - `auto` -> `gate` when `--strict-exit` is enabled; otherwise `observe`.
  - after `editor_gate` summary generation, run:
    - `python3 tools/check_ui_flow_stage_trend_contract.py --gate-summary ... --strict`
  - capture and persist contract fields:
    - `source/ok/issues/issue_count/status/mode/days/rc`
    - plus local policy fields:
      - `policy_input`
      - `policy_effective`
      - `decision`
  - local strict gate adds:
    - fail when `policy_effective=gate` and `decision=fail`.
  - local artifact markdown forwarding:
    - pass `UI_STAGE_CONTRACT_*` env into `tools/write_ci_artifact_summary.py` so local markdown now matches workflow contract line semantics.
- `tools/check_local_summary.sh` changes:
  - parse and validate local contract-policy fields from `local_ci_summary.json`.
  - require valid `policy_input/effective/decision` shape for editor-gate runs.
  - enforce `effective=gate -> decision=pass`.
- Benefit:
  - one contract-policy model across local, nightly, and light pipelines; easier promotion from observe to gate without behavior skew.

## Lane B (incremental): preselected polyline guidance for Fillet/Chamfer
- Goal:
  - reduce operator confusion in the common “single polyline preselected” flow where Fillet/Chamfer requires two corner-side picks on the same entity.
- Files:
  - `tools/web_viewer/tools/fillet_tool.js`
  - `tools/web_viewer/tools/chamfer_tool.js`
  - `tools/web_viewer/tests/editor_commands.test.js`
- Behavior:
  - when exactly one preselected target is a polyline:
    - initial prompt in second-pick stage becomes:
      - `Click near first side on selected polyline`
    - after first-side refinement click:
      - prompt changes to `Click near second side on selected polyline`
  - line preselection behavior stays unchanged (`Click second line/polyline`).
- Contract:
  - command payloads (`selection.filletByPick` / `selection.chamferByPick`) remain unchanged.
  - only status guidance text is refined; no model/history semantics change.
- Verification intent:
  - keep command-level behavior stable while making same-entity corner flow discoverable from status text alone.

## Lane B (incremental): UI-flow prompt contract sync for preselected polyline
- Goal:
  - keep browser smoke assertions aligned with the new Fillet/Chamfer polyline prompt sequence.
- File:
  - `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- Contract update:
  - preselected polyline flow now asserts two prompt transitions:
    - activation: `... first side on selected polyline ...`
    - after first-side click: `... second side on selected polyline ...`
  - result payload adds:
    - `filletPromptFirst` / `chamferPromptFirst`
    - `filletFallbackPromptFirst` / `chamferFallbackPromptFirst`
  - compatibility:
    - keeps existing `filletPromptSecond` / `chamferPromptSecond` fields.
    - `interaction_checks` accepts older payloads (missing `*PromptFirst`) and enforces first-prompt only when field exists.
- Benefit:
  - prevents false negatives when tool UX is improved while retaining historical trend compatibility.

## Lane A (incremental): UI-flow Playwright open retry hardening
- Goal:
  - reduce transient `UI_FLOW_OPEN_TIMEOUT` flakiness by retrying Playwright `open` with isolated session ids.
- File:
  - `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- Added controls:
  - `PWCLI_OPEN_RETRIES` (default `2`)
  - CLI arg `--pwcli-open-retries N`
- Runtime behavior:
  - `open` now runs with retry loop (`1..N`);
  - each attempt uses an isolated session name suffix (`_a1`, `_a2`, ...);
  - stale per-attempt session is stopped before retry.
- Summary contract additions (`summary.json`):
  - `open_retry_limit`
  - `open_attempt_count`
  - `open_attempt_exit_codes`
- Compatibility:
  - existing `flow_failure_code=UI_FLOW_OPEN_TIMEOUT|UI_FLOW_OPEN_FAIL` behavior unchanged;
  - additional fields are additive and safe for old readers.

## Lane A/C (incremental): open-retry knob propagation to orchestration + summary contracts
- Goal:
  - avoid losing the new UI-flow open retry knob at orchestration boundaries (`weekly -> parallel -> local summary/check`).
- Files:
  - `tools/editor_parallel_cycle.sh`
  - `tools/editor_weekly_validation.sh`
  - `tools/check_local_summary.sh`
- Contract updates:
  - `editor_parallel_cycle.sh`
    - new input env: `LANE_B_UI_FLOW_OPEN_RETRIES` (validated when provided).
    - forwards to UI-flow smoke: `--pwcli-open-retries`.
    - lane-B ui-flow summary now persists:
      - `open_retries`
      - `open_attempt_count`
      - `open_attempt_exit_codes`
      - `failure_stage_counts` passthrough.
  - `editor_weekly_validation.sh`
    - passes `EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES` into `editor_gate.sh` (gate path parity).
    - passes `LANE_B_UI_FLOW_OPEN_RETRIES` into `editor_parallel_cycle.sh`.
    - exports both retry vars into weekly summary writer.
    - weekly summary adds input fields:
      - `inputs.editor_ui_flow_open_retries`
      - `inputs.parallel_cycle_lane_b_ui_flow_open_retries`
    - weekly report markdown includes retry visibility for UI-flow + parallel lane B.
  - `check_local_summary.sh`
    - parses:
      - `editorUiFlowSmokeOpenRetries`
      - `editorGateUiFlowOpenRetries`
      - `editorParallelCycleLaneBUiFlowOpenRetries`
    - enforces positive retry counts in relevant gate contexts:
      - direct UI-flow gate enabled
      - editor-gate UI-flow gate enabled
      - parallel lane-B UI-flow gate enabled.
- Benefit:
  - retry policy is now traceable and enforceable end-to-end, reducing “configured but dropped” blind spots.

## Lane A/C (incremental): open-attempt telemetry propagation (diagnosis depth)
- Goal:
  - capture not only configured retries, but also actual open attempt execution telemetry in gate/parallel/local summaries.
- Files:
  - `tools/editor_gate.sh`
  - `tools/local_ci.sh`
  - `tools/check_local_summary.sh`
  - `tools/write_ci_artifact_summary.py`
- Contract updates:
  - `editor_gate.sh`
    - `ui_flow_smoke` adds:
      - `open_attempt_count`
      - `open_attempt_exit_codes`
    - each `ui_flow_smoke.runs[]` item adds:
      - `open_retry_limit`
      - `open_attempt_count`
      - `open_attempt_exit_codes`
  - `local_ci.sh`
    - direct UI-flow smoke aggregation exports:
      - `EDITOR_UI_FLOW_SMOKE_OPEN_ATTEMPT_COUNT`
      - `EDITOR_UI_FLOW_SMOKE_OPEN_ATTEMPT_EXIT_CODES`
    - gate summary extraction exports:
      - `EDITOR_GATE_UI_FLOW_OPEN_ATTEMPT_COUNT`
      - `EDITOR_GATE_UI_FLOW_OPEN_ATTEMPT_EXIT_CODES`
    - parallel-cycle extraction exports:
      - `PARALLEL_CYCLE_LANE_B_UI_FLOW_OPEN_ATTEMPT_COUNT`
      - `PARALLEL_CYCLE_LANE_B_UI_FLOW_OPEN_ATTEMPT_EXIT_CODES`
    - `build/local_ci_summary.json` adds:
      - `editorUiFlowSmokeOpenAttemptCount`
      - `editorUiFlowSmokeOpenAttemptExitCodes`
      - `editorGateUiFlowOpenAttemptCount`
      - `editorGateUiFlowOpenAttemptExitCodes`
      - `editorParallelCycleLaneBUiFlowOpenAttemptCount`
      - `editorParallelCycleLaneBUiFlowOpenAttemptExitCodes`
  - `check_local_summary.sh`
    - parses new attempt-count fields and enforces telemetry presence when UI-flow gate failures are present.
  - `write_ci_artifact_summary.py`
    - markdown now shows `open_retries/open_attempts` for gate, parallel lane B, and local UI-flow sections.
- Benefit:
  - faster root-cause localization for open-stage instability (configured retries vs actually attempted retries).

## Lane A/C (incremental): weekly + parallel markdown visibility for open attempts
- Goal:
  - make open-attempt telemetry visible not only in JSON payloads but also in human-facing weekly/parallel markdown summaries.
- Files:
  - `tools/editor_weekly_validation.sh`
  - `tools/editor_parallel_cycle.sh`
- Contract updates:
  - weekly summary JSON (`editor_weekly_validation.sh`) now enriches `ui_flow_smoke` with:
    - `open_attempt_count`
    - `open_attempt_exit_codes`
    - run-level mirrors in `ui_flow_smoke.runs[]`.
  - weekly summary markdown adds:
    - `ui_flow_open_attempts`.
  - parallel cycle markdown adds:
    - `open_attempts` on lane B ui-flow line.
    - explicit `ui_flow_open_attempt_exit_codes` line.
- Benefit:
  - triage can compare retries vs attempts directly from markdown artifacts, without opening raw JSON.

## Lane D (incremental): derived proxy metadata visibility + unified read-only guard
- Goal:
  - stop treating only `unsupported` placeholders as read-only. Imported derived DWG objects with `edit_mode=proxy` should also be inspectable-but-noneditable.
- Scope:
  - `tools/web_viewer/adapters/cadgf_document_adapter.js`
  - `tools/web_viewer/state/documentState.js`
  - `tools/web_viewer/commands/command_registry.js`
  - `tools/web_viewer/ui/property_panel.js`
  - `tools/web_viewer/style.css`
- Contract:
  - adapter now imports optional entity origin fields and maps them into internal camelCase properties:
    - `source_type -> sourceType`
    - `edit_mode -> editMode`
    - `proxy_kind -> proxyKind`
    - `block_name -> blockName`
    - `hatch_id -> hatchId`
    - `hatch_pattern -> hatchPattern`
    - `text_kind -> textKind`
    - `dim_type -> dimType`
    - `dim_style -> dimStyle`
    - `dim_text_pos -> dimTextPos`
    - `dim_text_rotation -> dimTextRotation`
  - export path writes the same metadata back to CADGF JSON so round-trip does not drop attribution.
  - `DocumentState.normalizeEntity()` preserves these fields for all editable entity types and unsupported passthrough entities.
  - command registry read-only check is generalized from:
    - `entity.readOnly===true || type==='unsupported'`
    - to:
      - `entity.readOnly===true || type==='unsupported' || editMode==='proxy'`
  - property panel behavior:
    - single-selection derived proxies show origin metadata rows (`Source Type`, `Edit Mode`, `Proxy Kind`, `Block Name`, hatch/dimension fields).
    - all-read-only selections stop before editable controls.
    - mixed selections still show a warning and apply edits only to editable entities.
- Expected user-facing effect:
  - `DIMENSION` / `HATCH` imports remain visible and explainable.
  - users can inspect provenance without accidentally editing derived geometry.
  - `INSERT` entities marked `edit_mode=exploded` remain editable.

## Lane D (incremental): selection provenance chip + round-trip proxy semantics
- Goal:
  - surface entity provenance earlier than the property panel, and promote derived-proxy protection from unit tests to fixture-driven round-trip smoke.
- Scope:
  - `tools/web_viewer/index.html`
  - `tools/web_viewer/ui/statusbar.js`
  - `tools/web_viewer/ui/workspace.js`
  - `tools/web_viewer/style.css`
  - `tools/web_viewer/scripts/editor_roundtrip_smoke.js`
  - `tools/web_viewer/tests/fixtures/editor_roundtrip_smoke_cases.json`
  - `tools/web_viewer/tests/fixtures/cadgf_smoke_derived_proxy_document.json`
- Contract:
  - status bar adds a dedicated `cad-status-selection` chip instead of reusing the general status message.
  - workspace computes concise selection provenance:
    - no selection: `Selection: none`
    - single derived proxy: `Selection: text | DIMENSION/dimension | proxy`
    - single exploded insert fragment: `Selection: line | INSERT/insert | exploded`
    - multi-select: counts + compact type list + read-only count.
  - round-trip smoke now tracks two origin-preservation invariants after export/re-import:
    - `derived_proxy_semantics`
      - exported entities with `editMode=proxy` must still exist
      - origin metadata must still match
      - `selection.move` must still reject them with `UNSUPPORTED_READ_ONLY`
    - `exploded_origin_editability`
      - exported entities with `editMode=exploded` must still exist
      - origin metadata must still match
      - `selection.move` must remain allowed
  - fixture coverage adds a synthetic CADGF case with:
    - one exploded `INSERT` line
    - one proxy `DIMENSION` text
    - one proxy `HATCH` boundary polyline
- Expected user-facing effect:
  - provenance becomes visible immediately on selection, without opening or parsing the property form.
  - CI now guards both sides of the rule:
    - derived proxies stay read-only
    - exploded insert fragments stay editable.
