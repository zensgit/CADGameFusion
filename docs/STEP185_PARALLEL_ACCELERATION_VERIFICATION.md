# STEP185 Parallel Acceleration Verification

## Run Information
- Date: 2026-02-21
- Workspace: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion`

## A) GitHub Nightly (workflow_dispatch)

### Observe
- Workflow run id: `22248982711`
- URL: `https://github.com/zensgit/VemCAD/actions/runs/22248982711`
- Result: `success`
- Log highlights:
  - roundtrip run_id=`20260221_025326_094_6e11`
  - `totals pass=1 fail=0 skipped=0`
  - `RUN_STEP166_GATE=0` (lite)

### Gate
- Workflow run id: `22248998665`
- URL: `https://github.com/zensgit/VemCAD/actions/runs/22248998665`
- Result: `success`
- Log highlights:
  - roundtrip run_id=`20260221_025438_611_1a04`
  - `totals pass=1 fail=0 skipped=0`
  - `RUN_STEP166_GATE=0` (lite)

### Note
- Both runs show GitHub artifact quota warning (`Failed to CreateArtifact`), but job conclusion remains success.

## B) New Case-Selection Trend Script

### Command
```bash
python3 tools/editor_case_selection_trend.py \
  --history-dir build/editor_gate_history \
  --windows 7,14 \
  --out-json build/editor_case_selection_trend.json \
  --out-md build/editor_case_selection_trend.md
```

### Result
- `case_selection_trend_status=stable`
- Output files:
  - `build/editor_case_selection_trend.json`
  - `build/editor_case_selection_trend.md`
- Current metrics:
  - 7d: `matched_ratio=0.960`, `fallback_rate=0.000`
  - 14d: `matched_ratio=0.960`, `fallback_rate=0.000`

## C) Weekly + STEP176 Integration Validation

### Weekly command (filtered observe + filtered gate)
```bash
STEP176_APPEND_REPORT=1 RUN_GATE=1 \
RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_PRIORITY_SET=P0,P1 \
EDITOR_SMOKE_TAG_ANY=text-heavy,arc-heavy,polyline-heavy,import-stress \
GATE_SMOKE_PRIORITY_SET=P0,P1 \
GATE_SMOKE_TAG_ANY=text-heavy,arc-heavy,polyline-heavy,import-stress \
bash tools/editor_weekly_validation.sh
```

### Result
- Weekly observe roundtrip run_id: `20260221_105924_743_0b2f`
- Weekly gate roundtrip run_id: `20260221_110200_608_bf48`
- Weekly observe STEP166 run_id: `20260221_030052`
- Weekly gate STEP166 run_id: `20260221_030322`
- Overall: PASS

### Field verification
- Weekly summary JSON contains:
  - `inputs.case_selection_trend_windows=7,14`
  - `case_selection_trend.status=stable`
  - `case_selection_trend.window_summaries[]`
- STEP176 report contains:
  - `editor_smoke_filters`
  - `editor_smoke_case_selection`
  - `gate_editor_smoke_filters`
  - `gate_editor_smoke_case_selection`
  - `case_selection_trend`
  - `case_selection_trend_windows`
  - `case_selection_trend_json`

## Syntax/Static Checks
- `bash -n tools/editor_weekly_validation.sh` PASS
- `python3 -m py_compile tools/editor_case_selection_trend.py` PASS
- `python3 -m py_compile tools/write_step176_weekly_report.py` PASS
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/cadgamefusion_editor_nightly.yml")'` PASS

## D) Gate Trend Skip Consistency (stale JSON guard)

### Code path
- Updated: `tools/editor_gate.sh`
- Goal: when `RUN_PERF_TREND=0` / `RUN_REAL_SCENE_TREND=0`, gate summary must not inherit old trend JSON values.

### Validation command
```bash
STEP176_APPEND_REPORT=1 RUN_GATE=1 \
RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_PRIORITY_SET=P0,P1 \
EDITOR_SMOKE_TAG_ANY=text-heavy,arc-heavy,polyline-heavy,import-stress \
GATE_SMOKE_PRIORITY_SET=P0,P1 \
GATE_SMOKE_TAG_ANY=text-heavy,arc-heavy,polyline-heavy,import-stress \
bash tools/editor_weekly_validation.sh
```

### Result
- Weekly observe roundtrip run_id: `20260221_203647_315_4eaf`
- Weekly gate roundtrip run_id: `20260221_203859_375_0292`
- Weekly observe STEP166 run_id: `20260221_123812`
- Weekly gate STEP166 run_id: `20260221_124022`
- Gate log now reports:
  - `perf_trend ... status=skipped coverage_days=0.00 selected=0`
  - `real_scene_trend ... status=skipped coverage_days=0.00 selected=0`
- STEP176 appended `Gate Snapshot` now reports:
  - `perf_trend: skipped`
  - `real_scene_trend: skipped`

## E) Profile switch + UI-flow smoke spot check

### Commands
```bash
EDITOR_GATE_PROFILE=lite EDITOR_SMOKE_LIMIT=2 \
RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_step186_lite.json \
bash tools/editor_gate.sh

EDITOR_GATE_PROFILE=full EDITOR_SMOKE_LIMIT=2 \
RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_step186_full.json \
bash tools/editor_gate.sh

bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate

node tools/web_viewer/scripts/editor_roundtrip_smoke.js \
  --mode gate \
  --cases tools/web_viewer/tests/fixtures/editor_roundtrip_smoke_cases.json \
  --limit 10
```

### Result
- Lite gate summary: `build/editor_gate_summary_step186_lite.json`
  - `step166.enabled=false`
  - `editor_smoke.convert_enabled=false`
- Full gate summary: `build/editor_gate_summary_step186_full.json`
  - `step166.enabled=true`
  - `editor_smoke.convert_enabled=true`
- Both profiles:
  - `perf_trend.status=skipped`
  - `real_scene_trend.status=skipped`
- UI-flow smoke runs:
  - observe summary: `build/editor_ui_flow_smoke/20260221_204446_ui_flow/summary.json` (`ok=true`)
  - gate summary: `build/editor_ui_flow_smoke/20260221_204547_ui_flow/summary.json` (`ok=true`)

## F) Lane B usability hardening (Fillet/Chamfer retry)

### Code path
- `tools/web_viewer/tools/fillet_tool.js`
- `tools/web_viewer/tools/chamfer_tool.js`
- `tools/web_viewer/tests/editor_commands.test.js`

### Validation command
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate
EDITOR_GATE_PROFILE=lite EDITOR_SMOKE_LIMIT=3 \
RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_step186_laneB.json \
bash tools/editor_gate.sh
```

### Result
- Node tests: `73/73 PASS`
  - includes new retry tests for `fillet/chamfer` command failure path.
- UI-flow gate smoke:
  - summary: `build/editor_ui_flow_smoke/20260221_214839_ui_flow/summary.json`
  - result: `ok=true`
- editor_gate (lite):
  - summary: `build/editor_gate_summary_step186_laneB.json`
  - editor_smoke_run_id: `20260221_214947_697_0e96`
  - gate decision: `would_fail=false`
- editor_gate (full):
  - summary: `build/editor_gate_summary_step186_full_laneB.json`
  - editor_smoke_run_id: `20260221_215144_406_e0fb`
  - step166_run_id: `20260221_135256` (`gate_would_fail=false`)
  - gate decision: `would_fail=false`

## G) Lane C case generation contract check

### Command
```bash
python3 tools/generate_editor_roundtrip_cases.py \
  --limit 8 \
  --priorities P0,P1 \
  --out local/editor_roundtrip_smoke_cases.json
```

### Result
- `selected_run_id=20260221_135256`
- `priorities=P0,P1`
- `cases=2`
- output: `local/editor_roundtrip_smoke_cases.json`

## H) Lane B UI-flow retry assertion

### Command
```bash
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate
```

### Result
- summary: `build/editor_ui_flow_smoke/20260221_220017_ui_flow/summary.json`
- `ok=true`
- `flow.fillet_polyline.retrySucceeded=true`
- `flow.chamfer_polyline.retrySucceeded=true`
- failure statuses are explicitly recorded:
  - `Fillet: radius too large [RADIUS_TOO_LARGE]`
  - `Chamfer: distance too large [DISTANCE_TOO_LARGE]`

## I) local_ci editor-gate forwarding knobs

### Code path
- `tools/local_ci.sh`

### Changes
- Added env passthrough for:
  - `EDITOR_GATE_PROFILE` (default `full`)
  - `EDITOR_GATE_RUN_PERF_TREND` (default `0`)
  - `EDITOR_GATE_RUN_REAL_SCENE_TREND` (default `0`)
- Added matching summary fields in `local_ci_summary.json`.

### Validation
```bash
bash -n tools/local_ci.sh
```
- result: `PASS`

## J) Weekly case-file minimum guard

### Commands
```bash
bash -n tools/editor_weekly_validation.sh
EDITOR_SMOKE_CASES=local/editor_roundtrip_smoke_cases.json \
EDITOR_SMOKE_MIN_CASES=4 \
RUN_GATE=0 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 \
STEP176_APPEND_REPORT=0 STEP170_APPEND_REPORT=0 \
bash tools/editor_weekly_validation.sh
```

### Result
- Weekly startup log now includes case guard diagnostics:
  - `editor_smoke_cases_count=2 min_required=4`
  - `fixture_count=1 not better; keep original case file`
- Weekly summary JSON reflects the guard inputs:
  - `inputs.editor_smoke_cases=local/editor_roundtrip_smoke_cases.json`
  - `inputs.editor_smoke_cases_count=2`
  - `inputs.editor_smoke_min_cases=4`

## Conclusion
- Parallel scope for this step is complete:
  - remote nightly dual-mode verification done,
  - case-selection trend pipeline landed,
  - weekly + STEP176 integration verified with real runs,
  - disabled trend path now has deterministic `skipped` summary semantics,
  - fillet/chamfer failure retry path is stabilized and verified,
  - case generation filter contract (`priority/tags`) remains functional,
  - UI-flow now asserts retry behavior in a browser-level path,
  - local CI can now select gate profile and trend workload deterministically,
  - weekly lane avoids regressing to lower-coverage fixture sets when local generated case files are small.

## K) Lane A gate case-coverage guard

### Commands
```bash
bash -n tools/editor_gate.sh
python3 -m py_compile tools/write_editor_gate_report.py
EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_STEP166_OBSERVE=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
bash tools/editor_gate.sh
```

### Result
- `tools/editor_gate.sh` now logs case guard decision:
  - `editor_smoke_cases_count=0 min_required=4 source=discovery`
  - local `EDITOR_SMOKE_CASES=local/editor_roundtrip_smoke_cases.json` (`count=2`) is auto demoted to discovery.
- gate run PASS:
  - `editor_smoke_run_id=20260221_223525_623_19f0`
  - `ui_flow_run_id=20260221_223447_ui_flow`
  - summary: `build/editor_gate_summary.json`
- `editor_gate_summary.json` contract verified:
  - `editor_smoke.case_source=discovery`
  - `editor_smoke.cases_count=0`

## L) Nightly case-source pass-through + CI summary provenance

### Code path
- `.github/workflows/cadgamefusion_editor_nightly.yml`
- `tools/write_ci_artifact_summary.py`

### Validation commands
```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/cadgamefusion_editor_nightly.yml")'
python3 -m py_compile tools/write_ci_artifact_summary.py

EDITOR_SMOKE_CASE_SOURCE=generated \
EDITOR_SMOKE_CASES_SELECTED=local/editor_roundtrip_smoke_cases_nightly.json \
EDITOR_SMOKE_GENERATED_CASES=4 \
EDITOR_SMOKE_REQUIRED_CASES=4 \
EDITOR_SMOKE_GENERATED_RUN_ID=20260228_055511 \
EDITOR_SMOKE_GENERATED_RUN_IDS=20260228_055511,20260228_055334 \
python3 tools/write_ci_artifact_summary.py \
  --title test-nightly \
  --mode observe \
  --gate-summary build/editor_gate_summary.json \
  --roundtrip-summary build/editor_roundtrip/20260228_141117_651_bd89/summary.json \
  --out build/ci_editor_nightly_summary_step186.md
```

### Result
- YAML parse: PASS
- Python compile: PASS
- Generated markdown: `build/ci_editor_nightly_summary_step186.md`
- New lines verified in markdown:
  - `editor_smoke_cases: source=generated count=4 min_required=4`
  - `editor_smoke_generated_runs: run_id=20260228_055511 run_ids=20260228_055511,20260228_055334`

## M) Gate smoke validation after provenance updates

### Command
```bash
EDITOR_GATE_PROFILE=lite EDITOR_SMOKE_LIMIT=4 \
RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_GATE_APPEND_REPORT=1 STEP176_APPEND_REPORT=1 \
SUMMARY_PATH=build/editor_gate_summary_step186_provenance.json \
bash tools/editor_gate.sh
```

### Result
- Gate summary: `build/editor_gate_summary_step186_provenance.json`
- Gate history: `build/editor_gate_history/gate_20260228_061640_20260228_141638_427_8954_no_cad.json`
- Roundtrip run_id: `20260228_141638_427_8954`
- `totals pass=4 fail=0 skipped=0`
- `editor_smoke.case_source=discovery` (local auto-case count below threshold, fallback policy worked as designed)
- STEP170/STEP176 verification reports appended successfully.

## N) Generated-case metadata propagation (weekly -> gate -> reports)

### Code path
- `tools/editor_weekly_validation.sh`
- `tools/editor_gate.sh`
- `tools/write_editor_gate_report.py`
- `tools/write_step176_gate_report.py`
- `tools/write_step176_dashboard.py`
- `tools/write_ci_artifact_summary.py`

### Validation commands
```bash
bash -n tools/editor_gate.sh
bash -n tools/editor_weekly_validation.sh
python3 -m py_compile tools/write_ci_artifact_summary.py tools/write_editor_gate_report.py tools/write_step176_gate_report.py tools/write_step176_dashboard.py

EDITOR_GATE_PROFILE=lite EDITOR_SMOKE_LIMIT=4 \
EDITOR_SMOKE_CASES=local/editor_roundtrip_smoke_cases_weekly.json \
EDITOR_SMOKE_CASE_SOURCE=generated \
EDITOR_SMOKE_GENERATED_CASES_PATH=local/editor_roundtrip_smoke_cases_weekly.json \
EDITOR_SMOKE_GENERATED_COUNT=4 \
EDITOR_SMOKE_GENERATED_MIN_CASES=4 \
EDITOR_SMOKE_GENERATED_PRIORITIES=P0,P1 \
EDITOR_SMOKE_GENERATED_RUN_ID=20260228_055511 \
EDITOR_SMOKE_GENERATED_RUN_IDS=20260228_055511,20260228_055334 \
RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_GATE_APPEND_REPORT=1 STEP176_APPEND_REPORT=1 \
SUMMARY_PATH=build/editor_gate_summary_step186_generatedmeta.json \
bash tools/editor_gate.sh

RUN_GATE=1 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 \
STEP176_APPEND_REPORT=1 STEP170_APPEND_REPORT=1 \
SUMMARY_JSON=build/editor_weekly_validation_summary_step186_generatedmeta.json \
SUMMARY_MD=build/editor_weekly_validation_summary_step186_generatedmeta.md \
bash tools/editor_weekly_validation.sh
```

### Result
- Gate summary contains generated metadata fields under `editor_smoke`:
  - `generated_cases_path`
  - `generated_count`
  - `generated_min_cases`
  - `generated_priorities`
  - `generated_run_id`
  - `generated_run_ids`
- Weekly gate path forwards generated metadata correctly:
  - weekly summary: `build/editor_weekly_validation_summary_step186_generatedmeta.json`
  - gate editor source: `generated`
  - gate generated count: `2`
  - gate summary path: `build/editor_gate_summary.json`
- STEP176 dashboard now shows generated lineage:
  - latest gate line includes `editor_smoke_generated`
  - gate history `editor_smoke` column includes `:gen=<count>`
- CI markdown summary now reads generated run lineage from gate summary (no env dependency required).

## O) local_ci provenance forwarding + step166-aware checker

### Commands
```bash
bash -n tools/local_ci.sh
bash -n tools/check_local_summary.sh
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/cadgamefusion_editor_nightly.yml")'

RUN_EDITOR_GATE=1 RUN_EDITOR_SMOKE=0 RUN_EDITOR_SMOKE_GATE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
SKIP_EDITOR_UI_FLOW_SMOKE=1 \
EDITOR_GATE_PROFILE=lite \
EDITOR_GATE_RUN_PERF_TREND=0 EDITOR_GATE_RUN_REAL_SCENE_TREND=0 \
EDITOR_SMOKE_CASES=local/editor_roundtrip_smoke_cases_weekly.json \
EDITOR_SMOKE_CASE_SOURCE=generated \
EDITOR_SMOKE_GENERATED_CASES_PATH=local/editor_roundtrip_smoke_cases_weekly.json \
EDITOR_SMOKE_GENERATED_COUNT=4 \
EDITOR_SMOKE_GENERATED_MIN_CASES=4 \
EDITOR_SMOKE_GENERATED_PRIORITIES=P0,P1 \
EDITOR_SMOKE_GENERATED_RUN_ID=20260228_055511 \
EDITOR_SMOKE_GENERATED_RUN_IDS=20260228_055511,20260228_055334 \
bash tools/local_ci.sh --build-dir build --quick --offline --skip-compare

bash tools/check_local_summary.sh --offline-allowed
```

### Result
- `tools/local_ci.sh` run PASS, editor gate run_id: `20260228_145542_075_0efd`
- `build/local_ci_summary.json` now includes:
  - `editorGateStep166Enabled=false` (lite profile)
  - `editorGateEditorSmokeGeneratedCount=4`
  - `editorGateEditorSmokeGeneratedRunId=20260228_055511`
  - `editorGateEditorSmokeGeneratedRunIds=20260228_055511,20260228_055334`
- `tools/check_local_summary.sh --offline-allowed` PASS with `editorGateStep166Enabled=false`; no false baseline-compare failure when STEP166 is intentionally disabled.

## P) Nightly step-summary consistency guard

### Validation
- YAML parse PASS after summary-field remap:
  - `.github/workflows/cadgamefusion_editor_nightly.yml`
- Summary extraction logic now reads `editor_smoke` source/cases/generated lineage from `editor_gate_summary_nightly.json` first, so displayed values match final gate state.

## Q) Light-workflow artifact summary parity (roundtrip-only mode)

### Command
```bash
python3 -m py_compile tools/write_ci_artifact_summary.py

python3 tools/write_ci_artifact_summary.py \
  --title test-light-summary \
  --mode gate \
  --roundtrip-summary build/editor_roundtrip/20260228_145542_075_0efd/summary.json \
  --out build/ci_editor_light_summary_step186_roundtrip.md
```

### Result
- Generated markdown: `build/ci_editor_light_summary_step186_roundtrip.md`
- New roundtrip lines present:
  - `roundtrip_filters`
  - `roundtrip_case_selection`
  - `roundtrip_unsupported`
- Sample values:
  - `selected=5 matched=8 candidate=8 total=8 fallback=false`
  - `unsupported checked=20 missing=0 drifted=0 failed_cases=0`

## R) editor-light context alignment (source/limit/cases explicit)

### Commands
```bash
bash -n tools/ci_editor_light.sh
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/cadgamefusion_editor_light.yml")'

SKIP_EDITOR_UI_FLOW_SMOKE=1 \
EDITOR_SMOKE_LIMIT=1 \
EDITOR_SMOKE_CASES=tools/web_viewer/tests/fixtures/editor_roundtrip_smoke_cases.json \
EDITOR_SMOKE_CASE_SOURCE=fixture \
EDITOR_SMOKE_NO_CONVERT=1 \
bash tools/ci_editor_light.sh

EDITOR_SMOKE_CASE_SOURCE=fixture \
EDITOR_SMOKE_CASES=tools/web_viewer/tests/fixtures/editor_roundtrip_smoke_cases.json \
EDITOR_SMOKE_LIMIT=1 \
python3 tools/write_ci_artifact_summary.py \
  --title test-editor-light \
  --mode gate \
  --roundtrip-summary build/editor_roundtrip/20260228_160701_952_ee27/summary.json \
  --out build/ci_editor_light_summary_step186_alignment.md
```

### Result
- `ci_editor_light.sh` PASS, roundtrip run_id: `20260228_160701_952_ee27`
- `build/ci_editor_light_summary_step186_alignment.md` contains:
  - `roundtrip_cases: source=fixture limit=1 cases=tools/web_viewer/tests/fixtures/editor_roundtrip_smoke_cases.json`
  - `roundtrip_case_selection: selected=1 matched=1 candidate=1 total=1 fallback=false`
  - `roundtrip_unsupported: checked=2 missing=0 drifted=0`
  - `editor_smoke.min_cases_required=4`
  - `editor_smoke.case_selection.selected_count=5`

## L) Weekly integration with case guard (STEP176 append)

### Command
```bash
EDITOR_SMOKE_CASES=local/editor_roundtrip_smoke_cases.json \
EDITOR_SMOKE_MIN_CASES=4 \
RUN_GATE=0 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_REAL_SCENE_PERF=0 \
STEP176_APPEND_REPORT=1 STEP170_APPEND_REPORT=0 \
bash tools/editor_weekly_validation.sh
```

### Result
- weekly startup now matches guard behavior:
  - `editor_smoke_cases=<discovery>`
  - `editor_smoke_cases_count=0 min_required=4`
- roundtrip observe PASS with wider pool:
  - `editor_smoke_run_id=20260221_223547_598_f4b3`
  - `case_selection selected=8 matched=32 candidate=32 total=32 fallback=0`
- STEP166 observe PASS:
  - `step166_run_id=20260221_143550`
  - `gate_would_fail=False`
- weekly artifacts:
  - summary: `build/editor_weekly_validation_summary.json`
  - history: `build/editor_weekly_validation_history/weekly_20260221_143659_20260221_223547_598_f4b3_20260221_143550.json`
- report append:
  - `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md`

## M) Lane B unsupported proxy read-only hardening

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate
EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
bash tools/editor_gate.sh
```

### Result
- Node command tests: `PASS (77/77)`
  - new coverage:
    - `selection.move rejects read-only unsupported proxy`
    - `selection.copy skips read-only unsupported proxy in mixed selection`
    - `selection.propertyPatch skips read-only unsupported proxy in mixed selection`
    - `selection.delete keeps read-only unsupported proxies and removes editable entities`
- UI-flow smoke gate: `PASS`
  - summary: `build/editor_ui_flow_smoke/20260222_091608_ui_flow/summary.json`
- editor_gate lite: `PASS`
  - editor smoke run_id: `20260222_091737_002_2b9f`
  - ui_flow run_ids: `20260222_091643_ui_flow`, `20260222_091708_ui_flow`
  - summary: `build/editor_gate_summary.json`
  - case guard still valid: `case_source=discovery`, `selected=5`, `matched=20`

## N) Lane C hotkey semantic sync (F7/F8/F3)

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate
EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
bash tools/editor_gate.sh
```

### Result
- command tests: `PASS (77/77)`
- UI-flow smoke gate: `PASS`
  - summary: `build/editor_ui_flow_smoke/20260223_204445_ui_flow/summary.json`
  - `toggles_and_snap` includes keyboard toggle assertions for `F7/F8/F3`.
- editor_gate lite: `PASS`
  - ui_flow run_ids: `20260223_204528_ui_flow`, `20260223_204555_ui_flow`
  - editor_smoke run_id: `20260223_204622_182_fb2f`
  - summary: `build/editor_gate_summary.json`
  - gate decision: `would_fail=false`

### Qt mirror status
- Code landed for `F3` object-snap master toggle:
  - `editor/qt/include/snap/snap_settings.hpp`
  - `editor/qt/src/snap/snap_settings.cpp`
  - `editor/qt/src/mainwindow.cpp`
- Local build note:
  - current `build/` target set only exposes plugin/test targets; Qt editor compile target is not present in this build tree.
  - verification for this lane is therefore code inspection + Web gate regression no-regression evidence.

## O) Lane A failure-attribution completeness hardening

### Commands
```bash
bash -n tools/editor_gate.sh
python3 -m py_compile tools/write_editor_gate_report.py
node --test tools/web_viewer/tests/editor_commands.test.js

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
bash tools/editor_gate.sh

EDITOR_GATE_PROFILE=lite EDITOR_SMOKE_NO_CONVERT=0 EDITOR_SMOKE_LIMIT=1 \
RUN_STEP166_GATE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
EDITOR_PLUGIN=/tmp/cadgf_json_missing_plugin.dylib EDITOR_GATE_APPEND_REPORT=0 \
bash tools/editor_gate.sh

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 EDITOR_UI_FLOW_SMOKE_GATE_RUNS=1 EDITOR_UI_FLOW_TIMEOUT_MS=1 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_NO_CONVERT=1 EDITOR_SMOKE_LIMIT=1 EDITOR_GATE_APPEND_REPORT=0 \
bash tools/editor_gate.sh
```

### Result
- Static checks PASS:
  - `tools/editor_gate.sh` shell syntax OK.
  - `tools/write_editor_gate_report.py` bytecode compile OK.
  - Node command tests: `PASS (77/77)`.
- Positive gate run PASS:
  - editor smoke run_id: `20260223_212435_225_08fb`
  - ui-flow run_ids: `20260223_212328_ui_flow`, `20260223_212406_ui_flow`
  - summary: `build/editor_gate_summary.json`
  - new fields present:
    - `editor_smoke.failure_code_total=0`, `editor_smoke.failure_attribution_complete=true`
    - `ui_flow_smoke.failure_code_total=0`, `ui_flow_smoke.failure_attribution_complete=true`
- Negative editor-smoke run (missing plugin) FAIL as expected (`rc=2`):
  - run_id: `20260223_212503_585_dfb8`
  - gate fail reasons include bucketed attribution:
    - `EDITOR_SMOKE:FAIL`
    - `EDITOR_SMOKE_IMPORT_FAIL=1`
  - summary confirms attribution completeness:
    - `editor_smoke.failure_code_counts={"CONVERT_FAIL":1}`
    - `editor_smoke.failure_code_total=1`
    - `editor_smoke.failure_attribution_complete=true`
- Negative UI-flow run (timeout=1ms) FAIL as expected (`rc=2`):
  - ui-flow run_id: `20260223_212522_ui_flow`
  - gate fail reasons include bucketed attribution:
    - `UI_FLOW_SMOKE:FAIL`
    - `UI_FLOW_SMOKE_GATE_FAIL_COUNT:1`
    - `UI_FLOW_FLOW_JSON_INVALID:1`
  - summary confirms attribution completeness:
    - `ui_flow_smoke.failure_code_total=1`
    - `ui_flow_smoke.failure_code_counts={"UI_FLOW_FLOW_JSON_INVALID":1}`
    - `ui_flow_smoke.failure_attribution_complete=true`

## P) Lane A attribution propagation (local CI + weekly/CI report)

### Commands
```bash
bash -n tools/local_ci.sh
bash -n tools/check_local_summary.sh
python3 -m py_compile tools/write_step176_gate_report.py tools/write_ci_artifact_summary.py

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
bash tools/editor_gate.sh

python3 tools/write_ci_artifact_summary.py \
  --title "cadgamefusion-editor-nightly" \
  --mode observe \
  --gate-summary build/editor_gate_summary.json \
  --roundtrip-summary build/editor_roundtrip/20260223_213741_417_ab01/summary.json \
  --out build/ci_editor_nightly_summary.md

python3 tools/write_step176_gate_report.py \
  --gate-summary build/editor_gate_summary.json \
  --report docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md

bash tools/check_local_summary.sh --offline-allowed
```

### Result
- Static checks PASS:
  - `tools/local_ci.sh` / `tools/check_local_summary.sh` syntax OK.
  - updated Python report scripts compile OK.
- editor_gate(lite) PASS:
  - editor_smoke run_id: `20260223_213741_417_ab01`
  - ui_flow run_ids: `20260223_213637_ui_flow`, `20260223_213711_ui_flow`
  - summary: `build/editor_gate_summary.json`
  - attribution fields present and stable:
    - `editor_smoke.failure_code_total=0`, `editor_smoke.failure_attribution_complete=true`
    - `ui_flow_smoke.failure_code_total=0`, `ui_flow_smoke.failure_attribution_complete=true`
- CI artifact markdown updated:
  - `build/ci_editor_nightly_summary.md` now contains:
    - `editor_smoke_attribution: complete/code_total`
    - `ui_flow_attribution: complete/code_total`
- STEP176 gate snapshot append updated:
  - `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md` now includes:
    - `editor_smoke_failure_attribution`
    - `ui_flow_failure_attribution`
- Backward compatibility check:
  - existing `build/local_ci_summary.json` (older payload, no new fields) still passes checker with safe defaults:
    - `bash tools/check_local_summary.sh --offline-allowed` => `OK`

## Q) Lane B fillet/chamfer preselection fast-path

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
bash tools/editor_gate.sh
```

### Result
- command tests PASS: `79/79`
  - new cases added:
    - `fillet tool uses single preselected entity as first target when clicking second target directly`
    - `chamfer tool uses single preselected entity as first target when clicking second target directly`
- UI-flow smoke gate PASS:
  - summary: `build/editor_ui_flow_smoke/20260223_214209_ui_flow/summary.json`
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260223_214255_ui_flow`, `20260223_214322_ui_flow`
  - editor_smoke run_id: `20260223_214349_485_568c`
  - summary: `build/editor_gate_summary.json`
  - gate decision: `would_fail=false`

## R) Lane B UI-flow coverage for preselection fast-path

### Commands
```bash
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
bash tools/editor_gate.sh
```

### Result
- UI-flow smoke gate PASS:
  - summary: `build/editor_ui_flow_smoke/20260223_223633_ui_flow/summary.json`
  - new step `fillet_chamfer_preselection` executed and passed:
    - fillet preselection one-click path creates arc
    - chamfer preselection one-click path creates connector line (line count >= 3)
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260223_223716_ui_flow`, `20260223_223744_ui_flow`
  - editor_smoke run_id: `20260223_223815_486_f213`
  - summary: `build/editor_gate_summary.json`
  - gate decision: `would_fail=false`

## S) Lane B grip insert/delete regression lock

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
bash tools/editor_gate.sh
```

### Result
- command tests PASS: `81/81`
  - new select grip cases:
    - `select tool: polyline midpoint grip inserts vertex and supports undo/redo`
    - `select tool: double-click polyline vertex deletes vertex and supports undo/redo`
- UI-flow smoke gate PASS:
  - summary: `build/editor_ui_flow_smoke/20260223_232351_ui_flow/summary.json`
  - includes preselection fast-path step stability with deterministic fixture.
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260223_232435_ui_flow`, `20260223_232504_ui_flow`
  - editor_smoke run_id: `20260223_232532_886_ae04`
  - summary: `build/editor_gate_summary.json`
  - gate decision: `would_fail=false`

## T) Lane A full-profile gate checkpoint (includes STEP166 gate)

### Command
```bash
EDITOR_GATE_PROFILE=full RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
bash tools/editor_gate.sh
```

### Result
- editor_gate(full) PASS:
  - ui_flow run_ids: `20260223_233008_ui_flow`, `20260223_233040_ui_flow`
  - editor_smoke run_id: `20260223_233110_438_8ed0`
  - step166 run_id: `20260223_153113` (`gate_would_fail=false`)
  - summary: `build/editor_gate_summary.json`
  - history: `build/editor_gate_history/gate_20260223_153219_20260223_233110_438_8ed0_20260223_153113.json`
- confirms latest select/grip + fillet/chamfer fast-path changes do not regress full gate path.

## U) Lane B closed-polyline grip boundary coverage

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
bash tools/editor_gate.sh
```

### Result
- command tests PASS: `84/84`
  - added edge cases:
    - `select tool: closed polyline midpoint on closing edge inserts vertex and supports undo/redo`
    - `select tool: closed polyline vertex delete allowed above minimum and supports undo/redo`
    - `select tool: closed polyline vertex delete is blocked at minimum vertices`
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260223_233325_ui_flow`, `20260223_233353_ui_flow`
  - editor_smoke run_id: `20260223_233434_005_ff05`
  - summary: `build/editor_gate_summary.json`
  - gate decision: `would_fail=false`

## V) Lane B UI-flow grip lifecycle extension (polyline insert + delete gate hardening)

### Commands
```bash
bash -n tools/web_viewer/scripts/editor_ui_flow_smoke.sh
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
bash tools/editor_gate.sh
```

### Result
- Static check PASS:
  - `tools/web_viewer/scripts/editor_ui_flow_smoke.sh` shell syntax OK.
- Node command tests PASS: `84/84`.
- UI-flow smoke gate PASS:
  - summary: `build/editor_ui_flow_smoke/20260224_130250_ui_flow/summary.json`
  - new step `polyline_grip_insert_delete` executed:
    - midpoint grip insert + undo/redo verified in browser flow (hard gate).
    - vertex delete + undo/redo verified (hard gate), with deterministic fallback path recorded for this run:
      - `vertexDeleteAttempted=true`
      - `vertexDeleteApplied=true`
      - `vertexDeletePath=command_fallback`
      - `vertexDeleteUndoRedoVerified=true`
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260224_130349_ui_flow`, `20260224_130424_ui_flow`
  - editor_smoke run_id: `20260224_130458_263_6c66`
  - summary: `build/editor_gate_summary.json`
  - gate decision: `would_fail=false`
- editor_gate(full) PASS (STEP166 included):
  - ui_flow run_ids: `20260224_104114_ui_flow`, `20260224_104147_ui_flow`
  - editor_smoke run_id: `20260224_104219_505_5063`
  - step166 run_id: `20260224_024222` (`gate_would_fail=false`)
  - summary: `build/editor_gate_summary.json`

## W) Lane C round-trip unsupported passthrough hard check

### Commands
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode gate --limit 2 --no-convert

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
bash tools/editor_gate.sh

EDITOR_GATE_PROFILE=full RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
bash tools/editor_gate.sh
```

### Result
- direct round-trip smoke PASS:
  - run_id: `20260224_130839_508_889a`
  - summary: `build/editor_roundtrip/20260224_130839_508_889a/summary.json`
  - unsupported passthrough checks present and PASS in sampled cases (`checked=4 missing=0 drifted=0`).
- editor_gate(lite) PASS after passthrough hard check integration:
  - ui_flow run_ids: `20260224_130856_ui_flow`, `20260224_130933_ui_flow`
  - editor_smoke run_id: `20260224_131017_244_aa74`
  - summary: `build/editor_gate_summary.json`
  - gate decision: `would_fail=false`
- editor_gate(full) PASS after passthrough hard check integration:
  - ui_flow run_ids: `20260224_131025_ui_flow`, `20260224_131112_ui_flow`
  - editor_smoke run_id: `20260224_131153_529_51bb`
  - step166 run_id: `20260224_051155` (`gate_would_fail=false`)
  - summary: `build/editor_gate_summary.json`

## X) Lane A/B/C consolidation: closed-polyline UI-flow + passthrough rollup reports

### Commands
```bash
node --check tools/web_viewer/scripts/editor_roundtrip_smoke.js
python3 -m py_compile tools/write_editor_gate_report.py tools/write_step176_gate_report.py tools/write_ci_artifact_summary.py
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode gate --limit 5 --no-convert

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
bash tools/editor_gate.sh

EDITOR_GATE_PROFILE=full RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
bash tools/editor_gate.sh

python3 tools/write_ci_artifact_summary.py \
  --title "cadgamefusion-editor-nightly" \
  --mode observe \
  --gate-summary build/editor_gate_summary.json \
  --roundtrip-summary build/editor_roundtrip/20260224_133633_732_74f1/summary.json \
  --out build/ci_editor_nightly_summary.md
python3 tools/write_step176_gate_report.py --gate-summary build/editor_gate_summary.json --report docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md
python3 tools/write_editor_gate_report.py --gate-summary build/editor_gate_summary.json --step170-report docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md
```

### Result
- Static checks PASS:
  - `editor_roundtrip_smoke.js` syntax check OK.
  - report scripts compile OK.
- Node command tests PASS: `84/84`.
- UI-flow smoke gate PASS:
  - summary: `build/editor_ui_flow_smoke/20260224_133257_ui_flow/summary.json`
  - `polyline_grip_insert_delete` hard-verified insert/delete/undo/redo.
  - new `polyline_closed_vertex_delete` step PASS:
    - `deleteApplied=true`
    - `undoRedoVerified=true`
    - `deletePath=command_fallback`
- direct round-trip smoke PASS:
  - run_id: `20260224_133355_352_56c0`
  - summary: `build/editor_roundtrip/20260224_133355_352_56c0/summary.json`
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260224_133402_ui_flow`, `20260224_133439_ui_flow`
  - editor_smoke run_id: `20260224_133516_026_a3a6`
  - summary: `build/editor_gate_summary.json`
- editor_gate(full) PASS:
  - ui_flow run_ids: `20260224_133523_ui_flow`, `20260224_133558_ui_flow`
  - editor_smoke run_id: `20260224_133633_732_74f1`
  - step166 run_id: `20260224_053635` (`gate_would_fail=false`)
  - summary: `build/editor_gate_summary.json`
- Rollup verification:
  - `editor_gate_summary.json` now includes `editor_smoke.unsupported_passthrough` aggregate:
    - `cases_with_checks=5`
    - `checked_entities=20`
    - `missing_entities=0`
    - `drifted_entities=0`
    - `failed_cases=0`
  - CI/STEP170/STEP176 report writers successfully consumed and emitted unsupported passthrough rollup fields.

## Y) Lane C unsupported proxy interaction closure (visible + pickable + read-only)

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 5 --no-convert
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate

EDITOR_GATE_PROFILE=lite RUN_EDITOR_UI_FLOW_SMOKE=1 RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 \
EDITOR_SMOKE_LIMIT=5 EDITOR_SMOKE_NO_CONVERT=1 STEP170_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
bash tools/editor_gate.sh
```

### Result
- Node command tests PASS: `85/85`
  - added coverage:
    - `tool context picks visible unsupported display proxies`
    - cadgf adapter asserts unsupported proxies are imported as visible placeholders.
- round-trip smoke PASS:
  - run_id: `20260224_141146_390_9655`
  - summary: `build/editor_roundtrip/20260224_141146_390_9655/summary.json`
  - totals: `pass=5 fail=0 skipped=0`
- UI-flow smoke gate PASS:
  - summary: `build/editor_ui_flow_smoke/20260224_141156_ui_flow/summary.json`
- editor_gate(lite) PASS after unsupported proxy interaction closure:
  - ui_flow run_ids: `20260224_141241_ui_flow`, `20260224_141316_ui_flow`
  - editor_smoke run_id: `20260224_141351_458_4082`
  - summary: `build/editor_gate_summary.json`
  - gate decision: `would_fail=false`
- Behavior confirmation:
  - unsupported proxies remain read-only (command guards unchanged),
  - but are now spatially indexed + pickable, and selection highlight is visible in canvas.

## Z) Lane B/A follow-up: UI-flow unsupported proxy step + weekly report parity

### Commands
```bash
bash -n tools/web_viewer/scripts/editor_ui_flow_smoke.sh
node --test tools/web_viewer/tests/editor_commands.test.js

EDITOR_GATE_PROFILE=lite RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
EDITOR_SMOKE_LIMIT=5 EDITOR_SMOKE_NO_CONVERT=1 STEP170_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
bash tools/editor_gate.sh

python3 tools/write_step170_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --step170-report docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md
python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --report docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md

# synthetic short-detail fixture check for STEP170 weekly first_failed_run visibility
python3 - <<'PY'
import json
from pathlib import Path
base = Path("build/tmp_weekly_verify")
base.mkdir(parents=True, exist_ok=True)
payload = {
  "generated_at": "2026-02-24T19:30:00Z",
  "editor_smoke": {"run_id": "r1", "status": "PASS", "pass": 1, "fail": 0, "skipped": 0},
  "step166": {"run_id": "s1", "gate_would_fail": False},
  "performance": {},
  "ui_flow_smoke": {
    "enabled": True,
    "status": "FAIL",
    "run_id": "u2",
    "gate_runs_target": 1,
    "gate_run_count": 1,
    "gate_pass_count": 0,
    "gate_fail_count": 1,
    "failure_attribution_complete": True,
    "failure_code_total": 1,
    "runs": [
      {
        "run_id": "u2",
        "ok": False,
        "failure_code": "UI_FLOW_ASSERT_FAIL",
        "flow_step": "line",
        "flow_selection": "1 selected (line)",
        "failure_detail": "short fail"
      }
    ]
  },
  "ui_flow_failure_injection": {},
  "gate": {}
}
(base / "weekly_short_detail.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
PY
python3 tools/write_step170_weekly_report.py \
  --weekly-summary build/tmp_weekly_verify/weekly_short_detail.json \
  --step170-report build/tmp_weekly_verify/step170_weekly_test.md
rg -n "first_failed_run|short fail" build/tmp_weekly_verify/step170_weekly_test.md
```

### Result
- Static/syntax checks PASS:
  - `editor_ui_flow_smoke.sh` parses successfully.
- Node command tests PASS: `85/85`.
- editor_gate(lite, UI-flow disabled in this environment) PASS:
  - editor_smoke run_id: `20260224_142804_258_3623`
  - summary: `build/editor_gate_summary.json`
  - gate decision: `would_fail=false`
- STEP170/STEP176 weekly appenders PASS:
  - both scripts append successfully using `build/editor_weekly_validation_summary.json`.
  - weekly reports now include unsupported passthrough rollup lines for observe/gate sections.
- Environment note:
  - browser UI-flow execution was not revalidated in this run because `playwright-cli` bootstrap requires network access to `registry.npmjs.org` in current sandbox mode.
  - command-level and gate (non-UI-flow path) validations remain green.

## AA) Lane A UI-flow smoke fail-fast check under restricted network

### Command
```bash
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --port 18123 --pwcli-timeout-sec 5
```

### Result
- command returns quickly with summary output:
  - `build/editor_ui_flow_smoke/20260224_143101_ui_flow/summary.json`
- expected fail-fast behavior observed:
  - `ok=false`
  - `exit_code=124` (pwcli timeout)
  - log tail includes `"[SKIP] screenshot/console because FLOW_EXIT_CODE=124"`
- confirms new timeout wrapper + skip logic prevents long hang when playwright bootstrap cannot reach npm.

## AB) Lane A editor_gate UI-flow port allocation hardening (restricted bind sandbox)

### Commands
```bash
bash -n tools/editor_gate.sh
node --test tools/web_viewer/tests/editor_commands.test.js

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_NO_CONVERT=1 EDITOR_SMOKE_LIMIT=5 \
bash tools/editor_gate.sh

RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 \
RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 EDITOR_SMOKE_NO_CONVERT=1 EDITOR_SMOKE_LIMIT=3 \
bash tools/editor_gate.sh

EDITOR_GATE_PROFILE=lite RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=1 UI_FLOW_FAILURE_INJECTION_STRICT=0 \
RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 EDITOR_SMOKE_NO_CONVERT=1 EDITOR_SMOKE_LIMIT=2 \
bash tools/editor_gate.sh
```

### Result
- syntax + command tests PASS:
  - `editor_gate.sh` shell parse OK.
  - `editor_commands.test.js` PASS `85/85`.
- `editor_gate.sh` (implicit UI-flow gate default, bind denied) PASS:
  - warning emitted: `ui_flow port allocation failed (PermissionError: [Errno 1] Operation not permitted); skip ui_flow smoke`
  - editor smoke run_id: `20260224_145002_971_3acc`
  - gate summary: `build/editor_gate_summary.json`
  - summary fields:
    - `gate_decision.would_fail=false`
    - `ui_flow_smoke.mode=skipped`
    - `ui_flow_smoke.gate_required=true`
    - `ui_flow_smoke.gate_required_explicit=false`
    - `ui_flow_smoke.port_allocation.status=FAILED`
- `editor_gate.sh` (explicit UI-flow gate requirement, bind denied) FAIL as designed (`exit_code=2`):
  - editor smoke run_id: `20260224_145020_424_026a`
  - `gate_decision.fail_reasons` contains `UI_FLOW_SMOKE:PORT_UNAVAILABLE`.
- UI-flow failure injection path (bind denied, non-strict) handled without crash:
  - editor smoke run_id: `20260224_145036_661_6536`
  - `ui_flow_failure_injection.status=SKIPPED`
  - `ui_flow_failure_injection.failure_code=UI_FLOW_PORT_UNAVAILABLE`
  - `ui_flow_failure_injection.exit_code=125`.

## AC) Lane B fillet/chamfer preselection interaction closure

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_NO_CONVERT=1 EDITOR_SMOKE_LIMIT=5 \
bash tools/editor_gate.sh

EDITOR_GATE_PROFILE=full RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
bash tools/editor_gate.sh
```

### Result
- Node command tests PASS: `87/87`
  - includes two new preselection interaction tests for fillet/chamfer second-pick activation + first-side refinement.
- UI-flow smoke gate PASS:
  - summary: `build/editor_ui_flow_smoke/20260224_154334_ui_flow/summary.json`
  - `flow.fillet_chamfer_preselection` now verifies prompt-level contract:
    - `filletPromptSecond=true`
    - `chamferPromptSecond=true`
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260224_154419_ui_flow`, `20260224_154455_ui_flow`
  - editor_smoke run_id: `20260224_154531_213_930a`
  - summary: `build/editor_gate_summary.json`
  - gate decision: `would_fail=false`
- editor_gate(full) PASS:
  - ui_flow run_ids: `20260224_153857_ui_flow`, `20260224_153934_ui_flow`
  - editor_smoke run_id: `20260224_154010_852_897f`
  - step166 run_id: `20260224_074014` (`gate_would_fail=false`)
  - summary: `build/editor_gate_summary.json`

## AD) Lane B preselection fallback-miss determinism

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_NO_CONVERT=1 EDITOR_SMOKE_LIMIT=5 \
bash tools/editor_gate.sh

EDITOR_GATE_PROFILE=full RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
bash tools/editor_gate.sh
```

### Result
- Node command tests PASS: `89/89`
  - new deterministic fallback-miss tests:
    - `fillet tool preselection ignores fallback miss for first-side pick`
    - `chamfer tool preselection ignores fallback miss for first-side pick`
- UI-flow smoke gate PASS:
  - summary: `build/editor_ui_flow_smoke/20260224_165552_ui_flow/summary.json`
  - preselection prompt assertions remain stable.
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260224_165640_ui_flow`, `20260224_165716_ui_flow`
  - editor_smoke run_id: `20260224_165756_587_8069`
  - summary: `build/editor_gate_summary.json`
  - gate decision: `would_fail=false`
- editor_gate(full) PASS:
  - ui_flow run_ids: `20260224_165805_ui_flow`, `20260224_165843_ui_flow`
  - editor_smoke run_id: `20260224_165925_315_3ea0`
  - step166 run_id: `20260224_085929` (`gate_would_fail=false`)
  - summary: `build/editor_gate_summary.json`

## AE) Lane A UI-flow attribution normalization + report propagation

### Commands
```bash
python3 -m py_compile tools/write_editor_gate_report.py tools/write_step176_gate_report.py tools/write_ci_artifact_summary.py
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate

# Negative control for attribution code path
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --timeout-ms 1

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_NO_CONVERT=1 EDITOR_SMOKE_LIMIT=5 \
bash tools/editor_gate.sh

EDITOR_GATE_PROFILE=full RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
bash tools/editor_gate.sh

python3 tools/write_step176_gate_report.py --gate-summary build/editor_gate_summary.json --report docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md
python3 tools/write_ci_artifact_summary.py --title "cadgamefusion-editor-nightly" --mode observe --gate-summary build/editor_gate_summary.json --roundtrip-summary build/editor_roundtrip/20260224_171116_863_7273/summary.json --out build/ci_editor_nightly_summary.md
```

### Result
- static checks PASS:
  - report writers compile and run.
- Node command tests PASS: `89/89`.
- UI-flow smoke gate PASS:
  - summary: `build/editor_ui_flow_smoke/20260224_170431_ui_flow/summary.json`.
- UI-flow negative control (timeout-ms=1) emits direct attribution fields:
  - summary: `build/editor_ui_flow_smoke/20260224_170852_ui_flow/summary.json`
  - `flow_failure_code=UI_FLOW_FLOW_JSON_INVALID`
  - `flow_failure_detail` populated.
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260224_171003_ui_flow`, `20260224_171039_ui_flow`
  - editor_smoke run_id: `20260224_171116_863_7273`
  - summary: `build/editor_gate_summary.json`
  - gate decision: `would_fail=false`.
- editor_gate(full) PASS:
  - ui_flow run_ids: `20260224_170640_ui_flow`, `20260224_170716_ui_flow`
  - editor_smoke run_id: `20260224_170750_843_21d4`
  - step166 run_id: `20260224_090753` (`gate_would_fail=false`)
  - summary: `build/editor_gate_summary.json`.
- report propagation verified:
  - STEP176 append succeeded and includes ui-flow gate/port context fields.
  - CI summary regenerated at `build/ci_editor_nightly_summary.md` with ui-flow gate/port fields.

## AF) Lane A weekly report parity for UI-flow gate context

### Commands
```bash
python3 -m py_compile tools/write_step170_weekly_report.py tools/write_step176_weekly_report.py

python3 tools/write_step170_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --step170-report docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md

python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --report docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md
```

### Result
- weekly report writers compile PASS.
- STEP170 weekly append PASS:
  - appends ui-flow gate context fields (`ui_flow_gate_required`, `port_allocation`).
- STEP176 weekly append PASS:
  - appends ui-flow gate context + attribution fields (`failure_attribution`, `first_failure_code`).
- weekly snapshots now stay readable/diagnosable for both:
  - normal UI-flow-enabled runs
  - infra-skipped runs with explicit/implicit gate intent.

## AG) Lane A STEP176 dashboard parity for UI-flow gate context

### Commands
```bash
python3 -m py_compile tools/write_step176_dashboard.py
python3 tools/write_step176_dashboard.py
```

### Result
- dashboard writer compile PASS.
- dashboard regeneration PASS:
  - output: `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_DASHBOARD.md`
- dashboard now includes ui-flow gate context in latest gate section:
  - `ui_flow_gate_required`
  - `ui_flow_port_allocation`
- history table rows now annotate skipped UI-flow entries with:
  - required mode marker (`req=exp|imp`)
  - port status suffix when available (`FAILED`, etc.).

## AH) Lane B preselected same-polyline Fillet/Chamfer closure

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash -n tools/web_viewer/scripts/editor_ui_flow_smoke.sh
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_NO_CONVERT=1 EDITOR_SMOKE_LIMIT=5 \
bash tools/editor_gate.sh

EDITOR_GATE_PROFILE=full RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
bash tools/editor_gate.sh
```

### Result
- Node command tests PASS: `91/91`
  - added cases:
    - `fillet tool preselected polyline supports same-entity corner refinement in second-pick stage`
    - `chamfer tool preselected polyline supports same-entity corner refinement in second-pick stage`
- UI-flow smoke gate PASS:
  - summary: `build/editor_ui_flow_smoke/20260224_173125_ui_flow/summary.json`
  - new step `fillet_chamfer_polyline_preselection` PASS:
    - fillet: `filletPreselected=true`, `filletPromptSecond=true`, `filletApplied=true`, `filletArcCount=1`
    - chamfer: `chamferPreselected=true`, `chamferPromptSecond=true`, `chamferApplied=true`, `chamferLineCount=1`
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260224_173219_ui_flow`, `20260224_173256_ui_flow`
  - editor_smoke run_id: `20260224_173332_629_4686`
  - summary: `build/editor_gate_summary.json`
  - gate decision: `would_fail=false`
- editor_gate(full) PASS:
  - ui_flow run_ids: `20260224_173341_ui_flow`, `20260224_173420_ui_flow`
  - editor_smoke run_id: `20260224_173457_953_f3a0`
  - step166 run_id: `20260224_093501` (`gate_would_fail=false`)
  - summary: `build/editor_gate_summary.json`

## AI) Lane B two-segment polyline auto-pair fallback (same-leg mis-pick)

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash -n tools/web_viewer/scripts/editor_ui_flow_smoke.sh
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_NO_CONVERT=1 EDITOR_SMOKE_LIMIT=5 \
bash tools/editor_gate.sh

EDITOR_GATE_PROFILE=full RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
bash tools/editor_gate.sh
```

### Result
- Node command tests PASS: `93/93`
  - added cases:
    - `selection.filletByPick auto-pairs two-segment polyline corner when picks land on same segment`
    - `selection.chamferByPick auto-pairs two-segment polyline corner when picks land on same segment`
- UI-flow smoke gate PASS:
  - summary: `build/editor_ui_flow_smoke/20260224_174313_ui_flow/summary.json`
  - `fillet_chamfer_polyline_preselection` now passes with intentional same-leg second clicks:
    - `filletApplied=true`, `filletArcCount=1`
    - `chamferApplied=true`, `chamferLineCount=1`
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260224_174406_ui_flow`, `20260224_174442_ui_flow`
  - editor_smoke run_id: `20260224_174519_924_098e`
  - summary: `build/editor_gate_summary.json`
  - gate decision: `would_fail=false`
- editor_gate(full) PASS:
  - ui_flow run_ids: `20260224_174529_ui_flow`, `20260224_174607_ui_flow`
  - editor_smoke run_id: `20260224_174644_620_e97b`
  - step166 run_id: `20260224_094647` (`gate_would_fail=false`)
  - summary: `build/editor_gate_summary.json`

## AJ) Lane A UI-flow run_id traceability + weekly first-failure visibility fix

### Commands
```bash
python3 -m py_compile \
  tools/write_editor_gate_report.py \
  tools/write_step176_gate_report.py \
  tools/write_ci_artifact_summary.py \
  tools/write_step170_weekly_report.py \
  tools/write_step176_weekly_report.py
bash -n tools/editor_gate.sh
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_NO_CONVERT=1 EDITOR_SMOKE_LIMIT=5 \
bash tools/editor_gate.sh

EDITOR_GATE_PROFILE=full RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
bash tools/editor_gate.sh

python3 tools/write_step176_gate_report.py \
  --gate-summary build/editor_gate_summary.json \
  --report docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md

python3 tools/write_ci_artifact_summary.py \
  --title "cadgamefusion-editor-nightly" \
  --mode observe \
  --gate-summary build/editor_gate_summary.json \
  --roundtrip-summary build/editor_roundtrip/20260224_192701_361_4279/summary.json \
  --out build/ci_editor_nightly_summary.md

python3 tools/write_step170_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --step170-report docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md

python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --report docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md
```

### Result
- static checks PASS:
  - python compile PASS for all updated writers.
  - `editor_gate.sh` shell syntax PASS.
- command + UI-flow PASS:
  - Node tests: `93/93 PASS`.
  - UI-flow gate smoke summary: `build/editor_ui_flow_smoke/20260224_192336_ui_flow/summary.json` (`ok=true`).
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260224_192425_ui_flow`, `20260224_192501_ui_flow`
  - editor_smoke run_id: `20260224_192538_108_1f9e`
  - step166: skipped (lite profile)
  - summary: `build/editor_gate_summary.json`
- editor_gate(full) PASS:
  - ui_flow run_ids: `20260224_192548_ui_flow`, `20260224_192624_ui_flow`
  - editor_smoke run_id: `20260224_192701_361_4279`
  - step166 run_id: `20260224_112704` (`gate_would_fail=false`)
  - summary: `build/editor_gate_summary.json`
- contract verification:
  - `editor_gate_summary.json` now contains `ui_flow_smoke.run_ids=["20260224_192548_ui_flow","20260224_192624_ui_flow"]`.
  - STEP170/STEP176/CI markdown appenders now emit UI-flow run-id list lines from `run_ids` (fallback to `runs[]`).
  - STEP170 weekly writer now outputs `first_failed_run` independent of detail length (visibility bug fixed).
  - synthetic short-detail check PASS:
    - `build/tmp_weekly_verify/step170_weekly_test.md` contains `first_failed_run ... detail=\`short fail\``.

## AK) Lane A STEP176 dashboard run_id parity

### Commands
```bash
python3 -m py_compile tools/write_step176_dashboard.py
python3 tools/write_step176_dashboard.py
rg -n "ui_flow_run_ids|Latest Gate" docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_DASHBOARD.md
```

### Result
- dashboard writer compile PASS.
- dashboard regeneration PASS:
  - output: `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_DASHBOARD.md`
- `Latest Gate` now includes explicit UI-flow run-id list:
  - `ui_flow_run_ids: 20260224_192548_ui_flow 20260224_192624_ui_flow`

## AL) Lane B Fillet/Chamfer runtime-single-selection fast-path

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash -n tools/web_viewer/scripts/editor_ui_flow_smoke.sh
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_NO_CONVERT=1 EDITOR_SMOKE_LIMIT=5 \
bash tools/editor_gate.sh

EDITOR_GATE_PROFILE=full RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
bash tools/editor_gate.sh
```

### Result
- Node command tests PASS: `95/95`
  - added cases:
    - `fillet tool fast-path also applies when single selection is set after activation`
    - `chamfer tool fast-path also applies when single selection is set after activation`
- UI-flow smoke gate PASS:
  - summary: `build/editor_ui_flow_smoke/20260224_221445_ui_flow/summary.json`
  - `fillet_chamfer_preselection` now covers runtime selection path:
    - `filletRuntimePromptFirst=true`, `filletRuntimeApplied=true`, `filletRuntimeArcCount>=1`
    - `chamferRuntimePromptFirst=true`, `chamferRuntimeApplied=true`, `chamferRuntimeLineCount>=3`
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260224_221530_ui_flow`, `20260224_221610_ui_flow`
  - editor_smoke run_id: `20260224_221650_117_7223`
  - step166: skipped (lite profile)
  - summary: `build/editor_gate_summary.json`
- editor_gate(full) PASS:
  - ui_flow run_ids: `20260224_221703_ui_flow`, `20260224_221742_ui_flow`
  - editor_smoke run_id: `20260224_221818_530_27b2`
  - step166 run_id: `20260224_141821` (`gate_would_fail=false`)
  - summary: `build/editor_gate_summary.json`

## AM) Lane C Qt snap semantic persistence parity

### Commands
```bash
# Qt project persistence changes + regression safety checks
cmake --build build --target test_qt_project_roundtrip

node --test tools/web_viewer/tests/editor_commands.test.js

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_NO_CONVERT=1 EDITOR_SMOKE_LIMIT=5 \
bash tools/editor_gate.sh

EDITOR_GATE_PROFILE=full RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
bash tools/editor_gate.sh
```

### Result
- Qt build target check:
  - `cmake --build build --target test_qt_project_roundtrip` -> `ninja: error: unknown target 'test_qt_project_roundtrip'`
  - current build preset does not include Qt test targets; source-level changes still applied with backward-compatible field handling.
- Web/editor regression PASS:
  - `node --test` -> `95/95 PASS`
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260225_190600_ui_flow`, `20260225_190640_ui_flow`
  - editor_smoke run_id: `20260225_190717_201_5be2`
  - step166: skipped (lite profile)
  - summary: `build/editor_gate_summary.json`
- editor_gate(full) PASS:
  - ui_flow run_ids: `20260225_190725_ui_flow`, `20260225_190801_ui_flow`
  - editor_smoke run_id: `20260225_190838_459_17d4`
  - step166 run_id: `20260225_110841` (`gate_would_fail=false`)
  - summary: `build/editor_gate_summary.json`

## AN) Lane B stale-preselection reset hardening + Lane A warning normalization

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash -n tools/editor_gate.sh

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_NO_CONVERT=1 EDITOR_SMOKE_LIMIT=5 \
bash tools/editor_gate.sh

EDITOR_GATE_PROFILE=full RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
bash tools/editor_gate.sh
```

### Result
- command tests PASS: `97/97`
  - new coverage:
    - `fillet tool does not reuse stale preselection after Escape reset`
    - `chamfer tool does not reuse stale preselection after Escape reset`
- gate script syntax PASS: `bash -n tools/editor_gate.sh`
- editor_gate(lite) PASS:
  - first line now normalized for auto local tiny case file:
    - `INFO auto local editor_smoke_cases has 2 cases (<4), fixture_count=1 not better; fallback to discovery`
  - ui_flow run_ids: `20260225_201341_ui_flow`, `20260225_201420_ui_flow`
  - editor_smoke run_id: `20260225_201457_752_2cb9`
  - step166: skipped (lite profile)
  - summary: `build/editor_gate_summary.json`
- editor_gate(full) PASS:
  - first line uses same normalized INFO path for auto local tiny case file.
  - ui_flow run_ids: `20260225_201506_ui_flow`, `20260225_201543_ui_flow`
  - editor_smoke run_id: `20260225_201620_908_744d`
  - step166 run_id: `20260225_121624` (`gate_would_fail=false`)
  - summary: `build/editor_gate_summary.json`

## AO) Lane B UI-flow Esc stale-preselection coverage + Lane C Qt check script

### Commands
```bash
bash -n tools/web_viewer/scripts/editor_ui_flow_smoke.sh
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate

bash tools/qt_project_persistence_check.sh --mode observe --build-dir build \
  --out build/qt_project_persistence_check.json

bash tools/qt_project_persistence_check.sh --mode gate --require-on 0 --build-dir build \
  --out build/qt_project_persistence_check_gate.json

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_NO_CONVERT=1 EDITOR_SMOKE_LIMIT=5 \
bash tools/editor_gate.sh

EDITOR_GATE_PROFILE=full RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
bash tools/editor_gate.sh
```

### Result
- UI-flow smoke gate PASS:
  - summary: `build/editor_ui_flow_smoke/20260225_223415_ui_flow/summary.json`
  - Esc stale-preselection assertions:
    - `filletEscNoAutoApply=true`, `filletEscApplied=true`
    - `chamferEscNoAutoApply=true`, `chamferEscApplied=true`
- Qt check script PASS (expected skip in current profile):
  - `build/qt_project_persistence_check.json`: `status=skipped`, `reason=BUILD_EDITOR_QT_OFF`
  - `build/qt_project_persistence_check_gate.json`: `status=skipped`, `reason=BUILD_EDITOR_QT_OFF`
  - gate-mode with `--require-on 0` exits green; `--require-on 1` intentionally returns non-zero for strict enforcement.
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260225_223512_ui_flow`, `20260225_223551_ui_flow`
  - editor_smoke run_id: `20260225_223629_046_66fb`
  - step166: skipped (lite profile)
  - summary: `build/editor_gate_summary.json`
- editor_gate(full) PASS:
  - ui_flow run_ids: `20260225_223639_ui_flow`, `20260225_223717_ui_flow`
  - editor_smoke run_id: `20260225_223753_684_a7a5`
  - step166 run_id: `20260225_143757` (`gate_would_fail=false`)
  - summary: `build/editor_gate_summary.json`

## AP) Lane A+C Qt persistence integrated into editor_gate + report surfaces

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash -n tools/editor_gate.sh
bash -n tools/editor_weekly_validation.sh
python3 -m py_compile \
  tools/write_editor_gate_report.py \
  tools/write_step176_gate_report.py \
  tools/write_ci_artifact_summary.py \
  tools/write_step176_dashboard.py \
  tools/write_step176_weekly_report.py

# observe-lite (qt check runs in observe mode)
EDITOR_GATE_PROFILE=lite \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
STEP176_APPEND_REPORT=0 EDITOR_GATE_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_lite_qt.json \
HISTORY_DIR=build/editor_gate_history/lite_qt \
bash tools/editor_gate.sh

# observe-full (includes STEP166 gate path)
EDITOR_GATE_PROFILE=full \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
STEP176_APPEND_REPORT=0 EDITOR_GATE_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_full_qt.json \
HISTORY_DIR=build/editor_gate_history/full_qt \
bash tools/editor_gate.sh

# strict qt gate probe (expected fail when BUILD_EDITOR_QT=OFF + require_on=1)
EDITOR_GATE_PROFILE=lite \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_QT_PROJECT_PERSISTENCE_GATE=1 QT_PROJECT_PERSISTENCE_REQUIRE_ON=1 \
STEP176_APPEND_REPORT=0 EDITOR_GATE_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_lite_qt_gate_on.json \
HISTORY_DIR=build/editor_gate_history/lite_qt_gate_on \
bash tools/editor_gate.sh

# append docs with the full summary snapshot
python3 tools/write_editor_gate_report.py \
  --gate-summary build/editor_gate_summary_full_qt.json \
  --step170-report docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md
python3 tools/write_step176_gate_report.py \
  --gate-summary build/editor_gate_summary_full_qt.json \
  --report docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md
python3 tools/write_step176_dashboard.py
python3 tools/write_ci_artifact_summary.py \
  --title "cadgamefusion-editor-gate-local" \
  --mode gate \
  --gate-summary build/editor_gate_summary_full_qt.json \
  --roundtrip-summary build/editor_roundtrip/20260225_230502_479_4772/summary.json \
  --out build/ci_editor_gate_local_qt.md
```

### Result
- Core validation PASS:
  - `node --test tools/web_viewer/tests/editor_commands.test.js`: `97/97 PASS`
  - shell syntax: `tools/editor_gate.sh`, `tools/editor_weekly_validation.sh` PASS
  - Python writers compile PASS.
- editor_gate(lite observe) PASS:
  - ui_flow run_ids: `20260225_230217_ui_flow`, `20260225_230259_ui_flow`
  - editor_smoke run_id: `20260225_230337_164_1f73`
  - qt_project_persistence: `mode=observe`, `status=skipped`, `reason=BUILD_EDITOR_QT_OFF`, `run_id=20260225_150338`, `exit_code=0`
  - summary: `build/editor_gate_summary_lite_qt.json`
- editor_gate(full observe) PASS:
  - ui_flow run_ids: `20260225_230348_ui_flow`, `20260225_230424_ui_flow`
  - editor_smoke run_id: `20260225_230502_479_4772`
  - step166 run_id: `20260225_150505` (`gate_would_fail=false`)
  - qt_project_persistence: `mode=observe`, `status=skipped`, `reason=BUILD_EDITOR_QT_OFF`, `run_id=20260225_150505`, `exit_code=0`
  - summary: `build/editor_gate_summary_full_qt.json`
- strict Qt gate probe (expected fail) behaves correctly:
  - ui_flow run_ids: `20260225_230548_ui_flow`, `20260225_230625_ui_flow`
  - editor_smoke run_id: `20260225_230702_441_15a5`
  - qt_project_persistence: `mode=gate`, `status=skipped`, `reason=BUILD_EDITOR_QT_OFF`, `exit_code=2`
  - gate exit code: `2`
  - gate fail reasons include:
    - `QT_PROJECT_PERSISTENCE:FAIL`
    - `QT_PROJECT_PERSISTENCE_REASON:BUILD_EDITOR_QT_OFF`
  - summary: `build/editor_gate_summary_lite_qt_gate_on.json`
- Report outputs updated:
  - STEP170 append includes new "Qt project persistence" block:
    - `docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md`
  - STEP176 gate append includes Qt status/build/summary:
    - `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md`
  - STEP176 dashboard now surfaces Qt persistence in latest gate + history table:
    - `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_DASHBOARD.md`
- local CI artifact summary includes Qt persistence lines:
  - `build/ci_editor_gate_local_qt.md`

## AQ) Lane A local_ci/nightly Qt gate wiring

### Commands
```bash
# local_ci script integrity after Qt env + summary field extension
bash -n tools/local_ci.sh

# nightly workflow change inspection (no remote run in local env)
rg -n "RUN_QT_PROJECT_PERSISTENCE|qt_project_persistence_check" \
  .github/workflows/cadgamefusion_editor_nightly.yml

# default-history full gate run with Qt gate mode enabled (require_on=0)
EDITOR_GATE_PROFILE=full \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_QT_PROJECT_PERSISTENCE_GATE=1 QT_PROJECT_PERSISTENCE_REQUIRE_ON=0 \
EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
bash tools/editor_gate.sh
```

### Result
- `tools/local_ci.sh` syntax PASS.
- `local_ci` now exposes Qt persistence control surface:
  - `EDITOR_GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK`
  - `EDITOR_GATE_RUN_QT_PROJECT_PERSISTENCE_GATE`
  - `EDITOR_GATE_QT_PROJECT_PERSISTENCE_REQUIRE_ON`
- `local_ci` now forwards Qt persistence env into `tools/editor_gate.sh` and parses `qt_project_persistence` from gate summary into:
  - console summary line
  - `build/local_ci_summary.json` fields (`editorGateQtProjectPersistence*`).
- nightly workflow updated to stage-1 policy:
  - `RUN_QT_PROJECT_PERSISTENCE_CHECK=1`
  - `RUN_QT_PROJECT_PERSISTENCE_GATE=1`
  - `QT_PROJECT_PERSISTENCE_REQUIRE_ON=0`
  - artifact upload includes `deps/cadgamefusion/build/qt_project_persistence_check.json`.
- default-history full gate run PASS with Qt gate mode enabled:
  - ui_flow run_ids: `20260226_101418_ui_flow`, `20260226_101510_ui_flow`
  - editor_smoke run_id: `20260226_101551_046_2fb6`
  - step166 run_id: `20260226_021555` (`gate_would_fail=false`)
  - qt_project_persistence: `mode=gate`, `status=skipped`, `reason=BUILD_EDITOR_QT_OFF`, `exit_code=0`
  - summary: `build/editor_gate_summary.json`
- Scope note:
  - this verification round is repo-local; GitHub-hosted run confirmation will appear in next nightly execution records.

## AR) Lane A+C weekly Qt require_on auto-policy

### Commands
```bash
python3 tools/qt_project_persistence_gate_policy.py \
  --history-dir build/editor_gate_history \
  --days 14 \
  --min-samples 5 \
  --min-consecutive-passes 3 \
  --out-json build/qt_project_persistence_gate_policy.json \
  --out-md build/qt_project_persistence_gate_policy.md

RUN_GATE=1 RUN_REAL_SCENE_PERF=0 RUN_EDITOR_UI_FLOW_SMOKE=0 \
EDITOR_SMOKE_LIMIT=4 GATE_SMOKE_LIMIT=4 \
STEP170_APPEND_REPORT=0 STEP176_APPEND_REPORT=1 \
SUMMARY_JSON=build/editor_weekly_validation_summary_qt_policy.json \
SUMMARY_MD=build/editor_weekly_validation_summary_qt_policy.md \
bash tools/editor_weekly_validation.sh
```

### Result
- Policy tool PASS:
  - `qt_policy_status=observe`
  - `qt_policy_recommended_require_on=0`
  - artifacts:
    - `build/qt_project_persistence_gate_policy.json`
    - `build/qt_project_persistence_gate_policy.md`
- Weekly run PASS:
  - observe editor_smoke run_id: `20260226_113640_059_8902`
  - gate editor_smoke run_id: `20260226_113833_253_a1c6`
  - observe step166 run_id: `20260226_033642`
  - gate step166 run_id: `20260226_033836`
  - gate Qt persistence line: `mode=gate status=skipped reason=BUILD_EDITOR_QT_OFF require_on=0`
- Weekly summary contract validated:
  - `qt_project_persistence_policy.status=observe`
  - `qt_project_persistence_policy.recommended_require_on=0`
  - `qt_project_persistence_policy.effective_require_on=0`
  - `qt_project_persistence_policy.effective_source=auto-policy`
- Report surfaces updated:
  - `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md` includes weekly qt policy lines.
  - `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_DASHBOARD.md` weekly table includes `qt_policy`.

## AS) Lane A workflow dispatch override for artifact upload policy

### Commands
```bash
python3 - <<'PY'
import yaml
for path in (
  ".github/workflows/cadgamefusion_editor_light.yml",
  ".github/workflows/cadgamefusion_editor_nightly.yml",
):
  with open(path, "r", encoding="utf-8") as fh:
    yaml.safe_load(fh)
  print(f"yaml_ok {path}")
PY

rg -n "upload_artifacts|UPLOAD_CI_ARTIFACTS" \
  .github/workflows/cadgamefusion_editor_light.yml \
  .github/workflows/cadgamefusion_editor_nightly.yml
```

### Result
- YAML parse PASS for both workflows.
- `workflow_dispatch.inputs.upload_artifacts` is now available in:
  - `.github/workflows/cadgamefusion_editor_light.yml`
  - `.github/workflows/cadgamefusion_editor_nightly.yml`
- `UPLOAD_CI_ARTIFACTS` now resolves from dispatch input, with non-dispatch fallback to `on_failure`.
- Upload step condition remains unchanged (`always` / `on_failure` / `off`), so behavior is backward compatible.

## AT) Lane B same-polyline fallback execution hardening (Fillet/Chamfer)

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 \
RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_LIMIT=4 \
bash tools/editor_gate.sh
```

### Result
- Node command tests PASS: `99/99`
  - new cases:
    - `fillet tool preselected polyline executes same-entity corner when second hit falls back to selection`
    - `chamfer tool preselected polyline executes same-entity corner when second hit falls back to selection`
- UI-flow smoke gate PASS:
  - summary: `build/editor_ui_flow_smoke/20260227_203811_ui_flow/summary.json`
  - preselection flow remains green:
    - `flow.fillet_chamfer_preselection.*` = all expected `true`
    - `flow.fillet_chamfer_polyline_preselection.filletApplied=true`
    - `flow.fillet_chamfer_polyline_preselection.chamferApplied=true`
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260227_203927_ui_flow`, `20260227_204008_ui_flow`
  - editor_smoke run_id: `20260227_204048_012_83dd`
  - gate decision: `would_fail=false`
  - summary: `build/editor_gate_summary.json`

## AU) Remote nightly dispatch probe (GitHub budget blocked)

### Commands
```bash
gh workflow run cadgamefusion_editor_nightly.yml -f mode=observe -f smoke_limit=4
gh run view 22486420056 --repo zensgit/VemCAD
```

### Result
- Workflow run: `22486420056`
- URL: `https://github.com/zensgit/VemCAD/actions/runs/22486420056`
- Conclusion: `failure`
- Root cause (before any workflow step):
  - `The job was not started because an Actions budget is preventing further use.`
- Notes:
  - no step logs/artifacts were produced (`steps: []`).
  - dispatch-time `upload_artifacts` input is present in local YAML changes, but not yet available on remote default branch until these workflow changes are pushed.

## AV) Lane B polyline fallback-miss UI-flow telemetry + gate stability

### Commands
```bash
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate

EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 \
RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_LIMIT=4 \
bash tools/editor_gate.sh
```

### Result
- UI-flow smoke gate PASS:
  - summary: `build/editor_ui_flow_smoke/20260227_215927_ui_flow/summary.json`
  - polyline fallback telemetry:
    - `flow.fillet_chamfer_polyline_preselection.filletFallbackApplied=false`
    - `flow.fillet_chamfer_polyline_preselection.filletFallbackRecovered=true`
    - `flow.fillet_chamfer_polyline_preselection.chamferFallbackApplied=false`
    - `flow.fillet_chamfer_polyline_preselection.chamferFallbackRecovered=true`
- Interpretation:
  - current browser hit-testing did not consistently trigger direct fallback-miss apply,
  - deterministic recovery path kept gate stable and still validated end-to-end command closure.
- editor_gate(lite) PASS:
  - ui_flow run_ids: `20260227_220031_ui_flow`, `20260227_220113_ui_flow`
  - editor_smoke run_id: `20260227_220156_004_7f31`
  - summary: `build/editor_gate_summary.json`
  - gate decision: `would_fail=false`

## AW) Lane A STEP166 fail-path summary persistence

### Commands
```bash
EDITOR_GATE_PROFILE=full \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_full_current.json \
bash tools/editor_gate.sh

python3 tools/write_editor_gate_report.py \
  --gate-summary build/editor_gate_summary_full_current.json \
  --step170-report docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md
python3 tools/write_step176_gate_report.py \
  --gate-summary build/editor_gate_summary_full_current.json \
  --report docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md
python3 tools/write_step176_dashboard.py
```

### Result
- editor_gate(full) returns fail as expected:
  - exit code: `2`
  - `gate_decision.would_fail=true`
  - `gate_decision.fail_reasons=["STEP166:RC_2"]`
- Crucial contract now holds on fail:
  - summary exists: `build/editor_gate_summary_full_current.json`
  - run ids still recorded:
    - `editor_smoke.run_id=20260227_221818_596_7670`
    - `ui_flow_smoke.run_ids=[20260227_221652_ui_flow, 20260227_221735_ui_flow]`
    - `step166.run_id=20260227_141822`
- Report appenders execute successfully against failed gate summary:
  - `docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md` appended
  - `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md` appended
  - `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_DASHBOARD.md` regenerated

## AX) Lane A weekly gate-fail persistence (summary + report append before exit)

### Commands
```bash
RUN_GATE=1 RUN_REAL_SCENE_PERF=0 RUN_EDITOR_UI_FLOW_SMOKE=0 \
EDITOR_SMOKE_LIMIT=4 GATE_SMOKE_LIMIT=4 \
STEP170_APPEND_REPORT=1 STEP176_APPEND_REPORT=1 \
SUMMARY_JSON=build/editor_weekly_validation_summary_gatefail.json \
SUMMARY_MD=build/editor_weekly_validation_summary_gatefail.md \
bash tools/editor_weekly_validation.sh
```

### Result
- Weekly command exits non-zero as expected:
  - exit code: `2`
- Despite gate fail, artifacts are now persisted:
  - `build/editor_weekly_validation_summary_gatefail.json`
  - `build/editor_weekly_validation_summary_gatefail.md`
- Weekly summary gate snapshot:
  - `gate.status=fail`
  - `gate.exit_code=2`
- Run IDs captured in weekly summary:
  - observe: `editor_smoke=20260228_114144_006_4214`, `step166=20260228_034147`
  - gate: `editor_smoke=20260228_114433_042_1874`, `step166=20260228_034436`
- Report appenders now run before final exit:
  - `docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md` appended
  - `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md` appended

## AY) Lane A+C STEP166 alignment robustness recovery (gate restored)

### Commands
```bash
python3 -m py_compile scripts/compare_autocad_pdf.py

python3 scripts/cad_regression_run.py \
  --mode gate \
  --cases docs/STEP166_CAD_REGRESSION_CASES.json \
  --outdir build/cad_regression \
  --baseline docs/baselines/STEP166_baseline_summary.json \
  --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --report docs/STEP166_CAD_REGRESSION_VERIFICATION.md \
  --port-base 28460

EDITOR_GATE_PROFILE=full \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
EDITOR_SMOKE_LIMIT=4 \
SUMMARY_PATH=build/editor_gate_summary_current_round2.json \
STEP176_APPEND_REPORT=0 EDITOR_GATE_APPEND_REPORT=0 \
bash tools/editor_gate.sh

RUN_GATE=1 RUN_REAL_SCENE_PERF=0 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_LIMIT=4 GATE_SMOKE_LIMIT=4 \
STEP170_APPEND_REPORT=1 STEP176_APPEND_REPORT=1 \
SUMMARY_JSON=build/editor_weekly_validation_summary_step185_alignfix.json \
SUMMARY_MD=build/editor_weekly_validation_summary_step185_alignfix.md \
bash tools/editor_weekly_validation.sh
```

### Result
- compare script compile: PASS.
- STEP166 gate direct run: PASS.
  - run_id: `20260228_040106`
  - summary: `build/cad_regression/20260228_040106/summary.json`
  - gate: `would_fail=false`
  - baseline_compare: `compared_cases=6 degraded_cases=0 improved_cases=3`
- editor_gate(full) PASS after alignment fix:
  - summary: `build/editor_gate_summary_current_round2.json`
  - ui_flow run_ids: `20260228_120327_ui_flow`, `20260228_120410_ui_flow`
  - editor_smoke run_id: `20260228_120452_470_151c`
  - step166 run_id: `20260228_040455`
  - gate_decision: `exit_code=0`, `would_fail=false`
- weekly (observe+gate) PASS:
  - summary: `build/editor_weekly_validation_summary_step185_alignfix.json`
  - markdown: `build/editor_weekly_validation_summary_step185_alignfix.md`
  - observe editor_smoke run_id: `20260228_120644_514_aab9`
  - observe STEP166 run_id: `20260228_040645` (`gate_would_fail=false`)
  - gate editor_smoke run_id: `20260228_120825_769_32b4`
  - gate status: `ok`, `exit_code=0`

### Key metric observation
- Layout-level aligned shifts are no longer pinned at local-window boundaries.
- `jaccard_aligned` recovered from prior false-drift range (~0.01) to stable gate-pass range:
  - `layout1/all` around `0.033`
  - `layout2/all` around `0.051`
- No gate threshold was relaxed; recovery comes from deterministic alignment/rotation correction.

## AZ) Lane A+C weekly gate snapshot completeness (step166/ui-flow parity)

### Commands
```bash
bash -n tools/editor_weekly_validation.sh
python3 -m py_compile \
  tools/write_step170_weekly_report.py \
  tools/write_step176_weekly_report.py \
  tools/write_step176_dashboard.py

RUN_GATE=1 RUN_REAL_SCENE_PERF=0 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_LIMIT=4 GATE_SMOKE_LIMIT=4 \
STEP170_APPEND_REPORT=1 STEP176_APPEND_REPORT=1 \
SUMMARY_JSON=build/editor_weekly_validation_summary_step185_gatecontext.json \
SUMMARY_MD=build/editor_weekly_validation_summary_step185_gatecontext.md \
bash tools/editor_weekly_validation.sh

python3 tools/write_step176_dashboard.py
```

### Result
- syntax/compile checks: PASS.
- weekly run PASS:
  - observe editor_smoke run_id: `20260228_122206_778_ca66`
  - observe STEP166 run_id: `20260228_042208` (`gate_would_fail=false`)
  - gate editor_smoke run_id: `20260228_122347_744_8b5a`
  - gate STEP166 run_id: `20260228_042350` (`gate_would_fail=false`)
  - summary: `build/editor_weekly_validation_summary_step185_gatecontext.json`
  - markdown: `build/editor_weekly_validation_summary_step185_gatecontext.md`
- weekly summary contract now includes:
  - `gate.ui_flow_smoke`
  - `gate.step166`
- report append verification:
  - STEP170 weekly append includes:
    - `gate_ui_flow_smoke`
    - `gate_step166`
    - `gate_step166_summary_json`
  - STEP176 weekly append includes:
    - `gate_ui_flow_smoke`
    - `gate_step166_run_id`
    - `gate_step166_baseline_compare`
- dashboard parity:
  - `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_DASHBOARD.md`
  - Weekly History `step166` column now shows observe+gate pair, e.g.:
    - `obs=20260228_042208|gate=20260228_042350:False`

## BA) Lane A report/dashboard path anchoring hardening (cwd-independent)

### Commands
```bash
python3 -m py_compile \
  tools/write_step170_weekly_report.py \
  tools/write_step176_weekly_report.py \
  tools/write_step176_dashboard.py

# run from monorepo root (not deps/cadgamefusion) to verify path anchoring
python3 /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/write_step176_dashboard.py
python3 /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/write_step170_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary_step185_gatecontext.json \
  --step170-report docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md
python3 /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary_step185_gatecontext.json \
  --report docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md
```

### Result
- compile checks: PASS.
- cwd-independent invocation PASS:
  - dashboard output path stays correct:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_DASHBOARD.md`
  - weekly appenders still append to:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md`
- regression check:
  - no new top-level report file created under `/Users/huazhou/Downloads/Github/VemCAD/docs/`.

## BC) Lane A+C weekly generated-case provenance alignment

### Commands
```bash
bash -n tools/editor_weekly_validation.sh
python3 -m py_compile \
  tools/write_step170_weekly_report.py \
  tools/write_step176_weekly_report.py \
  tools/write_step176_dashboard.py \
  tools/generate_editor_roundtrip_cases.py

RUN_GATE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_REAL_SCENE_PERF=0 \
STEP170_APPEND_REPORT=0 \
STEP176_APPEND_REPORT=0 \
EDITOR_SMOKE_LIMIT=4 \
EDITOR_SMOKE_GENERATE_CASES=1 \
EDITOR_SMOKE_GENERATED_MIN_CASES=4 \
EDITOR_SMOKE_PRIORITY_SET=P0,P1 \
EDITOR_SMOKE_TAG_ANY=text-heavy,arc-heavy,polyline-heavy,import-stress \
SUMMARY_JSON=build/editor_weekly_validation_summary_step185_casegen.json \
SUMMARY_MD=build/editor_weekly_validation_summary_step185_casegen.md \
bash tools/editor_weekly_validation.sh

python3 tools/write_step170_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary_step185_casegen.json \
  --step170-report docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md
python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary_step185_casegen.json \
  --report docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md
python3 tools/write_step176_dashboard.py
```

### Result
- static checks: PASS.
- weekly run PASS:
  - editor_smoke run_id: `20260228_134749_339_99ff`
  - STEP166 run_id: `20260228_054752` (`gate_would_fail=False`)
  - summary: `build/editor_weekly_validation_summary_step185_casegen.json`
  - markdown: `build/editor_weekly_validation_summary_step185_casegen.md`
- weekly now records generation provenance:
  - `inputs.editor_smoke_case_source=generated`
  - `inputs.editor_smoke_generated_count=4`
  - `inputs.editor_smoke_generated_run_id=20260228_042350`
  - `inputs.editor_smoke_generated_run_ids=[20260228_042350,20260228_042208]`
- weekly markdown includes:
  - `editor_smoke_cases_source`
  - `editor_smoke_generated_cases`
  - `editor_smoke_generated_runs`
- report append verification:
  - STEP170 append includes:
    - `case_source`, `generated_cases`, `generated_runs`
  - STEP176 append includes:
    - `editor_smoke_cases source=...`
    - `editor_smoke_generated_cases`
    - `editor_smoke_generated_runs`
- dashboard verification:
  - weekly history table now has `case_sel` column.
  - latest row shows generated pool trace:
    - `generated:4/4/4`

## BD) Lane A+C gate-pool forwarding + post-STEP166 regeneration check

### Commands
```bash
bash -n tools/editor_weekly_validation.sh
python3 -m py_compile \
  tools/write_step170_weekly_report.py \
  tools/write_step176_weekly_report.py \
  tools/write_step176_dashboard.py

RUN_GATE=1 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_REAL_SCENE_PERF=0 \
STEP170_APPEND_REPORT=0 \
STEP176_APPEND_REPORT=0 \
EDITOR_SMOKE_LIMIT=4 \
GATE_SMOKE_LIMIT=4 \
EDITOR_SMOKE_GENERATE_CASES=1 \
EDITOR_SMOKE_GENERATED_MIN_CASES=4 \
EDITOR_SMOKE_PRIORITY_SET=P0,P1 \
EDITOR_SMOKE_TAG_ANY=text-heavy,arc-heavy,polyline-heavy,import-stress \
GATE_SMOKE_PRIORITY_SET=P0,P1 \
GATE_SMOKE_TAG_ANY=text-heavy,arc-heavy,polyline-heavy,import-stress \
SUMMARY_JSON=build/editor_weekly_validation_summary_step185_casegen_gate.json \
SUMMARY_MD=build/editor_weekly_validation_summary_step185_casegen_gate.md \
bash tools/editor_weekly_validation.sh

python3 tools/write_step170_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary_step185_casegen_gate.json \
  --step170-report docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md
python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary_step185_casegen_gate.json \
  --report docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md
python3 tools/write_step176_dashboard.py
```

### Result
- static checks: PASS.
- weekly observe+gate run PASS:
  - observe editor_smoke run_id: `20260228_135333_291_a136`
  - observe STEP166 run_id: `20260228_055334` (`gate_would_fail=False`)
  - gate editor_smoke run_id: `20260228_135508_362_203d`
  - gate STEP166 run_id: `20260228_055511` (`gate_would_fail=False`)
  - weekly summary: `build/editor_weekly_validation_summary_step185_casegen_gate.json`
- gate-pool provenance behavior:
  - observe pool:
    - `inputs.editor_smoke_case_source=generated`
    - `inputs.editor_smoke_cases=local/editor_roundtrip_smoke_cases_weekly.json`
    - generated count=`4`, run_ids=`[20260228_054752,20260228_042350]`
  - post-STEP166 gate regeneration attempt:
    - `inputs.gate_editor_smoke_generated_cases_path=local/editor_roundtrip_smoke_cases_weekly_gate.json`
    - generated count=`2`, run_ids=`[20260228_055334]`
  - because regenerated gate count `< min_cases(4)`, gate kept forwarded observe pool:
    - `inputs.gate_editor_smoke_cases=local/editor_roundtrip_smoke_cases_weekly.json`
    - `inputs.gate_editor_smoke_case_source=generated`
- report/dashboard verification:
  - STEP170 append includes:
    - `gate_case_source`
    - `gate_generated_cases`
    - `gate_generated_runs`
  - STEP176 append includes:
    - `gate_editor_smoke_cases`
    - `gate_editor_smoke_generated_cases`
    - `gate_editor_smoke_generated_runs`
  - dashboard:
    - latest gate now shows `editor_smoke_cases source/cases/limit` + `editor_smoke_case_selection`.
    - gate history editor column now includes `src=<case_source>`.

## BB) Lane A+C filtered case-pool densification + nightly provenance fields

### Commands
```bash
python3 -m py_compile tools/generate_editor_roundtrip_cases.py
node --check tools/web_viewer/scripts/editor_roundtrip_smoke.js
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/cadgamefusion_editor_nightly.yml")'

python3 tools/generate_editor_roundtrip_cases.py \
  --limit 8 \
  --priorities P0,P1 \
  --out local/editor_roundtrip_smoke_cases_step185.json

node tools/web_viewer/scripts/editor_roundtrip_smoke.js \
  --mode observe \
  --cases local/editor_roundtrip_smoke_cases_step185.json \
  --limit 8 \
  --priority-set P0,P1 \
  --tag-any text-heavy,arc-heavy,polyline-heavy,import-stress \
  --no-convert

EDITOR_GATE_PROFILE=lite \
EDITOR_SMOKE_CASES=local/editor_roundtrip_smoke_cases_step185.json \
EDITOR_SMOKE_LIMIT=8 \
EDITOR_SMOKE_PRIORITY_SET=P0,P1 \
EDITOR_SMOKE_TAG_ANY=text-heavy,arc-heavy,polyline-heavy,import-stress \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_PERF_TREND=0 \
RUN_REAL_SCENE_TREND=0 \
EDITOR_GATE_APPEND_REPORT=0 \
STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_step185_casepool.json \
bash tools/editor_gate.sh

python3 tools/write_ci_artifact_summary.py \
  --title "cadgamefusion-editor-nightly" \
  --mode observe \
  --gate-summary build/editor_gate_summary_step185_casepool.json \
  --roundtrip-summary build/editor_roundtrip/20260228_133910_993_961d/summary.json \
  --out build/ci_editor_nightly_summary_step185_casepool.md
```

### Result
- syntax/static checks: PASS.
- case generation now spans multiple recent STEP166 runs:
  - `selected_run_id=20260228_042350`
  - `selected_run_ids=20260228_042350,20260228_042208,20260228_040828,20260228_040645`
  - `cases=8`
- generated cases now carry aligned tags for filter matching:
  - sample tag distribution: `text-heavy=8`, `arc-heavy=8`
  - duplicate base names are disambiguated (`@<run_id>` suffix), so case names remain unique.
- direct roundtrip smoke (filtered):
  - run_id: `20260228_133900_639_5de9`
  - `case_selection selected=8 matched=8 candidate=8 total=8 fallback=0`
  - totals: `pass=8 fail=0 skipped=0`
- gate integration (lite profile, filtered explicit cases):
  - summary: `build/editor_gate_summary_step185_casepool.json`
  - editor_smoke run_id: `20260228_133910_993_961d`
  - gate decision: `would_fail=false`
  - `editor_smoke.case_selection.used_fallback=false`
  - `editor_smoke.case_selection.selected_count=8`
  - `editor_smoke.case_selection.matched_count=8`
- CI summary check:
  - `build/ci_editor_nightly_summary_step185_casepool.md` contains:
    - `editor_smoke_filters: priority_set=P0,P1 tag_any=text-heavy,arc-heavy,polyline-heavy,import-stress`
    - `editor_smoke_case_selection: selected=8 matched=8 candidate=8 total=8 fallback=false`
- nightly workflow contract check:
  - `.github/workflows/cadgamefusion_editor_nightly.yml` now exports:
    - `editor_smoke_generated_run_id`
    - `editor_smoke_generated_run_ids`
  - and appends both fields into Step Summary.

## BE) Lane A generated-count consistency hardening + consumer propagation

### Commands
```bash
bash -n tools/editor_gate.sh tools/local_ci.sh
python3 -m py_compile \
  tools/write_ci_artifact_summary.py \
  tools/write_editor_gate_report.py \
  tools/write_step176_gate_report.py \
  tools/write_step176_dashboard.py

EDITOR_GATE_PROFILE=lite \
EDITOR_SMOKE_LIMIT=4 \
EDITOR_SMOKE_CASE_SOURCE=generated \
EDITOR_SMOKE_GENERATED_CASES_PATH=local/editor_roundtrip_smoke_cases_nightly.json \
EDITOR_SMOKE_GENERATED_COUNT=5 \
EDITOR_SMOKE_GENERATED_MIN_CASES=4 \
EDITOR_SMOKE_GENERATED_PRIORITIES=P0,P1 \
EDITOR_SMOKE_GENERATED_RUN_ID=20260228_042350 \
EDITOR_SMOKE_GENERATED_RUN_IDS=20260228_042350,20260228_042208 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_PERF_TREND=0 \
RUN_REAL_SCENE_TREND=0 \
EDITOR_GATE_APPEND_REPORT=0 \
STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_step186_gen_consistency.json \
bash tools/editor_gate.sh

python3 tools/write_ci_artifact_summary.py \
  --title "cadgamefusion-editor-nightly" \
  --mode observe \
  --gate-summary build/editor_gate_summary_step186_gen_consistency.json \
  --roundtrip-summary build/editor_roundtrip/20260228_191018_671_f1cc/summary.json \
  --out build/ci_editor_nightly_summary_step186_gen_consistency.md

RUN_EDITOR_GATE=1 \
EDITOR_GATE_PROFILE=lite \
RUN_EDITOR_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
bash tools/local_ci.sh --quick --offline --skip-compare

bash tools/check_local_summary.sh --offline-allowed
```

### Result
- static checks: PASS.
- mismatch scenario gate run PASS:
  - run_id: `20260228_191018_671_f1cc`
  - summary: `build/editor_gate_summary_step186_gen_consistency.json`
  - emitted warning:
    - generated case file missing for declared count
  - summary provenance fields:
    - `editor_smoke.generated_count=0`
    - `editor_smoke.generated_count_declared=5`
    - `editor_smoke.generated_count_actual=0`
    - `editor_smoke.generated_count_mismatch=true`
- CI summary render PASS:
  - `build/ci_editor_nightly_summary_step186_gen_consistency.md` now includes:
    - `editor_smoke_generated_cases: path/count/declared/actual/mismatch/min/priorities`
- local CI propagation PASS:
  - local gate run_id: `20260228_191213_804_5190`
  - `build/local_ci_summary.json` includes:
    - `editorGateEditorSmokeGeneratedCount`
    - `editorGateEditorSmokeGeneratedCountDeclared`
    - `editorGateEditorSmokeGeneratedCountActual`
    - `editorGateEditorSmokeGeneratedCountMismatch`
  - `tools/check_local_summary.sh --offline-allowed`: PASS.

## BF) Lane A remote nightly dispatch verification (observe+gate)

### Commands
```bash
cd /Users/huazhou/Downloads/Github/VemCAD
gh workflow run cadgamefusion-editor-nightly --ref main -f mode=observe -f smoke_limit=8
gh workflow run cadgamefusion-editor-nightly --ref main -f mode=gate -f smoke_limit=8
gh run view 22520206217
gh run view 22520213387
```

### Result
- dispatch API compatibility check:
  - remote rejected `upload_artifacts` input (`HTTP 422`) -> indicates remote workflow file has not yet picked up local input expansion.
- observe run: `22520206217`
  - URL: `https://github.com/zensgit/VemCAD/actions/runs/22520206217`
  - conclusion: `failure`
  - annotation: `The job was not started because an Actions budget is preventing further use.`
- gate run: `22520213387`
  - URL: `https://github.com/zensgit/VemCAD/actions/runs/22520213387`
  - conclusion: `failure`
  - annotation: `The job was not started because an Actions budget is preventing further use.`
- decision:
  - remote nightly evidence captured, but blocked by org/repo budget quota; local/weekly validation remains authoritative this round.

## BG) Lane A+C mismatch warning propagation in trend summaries

### Commands
```bash
python3 tools/editor_case_selection_trend.py \
  --history-dir build/editor_gate_history \
  --windows 7,14 \
  --out-json build/editor_case_selection_trend_step186.json \
  --out-md build/editor_case_selection_trend_step186.md

python3 tools/editor_gate_trend.py \
  --history-dir build/editor_gate_history \
  --days 7 \
  --out-json build/editor_gate_trend_step186.json \
  --out-md build/editor_gate_trend_step186.md
```

### Result
- case-selection trend output now includes mismatch rollups:
  - `generated_count_mismatch_runs_total=2`
  - `generated_count_mismatch_rate_max=0.012`
  - `warning_codes=[GENERATED_COUNT_MISMATCH]`
- gate trend output now includes provenance mismatch metrics:
  - `metrics.case_source.generated_count_mismatch_runs=1`
  - `metrics.case_source.generated_count_mismatch_rate=0.012048...`
  - recent run rows include per-run declared/actual/mismatch fields.
- markdown reports now render mismatch lines:
  - `build/editor_case_selection_trend_step186.md`
  - `build/editor_gate_trend_step186.md`

## BH) Weekly integration with mismatch-aware generated provenance

### Commands
```bash
RUN_GATE=1 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_REAL_SCENE_PERF=0 \
STEP170_APPEND_REPORT=0 \
STEP176_APPEND_REPORT=0 \
SUMMARY_JSON=build/editor_weekly_validation_summary_step186_parallel.json \
SUMMARY_MD=build/editor_weekly_validation_summary_step186_parallel.md \
bash tools/editor_weekly_validation.sh

python3 tools/write_step170_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary_step186_parallel.json \
  --step170-report docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md
python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary_step186_parallel.json \
  --report docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md
python3 tools/write_step176_dashboard.py
```

### Result
- weekly run PASS:
  - observe editor_smoke run_id: `20260228_195854_116_f495`
  - observe STEP166 run_id: `20260228_115858`
  - gate editor_smoke run_id: `20260228_200039_043_8ff7`
  - gate STEP166 run_id: `20260228_120043`
  - weekly summary: `build/editor_weekly_validation_summary_step186_parallel.json`
- mismatch-aware weekly markdown generated:
  - `build/editor_weekly_validation_summary_step186_parallel.md` includes:
    - observe: `count/declared/actual/mismatch`
    - gate: `count/declared/actual/mismatch`
    - trend: `mismatch_runs`, `mismatch_rate_max`, `case_selection_trend_warnings`
    - trend windows include `mm=<rate>`.
- report/dashboard propagation PASS:
  - STEP170 weekly append includes generated mismatch detail.
  - STEP176 weekly append includes generated mismatch detail and trend warnings.
  - STEP176 dashboard weekly `case_sel` column now adds `:mm=<runs>` when mismatch is present.

## BI) Lane B UI-flow regression sanity after parallel changes

### Commands
```bash
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate
```

### Result
- UI-flow gate PASS:
  - summary: `build/editor_ui_flow_smoke/20260228_200317_ui_flow/summary.json`
  - run_id: `20260228_200317_ui_flow`
  - `ok=true`
  - `flow_failure_code` empty.

## BJ) 3-lane orchestration runner validation (single-command cycle)

### Commands
```bash
bash -n tools/editor_parallel_cycle.sh

OUT_DIR=build/editor_parallel_cycle/step186_cycle2 \
SUMMARY_JSON=build/editor_parallel_cycle/step186_cycle2/summary.json \
SUMMARY_MD=build/editor_parallel_cycle/step186_cycle2/summary.md \
LANE_A_LIMIT=6 \
LANE_A_RUN_UI_FLOW=0 \
LANE_A_RUN_STEP166=0 \
LANE_B_RUN_UI_FLOW=1 \
LANE_B_UI_FLOW_MODE=gate \
LANE_C_WINDOWS=7,14 \
LANE_C_DAYS=7 \
bash tools/editor_parallel_cycle.sh
```

### Result
- orchestration runner PASS:
  - run_id: `20260228_202407`
  - summary_json: `build/editor_parallel_cycle/step186_cycle2/summary.json`
  - summary_md: `build/editor_parallel_cycle/step186_cycle2/summary.md`
  - overall_status: `pass`
- Lane A PASS:
  - profile: `lite`
  - gate summary: `build/editor_parallel_cycle/step186_cycle2/editor_gate_summary.json`
- Lane B PASS:
  - node test log: `build/editor_parallel_cycle/step186_cycle2/lane_b_node_tests.log`
  - ui-flow summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260228_202409_ui_flow/summary.json`
- Lane C PASS:
  - case selection trend: `build/editor_parallel_cycle/step186_cycle2/editor_case_selection_trend.json`
  - gate trend: `build/editor_parallel_cycle/step186_cycle2/editor_gate_trend.json`

## BK) local_ci parallel-cycle entry + gate-decision field verification

### Commands
```bash
bash -n tools/editor_parallel_cycle.sh tools/local_ci.sh tools/check_local_summary.sh

RUN_EDITOR_PARALLEL_CYCLE=1 \
RUN_EDITOR_GATE=0 \
RUN_EDITOR_SMOKE=0 \
RUN_EDITOR_SMOKE_GATE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
PARALLEL_CYCLE_RUN_LANE_A=1 \
PARALLEL_CYCLE_RUN_LANE_B=1 \
PARALLEL_CYCLE_RUN_LANE_C=1 \
PARALLEL_CYCLE_LANE_A_LIMIT=4 \
PARALLEL_CYCLE_LANE_A_RUN_STEP166=0 \
PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW=0 \
bash tools/local_ci.sh --quick --offline --skip-compare

bash tools/check_local_summary.sh --offline-allowed
```

### Result
- syntax checks: PASS.
- local_ci parallel cycle path: PASS
  - local CI summary: `build/local_ci_summary.json`
  - parallel cycle summary json: `build/editor_parallel_cycle_summary.json`
  - parallel cycle summary md: `build/editor_parallel_cycle_summary.md`
  - run_id: `20260228_215013`
- gate-decision fields present and parsed:
  - `editorParallelCycleStatus=ok`
  - `editorParallelCycleGateDecision=watch`
  - `editorParallelCycleGateShouldMerge=false`
- `editorParallelCycleGateWarningCodes=GENERATED_COUNT_MISMATCH`
- `check_local_summary.sh --offline-allowed`: PASS (includes parallel-cycle status/decision output).

## BL) parallel-cycle watch policy escalation verification (observe -> gate)

### Commands
```bash
RUN_LANE_A=1 \
RUN_LANE_B=0 \
RUN_LANE_C=1 \
LANE_A_GATE_SUMMARY=build/editor_gate_summary.json \
PARALLEL_WATCH_POLICY=observe \
OUT_DIR=build/editor_parallel_cycle/step186_policy_observe \
SUMMARY_JSON=build/editor_parallel_cycle/step186_policy_observe/summary.json \
SUMMARY_MD=build/editor_parallel_cycle/step186_policy_observe/summary.md \
bash tools/editor_parallel_cycle.sh

set +e
RUN_LANE_A=1 \
RUN_LANE_B=0 \
RUN_LANE_C=1 \
LANE_A_GATE_SUMMARY=build/editor_gate_summary.json \
PARALLEL_WATCH_POLICY=gate \
OUT_DIR=build/editor_parallel_cycle/step186_policy_gate \
SUMMARY_JSON=build/editor_parallel_cycle/step186_policy_gate/summary.json \
SUMMARY_MD=build/editor_parallel_cycle/step186_policy_gate/summary.md \
bash tools/editor_parallel_cycle.sh
echo rc=$?
set -e
```

### Result
- observe policy run:
  - run_id: `20260228_220645`
  - decision: `watch`
  - overall_status: `pass`
  - exit code: `0`
- gate policy run:
  - run_id: `20260228_220654`
  - decision: `fail` (watch escalated)
  - overall_status: `fail`
  - exit code: `1` (expected)
- summary fields validated:
  - `gate_decision.raw_decision`
  - `gate_decision.watch_policy`
  - `gate_decision.watch_escalated`

## BM) CI markdown parallel section rendering + workflow wiring

### Commands
```bash
python3 -m py_compile tools/write_ci_artifact_summary.py

ROUNDTRIP_SUMMARY="$(ls -1t build/editor_roundtrip/*/summary.json | head -n 1)"
python3 tools/write_ci_artifact_summary.py \
  --title "parallel-test" \
  --mode observe \
  --gate-summary build/editor_gate_summary.json \
  --parallel-summary build/editor_parallel_cycle/step186_policy_observe/summary.json \
  --roundtrip-summary "$ROUNDTRIP_SUMMARY" \
  --out build/ci_editor_parallel_summary_test.md
```

### Result
- compile check: PASS.
- generated markdown: `build/ci_editor_parallel_summary_test.md`
- `Parallel Cycle` section rendered with:
  - decision/raw/watch_policy/watch_escalated/should_merge
  - fail_reasons/warning_codes/failure_codes
  - lane statuses (`A/B/B.ui/C`)
- workflow updates landed:
  - nightly now generates and uploads `editor_parallel_cycle_nightly_*` summaries and passes `--parallel-summary` to CI markdown.
  - light now generates lane-C parallel summary and passes `--parallel-summary` to CI markdown.

## BN) local_ci watch-policy behavior + summary checker gating

### Commands
```bash
RUN_EDITOR_PARALLEL_CYCLE=1 \
RUN_EDITOR_GATE=0 \
RUN_EDITOR_SMOKE=0 \
RUN_EDITOR_SMOKE_GATE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
PARALLEL_CYCLE_RUN_LANE_A=1 \
PARALLEL_CYCLE_RUN_LANE_B=0 \
PARALLEL_CYCLE_RUN_LANE_C=1 \
PARALLEL_CYCLE_LANE_A_LIMIT=4 \
PARALLEL_CYCLE_LANE_A_RUN_STEP166=0 \
PARALLEL_CYCLE_WATCH_POLICY=gate \
bash tools/local_ci.sh --quick --offline --skip-compare

set +e
bash tools/check_local_summary.sh --offline-allowed
echo rc=$?
set -e

# restore non-blocking summary for next cycles
RUN_EDITOR_PARALLEL_CYCLE=1 \
RUN_EDITOR_GATE=0 \
RUN_EDITOR_SMOKE=0 \
RUN_EDITOR_SMOKE_GATE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
PARALLEL_CYCLE_RUN_LANE_A=1 \
PARALLEL_CYCLE_RUN_LANE_B=0 \
PARALLEL_CYCLE_RUN_LANE_C=1 \
PARALLEL_CYCLE_LANE_A_LIMIT=4 \
PARALLEL_CYCLE_LANE_A_RUN_STEP166=0 \
PARALLEL_CYCLE_WATCH_POLICY=observe \
bash tools/local_ci.sh --quick --offline --skip-compare
bash tools/check_local_summary.sh --offline-allowed
```

### Result
- `PARALLEL_CYCLE_WATCH_POLICY=gate` run:
  - local_ci summary reports `editorParallelCycleStatus=fail`
  - gate details: `decision=fail raw=watch watch_escalated=true`
  - summary checker returns `rc=2` (blocking as expected)
- restore run with `PARALLEL_CYCLE_WATCH_POLICY=observe`:
  - local_ci summary returns `parallelStatus=ok`
  - checker returns PASS

## BO) Fillet/Chamfer two-target preselection one-click verification

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js

bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh \
  --mode observe \
  --outdir build/editor_ui_flow_smoke_pair_preselect

EDITOR_GATE_PROFILE=lite \
EDITOR_SMOKE_LIMIT=3 \
RUN_EDITOR_UI_FLOW_SMOKE=1 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 \
RUN_STEP166_GATE=0 \
RUN_PERF_TREND=0 \
RUN_REAL_SCENE_TREND=0 \
STEP170_APPEND_REPORT=0 \
STEP176_APPEND_REPORT=0 \
bash tools/editor_gate.sh
```

### Result
- command tests: PASS (`101/101`).
- UI-flow preselection run: PASS.
  - run_id: `20260301_124418_ui_flow`
  - summary: `build/editor_ui_flow_smoke_pair_preselect/summary.json`
  - `fillet_chamfer_preselection` fields:
    - `filletPairPromptSecond=true`
    - `filletPairApplied=true`
    - `filletPairArcCount=1`
    - `chamferPairPromptSecond=true`
    - `chamferPairApplied=true`
    - `chamferPairLineCount=3`
- gate integration checkpoint: PASS.
  - editor smoke run_id: `20260301_124654_597_bec1`
  - ui-flow gate runs: `20260301_124527_ui_flow`, `20260301_124611_ui_flow`
  - no new failure code introduced in this change.

## BP) Parallel lane-B UI-flow cycle checkpoint

### Command
```bash
RUN_LANE_A=0 \
RUN_LANE_B=1 \
RUN_LANE_C=0 \
LANE_B_RUN_UI_FLOW=1 \
LANE_B_UI_FLOW_MODE=observe \
OUT_DIR=build/editor_parallel_cycle_laneb_ui \
SUMMARY_JSON=build/editor_parallel_cycle_laneb_ui_summary.json \
SUMMARY_MD=build/editor_parallel_cycle_laneb_ui_summary.md \
bash tools/editor_parallel_cycle.sh
```

### Result
- run_id: `20260301_124821`
- overall_status: `pass`
- gate_decision: `pass`
- summary artifacts:
  - `build/editor_parallel_cycle_laneb_ui_summary.json`
  - `build/editor_parallel_cycle_laneb_ui_summary.md`

## BQ) UI-flow interaction attribution fields + report propagation

### Commands
```bash
bash -n tools/web_viewer/scripts/editor_ui_flow_smoke.sh tools/editor_gate.sh tools/editor_weekly_validation.sh
python3 -m py_compile \
  tools/write_editor_gate_report.py \
  tools/write_step170_weekly_report.py \
  tools/write_step176_gate_report.py \
  tools/write_step176_weekly_report.py \
  tools/write_step176_dashboard.py

node --test tools/web_viewer/tests/editor_commands.test.js

bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh \
  --mode observe \
  --outdir build/editor_ui_flow_smoke_interaction_fields

EDITOR_GATE_PROFILE=lite \
EDITOR_SMOKE_LIMIT=2 \
RUN_EDITOR_UI_FLOW_SMOKE=1 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 \
RUN_STEP166_GATE=0 \
RUN_PERF_TREND=0 \
RUN_REAL_SCENE_TREND=0 \
STEP170_APPEND_REPORT=0 \
STEP176_APPEND_REPORT=0 \
bash tools/editor_gate.sh

python3 tools/write_step176_gate_report.py \
  --gate-summary build/editor_gate_summary.json \
  --report build/step176_gate_tmp.md
python3 tools/write_editor_gate_report.py \
  --gate-summary build/editor_gate_summary.json \
  --step170-report build/step170_gate_tmp.md
python3 tools/write_step170_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --step170-report build/step170_weekly_tmp.md
python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --report build/step176_weekly_tmp.md
python3 tools/write_step176_dashboard.py --out build/step176_dashboard_tmp.md
```

### Result
- syntax/compile checks: PASS.
- command tests: PASS (`101/101`).
- UI-flow observe: PASS.
  - run_id: `20260301_131149_ui_flow`
  - summary: `build/editor_ui_flow_smoke_interaction_fields/summary.json`
  - `interaction_checks.complete=true`
  - pair checks: `fillet_pair_preselection_ok=true`, `chamfer_pair_preselection_ok=true`
- editor gate: PASS.
  - ui-flow run_ids: `20260301_131443_ui_flow`, `20260301_131524_ui_flow`
  - editor smoke run_id: `20260301_131606_844_8b60`
  - `build/editor_gate_summary.json` now contains:
    - `ui_flow_smoke.interaction_checks_coverage`
    - `ui_flow_smoke.interaction_checks_complete=true`
- report propagation: PASS.
  - generated temp reports include interaction-check lines:
    - `build/step170_gate_tmp.md`
    - `build/step176_gate_tmp.md`
    - `build/step170_weekly_tmp.md`
    - `build/step176_weekly_tmp.md`
    - `build/step176_dashboard_tmp.md`

## BR) Weekly pipeline integration (interaction coverage in weekly JSON/MD)

### Command
```bash
EDITOR_SMOKE_LIMIT=1 \
RUN_EDITOR_UI_FLOW_SMOKE=1 \
EDITOR_UI_FLOW_MODE=observe \
EDITOR_UI_FLOW_SMOKE_GATE_RUNS=1 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_REAL_SCENE_PERF=0 \
RUN_STEP166_BASELINE_REFRESH=0 \
RUN_GATE=0 \
CAD_MAX_WORKERS=1 \
STEP176_APPEND_REPORT=0 \
STEP170_APPEND_REPORT=0 \
bash tools/editor_weekly_validation.sh
```

### Result
- weekly run: PASS.
  - ui-flow run_id: `20260301_132207_ui_flow`
  - editor smoke run_id: `20260301_132248_340_a2c2`
  - step166 run_id: `20260301_052248`
  - weekly summary: `build/editor_weekly_validation_summary.json`
- weekly JSON now carries:
  - `ui_flow_smoke.interaction_checks_coverage` (11 keys)
  - `ui_flow_smoke.interaction_checks_complete=true`
  - `ui_flow_smoke.failure_code_total=0`
- weekly report renderers verified against latest summary:
  - `build/step170_weekly_tmp.md` contains `interaction_checks` line.
  - `build/step176_weekly_tmp.md` contains `ui_flow_interaction_checks` line.

## BS) Fillet/Chamfer cross-layer usability checkpoint

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js

bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh \
  --mode observe \
  --outdir build/editor_ui_flow_smoke_step186_crosslayer

EDITOR_GATE_PROFILE=lite \
EDITOR_SMOKE_LIMIT=2 \
RUN_STEP166_GATE=0 \
RUN_PERF_TREND=0 \
RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_GATE_APPEND_REPORT=0 \
STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_step186_crosslayer.json \
bash tools/editor_gate.sh
```

### Result
- command tests: PASS (`104/104`).
  - new assertions added:
    - `selection.filletByPick supports unlocked cross-layer targets`
    - `selection.filletByPick rejects locked layer in cross-layer mode`
    - `selection.chamferByPick supports unlocked cross-layer targets`
- UI-flow observe: PASS.
  - run_id: `20260301_141108_ui_flow`
  - summary: `build/editor_ui_flow_smoke_step186_crosslayer2/summary.json`
  - `ok=true`, `flow_failure_code=''`
  - cross-layer fields:
    - `filletCrossLayerApplied=true`, `filletCrossLayerArcCount=1`
    - `chamferCrossLayerApplied=true`, `chamferCrossLayerLineCount=3`
  - interaction checks include:
    - `fillet_cross_layer_preselection_ok=true`
    - `chamfer_cross_layer_preselection_ok=true`
- editor gate (lite): PASS.
  - ui-flow run_ids: `20260301_141204_ui_flow`
  - editor smoke run_id: `20260301_141247_236_09c4`
  - summary: `build/editor_gate_summary_step186_crosslayer_ui.json`
  - `gate_decision.would_fail=false`
  - `ui_flow_smoke.interaction_checks_complete=true`
  - `ui_flow_smoke.interaction_checks_coverage` includes:
    - `fillet_cross_layer_preselection_ok: pass_runs=1/1`
    - `chamfer_cross_layer_preselection_ok: pass_runs=1/1`

## BT) Cross-layer regression expansion (selection.fillet / selection.chamfer)

### Command
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
```

### Result
- PASS (`108/108`).
- Added/covered extra command-level scenarios:
  - `selection.fillet supports unlocked cross-layer lines`
  - `selection.fillet rejects locked secondary layer in cross-layer mode`
  - `selection.chamfer supports unlocked cross-layer lines`
  - `selection.chamfer rejects locked secondary layer in cross-layer mode`
- This closes the gap between `ByPick` path and direct selection command path.

## BU) Parallel cycle checkpoint (Lane B + Lane C)

### Command
```bash
RUN_LANE_A=0 \
RUN_LANE_B=1 \
RUN_LANE_C=1 \
LANE_B_RUN_UI_FLOW=1 \
LANE_B_UI_FLOW_MODE=observe \
OUT_DIR=build/editor_parallel_cycle_step186_crosslayer \
SUMMARY_JSON=build/editor_parallel_cycle_step186_crosslayer.json \
SUMMARY_MD=build/editor_parallel_cycle_step186_crosslayer.md \
bash tools/editor_parallel_cycle.sh
```

### Result
- run_id: `20260301_230700`
- overall_status: `pass`
- decision: `watch` (`watch_policy=observe`)
- lane status:
  - lane_b: `pass` (node tests + ui-flow observe)
    - ui-flow summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260301_230701_ui_flow/summary.json`
  - lane_c: `pass` (case-selection trend + gate trend artifacts emitted)

## BV) Full-profile gate checkpoint (with STEP166)

### Command
```bash
EDITOR_GATE_PROFILE=full \
EDITOR_SMOKE_LIMIT=1 \
RUN_PERF_TREND=0 \
RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_UI_FLOW_SMOKE_GATE_RUNS=1 \
EDITOR_GATE_APPEND_REPORT=0 \
STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_step186_full_crosslayer.json \
bash tools/editor_gate.sh
```

### Result
- gate run: PASS.
  - ui-flow run_id: `20260301_231958_ui_flow`
  - editor smoke run_id: `20260301_232044_321_c899`
  - step166 run_id: `20260301_152046`
  - summary: `build/editor_gate_summary_step186_full_crosslayer.json`
- key checks:
  - `gate_decision.would_fail=false`
  - `step166.enabled=true`
  - `step166.baseline_compare.degraded_cases=0`
  - `ui_flow_smoke.interaction_checks_complete=true`
  - cross-layer interaction coverage:
    - `fillet_cross_layer_preselection_ok: pass_runs=1/1`
    - `chamfer_cross_layer_preselection_ok: pass_runs=1/1`

## BW) Gate summary `inputs` block validation

### Command
```bash
EDITOR_GATE_PROFILE=lite \
EDITOR_SMOKE_LIMIT=1 \
RUN_STEP166_GATE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_PERF_TREND=0 \
RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_GATE_APPEND_REPORT=0 \
STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_step186_inputs.json \
bash tools/editor_gate.sh
```

### Result
- gate run: PASS.
  - editor smoke run_id: `20260301_232305_942_091f`
  - summary: `build/editor_gate_summary_step186_inputs.json`
- `inputs` block present and populated:
  - `editor_gate_profile=lite`
  - `editor_smoke_limit=1`
  - `editor_smoke_no_convert=true`
  - `run_step166_gate=false`
  - `run_editor_ui_flow_smoke_gate=false`
  - `run_perf_trend=false`
  - `run_real_scene_trend=false`

## BX) Gate report propagation for `gate_inputs`

### Command
```bash
python3 -m py_compile \
  tools/write_editor_gate_report.py \
  tools/write_step176_gate_report.py

python3 tools/write_editor_gate_report.py \
  --gate-summary build/editor_gate_summary_step186_inputs.json \
  --step170-report build/step170_gate_step186_inputs.md

python3 tools/write_step176_gate_report.py \
  --gate-summary build/editor_gate_summary_step186_inputs.json \
  --report build/step176_gate_step186_inputs.md
```

### Result
- compile: PASS
- report generation: PASS
- both rendered reports contain:
  - `gate_inputs: profile=lite step166=False ui_flow_gate=False convert_disabled=True`
  - files:
    - `build/step170_gate_step186_inputs.md`
    - `build/step176_gate_step186_inputs.md`

## BY) Weekly full chain with gate runtime fields (observe + gate)

### Commands
```bash
RUN_GATE=1 \
EDITOR_SMOKE_LIMIT=1 \
GATE_SMOKE_LIMIT=1 \
EDITOR_UI_FLOW_SMOKE_GATE_RUNS=1 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_REAL_SCENE_PERF=0 \
RUN_STEP166_BASELINE_REFRESH=0 \
STEP170_APPEND_REPORT=0 \
STEP176_APPEND_REPORT=0 \
SUMMARY_JSON=build/editor_weekly_validation_summary_step186_gateinputs_gateon2.json \
SUMMARY_MD=build/editor_weekly_validation_summary_step186_gateinputs_gateon2.md \
bash tools/editor_weekly_validation.sh
```

### Result
- weekly run: PASS.
  - observe editor smoke run_id: `20260301_233523_283_b5e8`
  - observe STEP166 run_id: `20260301_153523`
  - gate status: `ok`
  - gate editor smoke run_id: `20260301_233726_308_97ca`
  - gate ui-flow run_ids: `20260301_233642_ui_flow`
  - gate STEP166 run_id: `20260301_153727`
  - summary: `build/editor_weekly_validation_summary_step186_gateinputs_gateon2.json`
  - markdown: `build/editor_weekly_validation_summary_step186_gateinputs_gateon2.md`
- runtime fields now present in weekly summary `inputs`:
  - `gate_editor_profile` (empty => `<none>` in report rendering)
  - `gate_run_step166_gate=true`
  - `gate_run_editor_ui_flow_smoke_gate=true`
  - `gate_editor_smoke_no_convert=false`
  - `gate_run_perf_trend=false`
  - `gate_run_real_scene_trend=false`

### Intermediate issue (fixed)
- First attempt failed with `NameError: name 'gate' is not defined` in weekly markdown generation.
- Fix applied in `tools/editor_weekly_validation.sh` by switching to `payload['gate']` access for runtime-input formatting.

## BZ) Weekly report propagation for `gate_runtime`

### Commands
```bash
python3 -m py_compile \
  tools/write_step170_weekly_report.py \
  tools/write_step176_weekly_report.py

python3 tools/write_step170_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary_step186_gateinputs_gateon2.json \
  --step170-report build/step170_weekly_step186_gateinputs.md

python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary_step186_gateinputs_gateon2.json \
  --report build/step176_weekly_step186_gateinputs.md
```

### Result
- compile: PASS
- report generation: PASS
- both reports include:
  - `gate_runtime: profile=<none> step166_gate=True ui_flow_gate=True convert_disabled=False perf_trend=False real_scene_trend=False`
  - files:
    - `build/step170_weekly_step186_gateinputs.md`
    - `build/step176_weekly_step186_gateinputs.md`

## CA) Dashboard propagation for gate runtime fields

### Commands
```bash
python3 -m py_compile tools/write_step176_dashboard.py

python3 tools/write_step176_dashboard.py \
  --out build/step176_dashboard_step186_runtime.md

rg -n "gate_inputs|runtime|gate_runtime" build/step176_dashboard_step186_runtime.md
```

### Result
- compile: PASS
- dashboard generation: PASS
- output includes runtime traceability surfaces:
  - `Latest Gate` has `gate_inputs: profile/step166_gate/ui_flow_gate/convert_disabled/perf_trend/real_scene_trend`
  - `Gate History (Recent)` has `runtime` column
  - `Weekly History (Recent)` has `gate_runtime` column
- output file:
  - `build/step176_dashboard_step186_runtime.md`

## CB) CI artifact summary propagation for `gate_inputs`

### Commands
```bash
python3 -m py_compile tools/write_ci_artifact_summary.py

python3 tools/write_ci_artifact_summary.py \
  --mode gate \
  --gate-summary build/editor_gate_summary_step186_inputs.json \
  --parallel-summary build/editor_parallel_cycle_step186_crosslayer.json \
  --out build/ci_artifact_step186_runtime.md

rg -n "gate_inputs|decision" build/ci_artifact_step186_runtime.md
```

### Result
- compile: PASS
- summary generation: PASS
- `Editor Gate` section now contains:
  - `gate_inputs: profile=lite step166_gate=false ui_flow_gate=false convert_disabled=true perf_trend=false real_scene_trend=false`
- output file:
  - `build/ci_artifact_step186_runtime.md`

## CC) Parallel cycle lane-A runtime passthrough validation

### Commands
```bash
bash -n tools/editor_parallel_cycle.sh

RUN_LANE_A=1 \
RUN_LANE_B=0 \
RUN_LANE_C=0 \
LANE_A_GATE_SUMMARY=build/editor_gate_summary_step186_inputs.json \
OUT_DIR=build/editor_parallel_cycle_step186_runtime \
SUMMARY_JSON=build/editor_parallel_cycle_step186_runtime_summary.json \
SUMMARY_MD=build/editor_parallel_cycle_step186_runtime_summary.md \
bash tools/editor_parallel_cycle.sh
```

### Result
- shell syntax check: PASS
- parallel cycle run: PASS
  - run_id: `20260302_105505`
  - summary: `build/editor_parallel_cycle_step186_runtime_summary.json`
- `lanes.lane_a.runtime_inputs` present:
  - `editor_gate_profile=lite`
  - `editor_smoke_no_convert=true`
  - `run_step166_gate=false`
  - `run_editor_ui_flow_smoke_gate=false`
  - `run_perf_trend=false`
  - `run_real_scene_trend=false`

## CD) Precomputed gate fail detection fix (`gate_decision.would_fail`)

### Commands
```bash
python3 - <<'PY'
import json, pathlib
path = pathlib.Path("build/tmp_editor_gate_would_fail.json")
path.write_text(json.dumps({
  "generated_at": "2026-03-02T00:00:00Z",
  "gate_decision": {"would_fail": True, "exit_code": 2, "fail_reasons": ["EDITOR_SMOKE_FAIL"]},
  "editor_smoke": {"failure_code_counts": {"UI_FAIL": 1}},
  "ui_flow_smoke": {"failure_code_counts": {}}
}, indent=2) + "\n", encoding="utf-8")
print(path)
PY

RUN_LANE_A=1 \
RUN_LANE_B=0 \
RUN_LANE_C=0 \
LANE_A_GATE_SUMMARY=build/tmp_editor_gate_would_fail.json \
OUT_DIR=build/editor_parallel_cycle_step186_wouldfail \
SUMMARY_JSON=build/editor_parallel_cycle_step186_wouldfail.json \
SUMMARY_MD=build/editor_parallel_cycle_step186_wouldfail.md \
bash tools/editor_parallel_cycle.sh
```

### Result
- run exits non-zero as expected (`rc=1`).
- summary gate decision:
  - `decision=fail`
  - `fail_reasons` includes `EDITOR_GATE_WOULD_FAIL`
  - `failure_code_counts` contains forwarded `UI_FAIL=1`
- output files:
  - `build/editor_parallel_cycle_step186_wouldfail.json`
  - `build/editor_parallel_cycle_step186_wouldfail.md`

## CE) CI artifact summary propagation for `lane_a_runtime`

### Commands
```bash
python3 -m py_compile tools/write_ci_artifact_summary.py

python3 tools/write_ci_artifact_summary.py \
  --mode gate \
  --gate-summary build/editor_gate_summary_step186_inputs.json \
  --parallel-summary build/editor_parallel_cycle_step186_runtime_summary.json \
  --out build/ci_artifact_step186_parallel_runtime.md

rg -n "lane_a_runtime|gate_inputs|decision" build/ci_artifact_step186_parallel_runtime.md
```

### Result
- compile: PASS
- summary generation: PASS
- markdown now includes:
  - `gate_inputs: profile=lite ...`
  - `lane_a_runtime: profile=lite step166_gate=false ui_flow_gate=false convert_disabled=true perf_trend=false real_scene_trend=false`
- output file:
  - `build/ci_artifact_step186_parallel_runtime.md`

## CF) Parallel markdown runtime fallback when lane A skipped

### Commands
```bash
RUN_LANE_A=0 \
RUN_LANE_B=0 \
RUN_LANE_C=1 \
OUT_DIR=build/editor_parallel_cycle_step186_lanec2 \
SUMMARY_JSON=build/editor_parallel_cycle_step186_lanec2.json \
SUMMARY_MD=build/editor_parallel_cycle_step186_lanec2.md \
bash tools/editor_parallel_cycle.sh

rg -n "lane_a:|runtime" build/editor_parallel_cycle_step186_lanec2.md
```

### Result
- run: PASS (`gate_decision=watch`, observe policy).
- markdown no longer prints misleading default booleans for skipped lane A:
  - `lane_a: skipped ...`
  - `runtime: n/a`

## CG) Workflow YAML syntax validation (nightly/light)

### Command
```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/cadgamefusion_editor_nightly.yml"); YAML.load_file(".github/workflows/cadgamefusion_editor_light.yml"); puts "yaml_ok"'
```

### Result
- PASS (`yaml_ok`).
- Confirms workflow updates (runtime extraction snippets + step-summary append blocks) keep valid YAML structure.
- Confirms runtime line artifacts are part of upload path lists:
  - `deps/cadgamefusion/build/ci_editor_nightly_runtime_lines.md`
  - `deps/cadgamefusion/build/ci_editor_light_runtime_lines.md`

## CH) Step-summary runtime line extraction dry-run

### Commands
```bash
# nightly-style runtime lines
cd deps/cadgamefusion
export PARALLEL_SUMMARY=build/editor_parallel_cycle_step186_runtime2_summary.json
python3 - "${PARALLEL_SUMMARY:-}" <<'PY' > build/ci_editor_nightly_runtime_lines.stepcheck.md
import json
import sys
from pathlib import Path
def load_json(path_text):
    path_text = str(path_text or "").strip()
    if not path_text:
        return {}
    path = Path(path_text)
    if not path.is_absolute():
        path = Path.cwd() / path
    try:
        if path.exists() and path.is_file():
            payload = json.loads(path.read_text(encoding="utf-8"))
            return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}
    return {}
def as_dict(value):
    return value if isinstance(value, dict) else {}
def b(value):
    return "true" if bool(value) else "false"
gate = load_json("build/editor_gate_summary_step186_inputs.json")
inputs = as_dict(gate.get("inputs"))
parallel = load_json(sys.argv[1] if len(sys.argv) > 1 else "")
lane_a_runtime = as_dict(as_dict(as_dict(parallel.get("lanes")).get("lane_a")).get("runtime_inputs"))
print("- nightly_gate_runtime: `profile={}` `step166_gate={}` `ui_flow_gate={}` `convert_disabled={}` `perf_trend={}` `real_scene_trend={}`".format(
  str(inputs.get("editor_gate_profile") or "<none>"), b(inputs.get("run_step166_gate", False)), b(inputs.get("run_editor_ui_flow_smoke_gate", False)), b(inputs.get("editor_smoke_no_convert", False)), b(inputs.get("run_perf_trend", False)), b(inputs.get("run_real_scene_trend", False))))
if lane_a_runtime:
  print("- nightly_parallel_lane_a_runtime: `profile={}` `step166_gate={}` `ui_flow_gate={}` `convert_disabled={}` `perf_trend={}` `real_scene_trend={}`".format(
    str(lane_a_runtime.get("editor_gate_profile") or "<none>"), b(lane_a_runtime.get("run_step166_gate", False)), b(lane_a_runtime.get("run_editor_ui_flow_smoke_gate", False)), b(lane_a_runtime.get("editor_smoke_no_convert", False)), b(lane_a_runtime.get("run_perf_trend", False)), b(lane_a_runtime.get("run_real_scene_trend", False))))
else:
  print("- nightly_parallel_lane_a_runtime: `n/a`")
PY

# light-style runtime lines
cd /Users/huazhou/Downloads/Github/VemCAD
export PARALLEL_SUMMARY=deps/cadgamefusion/build/editor_parallel_cycle_step186_runtime2_summary.json
export EDITOR_SMOKE_CASE_SOURCE=fixture
export EDITOR_SMOKE_LIMIT=1
export EDITOR_SMOKE_NO_CONVERT=1
python3 - "${PARALLEL_SUMMARY:-}" <<'PY' > deps/cadgamefusion/build/ci_editor_light_runtime_lines.stepcheck.md
import json
import os
import sys
from pathlib import Path
def load_json(path_text):
    path_text = str(path_text or "").strip()
    if not path_text:
        return {}
    path = Path(path_text)
    if not path.is_absolute():
        path = Path.cwd() / path
    try:
        if path.exists() and path.is_file():
            payload = json.loads(path.read_text(encoding="utf-8"))
            return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}
    return {}
def as_dict(value):
    return value if isinstance(value, dict) else {}
def b(value):
    text = str(value or "").strip().lower()
    if text in {"1", "true", "yes", "on"}:
        return "true"
    if text in {"0", "false", "no", "off"}:
        return "false"
    return "true" if bool(value) else "false"
parallel = load_json(sys.argv[1] if len(sys.argv) > 1 else "")
lane_a_runtime = as_dict(as_dict(as_dict(parallel.get("lanes")).get("lane_a")).get("runtime_inputs"))
print("- light_editor_runtime: `source={}` `limit={}` `convert_disabled={}`".format(
    str(os.environ.get("EDITOR_SMOKE_CASE_SOURCE") or "fixture"),
    str(os.environ.get("EDITOR_SMOKE_LIMIT") or ""),
    b(os.environ.get("EDITOR_SMOKE_NO_CONVERT", "1")),
))
if lane_a_runtime:
    print("- light_parallel_lane_a_runtime: `profile={}` `step166_gate={}` `ui_flow_gate={}` `convert_disabled={}` `perf_trend={}` `real_scene_trend={}`".format(
        str(lane_a_runtime.get("editor_gate_profile") or "<none>"),
        b(lane_a_runtime.get("run_step166_gate", False)),
        b(lane_a_runtime.get("run_editor_ui_flow_smoke_gate", False)),
        b(lane_a_runtime.get("editor_smoke_no_convert", False)),
        b(lane_a_runtime.get("run_perf_trend", False)),
        b(lane_a_runtime.get("run_real_scene_trend", False)),
    ))
else:
    print("- light_parallel_lane_a_runtime: `n/a`")
PY
```

### Result
- nightly dry-run output:
  - `nightly_gate_runtime: profile=lite step166_gate=false ui_flow_gate=false convert_disabled=true perf_trend=false real_scene_trend=false`
  - `nightly_parallel_lane_a_runtime: profile=lite step166_gate=false ui_flow_gate=false convert_disabled=true perf_trend=false real_scene_trend=false`
- light dry-run output:
  - `light_editor_runtime: source=fixture limit=1 convert_disabled=true`
  - `light_parallel_lane_a_runtime: profile=lite step166_gate=false ui_flow_gate=false convert_disabled=true perf_trend=false real_scene_trend=false`
- artifacts:
  - `build/ci_editor_nightly_runtime_lines.stepcheck.md`
  - `build/ci_editor_light_runtime_lines.stepcheck.md`

## CI) Weekly canonical `gate_runtime` object validation

### Commands
```bash
bash -n tools/editor_weekly_validation.sh

RUN_GATE=1 \
EDITOR_SMOKE_LIMIT=1 \
GATE_SMOKE_LIMIT=1 \
EDITOR_UI_FLOW_SMOKE_GATE_RUNS=1 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_REAL_SCENE_PERF=0 \
RUN_STEP166_BASELINE_REFRESH=0 \
STEP170_APPEND_REPORT=0 \
STEP176_APPEND_REPORT=0 \
SUMMARY_JSON=build/editor_weekly_validation_summary_step186_runtimeobj.json \
SUMMARY_MD=build/editor_weekly_validation_summary_step186_runtimeobj.md \
bash tools/editor_weekly_validation.sh

python3 - <<'PY'
import json
payload = json.load(open("build/editor_weekly_validation_summary_step186_runtimeobj.json", "r", encoding="utf-8"))
print(payload.get("gate_runtime"))
print(payload.get("gate", {}).get("runtime"))
PY
```

### Result
- shell syntax check: PASS.
- weekly run: PASS.
  - observe editor smoke run_id: `20260302_151306_661_0b79`
  - observe STEP166 run_id: `20260302_071310`
  - gate editor smoke run_id: `20260302_151525_620_aca5`
  - gate UI flow run_id: `20260302_151437_ui_flow`
  - gate STEP166 run_id: `20260302_071529`
- summary now contains canonical runtime object in both locations:
  - `gate_runtime`
  - `gate.runtime`
- runtime values:
  - `profile=<none>`
  - `step166_gate=true`
  - `ui_flow_gate=true`
  - `convert_disabled=false`
  - `perf_trend=false`
  - `real_scene_trend=false`
  - `source=gate.inputs`

## CJ) Weekly report/dashboard fallback convergence validation

### Commands
```bash
python3 -m py_compile \
  tools/write_step170_weekly_report.py \
  tools/write_step176_weekly_report.py \
  tools/write_step176_dashboard.py

python3 tools/write_step170_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary_step186_runtimeobj.json \
  --step170-report build/step170_weekly_step186_runtimeobj.md

python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary_step186_runtimeobj.json \
  --report build/step176_weekly_step186_runtimeobj.md

python3 tools/write_step176_dashboard.py \
  --out build/step176_dashboard_step186_runtime3.md

rg -n "gate_runtime|weekly_gate_runtime|source=" \
  build/step170_weekly_step186_runtimeobj.md \
  build/step176_weekly_step186_runtimeobj.md \
  build/step176_dashboard_step186_runtime3.md
```

### Result
- compile: PASS.
- renderers: PASS.
- STEP170/STEP176 weekly reports both output runtime with source:
  - `gate_runtime: ... source=gate.inputs`
- dashboard output includes:
  - `gate_runtime` column in Weekly History (compact view)
  - `weekly_gate_runtime: ... source=gate.inputs` in Latest Weekly Artifact section

## CK) local_ci runtime object generation + fallback compatibility

### Commands
```bash
bash -n tools/local_ci.sh tools/check_local_summary.sh

RUN_EDITOR_GATE=0 \
RUN_EDITOR_PARALLEL_CYCLE=0 \
RUN_EDITOR_SMOKE=0 \
RUN_EDITOR_SMOKE_GATE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
bash tools/local_ci.sh --build-dir build --offline --quick --skip-compare

python3 - <<'PY'
import json
payload = json.load(open("build/local_ci_summary.json", "r", encoding="utf-8"))
print("editorGateRuntime", payload.get("editorGateRuntime"))
print("editorGateRuntimeProfile", payload.get("editorGateRuntimeProfile"))
print("editorGateRuntimeSource", payload.get("editorGateRuntimeSource"))
print("editorParallelCycleLaneARuntime", payload.get("editorParallelCycleLaneARuntime"))
print("editorParallelCycleLaneARuntimeSource", payload.get("editorParallelCycleLaneARuntimeSource"))
PY

bash tools/check_local_summary.sh --offline-allowed
```

### Result
- shell syntax checks: PASS.
- local_ci quick/offline run: PASS.
  - summary: `build/local_ci_summary.json`
- summary contains canonical runtime object fields (with expected defaults in this run):
  - `editorGateRuntime = {}`
  - `editorGateRuntimeProfile = <none>`
  - `editorGateRuntimeSource = local_ci_defaults`
  - `editorParallelCycleLaneARuntime = {}`
  - `editorParallelCycleLaneARuntimeSource = lane_a_missing`
- `check_local_summary.sh --offline-allowed`: PASS.
  - emits additional runtime line:
    - `gateRuntime profile=<none> ... source=local_ci_defaults`
    - `parallelLaneARuntime profile=<none> ... source=lane_a_missing`

## CL) `write_ci_artifact_summary.py --local-summary` renderer validation

### Commands
```bash
python3 -m py_compile tools/write_ci_artifact_summary.py

python3 tools/write_ci_artifact_summary.py \
  --title "cadgamefusion-local-ci" \
  --mode observe \
  --local-summary build/local_ci_summary.json \
  --out build/ci_local_summary_step186_runtime.md

rg -n "Local CI Runtime|local_gate_runtime|local_parallel_lane_a_runtime|local_summary" \
  build/ci_local_summary_step186_runtime.md
```

### Result
- compile: PASS.
- render: PASS.
- markdown contains local runtime section:
  - `local_gate_runtime: profile=<none> ... source=local_ci_defaults`
  - `local_parallel_lane_a_runtime: profile=<none> ... source=lane_a_missing`
  - `local_summary_core: offline=true validation_fail_count=0 missing_scenes=0`
- output:
  - `build/ci_local_summary_step186_runtime.md`

## CM) local_ci auto artifact markdown generation

### Commands
```bash
bash -n tools/local_ci.sh tools/check_local_summary.sh

RUN_EDITOR_GATE=0 \
RUN_EDITOR_PARALLEL_CYCLE=0 \
RUN_EDITOR_SMOKE=0 \
RUN_EDITOR_SMOKE_GATE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
bash tools/local_ci.sh --build-dir build --offline --quick --skip-compare

python3 - <<'PY'
import json
payload = json.load(open("build/local_ci_summary.json", "r", encoding="utf-8"))
print("localCiArtifactSummaryMd", payload.get("localCiArtifactSummaryMd"))
print("editorGateRuntime", payload.get("editorGateRuntime"))
print("editorParallelCycleLaneARuntime", payload.get("editorParallelCycleLaneARuntime"))
PY

rg -n "Local CI Runtime|local_gate_runtime|local_parallel_lane_a_runtime|local_summary" \
  build/local_ci_artifact_summary.md

bash tools/check_local_summary.sh --offline-allowed
```

### Result
- shell syntax: PASS.
- local_ci run: PASS.
  - summary JSON: `build/local_ci_summary.json`
  - auto markdown: `build/local_ci_artifact_summary.md`
- summary JSON includes:
  - `localCiArtifactSummaryMd=build/local_ci_artifact_summary.md`
  - `editorGateRuntime={}`
  - `editorParallelCycleLaneARuntime={}`
- markdown includes `Local CI Runtime` section with runtime source markers.
- summary checker: PASS.

## CN) local runtime defaults convergence + checker path options

### Commands
```bash
bash -n tools/local_ci.sh tools/check_local_summary.sh
python3 -m py_compile tools/write_ci_artifact_summary.py

RUN_EDITOR_GATE=0 RUN_EDITOR_PARALLEL_CYCLE=0 \
RUN_EDITOR_SMOKE=0 RUN_EDITOR_SMOKE_GATE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
bash tools/local_ci.sh --build-dir build --offline --quick --skip-compare

python3 - <<'PY'
import json
payload = json.load(open("build/local_ci_summary.json", "r", encoding="utf-8"))
print("editorGateRuntime", payload.get("editorGateRuntime"))
print("editorParallelCycleLaneARuntime", payload.get("editorParallelCycleLaneARuntime"))
PY

bash tools/check_local_summary.sh --summary build/local_ci_summary.json --offline-allowed
bash tools/check_local_summary.sh --build-dir build --offline-allowed

RUN_EDITOR_GATE=0 RUN_EDITOR_PARALLEL_CYCLE=1 \
PARALLEL_CYCLE_RUN_LANE_A=1 PARALLEL_CYCLE_RUN_LANE_B=0 PARALLEL_CYCLE_RUN_LANE_C=0 \
PARALLEL_CYCLE_LANE_A_PROFILE=lite PARALLEL_CYCLE_LANE_A_LIMIT=1 PARALLEL_CYCLE_LANE_A_RUN_STEP166=0 \
PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW=0 \
bash tools/local_ci.sh --build-dir build --offline --quick --skip-compare

rg -n "Local CI Runtime|local_parallel_cycle|local_gate_runtime|local_parallel_lane_a_runtime" \
  build/local_ci_artifact_summary.md
```

### Result
- syntax/compile: PASS.
- local_ci (no gate/no cycle) now emits non-empty default runtime objects:
  - `editorGateRuntime={"profile":"full","step166_gate":true,...,"source":"local_ci_defaults"}`
  - `editorParallelCycleLaneARuntime={"profile":"lite","step166_gate":false,...,"source":"lane_a_defaults"}`
- `check_local_summary.sh` path options PASS:
  - `--summary build/local_ci_summary.json`
  - `--build-dir build`
- local_ci (lane-A-only cycle) PASS with runtime source propagated from cycle summary:
  - `parallelLaneARuntime ... source=parallel.lane_a.runtime_inputs`
- local artifact markdown now includes parallel lane toggles/decision line:
  - `local_parallel_cycle: run_lane_a=true run_lane_b=false run_lane_c=false decision=pass ...`

## CO) Lane B arc radius grip regression test

### Command
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
```

### Result
- PASS (`109/109`).
- New coverage case included:
  - `select tool: arc radius grip updates radius and supports undo/redo`
- Assertions verified:
  - arc radius changes to dragged target radius,
  - center/start/end angles stay stable,
  - undo/redo restores radius deterministically.

## CP) Parallel-cycle duration telemetry propagation

### Commands
```bash
bash -n tools/editor_parallel_cycle.sh tools/local_ci.sh tools/check_local_summary.sh
python3 -m py_compile tools/write_ci_artifact_summary.py

RUN_LANE_A=0 RUN_LANE_B=0 RUN_LANE_C=1 \
LANE_C_DAYS=3 LANE_C_WINDOWS=7 \
OUT_DIR=build/editor_parallel_cycle_duration_check \
SUMMARY_JSON=build/editor_parallel_cycle_duration_check.json \
SUMMARY_MD=build/editor_parallel_cycle_duration_check.md \
bash tools/editor_parallel_cycle.sh

RUN_EDITOR_GATE=0 RUN_EDITOR_PARALLEL_CYCLE=1 \
PARALLEL_CYCLE_RUN_LANE_A=0 PARALLEL_CYCLE_RUN_LANE_B=0 PARALLEL_CYCLE_RUN_LANE_C=1 \
PARALLEL_CYCLE_LANE_C_WINDOWS=7 PARALLEL_CYCLE_LANE_C_DAYS=3 \
bash tools/local_ci.sh --build-dir build --offline --quick --skip-compare

RUN_EDITOR_PARALLEL_CYCLE=true \
bash tools/check_local_summary.sh --summary build/local_ci_summary.json --offline-allowed

python3 tools/write_ci_artifact_summary.py \
  --title "parallel-duration-check" \
  --mode observe \
  --parallel-summary build/editor_parallel_cycle_summary.json \
  --out build/ci_parallel_duration.md

python3 tools/write_ci_artifact_summary.py \
  --title "cadgamefusion-local-ci" \
  --mode observe \
  --local-summary build/local_ci_summary.json \
  --out build/ci_local_summary_step186_duration.md
```

### Result
- syntax/compile: PASS.
- `editor_parallel_cycle` summary includes duration fields:
  - `duration_sec=1`
  - `lanes.lane_c.duration_sec=1`
  - `lanes.lane_c.case_selection.duration_sec=1`
  - `lanes.lane_c.gate_trend.duration_sec=1`
- `local_ci` summary includes flattened duration fields:
  - `editorParallelCycleDurationSec=1`
  - `editorParallelCycleLaneCDurationSec=1`
  - `editorParallelCycleLaneCCaseSelectionDurationSec=1`
  - `editorParallelCycleLaneCGateTrendDurationSec=1`
- checker output now includes:
  - `parallelDuration total=1s laneA=0s laneB=0s laneBNode=0s laneBUI=0s laneC=1s laneCCase=1s laneCGate=1s`
- markdown renderers:
  - `build/ci_parallel_duration.md` has `Parallel Cycle` duration line.
  - `build/ci_local_summary_step186_duration.md` has `local_parallel_cycle_duration` line.

## CQ) Local UI-flow interaction-check propagation

### Commands
```bash
bash -n tools/local_ci.sh tools/check_local_summary.sh tools/web_viewer/scripts/editor_ui_flow_smoke.sh
python3 -m py_compile tools/write_ci_artifact_summary.py

RUN_EDITOR_GATE=0 RUN_EDITOR_PARALLEL_CYCLE=0 \
RUN_EDITOR_SMOKE=0 RUN_EDITOR_SMOKE_GATE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=1 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
bash tools/local_ci.sh --build-dir build --offline --quick --skip-compare

RUN_EDITOR_GATE=0 RUN_EDITOR_PARALLEL_CYCLE=0 \
RUN_EDITOR_SMOKE=0 RUN_EDITOR_SMOKE_GATE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 \
EDITOR_UI_FLOW_SMOKE_GATE_RUNS=1 \
bash tools/local_ci.sh --build-dir build --offline --quick --skip-compare

bash tools/check_local_summary.sh --summary build/local_ci_summary.json --offline-allowed

python3 tools/write_ci_artifact_summary.py \
  --title "cadgamefusion-local-ci" \
  --mode observe \
  --local-summary build/local_ci_summary.json \
  --out build/ci_local_summary_step186_ui_checks.md

rg -n "local_ui_flow_smoke|local_ui_flow_attribution|local_ui_flow_interaction_checks" \
  build/local_ci_artifact_summary.md build/ci_local_summary_step186_ui_checks.md
```

### Result
- syntax/compile: PASS.
- local_ci (UI-flow observe only): PASS.
  - summary line includes:
    - `Editor UI flow smoke attribution: failure_code_total=0 attr_complete=true interaction_complete=true`
- `build/local_ci_summary.json` now contains:
  - `editorUiFlowSmokeFailureAttributionComplete=true`
  - `editorUiFlowSmokeInteractionChecksCoverage` (16 keys, all `true` in this run)
  - `editorUiFlowSmokeInteractionChecksComplete=true`
- `check_local_summary.sh --summary ...` PASS and prints:
  - `editorUiFlowAttr=true`
  - `editorUiFlowInteractionComplete=true`
- gate-mode replay (`RUN_EDITOR_UI_FLOW_SMOKE_GATE=1`, runs=1): PASS.
  - `editorUiFlowSmokeStatus=ok`
  - `editorUiFlowSmokeGateRuns=1/1`
  - `editorUiFlowAttr=true`
  - `editorUiFlowInteractionComplete=true`
- markdown outputs include new local UI-flow lines:
  - `local_ui_flow_smoke`
  - `local_ui_flow_attribution`
  - `local_ui_flow_interaction_checks`

## CR) Parallel-cycle lane-B UI-flow interaction/attribution propagation

### Commands
```bash
bash -n tools/editor_parallel_cycle.sh tools/local_ci.sh tools/check_local_summary.sh
python3 -m py_compile tools/write_ci_artifact_summary.py

RUN_LANE_A=0 RUN_LANE_B=1 RUN_LANE_C=0 \
LANE_B_RUN_UI_FLOW=1 LANE_B_UI_FLOW_MODE=gate \
OUT_DIR=build/editor_parallel_cycle_lane_b_check \
SUMMARY_JSON=build/editor_parallel_cycle_lane_b_check.json \
SUMMARY_MD=build/editor_parallel_cycle_lane_b_check.md \
bash tools/editor_parallel_cycle.sh

RUN_EDITOR_GATE=0 RUN_EDITOR_PARALLEL_CYCLE=1 \
PARALLEL_CYCLE_RUN_LANE_A=0 PARALLEL_CYCLE_RUN_LANE_B=1 PARALLEL_CYCLE_RUN_LANE_C=0 \
PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW=1 PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE=gate \
RUN_EDITOR_SMOKE=0 RUN_EDITOR_SMOKE_GATE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
bash tools/local_ci.sh --build-dir build --offline --quick --skip-compare

bash tools/check_local_summary.sh --summary build/local_ci_summary.json --offline-allowed

python3 tools/write_ci_artifact_summary.py \
  --title "parallel-ui-checks" \
  --mode gate \
  --parallel-summary build/editor_parallel_cycle_summary.json \
  --out build/ci_parallel_ui_checks.md

rg -n "lane_b_ui_flow_checks|lane_b_ui_flow_interaction_coverage|local_parallel_lane_b_ui_flow|local_parallel_lane_b_ui_interaction_checks" \
  build/local_ci_artifact_summary.md build/ci_parallel_ui_checks.md
```

### Result
- syntax/compile: PASS.
- `editor_parallel_cycle` (lane-B only) PASS:
  - `lanes.lane_b.ui_flow.failure_attribution_complete=true`
  - `lanes.lane_b.ui_flow.interaction_checks_complete=true`
  - `lanes.lane_b.ui_flow.interaction_checks_coverage` includes 16 keys
  - `gate_decision=pass` (no lane-B ui-flow completeness regressions)
- `local_ci` (parallel-cycle lane-B gate mode) PASS:
  - summary line includes:
    - `Editor parallel cycle lane B ui-flow checks: attr_complete=true interaction_complete=true`
  - `build/local_ci_summary.json` contains:
    - `editorParallelCycleLaneBUiFlowFailureAttributionComplete=true`
    - `editorParallelCycleLaneBUiFlowInteractionChecksCoverage` (16 keys)
    - `editorParallelCycleLaneBUiFlowInteractionChecksComplete=true`
- checker PASS:
  - `parallelLaneBRun=true parallelLaneBUiFlow=true parallelLaneBUiMode=gate`
  - `parallelLaneBAttr=true parallelLaneBInteraction=true`
- markdown renderer PASS:
  - `build/local_ci_artifact_summary.md` and `build/ci_parallel_ui_checks.md` include:
    - `lane_b_ui_flow_checks`
    - `lane_b_ui_flow_interaction_coverage`
    - `local_parallel_lane_b_ui_flow`
    - `local_parallel_lane_b_ui_interaction_checks`

## CS) STEP176 weekly/dashboard parallel-cycle propagation

### Commands
```bash
bash -n tools/editor_weekly_validation.sh
python3 -m py_compile tools/write_step176_weekly_report.py tools/write_step176_dashboard.py

RUN_LANE_A=0 RUN_LANE_B=1 RUN_LANE_C=0 \
LANE_B_RUN_UI_FLOW=1 LANE_B_UI_FLOW_MODE=gate \
OUT_DIR=build/editor_parallel_cycle_weekly_bridge \
SUMMARY_JSON=build/editor_parallel_cycle_weekly_bridge.json \
SUMMARY_MD=build/editor_parallel_cycle_weekly_bridge.md \
bash tools/editor_parallel_cycle.sh

python3 - <<'PY'
import json
from pathlib import Path
base = Path("build/editor_weekly_validation_summary.json")
if not base.exists():
    base = sorted(Path("build/editor_weekly_validation_history").glob("weekly_*.json"))[-1]
weekly = json.load(base.open("r", encoding="utf-8"))
parallel = json.load(open("build/editor_parallel_cycle_weekly_bridge.json", "r", encoding="utf-8"))
weekly.setdefault("inputs", {})
weekly["inputs"].update({
    "run_editor_parallel_cycle": True,
    "parallel_cycle_watch_policy": "observe",
    "parallel_cycle_run_lane_a": False,
    "parallel_cycle_run_lane_b": True,
    "parallel_cycle_run_lane_c": False,
    "parallel_cycle_lane_b_run_ui_flow": True,
    "parallel_cycle_lane_b_ui_flow_mode": "gate",
    "parallel_cycle_strict": False,
})
weekly["parallel_cycle"] = {
    "enabled": True,
    "status": "fail",
    "exit_code": 1,
    "run_id": parallel.get("run_id", ""),
    "out_dir": parallel.get("out_dir", ""),
    "summary_json": "build/editor_parallel_cycle_weekly_bridge.json",
    "summary_md": "build/editor_parallel_cycle_weekly_bridge.md",
    "watch_policy": "observe",
    "gate_decision": parallel.get("gate_decision", {}),
    "overall_status": parallel.get("overall_status", ""),
    "duration_sec": parallel.get("duration_sec", 0),
    "lanes": parallel.get("lanes", {}),
    "summary_loaded": True,
    "gate_decision_raw": parallel.get("gate_decision", {}).get("decision", ""),
}
Path("build/weekly_with_parallel_test.json").write_text(
    json.dumps(weekly, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
PY

python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/weekly_with_parallel_test.json \
  --report build/step176_weekly_report_parallel_test.md

mkdir -p build/weekly_history_parallel_test
cp build/weekly_with_parallel_test.json build/weekly_history_parallel_test/weekly_parallel_test.json

python3 tools/write_step176_dashboard.py \
  --weekly-history-dir build/weekly_history_parallel_test \
  --out build/step176_dashboard_parallel_test.md \
  --max-weekly 5 --max-gates 5

rg -n "parallel_cycle|parallel_lane_b|lane_b_ui|weekly_parallel_cycle" \
  build/step176_weekly_report_parallel_test.md \
  build/step176_dashboard_parallel_test.md
```

### Result
- syntax/compile: PASS.
- weekly producer script now accepts and exports parallel-cycle inputs/outputs:
  - new env knobs (`RUN_EDITOR_PARALLEL_CYCLE`, `PARALLEL_CYCLE_*`)
  - new weekly summary node `parallel_cycle`.
- `editor_parallel_cycle` lane-B sample produced:
  - `run_id=20260303_082154`
  - `summary_json=build/editor_parallel_cycle_weekly_bridge.json`
  - `gate_decision=fail` (captured and propagated).
- STEP176 weekly report render includes new lines:
  - `parallel_cycle`
  - `parallel_lane_b`
  - `parallel_lane_b_ui_flow`
  - `parallel_cycle_summary_json` / `parallel_cycle_summary_md`
- STEP176 dashboard render includes:
  - weekly-history column `parallel_cycle`
  - latest-weekly line `weekly_parallel_cycle`
  - `weekly_parallel_cycle_summary_json` artifact pointer.

## CT) Weekly end-to-end smoke (with parallel-cycle enabled)

### Commands
```bash
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_REAL_SCENE_PERF=0 \
RUN_GATE=0 \
RUN_STEP166_BASELINE_REFRESH=0 \
RUN_EDITOR_PARALLEL_CYCLE=1 \
PARALLEL_CYCLE_RUN_LANE_A=0 \
PARALLEL_CYCLE_RUN_LANE_B=1 \
PARALLEL_CYCLE_RUN_LANE_C=0 \
PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW=0 \
EDITOR_SMOKE_LIMIT=2 \
CAD_MAX_WORKERS=1 \
bash tools/editor_weekly_validation.sh

python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --report build/step176_weekly_report_after_real_run.md

python3 tools/write_step176_dashboard.py \
  --out build/step176_dashboard_after_real_run.md \
  --max-weekly 20 --max-gates 20

rg -n "parallel_cycle|parallel_lane_b|weekly_parallel_cycle" \
  build/editor_weekly_validation_summary.json \
  build/step176_weekly_report_after_real_run.md \
  build/step176_dashboard_after_real_run.md
```

### Result
- weekly flow PASS after producer fix (inline summary renderer now has `as_dict` helper).
- generated artifacts:
  - `build/editor_weekly_validation_summary.json`
  - `build/editor_weekly_validation_summary.md`
  - `build/editor_weekly_validation_history/weekly_20260303_003128_20260303_082843_924_0bf6_20260303_002844.json`
- weekly summary now contains `parallel_cycle` node with lane-B data:
  - `status=pass`, `run_id=20260303_083128`, `summary_json=build/editor_parallel_cycle/20260303_083128/summary.json`
- STEP176 weekly report render includes:
  - `parallel_cycle`
  - `parallel_lane_b`
  - `parallel_lane_b_ui_flow`
  - `parallel_cycle_summary_json/md`
- STEP176 dashboard render includes:
  - weekly-history `parallel_cycle` column
  - latest-weekly `weekly_parallel_cycle` line + summary pointer.

## CU) STEP170 weekly report parallel-cycle propagation

### Commands
```bash
python3 -m py_compile tools/write_step170_weekly_report.py

python3 tools/write_step170_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --step170-report build/step170_weekly_report_after_parallel_patch.md

rg -n "parallel_cycle_inputs|parallel_cycle|lane_b_ui_flow|parallel_cycle_summary" \
  build/step170_weekly_report_after_parallel_patch.md
```

### Result
- compile: PASS.
- report append: PASS.
- rendered STEP170 weekly block now includes:
  - `parallel_cycle_inputs`
  - `parallel_cycle`
  - `lane_b_ui_flow`
  - `parallel_cycle_summary_json/md`.

## CV) Weekly parallel decision policy (observe/gate) + report convergence

### Commands
```bash
bash -n tools/editor_weekly_validation.sh
python3 -m py_compile \
  tools/write_step170_weekly_report.py \
  tools/write_step176_weekly_report.py \
  tools/write_step176_dashboard.py

RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_REAL_SCENE_PERF=0 \
RUN_GATE=0 \
RUN_STEP166_BASELINE_REFRESH=0 \
RUN_EDITOR_PARALLEL_CYCLE=1 \
WEEKLY_PARALLEL_DECISION_POLICY=gate \
PARALLEL_CYCLE_RUN_LANE_A=0 \
PARALLEL_CYCLE_RUN_LANE_B=1 \
PARALLEL_CYCLE_RUN_LANE_C=0 \
PARALLEL_CYCLE_LANE_B_RUN_UI_FLOW=0 \
EDITOR_SMOKE_LIMIT=2 \
CAD_MAX_WORKERS=1 \
bash tools/editor_weekly_validation.sh

python3 tools/write_step170_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --step170-report build/step170_weekly_report_parallel_policy_gate.md

python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --report build/step176_weekly_report_parallel_policy_gate.md

python3 tools/write_step176_dashboard.py \
  --out build/step176_dashboard_parallel_policy_gate.md \
  --max-weekly 20 --max-gates 20

rg -n "weekly_policy|parallel_cycle_gate|watch_escalated|weekly_parallel_cycle_gate" \
  build/step170_weekly_report_parallel_policy_gate.md \
  build/step176_weekly_report_parallel_policy_gate.md \
  build/step176_dashboard_parallel_policy_gate.md
```

### Result
- syntax/compile: PASS.
- weekly run PASS under `WEEKLY_PARALLEL_DECISION_POLICY=gate` (parallel decision was pass):
  - `parallel_cycle run_id=20260303_131336`
  - `summary_json=build/editor_parallel_cycle/20260303_131336/summary.json`
- weekly summary now carries:
  - `inputs.weekly_parallel_decision_policy=gate`
  - parallel gate detail fields (`raw/should_merge/watch_escalated/fail_reasons/warning_codes`).
- STEP170 report output includes:
  - `parallel_cycle_inputs ... weekly_policy=gate`
  - `parallel_cycle ... watch_escalated=False`
  - `parallel_cycle_gate`.
- STEP176 report/dashboard outputs include:
  - `parallel_cycle ... should_merge=True watch_escalated=False`
  - `parallel_cycle_gate: weekly_policy=gate ...`
  - `weekly_parallel_cycle_gate`.

## CW) Lane-B UI-flow timeout injection + weekly gate blocking branch

### Commands
```bash
bash -n tools/editor_parallel_cycle.sh tools/editor_weekly_validation.sh
python3 -m py_compile \
  tools/write_step170_weekly_report.py \
  tools/write_step176_weekly_report.py \
  tools/write_step176_dashboard.py

RUN_LANE_A=0 RUN_LANE_B=1 RUN_LANE_C=0 \
LANE_B_RUN_UI_FLOW=1 \
LANE_B_UI_FLOW_MODE=gate \
LANE_B_UI_FLOW_TIMEOUT_MS=1 \
OUT_DIR=build/editor_parallel_cycle_laneb_gate_inject \
SUMMARY_JSON=build/editor_parallel_cycle_laneb_gate_inject.json \
SUMMARY_MD=build/editor_parallel_cycle_laneb_gate_inject.md \
bash tools/editor_parallel_cycle.sh

RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_REAL_SCENE_PERF=0 \
RUN_GATE=0 \
RUN_STEP166_BASELINE_REFRESH=0 \
RUN_EDITOR_PARALLEL_CYCLE=1 \
WEEKLY_PARALLEL_DECISION_POLICY=gate \
PARALLEL_CYCLE_RUN_LANE_A=0 \
PARALLEL_CYCLE_RUN_LANE_B=1 \
PARALLEL_CYCLE_RUN_LANE_C=0 \
PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE=gate \
PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS=1 \
EDITOR_SMOKE_LIMIT=2 \
CAD_MAX_WORKERS=1 \
bash tools/editor_weekly_validation.sh

python3 tools/write_step170_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --step170-report build/step170_weekly_report_parallel_policy_inject_fail.md

python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --report build/step176_weekly_report_parallel_policy_inject_fail.md

python3 tools/write_step176_dashboard.py \
  --out build/step176_dashboard_parallel_policy_inject_fail.md \
  --max-weekly 20 --max-gates 20

rg -n "lane_b_ui_timeout_ms|parallel_cycle_gate|LANE_B_UI_FLOW|weekly_parallel_cycle_gate" \
  build/step170_weekly_report_parallel_policy_inject_fail.md \
  build/step176_weekly_report_parallel_policy_inject_fail.md \
  build/step176_dashboard_parallel_policy_inject_fail.md
```

### Result
- syntax/compile: PASS.
- lane-B isolated injection PASS（按预期失败）:
  - `editor_parallel_cycle` exit code `1`
  - `gate_decision=fail`
  - fail reasons include:
    - `LANE_B_UI_FLOW_FAIL`
    - `LANE_B_UI_FLOW_ATTR_MISSING`
    - `LANE_B_UI_FLOW_INTERACTION_INCOMPLETE`
- weekly gate policy blocking branch PASS（按预期阻塞）:
  - weekly exit code `1`
  - explicit log:
    - `ERROR parallel cycle gate policy failed (decision=fail, status=fail)`
  - weekly summary contains:
    - `inputs.weekly_parallel_decision_policy=gate`
    - `inputs.parallel_cycle_lane_b_ui_flow_timeout_ms=1`
    - `parallel_cycle.gate_decision.fail_reasons` with lane-B failure set.
- rendered reports include timeout + gate reason convergence:
  - STEP170:
    - `parallel_cycle_inputs ... lane_b_ui_timeout_ms=1`
    - `parallel_cycle_gate: fail_reasons=...`
  - STEP176 report/dashboard:
    - `parallel_cycle ... lane_b_ui_timeout_ms=1`
    - `weekly_parallel_cycle_gate: fail_reasons=...`

## CX) Lane-B UI-flow default-on weekly gate pass path

### Commands
```bash
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_REAL_SCENE_PERF=0 \
RUN_GATE=0 \
RUN_STEP166_BASELINE_REFRESH=0 \
RUN_EDITOR_PARALLEL_CYCLE=1 \
WEEKLY_PARALLEL_DECISION_POLICY=gate \
PARALLEL_CYCLE_RUN_LANE_A=0 \
PARALLEL_CYCLE_RUN_LANE_B=1 \
PARALLEL_CYCLE_RUN_LANE_C=0 \
PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE=gate \
EDITOR_SMOKE_LIMIT=2 \
CAD_MAX_WORKERS=1 \
bash tools/editor_weekly_validation.sh

python3 tools/write_step170_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --step170-report build/step170_weekly_report_parallel_default_laneb.md

python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --report build/step176_weekly_report_parallel_default_laneb.md

python3 tools/write_step176_dashboard.py \
  --out build/step176_dashboard_parallel_default_laneb.md \
  --max-weekly 20 --max-gates 20

rg -n "lane_b_ui_flow=True|lane_b_ui_timeout_ms|weekly_parallel_cycle" \
  build/step170_weekly_report_parallel_default_laneb.md \
  build/step176_weekly_report_parallel_default_laneb.md \
  build/step176_dashboard_parallel_default_laneb.md
```

### Result
- weekly run PASS with default-on lane-B ui-flow:
  - `parallel_cycle run_id=20260304_122345`
  - `gate_decision=pass`
- weekly summary confirms:
  - `parallel_cycle_lane_b_run_ui_flow=true`
  - `parallel_cycle_lane_b_ui_flow_timeout_ms=0` (default path).
- rendered outputs converge on pass semantics:
  - STEP170/STEP176 input lines show `lane_b_ui_flow=True`.
  - dashboard latest line shows:
    - `lane_b_ui_status=pass`
    - `lane_b_attr=True`
    - `lane_b_interaction=True`.

## CY) Local CI / checker / artifact parity for lane-B timeout + enabled

### Commands
```bash
bash -n tools/local_ci.sh tools/check_local_summary.sh
python3 -m py_compile tools/write_ci_artifact_summary.py

RUN_EDITOR_PARALLEL_CYCLE=1 \
PARALLEL_CYCLE_RUN_LANE_A=0 \
PARALLEL_CYCLE_RUN_LANE_C=0 \
PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE=gate \
PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS=1 \
bash tools/local_ci.sh --offline --skip-compare --quick

python3 - <<'PY'
import json
j = json.load(open("build/local_ci_summary.json", "r", encoding="utf-8"))
for key in [
    "editorParallelCycleStatus",
    "editorParallelCycleLaneBRunUiFlow",
    "editorParallelCycleLaneBUiFlowEnabled",
    "editorParallelCycleLaneBUiFlowMode",
    "editorParallelCycleLaneBUiFlowTimeoutMs",
    "editorParallelCycleLaneBUiFlowFailureAttributionComplete",
    "editorParallelCycleLaneBUiFlowInteractionChecksComplete",
]:
    print(key, j.get(key))
PY

bash tools/check_local_summary.sh --offline-allowed --summary build/local_ci_summary.json || true

python3 tools/write_ci_artifact_summary.py \
  --mode gate \
  --parallel-summary build/editor_parallel_cycle_summary.json \
  --local-summary build/local_ci_summary.json \
  --out build/local_ci_artifact_summary_check.md

rg -n "lane_b_ui_flow_checks|local_parallel_lane_b_ui_flow|timeout_ms" \
  build/local_ci_artifact_summary_check.md
```

### Result
- syntax/compile: PASS.
- local-ci timeout injection run PASS（local_ci 主流程成功，parallel cycle 按预期 fail）:
  - parallel run_id: `20260304_130841`
  - `editorParallelCycleStatus=fail`
  - `editorParallelCycleLaneBUiFlowEnabled=true`
  - `editorParallelCycleLaneBUiFlowTimeoutMs=1`
  - `editorParallelCycleLaneBUiFlowFailureAttributionComplete=false`
  - `editorParallelCycleLaneBUiFlowInteractionChecksComplete=false`
- checker propagation PASS:
  - `check_local_summary.sh` 输出包含:
    - `parallelLaneBUiEnabled=true`
    - `parallelLaneBUiTimeoutMs=1`
  - gate diagnostics（预期）仍报告 lane-B attribution/interaction 不完整。
- artifact markdown propagation PASS:
  - `lane_b_ui_flow_checks: enabled=true ... timeout_ms=1 ...`
  - `local_parallel_lane_b_ui_flow: configured=true enabled=true ... timeout_ms=1 ...`

## CZ) Parallel-cycle lane-B fail path keeps summary attribution (no attr-missing downgrade)

### Commands
```bash
bash -n tools/editor_parallel_cycle.sh

RUN_LANE_A=0 RUN_LANE_B=1 RUN_LANE_C=0 \
LANE_B_RUN_UI_FLOW=1 \
LANE_B_UI_FLOW_MODE=gate \
LANE_B_UI_FLOW_TIMEOUT_MS=1 \
OUT_DIR=build/editor_parallel_cycle_laneb_gate_inject_v3 \
SUMMARY_JSON=build/editor_parallel_cycle_laneb_gate_inject_v3.json \
SUMMARY_MD=build/editor_parallel_cycle_laneb_gate_inject_v3.md \
bash tools/editor_parallel_cycle.sh

python3 - <<'PY'
import json, os
j = json.load(open("build/editor_parallel_cycle_laneb_gate_inject_v3.json", "r", encoding="utf-8"))
ui = (((j.get("lanes") or {}).get("lane_b") or {}).get("ui_flow") or {})
print("ui.summary_json =", ui.get("summary_json"))
print("ui.failure_code =", ui.get("failure_code"))
print("ui.attr_complete =", ui.get("failure_attribution_complete"))
print("gate.fail_reasons =", ((j.get("gate_decision") or {}).get("fail_reasons") or []))
sp = ui.get("summary_json") or ""
if sp and os.path.exists(sp):
  s = json.load(open(sp, "r", encoding="utf-8"))
  print("summary.flow_failure_code =", s.get("flow_failure_code"))
PY

RUN_EDITOR_PARALLEL_CYCLE=1 \
PARALLEL_CYCLE_RUN_LANE_A=0 \
PARALLEL_CYCLE_RUN_LANE_C=0 \
PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE=gate \
PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS=1 \
bash tools/local_ci.sh --offline --skip-compare --quick

python3 tools/write_ci_artifact_summary.py \
  --mode gate \
  --parallel-summary build/editor_parallel_cycle_summary.json \
  --local-summary build/local_ci_summary.json \
  --out build/local_ci_artifact_summary_v3.md

rg -n "lane_b_ui_flow_checks|local_parallel_lane_b_ui_flow" \
  build/local_ci_artifact_summary_v3.md
```

### Result
- syntax: PASS.
- parallel-cycle fail injection (expected fail) now preserves ui-flow summary on fail path:
  - run_id: `20260306_140527`
  - `ui.summary_json` exists and points to `.../editor_ui_flow_smoke/.../summary.json`
  - `ui.failure_code=UI_FLOW_TIMEOUT`
  - `summary.flow_failure_detail=pwcli timeout (exit_code=124)`
  - `ui.attr_complete=true`
  - gate fail reasons include:
    - `LANE_B_FAIL`
    - `LANE_B_UI_FLOW_FAIL`
    - `LANE_B_UI_FLOW_INTERACTION_INCOMPLETE`
  - **no** `LANE_B_UI_FLOW_ATTR_MISSING` in this path.
- local-ci propagation PASS (same timeout-injection profile):
  - parallel summary line shows `attr_complete=true timeout_ms=1`.
  - markdown output includes:
    - `lane_b_ui_flow_checks ... failure_code=UI_FLOW_TIMEOUT`
    - `local_parallel_lane_b_ui_flow ... attr_complete=true ...`

## DA) UI-flow setup-stage attribution propagation (gate/parallel/local summary)

### Commands
```bash
bash -n tools/web_viewer/scripts/editor_ui_flow_smoke.sh \
  tools/editor_gate.sh \
  tools/editor_parallel_cycle.sh \
  tools/local_ci.sh
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile \
  tools/write_editor_gate_report.py \
  tools/write_step176_gate_report.py \
  tools/write_ci_artifact_summary.py

RUN_LANE_A=0 RUN_LANE_B=1 RUN_LANE_C=0 \
LANE_B_RUN_UI_FLOW=1 \
LANE_B_UI_FLOW_MODE=gate \
LANE_B_UI_FLOW_TIMEOUT_MS=1 \
OUT_DIR=build/editor_parallel_cycle_stagecheck \
SUMMARY_JSON=build/editor_parallel_cycle_stagecheck_summary.json \
SUMMARY_MD=build/editor_parallel_cycle_stagecheck_summary.md \
bash tools/editor_parallel_cycle.sh || true

python3 - <<'PY'
import json
j = json.load(open("build/editor_parallel_cycle_stagecheck_summary.json", "r", encoding="utf-8"))
ui = (((j.get("lanes") or {}).get("lane_b") or {}).get("ui_flow") or {})
print("failure_code", ui.get("failure_code"))
print("failure_stage", ui.get("failure_stage"))
print("open/resize/run", ui.get("open_exit_code"), ui.get("resize_exit_code"), ui.get("run_code_exit_code"))
PY

RUN_EDITOR_GATE=0 RUN_EDITOR_PARALLEL_CYCLE=1 \
PARALLEL_CYCLE_RUN_LANE_A=0 PARALLEL_CYCLE_RUN_LANE_C=0 \
PARALLEL_CYCLE_LANE_B_UI_FLOW_MODE=gate \
PARALLEL_CYCLE_LANE_B_UI_FLOW_TIMEOUT_MS=1 \
bash tools/local_ci.sh --offline --skip-compare --quick

python3 - <<'PY'
import json
j = json.load(open("build/local_ci_summary.json", "r", encoding="utf-8"))
for key in [
    "editorParallelCycleLaneBUiFlowFailureStage",
    "editorParallelCycleLaneBUiFlowOpenExitCode",
    "editorParallelCycleLaneBUiFlowResizeExitCode",
    "editorParallelCycleLaneBUiFlowRunCodeExitCode",
]:
    print(key, j.get(key))
PY

python3 tools/write_ci_artifact_summary.py \
  --title stagecheck \
  --mode observe \
  --gate-summary build/editor_gate_summary_stagecheck.json \
  --parallel-summary build/editor_parallel_cycle_stagecheck_summary.json \
  --local-summary build/local_ci_summary.json \
  --out build/ci_stagecheck.md

rg -n "setup_exits|first_failure_stage" build/ci_stagecheck.md build/local_ci_artifact_summary.md
```

### Result
- syntax + compile: PASS.
- parallel-cycle lane-B timeout injection (`run_id=20260306_143244`) captures setup-stage attribution:
  - `failure_code=UI_FLOW_OPEN_TIMEOUT`
  - `failure_stage=open`
  - `open/resize/run = 124/0/0`
  - `failure_attribution_complete=true`
- local-ci propagation (`run_id=20260306_143340`) includes new JSON fields:
  - `editorParallelCycleLaneBUiFlowFailureStage=open`
  - `editorParallelCycleLaneBUiFlowOpenExitCode=124`
  - `editorParallelCycleLaneBUiFlowResizeExitCode=0`
  - `editorParallelCycleLaneBUiFlowRunCodeExitCode=0`
- markdown report propagation PASS:
  - `build/local_ci_artifact_summary.md` and `build/ci_stagecheck.md` include:
    - `lane_b_ui_flow_setup_exits`
    - `local_parallel_lane_b_ui_setup_exits`
    - `local_gate_ui_flow_setup_exits`

## DB) Weekly/dashboard/report propagation for setup-stage attribution

### Commands
```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile \
  tools/write_step170_weekly_report.py \
  tools/write_step176_weekly_report.py \
  tools/write_step176_dashboard.py \
  tools/write_editor_gate_report.py \
  tools/write_step176_gate_report.py \
  tools/write_ci_artifact_summary.py

python3 tools/write_step170_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --step170-report build/STEP170_weekly_stageprop.md

python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary.json \
  --report build/STEP176_weekly_stageprop.md

python3 tools/write_step176_dashboard.py \
  --out build/STEP176_dashboard_stageprop.md

python3 tools/write_ci_artifact_summary.py \
  --title stagecheck2 \
  --mode observe \
  --parallel-summary build/editor_parallel_cycle_stagecheck_summary.json \
  --local-summary build/local_ci_summary.json \
  --out build/ci_stagecheck2.md

rg -n "setup_exits|failure_stage_counts|ui_flow_failure_stages|lane_b_ui_flow_failure_stages|lane_b_ui_stage" \
  build/STEP170_weekly_stageprop.md \
  build/STEP176_weekly_stageprop.md \
  build/STEP176_dashboard_stageprop.md \
  build/ci_stagecheck2.md
```

### Result
- compile/syntax: PASS.
- STEP170 weekly output now includes lane-B setup exit line:
  - `lane_b_ui_setup_exits: open/resize/run_code/failure_stage`.
- STEP176 weekly output now includes:
  - `lane_b_ui_flow_setup_exits` (and stage-count line when present).
- STEP176 dashboard output now includes latest-weekly lane-B stage/setup fields:
  - `lane_b_ui_stage`
  - `lane_b_ui_setup`.
- CI artifact summary now includes:
  - `lane_b_ui_flow_failure_stages`
  - existing `*_setup_exits` lines retained.
- `build/local_ci_summary.json` now carries stage-count keys:
  - `editorParallelCycleLaneBUiFlowFailureStageCounts`
  - `editorGateUiFlowFailureStageCounts`

## DC) UI-flow stage trend aggregator + weekly/report/dashboard propagation

### Commands
```bash
bash -n tools/editor_weekly_validation.sh

PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile \
  tools/editor_ui_flow_stage_trend.py \
  tools/write_step170_weekly_report.py \
  tools/write_step176_weekly_report.py \
  tools/write_step176_dashboard.py

python3 tools/editor_ui_flow_stage_trend.py \
  --history-dir build/editor_gate_history \
  --days 14 \
  --out-json build/editor_ui_flow_stage_trend.json \
  --out-md build/editor_ui_flow_stage_trend.md

python3 - <<'PY'
import json
src='build/editor_weekly_validation_summary_step186_runtimeobj.json'
out='build/editor_weekly_validation_summary_stage_trend_test.json'
trend='build/editor_ui_flow_stage_trend.json'
d=json.load(open(src,'r',encoding='utf-8'))
t=json.load(open(trend,'r',encoding='utf-8'))
d['ui_flow_stage_trend']={
  'days': int(t.get('days',0)),
  'status': t.get('status',''),
  'recommended_gate_mode': t.get('recommended_gate_mode','observe'),
  'summary_json': trend,
  'summary_md': 'build/editor_ui_flow_stage_trend.md',
  'enabled_samples_in_window': int(t.get('enabled_samples_in_window',0)),
  'samples_in_window': int(t.get('samples_in_window',0)),
  'samples_total': int(t.get('samples_total',0)),
  'fail_ratio': ((t.get('metrics') or {}).get('fail_ratio') if isinstance(t.get('metrics'),dict) else 0.0),
  'attribution_ratio': ((t.get('metrics') or {}).get('attribution_ratio') if isinstance(t.get('metrics'),dict) else 1.0),
  'failure_stage_counts': ((t.get('metrics') or {}).get('failure_stage_counts') if isinstance(t.get('metrics'),dict) else {}),
  'first_failure_stage_counts': ((t.get('metrics') or {}).get('first_failure_stage_counts') if isinstance(t.get('metrics'),dict) else {}),
  'setup_exit_nonzero_runs': ((t.get('metrics') or {}).get('setup_exit_nonzero_runs') if isinstance(t.get('metrics'),dict) else {}),
  'policy': t.get('policy') if isinstance(t.get('policy'),dict) else {}
}
json.dump(d,open(out,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
print(out)
PY

python3 tools/write_step170_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary_stage_trend_test.json \
  --step170-report build/STEP170_weekly_stage_trend_test.md

python3 tools/write_step176_weekly_report.py \
  --weekly-summary build/editor_weekly_validation_summary_stage_trend_test.json \
  --report build/STEP176_weekly_stage_trend_test.md

mkdir -p build/tmp_weekly_stage_trend_history
cp build/editor_weekly_validation_summary_stage_trend_test.json \
  build/tmp_weekly_stage_trend_history/weekly_stage_trend_test.json
python3 tools/write_step176_dashboard.py \
  --weekly-history-dir build/tmp_weekly_stage_trend_history \
  --out build/STEP176_dashboard_stage_trend_test2.md

rg -n "ui_flow_stage_trend|ui_flow_stage_counts|trend\\(ui_stage\\)|weekly_ui_flow_stage_trend" \
  build/STEP170_weekly_stage_trend_test.md \
  build/STEP176_weekly_stage_trend_test.md \
  build/STEP176_dashboard_stage_trend_test2.md
```

### Result
- syntax + compile: PASS.
- new trend script PASS:
  - `ui_flow_stage_trend_status=watch`
  - `ui_flow_stage_trend_gate_mode=observe`
  - output artifacts:
    - `build/editor_ui_flow_stage_trend.json`
    - `build/editor_ui_flow_stage_trend.md`
- STEP170 weekly writer output includes:
  - `ui_flow_stage_trend: status=watch recommended_gate_mode=observe ...`
  - `ui_flow_stage_counts: flow=2`
  - `ui_flow_stage_trend_json`
- STEP176 weekly writer output includes:
  - `ui_flow_stage_trend`
  - `ui_flow_stage_trend_counts`
  - `ui_flow_stage_trend_first_stage_counts`
  - `ui_flow_stage_trend_json`
- STEP176 dashboard output includes:
  - weekly table column title `trend(ui_stage)`
  - weekly row compact trend cell with UI stage trend fragment (`ui:watch/observe`)
  - latest weekly block line:
    - `weekly_ui_flow_stage_trend: status/recommended_gate_mode/enabled_samples/fail_ratio/attribution_ratio`

## DE) editor_gate trend policy switch (`observe|auto|gate`) + local_ci wiring

### Commands
```bash
bash -n tools/editor_gate.sh tools/local_ci.sh
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile \
  tools/editor_ui_flow_stage_trend.py \
  tools/write_ci_artifact_summary.py

RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_LIMIT=1 EDITOR_SMOKE_NO_CONVERT=1 \
RUN_UI_FLOW_STAGE_TREND=1 UI_FLOW_STAGE_TREND_POLICY=auto UI_FLOW_STAGE_TREND_DAYS=14 \
SUMMARY_PATH=build/editor_gate_summary_stage_policy_auto.json \
HISTORY_DIR=build/editor_gate_history_stage_policy_auto \
EDITOR_OUTDIR=build/editor_roundtrip_stage_policy_auto \
CAD_OUTDIR=build/cad_regression_stage_policy_auto \
bash tools/editor_gate.sh

set +e
RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
EDITOR_SMOKE_LIMIT=1 EDITOR_SMOKE_NO_CONVERT=1 \
RUN_UI_FLOW_STAGE_TREND=1 UI_FLOW_STAGE_TREND_POLICY=gate UI_FLOW_STAGE_TREND_DAYS=14 \
SUMMARY_PATH=build/editor_gate_summary_stage_policy_gate.json \
HISTORY_DIR=build/editor_gate_history_stage_policy_gate \
EDITOR_OUTDIR=build/editor_roundtrip_stage_policy_gate \
CAD_OUTDIR=build/cad_regression_stage_policy_gate \
bash tools/editor_gate.sh >/tmp/editor_gate_policy_gate.log 2>&1
rc=$?
set -e
echo "policy_gate_rc=$rc"

RUN_EDITOR_GATE=1 RUN_EDITOR_PARALLEL_CYCLE=0 \
RUN_EDITOR_SMOKE=0 RUN_EDITOR_SMOKE_GATE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
EDITOR_GATE_RUN_PERF_TREND=0 EDITOR_GATE_RUN_REAL_SCENE_TREND=0 \
EDITOR_GATE_RUN_UI_FLOW_STAGE_TREND=1 \
EDITOR_GATE_UI_FLOW_STAGE_TREND_POLICY=auto \
EDITOR_GATE_UI_FLOW_STAGE_TREND_DAYS=14 \
bash tools/local_ci.sh --offline --skip-compare --quick --build-dir build/local_ci_stage_trend

python3 - <<'PY'
import json
j = json.load(open("build/local_ci_stage_trend/local_ci_summary.json", "r", encoding="utf-8"))
for k in [
  "editorGateRunUiFlowStageTrend",
  "editorGateUiFlowStageTrendPolicyInput",
  "editorGateUiFlowStageTrendDaysInput",
  "editorGateUiFlowStageTrendStatus",
  "editorGateUiFlowStageTrendRecommendedMode",
  "editorGateUiFlowStageTrendEffectiveMode",
  "editorGateUiFlowStageTrendGateSource",
  "editorGateUiFlowStageTrendGateApplied",
  "editorGateUiFlowStageTrendEnabledSamples",
  "editorGateUiFlowStageTrendFailRatio",
  "editorGateUiFlowStageTrendAttributionRatio",
]:
  print(k, j.get(k))
PY

rg -n "local_gate_ui_flow_stage_trend|local_gate_ui_flow_stage_trend_counts" \
  build/local_ci_stage_trend/local_ci_artifact_summary.md
```

### Result
- syntax + compile: PASS.
- `editor_gate` policy `auto` run PASS:
  - trend output: `status=no_data`, `recommended_gate_mode=observe`.
  - effective gating switched to observe path:
    - `ui_flow_smoke_gate=0`
    - `ui_flow_smoke=1` (observe continuity)
  - summary contains new `inputs.ui_flow_stage_trend_*` and top-level `ui_flow_stage_trend`.
- `editor_gate` policy `gate` run behaves as hard gate:
  - process exit: `rc=2`
  - gate reason includes: `UI_FLOW_STAGE_TREND:no_data`
  - summary `ui_flow_stage_trend.policy=gate`, `effective_mode=gate`.
- `local_ci` wiring PASS:
  - `local_ci_summary.json` contains new keys:
    - `editorGateRunUiFlowStageTrend`
    - `editorGateUiFlowStageTrendPolicyInput`
    - `editorGateUiFlowStageTrendStatus`
    - `editorGateUiFlowStageTrendRecommendedMode`
    - `editorGateUiFlowStageTrendEffectiveMode`
    - `editorGateUiFlowStageTrendGateSource`
    - `editorGateUiFlowStageTrendGateApplied`
    - ratios/samples/stage-count fields.
  - `local_ci_artifact_summary.md` contains:
    - `local_gate_ui_flow_stage_trend`
    - `local_gate_ui_flow_stage_trend_counts`

## DF) Follow-up recheck (policy auto/gate + local_ci summary + workflow YAML)

### Commands
```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/cadgamefusion_editor_nightly.yml"); YAML.load_file(".github/workflows/cadgamefusion_editor_light.yml"); puts "yaml_ok"'

bash -n tools/editor_gate.sh
bash -n tools/local_ci.sh
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile \
  tools/write_ci_artifact_summary.py \
  tools/editor_ui_flow_stage_trend.py

RUN_EDITOR_GATE=1 \
RUN_COMPARE=0 RUN_PLM_SMOKE=0 RUN_UNIT_TESTS=0 RUN_UI_FLOW_SMOKE=0 RUN_STEP166_OBSERVE=0 RUN_QT_PROJECT_PERSISTENCE=0 \
EDITOR_GATE_PROFILE=lite \
EDITOR_GATE_RUN_PERF_TREND=0 EDITOR_GATE_RUN_REAL_SCENE_TREND=0 \
EDITOR_GATE_RUN_UI_FLOW_STAGE_TREND=1 \
EDITOR_GATE_UI_FLOW_STAGE_TREND_POLICY=auto \
EDITOR_GATE_UI_FLOW_STAGE_TREND_DAYS=14 \
bash tools/local_ci.sh --offline --skip-compare --quick --build-dir build/local_ci_stage_trend_continue

set +e
EDITOR_GATE_PROFILE=lite \
RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_STAGE_TREND=1 UI_FLOW_STAGE_TREND_POLICY=gate UI_FLOW_STAGE_TREND_DAYS=14 \
RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_stage_policy_gate_check.json \
bash tools/editor_gate.sh >/tmp/editor_gate_stage_policy_gate_check.log 2>&1
rc=$?
set -e
echo "policy_gate_rc=$rc"
```

### Result
- workflow YAML parse: PASS (`yaml_ok`).
- shell + python static checks: PASS.
- `local_ci --quick` PASS:
  - summary: `build/local_ci_stage_trend_continue/local_ci_summary.json`
  - artifact md: `build/local_ci_stage_trend_continue/local_ci_artifact_summary.md`
  - editor smoke run_id: `20260306_213425_487_aa8c`
  - trend line in summary:
    - `status=no_data`
    - `recommended=observe`
    - `effective=observe`
    - `source=auto_recommended_observe`
    - `applied=true`
- `editor_gate` hard-gate check behaves as expected:
  - exit code: `policy_gate_rc=2`
  - summary: `build/editor_gate_summary_stage_policy_gate_check.json`
  - gate reason contains: `UI_FLOW_STAGE_TREND:no_data`
  - editor smoke run_id: `20260306_213438_958_c5bf`

## DG) `check_local_summary` stage-trend contract enforcement

### Commands
```bash
bash -n tools/check_local_summary.sh
bash tools/check_local_summary.sh --offline-allowed --summary build/local_ci_stage_trend_continue/local_ci_summary.json
```

### Result
- syntax: PASS.
- summary check: PASS.
- output now includes explicit stage-trend line:
  - `gateUiStageTrend run=true policy=auto days=14 status=no_data recommended=observe effective=observe source=auto_recommended_observe applied=true enabledSamples=0`
- no regression on existing summary checks (`[summary] OK`).

## DK) Weekly summary/dashboard trend-contract checker

### Commands
```bash
bash -n tools/check_weekly_summary.sh
bash -n tools/editor_weekly_validation.sh
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile tools/write_step176_dashboard.py

mkdir -p build/tmp_weekly_stage_contract_history
cp build/editor_weekly_validation_summary_stage_trend_test.json \
  build/tmp_weekly_stage_contract_history/weekly_stage_contract.json

python3 tools/write_step176_dashboard.py \
  --weekly-history-dir build/tmp_weekly_stage_contract_history \
  --out build/STEP176_dashboard_stage_contract.md

bash tools/check_weekly_summary.sh \
  --summary build/editor_weekly_validation_summary_stage_trend_test.json \
  --dashboard build/STEP176_dashboard_stage_contract.md \
  --require-dashboard

rg -n "weekly_ui_flow_stage_trend_contract|trend\\(ui_stage\\)" \
  build/STEP176_dashboard_stage_contract.md
```

### Result
- syntax + compile: PASS.
- weekly/dashboard contract check: PASS.
- checker output:
  - `OK status=watch mode=observe days=14 enabled_samples=68 fail_ratio=0.029 attribution_ratio=1.000 dashboard=checked`
- dashboard now includes:
  - table header `trend(ui_stage)`
  - `weekly_ui_flow_stage_trend_contract: ok=True issues=-`

## DL) STEP166 retry-exhaustion fail propagation fix verification (`editor_gate --profile full`)

### Commands
```bash
set +e
EDITOR_GATE_PROFILE=full EDITOR_SMOKE_LIMIT=1 \
RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_STAGE_TREND=1 UI_FLOW_STAGE_TREND_POLICY=observe UI_FLOW_STAGE_TREND_DAYS=14 \
RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_full_stage_contract_fix.json \
bash tools/editor_gate.sh >/tmp/editor_gate_full_stage_contract_fix.log 2>&1
rc=$?
set -e
echo "rc=$rc"

python3 - <<'PY'
import json
j = json.load(open("build/editor_gate_summary_full_stage_contract_fix.json", "r", encoding="utf-8"))
gd = j.get("gate_decision", {}) if isinstance(j.get("gate_decision"), dict) else {}
step166 = j.get("step166", {}) if isinstance(j.get("step166"), dict) else {}
print("gate_decision.would_fail", gd.get("would_fail"))
print("gate_decision.exit_code", gd.get("exit_code"))
print("gate_decision.fail_reasons", gd.get("fail_reasons"))
print("step166.gate_would_fail", (step166.get("gate_decision") or {}).get("would_fail"))
PY
```

### Result
- command exit: `rc=2` (expected).
- summary confirms fail propagation:
  - `gate_decision.would_fail=True`
  - `gate_decision.exit_code=2`
  - `gate_decision.fail_reasons=['STEP166:RC_2']`
  - `step166.gate_would_fail=True`
- editor smoke run_id: `20260306_215107_316_66a4`
- step166 run_id: `20260306_135355`

## DM) CI artifact summary exposes gate/local stage-trend contract

### Commands
```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile tools/write_ci_artifact_summary.py

python3 tools/write_ci_artifact_summary.py \
  --title stage-contract-ci \
  --mode gate \
  --gate-summary build/editor_gate_summary_full_stage_contract_fix.json \
  --local-summary build/local_ci_stage_trend_continue/local_ci_summary.json \
  --out build/ci_summary_stage_contract.md

rg -n "ui_flow_stage_trend|ui_flow_stage_trend_contract|local_gate_ui_flow_stage_trend_contract" \
  build/ci_summary_stage_contract.md
```

### Result
- compile: PASS.
- markdown now includes gate trend contract lines:
  - `ui_flow_stage_trend: status=watch recommended=observe ...`
  - `ui_flow_stage_trend_contract: ok=true issues=none`
  - `ui_flow_stage_trend_counts: stages=flow=2 first_stages=flow=1 setup_nonzero=-`
- markdown also includes local trend contract line:
  - `local_gate_ui_flow_stage_trend_contract: ok=true issues=none`

## DN) Workflow-level contract check integration (nightly/light) + tool validation

### Commands
```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile \
  tools/check_ui_flow_stage_trend_contract.py

python3 tools/check_ui_flow_stage_trend_contract.py \
  --gate-summary build/editor_gate_summary_full_stage_contract_fix.json \
  --out-json build/editor_ui_flow_stage_trend_contract_test.json \
  --out-md build/editor_ui_flow_stage_trend_contract_test.md \
  --strict

python3 tools/check_ui_flow_stage_trend_contract.py \
  --local-summary build/local_ci_stage_trend_continue/local_ci_summary.json \
  --out-json build/editor_ui_flow_stage_trend_contract_local_test.json \
  --out-md build/editor_ui_flow_stage_trend_contract_local_test.md \
  --strict

ruby -e 'require "yaml"; YAML.load_file(".github/workflows/cadgamefusion_editor_nightly.yml"); YAML.load_file(".github/workflows/cadgamefusion_editor_light.yml"); puts "yaml_ok_after_contract"'

python3 tools/write_ci_artifact_summary.py \
  --title stage-contract-ci \
  --mode gate \
  --gate-summary build/editor_gate_summary_full_stage_contract_fix.json \
  --local-summary build/local_ci_stage_trend_continue/local_ci_summary.json \
  --out build/ci_summary_stage_contract.md

rg -n "ui_flow_stage_trend_contract|local_gate_ui_flow_stage_trend_contract" \
  build/ci_summary_stage_contract.md
```

### Result
- new tool compile: PASS.
- gate summary contract check: PASS.
  - `source=gate`, `ok=true`, `issues=none`, `status=watch`, `mode=observe`, `days=14`
- local summary contract check: PASS.
  - `source=local`, `ok=true`, `issues=none`, `status=no_data`, `mode=observe`, `days=14`
- nightly/light workflow YAML parse: PASS (`yaml_ok_after_contract`).
- CI artifact markdown now includes:
  - `ui_flow_stage_trend_contract: ok=true issues=none`
  - `local_gate_ui_flow_stage_trend_contract: ok=true issues=none`

## DP) Gate matrix recheck (`lite` + `full`)

### Commands
```bash
EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 \
RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_STAGE_TREND=1 UI_FLOW_STAGE_TREND_POLICY=auto UI_FLOW_STAGE_TREND_DAYS=14 \
RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_lite_stage_contract_fix.json \
bash tools/editor_gate.sh

python3 - <<'PY'
import json
for p in [
  "build/editor_gate_summary_lite_stage_contract_fix.json",
  "build/editor_gate_summary_full_stage_contract_fix.json",
]:
  j = json.load(open(p, "r", encoding="utf-8"))
  gd = j.get("gate_decision", {}) if isinstance(j.get("gate_decision"), dict) else {}
  inp = j.get("inputs", {}) if isinstance(j.get("inputs"), dict) else {}
  step166 = j.get("step166", {}) if isinstance(j.get("step166"), dict) else {}
  print(p, "profile=", inp.get("editor_gate_profile"), "would_fail=", gd.get("would_fail"), "exit=", gd.get("exit_code"), "step166_run_id=", step166.get("run_id"))
PY
```

### Result
- `lite` profile summary:
  - `build/editor_gate_summary_lite_stage_contract_fix.json`
  - `editor_smoke_run_id=20260306_221520_205_f055`
  - `gate_decision.would_fail=false` `exit_code=0`
  - `ui_flow_stage_trend=status=watch recommended=observe effective=observe`
- `full` profile summary (from DL):
  - `build/editor_gate_summary_full_stage_contract_fix.json`
  - `editor_smoke_run_id=20260306_215107_316_66a4`
  - `step166_run_id=20260306_135355`
  - `gate_decision.would_fail=true` `exit_code=2` `fail_reasons=['STEP166:RC_2']`

## DQ) Unified workflow contract fields (`issue_count` + `rc`) and CI markdown propagation

### Commands
```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile \
  tools/check_ui_flow_stage_trend_contract.py \
  tools/write_ci_artifact_summary.py

UI_STAGE_CONTRACT_SOURCE=gate \
UI_STAGE_CONTRACT_OK=true \
UI_STAGE_CONTRACT_ISSUES=none \
UI_STAGE_CONTRACT_ISSUE_COUNT=0 \
UI_STAGE_CONTRACT_STATUS=watch \
UI_STAGE_CONTRACT_MODE=observe \
UI_STAGE_CONTRACT_DAYS=14 \
UI_STAGE_CONTRACT_RC=0 \
python3 tools/write_ci_artifact_summary.py \
  --title stage-contract-ci-env \
  --mode gate \
  --gate-summary build/editor_gate_summary_full_stage_contract_fix.json \
  --local-summary build/local_ci_stage_trend_continue/local_ci_summary.json \
  --out build/ci_summary_stage_contract_env.md

rg -n "workflow_ui_flow_stage_trend_contract|ui_flow_stage_trend_contract|local_gate_ui_flow_stage_trend_contract" \
  build/ci_summary_stage_contract_env.md

ruby -e 'require "yaml"; YAML.load_file(".github/workflows/cadgamefusion_editor_nightly.yml"); YAML.load_file(".github/workflows/cadgamefusion_editor_light.yml"); puts "yaml_ok_contract_count"'
```

### Result
- compile: PASS.
- CI markdown now includes unified workflow contract line:
  - `workflow_ui_flow_stage_trend_contract: ok=true issues=none issue_count=0 source=gate status=watch mode=observe days=14 rc=0`
- gate/local contract lines remain present:
  - `ui_flow_stage_trend_contract: ok=true issues=none`
  - `local_gate_ui_flow_stage_trend_contract: ok=true issues=none`
- workflow YAML parse after issue-count wiring: PASS (`yaml_ok_contract_count`).

## DR) Lane D revalidation (unsupported proxy end-to-end)

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate
```

### Result
- command-level tests: PASS (`109/109`).
- end-to-end UI flow: PASS.
  - summary: `build/editor_ui_flow_smoke/20260306_214644_ui_flow/summary.json`
  - screenshot: `build/editor_ui_flow_smoke/20260306_214644_ui_flow/editor_ui_flow.png`
- `flow.unsupported_proxy_select` confirms the intended read-only behavior:
  - `summary="1 selected (unsupported)"`
  - `readOnlyNote="Selected entity is read-only (unsupported proxy); editing disabled."`
  - `status="Selected entities are read-only proxies"`
  - `entityCountBeforeDelete=2`
  - `entityCountAfterDelete=2`
- conclusion: prior `UI_FLOW_OPEN_TIMEOUT` was a sandbox/runtime constraint during local HTTP bind, not a product defect in unsupported proxy selection or read-only enforcement.

## DS) Lane A/C workflow contract policy enforcement wiring + summary parity

### Commands
```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/cadgamefusion_editor_nightly.yml"); YAML.load_file(".github/workflows/cadgamefusion_editor_light.yml"); puts "yaml_ok_contract_policy"'

python3 tools/check_ui_flow_stage_trend_contract.py \
  --gate-summary build/editor_gate_summary_full_stage_contract_fix.json \
  --strict \
  --out-json build/editor_ui_flow_stage_trend_contract_policy_check.json \
  --out-md build/editor_ui_flow_stage_trend_contract_policy_check.md

UI_STAGE_CONTRACT_SOURCE=gate \
UI_STAGE_CONTRACT_OK=true \
UI_STAGE_CONTRACT_ISSUES=none \
UI_STAGE_CONTRACT_ISSUE_COUNT=0 \
UI_STAGE_CONTRACT_STATUS=watch \
UI_STAGE_CONTRACT_MODE=observe \
UI_STAGE_CONTRACT_DAYS=14 \
UI_STAGE_CONTRACT_RC=0 \
UI_STAGE_CONTRACT_POLICY=gate \
UI_STAGE_CONTRACT_DECISION=pass \
python3 tools/write_ci_artifact_summary.py \
  --title stage-contract-policy-pass \
  --mode observe \
  --out build/ci_summary_contract_policy.md

UI_STAGE_CONTRACT_SOURCE=light_no_editor_gate \
UI_STAGE_CONTRACT_OK=false \
UI_STAGE_CONTRACT_ISSUES=gate_summary_missing \
UI_STAGE_CONTRACT_ISSUE_COUNT=1 \
UI_STAGE_CONTRACT_STATUS=missing \
UI_STAGE_CONTRACT_MODE=observe \
UI_STAGE_CONTRACT_DAYS=0 \
UI_STAGE_CONTRACT_RC=2 \
UI_STAGE_CONTRACT_POLICY=gate \
UI_STAGE_CONTRACT_DECISION=fail \
python3 tools/write_ci_artifact_summary.py \
  --title stage-contract-policy-fail \
  --mode gate \
  --out build/ci_summary_stage_contract_policy_gate.md

rg -n "workflow_ui_flow_stage_trend_contract" \
  build/ci_summary_contract_policy.md \
  build/ci_summary_stage_contract_policy_gate.md
```

### Result
- workflow YAML parse: PASS (`yaml_ok_contract_policy`).
- contract check on gate summary: PASS.
  - `source=gate`, `ok=true`, `issues=none`, `issue_count=0`, `status=watch`, `mode=observe`, `days=14`, `rc=0`.
- CI summary line now carries policy/decision fields:
  - pass sample:
    - `workflow_ui_flow_stage_trend_contract: ok=true ... policy=gate decision=pass ... rc=0`
  - fail sample:
    - `workflow_ui_flow_stage_trend_contract: ok=false issues=gate_summary_missing issue_count=1 ... policy=gate decision=fail ... rc=2`
- workflow wiring check (by file diff/grep):
  - nightly/light both now expose `ui_flow_stage_trend_contract_policy` + `ui_flow_stage_trend_contract_decision`.
  - nightly/light both include explicit enforcement steps that only block when effective policy is `gate` and decision is `fail`.

## DT) Lane A/C local_ci contract-policy parity (editor_gate + summary checker)

### Commands
```bash
bash -n tools/local_ci.sh
bash -n tools/check_local_summary.sh

bash tools/check_local_summary.sh \
  --offline-allowed \
  --summary build/local_ci_stage_trend_continue/local_ci_summary.json

UI_STAGE_CONTRACT_SOURCE=light_no_editor_gate \
UI_STAGE_CONTRACT_OK=false \
UI_STAGE_CONTRACT_ISSUES=gate_summary_missing \
UI_STAGE_CONTRACT_ISSUE_COUNT=1 \
UI_STAGE_CONTRACT_STATUS=missing \
UI_STAGE_CONTRACT_MODE=observe \
UI_STAGE_CONTRACT_DAYS=0 \
UI_STAGE_CONTRACT_RC=2 \
UI_STAGE_CONTRACT_POLICY=gate \
UI_STAGE_CONTRACT_DECISION=fail \
python3 tools/write_ci_artifact_summary.py \
  --title local-contract-policy-gate \
  --mode gate \
  --out build/ci_summary_local_contract_policy_gate.md

rg -n "workflow_ui_flow_stage_trend_contract" \
  build/ci_summary_local_contract_policy_gate.md

python3 - <<'PY'
import json
from pathlib import Path
src = Path("build/local_ci_stage_trend_continue/local_ci_summary.json")
base = json.loads(src.read_text(encoding="utf-8"))
for target, decision, rc in [
    ("build/local_ci_contract_policy_ok.json", "pass", 0),
    ("build/local_ci_contract_policy_fail.json", "fail", 2),
]:
    payload = dict(base)
    payload["runEditorGate"] = True
    payload["editorGateStatus"] = "ok"
    payload["editorGateRunUiFlowStageTrend"] = True
    payload["editorGateUiFlowStageContractPolicyInput"] = "gate"
    payload["editorGateUiFlowStageContractPolicyEffective"] = "gate"
    payload["editorGateUiFlowStageContractDecision"] = decision
    payload["editorGateUiFlowStageContractSource"] = "gate"
    payload["editorGateUiFlowStageContractOk"] = (decision == "pass")
    payload["editorGateUiFlowStageContractIssues"] = "none" if decision == "pass" else "policy_gate_contract_invalid"
    payload["editorGateUiFlowStageContractIssueCount"] = 0 if decision == "pass" else 1
    payload["editorGateUiFlowStageContractStatus"] = "watch"
    payload["editorGateUiFlowStageContractMode"] = "observe"
    payload["editorGateUiFlowStageContractDays"] = 14
    payload["editorGateUiFlowStageContractRc"] = rc
    Path(target).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY

bash tools/check_local_summary.sh --offline-allowed --summary build/local_ci_contract_policy_ok.json
set +e
bash tools/check_local_summary.sh --offline-allowed --summary build/local_ci_contract_policy_fail.json
echo "fail_rc=$?"
set -e
```

### Result
- shell syntax checks: PASS.
- `check_local_summary.sh` with legacy local summary fixture: PASS (backward-compatible fallback for missing new contract fields).
- artifact markdown contract line includes policy/decision in local context:
  - `workflow_ui_flow_stage_trend_contract: ... policy=gate decision=fail ... rc=2`
- synthetic contract-policy matrix for checker behavior:
  - `effective=gate + decision=pass + rc=0`: PASS.
  - `effective=gate + decision=fail + rc=2`: FAIL (`fail_rc=2`).
- implementation confirmation:
  - `tools/local_ci.sh` now exports/records:
    - `editorGateUiFlowStageContractPolicyInput`
    - `editorGateUiFlowStageContractPolicyEffective`
    - `editorGateUiFlowStageContractDecision`
    - `editorGateUiFlowStageContractSource/Ok/Issues/IssueCount/Status/Mode/Days/Rc`
  - strict local gate now blocks when contract policy is effectively `gate` and decision is `fail`.

## DU) Lane B preselected polyline status-guidance refinement (Fillet/Chamfer)

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js

EDITOR_GATE_PROFILE=lite EDITOR_SMOKE_LIMIT=3 \
RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_step185_polyline_hint.json \
bash tools/editor_gate.sh

# optional environment check (may fail outside stable local playwright wrapper runtime)
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate
```

### Result
- command tests: PASS (`109/109`).
  - updated assertions verify new prompt sequence for single preselected polyline:
    - first prompt: `... first side on selected polyline ...`
    - second prompt after refinement click: `... second side on selected polyline ...`
- editor_gate(lite) smoke matrix: PASS.
  - summary: `build/editor_gate_summary_step185_polyline_hint.json`
  - editor smoke run_id: `20260306_231037_405_e569`
  - `totals pass=3 fail=0 skipped=0`
  - gate decision: `would_fail=false`
- optional UI-flow gate run in this sandbox session failed with `UI_FLOW_OPEN_TIMEOUT`.
  - summary: `build/editor_ui_flow_smoke/20260306_230938_ui_flow/summary.json`
  - failure code: `UI_FLOW_OPEN_TIMEOUT`
  - attribution: environment/runtime Playwright open timeout; command-level + gate-smoke checks above remained green.

## DV) UI-flow open-timeout recheck (extended setup timeout)

### Command
```bash
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh \
  --mode gate \
  --port 18181 \
  --pwcli-setup-timeout-sec 60 \
  --pwcli-timeout-sec 90
```

### Result
- still failed with `UI_FLOW_OPEN_TIMEOUT` at `open` stage in this sandbox runtime.
  - summary: `build/editor_ui_flow_smoke/20260306_231245_ui_flow/summary.json`
  - `open_exit_code=124`
  - `flow_failure_detail` contains `pwcli timeout after 60.0s`
- this confirms the current issue is environment/runtime-level for browser open in this session, not command-level geometry regressions.

## DW) Polyline preselection prompt-contract sync (UI-flow script + gate smoke)

### Commands
```bash
bash -n tools/web_viewer/scripts/editor_ui_flow_smoke.sh

# fast failure-path run to execute summary writer/contract path in this sandbox runtime
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh \
  --mode observe \
  --port 18281 \
  --pwcli-setup-timeout-sec 2 \
  --pwcli-timeout-sec 4

node --test tools/web_viewer/tests/editor_commands.test.js

EDITOR_GATE_PROFILE=lite EDITOR_SMOKE_LIMIT=2 \
RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_step185_polyline_promptsync.json \
bash tools/editor_gate.sh
```

### Result
- `editor_ui_flow_smoke.sh` syntax check: PASS.
- observe quick run produced summary successfully (writer/contract path executed):
  - `build/editor_ui_flow_smoke/20260306_232933_ui_flow/summary.json`
  - failure is still environment-side `UI_FLOW_OPEN_TIMEOUT` (expected in this sandbox).
- command tests remain green after prompt-contract update:
  - `node --test ...editor_commands.test.js` => `109/109 PASS`.
- gate smoke matrix (without UI-flow gate) remains green:
  - summary: `build/editor_gate_summary_step185_polyline_promptsync.json`
  - roundtrip run_id: `20260306_233007_760_cc10`
  - `totals pass=2 fail=0 skipped=0`
  - `gate_decision.would_fail=false`

## DX) UI-flow open retry hardening verification

### Commands
```bash
bash -n tools/web_viewer/scripts/editor_ui_flow_smoke.sh

PWCLI_OPEN_RETRIES=3 \
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh \
  --mode observe \
  --port 18381 \
  --pwcli-setup-timeout-sec 1 \
  --pwcli-timeout-sec 1

python3 - <<'PY'
import json
j=json.load(open('build/editor_ui_flow_smoke/20260306_233247_ui_flow/summary.json'))
print(j.get('flow_failure_code'), j.get('open_attempt_count'), j.get('open_retry_limit'), j.get('open_attempt_exit_codes'))
PY

EDITOR_GATE_PROFILE=lite EDITOR_SMOKE_LIMIT=1 \
RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_step185_open_retry.json \
bash tools/editor_gate.sh
```

### Result
- script syntax: PASS.
- retry behavior confirmed in summary:
  - file: `build/editor_ui_flow_smoke/20260306_233247_ui_flow/summary.json`
  - `flow_failure_code=UI_FLOW_OPEN_TIMEOUT`
  - `open_attempt_count=3`
  - `open_retry_limit=3`
  - `open_attempt_exit_codes=1:124,2:124,3:124`
- editor_gate lite smoke remains PASS after retry hardening change:
  - summary: `build/editor_gate_summary_step185_open_retry.json`
  - roundtrip run_id: `20260306_233355_931_33c0`
  - `totals pass=1 fail=0 skipped=0`
  - gate decision: `would_fail=false`

## DY) Open-retry propagation verification (parallel/weekly/local contract path)

### Commands
```bash
bash -n tools/editor_parallel_cycle.sh \
  && bash -n tools/editor_weekly_validation.sh \
  && bash -n tools/check_local_summary.sh

PWCLI_SETUP_TIMEOUT_SEC=1 PWCLI_TIMEOUT_SEC=1 \
RUN_LANE_A=0 RUN_LANE_B=1 RUN_LANE_C=0 \
LANE_B_RUN_UI_FLOW=1 LANE_B_UI_FLOW_MODE=observe LANE_B_UI_FLOW_OPEN_RETRIES=3 \
OUT_DIR=build/editor_parallel_cycle_step185_open_retry \
bash tools/editor_parallel_cycle.sh

python3 - <<'PY'
import json
j=json.load(open('build/editor_parallel_cycle_step185_open_retry/summary.json'))
ui=j.get('lanes',{}).get('lane_b',{}).get('ui_flow',{})
print(ui.get('open_retries'), ui.get('open_attempt_count'), ui.get('open_attempt_exit_codes'))
PY

EDITOR_GATE_PROFILE=lite EDITOR_SMOKE_LIMIT=1 \
RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES=3 \
EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_step185_open_retry_prop.json \
bash tools/editor_gate.sh

python3 - <<'PY'
import json
j=json.load(open('build/editor_gate_summary_step185_open_retry_prop.json'))
print(j.get('inputs',{}).get('editor_ui_flow_pwcli_open_retries'), j.get('ui_flow_smoke',{}).get('open_retries'))
PY

python3 - <<'PY'
import json
j={
  'offline': False, 'scenes': ['scene_a'], 'missingScenes': [], 'validationFailCount': 0,
  'skipCompare': False, 'ctestHatchDashStatus': 'ok', 'ctestTextAlignPartialStatus': 'ok',
  'ctestTextAlignExtendedStatus': 'ok', 'ctestHatchDenseCapStatus': 'ok',
  'ctestHatchLargeBoundaryBudgetStatus': 'ok', 'ctestNonfiniteNumbersStatus': 'ok',
  'runEditorSmokeGate': False, 'runEditorUiFlowSmokeGate': False,
  'runEditorGate': False, 'runEditorParallelCycle': False
}
json.dump(j, open('build/check_local_summary_smoke.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)
PY
bash tools/check_local_summary.sh --summary build/check_local_summary_smoke.json
```

### Result
- script syntax checks: PASS (`editor_parallel_cycle.sh`, `editor_weekly_validation.sh`, `check_local_summary.sh`).
- parallel lane-B propagation path verified:
  - run_id: `20260306_234743`
  - summary: `build/editor_parallel_cycle_step185_open_retry/summary.json`
  - lane-B ui-flow values:
    - `open_retries=3`
    - `open_attempt_count=3`
    - `open_attempt_exit_codes=1:124,2:124,3:124`
    - failure attribution code preserved: `UI_FLOW_OPEN_TIMEOUT`
- editor_gate input->summary propagation verified:
  - summary: `build/editor_gate_summary_step185_open_retry_prop.json`
  - `inputs.editor_ui_flow_pwcli_open_retries=3`
  - `ui_flow_smoke.open_retries=3`
  - gate run PASS (lite profile), roundtrip run_id: `20260306_234853_236_bbe7`.
- local summary checker compatibility smoke: PASS on synthetic summary (`build/check_local_summary_smoke.json`).
  - confirms new retry-field parser path does not break non-gate local summaries.

## DZ) Open-attempt telemetry propagation verification (gate/local/report path)

### Commands
```bash
bash -n tools/local_ci.sh \
  && bash -n tools/check_local_summary.sh \
  && bash -n tools/editor_gate.sh
PYTHONPYCACHEPREFIX=/tmp python3 -m py_compile tools/write_ci_artifact_summary.py

node --test tools/web_viewer/tests/editor_commands.test.js

PWCLI_SETUP_TIMEOUT_SEC=1 PWCLI_TIMEOUT_SEC=1 \
EDITOR_GATE_PROFILE=lite EDITOR_SMOKE_LIMIT=1 \
RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_EDITOR_UI_FLOW_SMOKE=1 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_UI_FLOW_PWCLI_OPEN_RETRIES=3 EDITOR_UI_FLOW_TIMEOUT_MS=1 \
EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_step185_open_attempt_contract.json \
bash tools/editor_gate.sh

PWCLI_SETUP_TIMEOUT_SEC=1 PWCLI_TIMEOUT_SEC=1 \
RUN_LANE_A=0 RUN_LANE_B=1 RUN_LANE_C=0 \
LANE_B_RUN_UI_FLOW=1 LANE_B_UI_FLOW_MODE=observe LANE_B_UI_FLOW_OPEN_RETRIES=3 \
OUT_DIR=build/editor_parallel_cycle_step185_open_attempts2 \
bash tools/editor_parallel_cycle.sh

python3 tools/write_ci_artifact_summary.py \
  --mode observe \
  --gate-summary build/editor_gate_summary_step185_open_attempt_contract.json \
  --parallel-summary build/editor_parallel_cycle_step185_open_attempts2/summary.json \
  --local-summary build/check_local_summary_smoke.json \
  --out build/ci_artifact_summary_step185_open_attempts.md
```

### Result
- static validation: PASS (`bash -n` for modified shell scripts + `py_compile` for reporter with writable pycache override).
- command tests: PASS (`node --test ...editor_commands.test.js`, `109/109`).
- gate summary contract fields verified:
  - `build/editor_gate_summary_step185_open_attempt_contract.json` contains `ui_flow_smoke.open_attempt_count` + `ui_flow_smoke.open_attempt_exit_codes` keys.
  - in this sandbox run, UI-flow smoke was skipped due port-allocation permission (`enabled=false`), so values are `0/""` but schema is present.
- parallel lane-B runtime telemetry verified on real run:
  - `build/editor_parallel_cycle_step185_open_attempts2/summary.json`
  - lane-B UI-flow:
    - `open_retries=3`
    - `open_attempt_count=3`
    - `open_attempt_exit_codes=1:124,2:124,3:124`
- reporter rendering verification:
  - `build/ci_artifact_summary_step185_open_attempts.md` now includes `open_retries/open_attempts` lines for:
    - gate `ui_flow_smoke`
    - parallel `lane_b_ui_flow_checks`
    - local `local_ui_flow_smoke` / `local_gate_ui_flow_setup_exits`.

## EA) Parallel markdown open-attempt visibility recheck

### Commands
```bash
bash -n tools/editor_weekly_validation.sh
bash -n tools/editor_parallel_cycle.sh

PWCLI_SETUP_TIMEOUT_SEC=1 PWCLI_TIMEOUT_SEC=1 \
RUN_LANE_A=0 RUN_LANE_B=1 RUN_LANE_C=0 \
LANE_B_RUN_UI_FLOW=1 LANE_B_UI_FLOW_MODE=observe LANE_B_UI_FLOW_OPEN_RETRIES=2 \
OUT_DIR=build/editor_parallel_cycle_step185_open_attempts3 \
bash tools/editor_parallel_cycle.sh

python3 - <<'PY'
import json
j=json.load(open('build/editor_parallel_cycle_step185_open_attempts3/summary.json'))
ui=j.get('lanes',{}).get('lane_b',{}).get('ui_flow',{})
print(ui.get('open_retries'), ui.get('open_attempt_count'), ui.get('open_attempt_exit_codes'))
PY

rg -n "open_attempts|open_attempt_exit_codes" \
  build/editor_parallel_cycle_step185_open_attempts3/summary.md
```

### Result
- syntax checks: PASS (`editor_weekly_validation.sh`, `editor_parallel_cycle.sh`).
- parallel cycle run PASS:
  - run_id: `20260307_001350`
  - summary: `build/editor_parallel_cycle_step185_open_attempts3/summary.json`
  - lane-B ui-flow:
    - `open_retries=2`
    - `open_attempt_count=2`
    - `open_attempt_exit_codes=1:124,2:124`
- markdown visibility PASS:
  - `build/editor_parallel_cycle_step185_open_attempts3/summary.md` contains:
    - lane B line with `open_attempts=2`
    - `ui_flow_open_attempt_exit_codes: 1:124,2:124`.

## EB) Derived proxy metadata visibility + unified read-only guard

### Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate
```

### Result
- command-level regression: PASS (`110/110`).
  - new assertions cover:
    - `selection.move rejects derived proxy entity by editMode`
    - CADGF adapter import/export preserves `source_type/edit_mode/proxy_kind/block_name`
    - dimension text metadata remains stable when the entity is read-only.
- UI flow gate smoke: PASS.
  - summary: `build/editor_ui_flow_smoke/20260307_002313_ui_flow/summary.json`
  - `unsupported_proxy_select.readOnlyNote` remains:
    - `Selected entity is read-only (unsupported proxy); editing disabled.`
  - `unsupported_proxy_select.entityCountBeforeDelete == entityCountAfterDelete == 2`
- conclusion:
  - widening the read-only guard from `unsupported` to all `editMode=proxy` entities did not regress existing unsupported-proxy interaction flow.
  - property panel/read-only note changes remain compatible with current browser smoke expectations.

## EC) Selection provenance chip + round-trip proxy semantics

### Commands
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js \
  --mode gate \
  --cases tools/web_viewer/tests/fixtures/editor_roundtrip_smoke_cases.json \
  --limit 10 \
  --no-convert

jq '{totals, results: [.results[] | {name, status, derived_proxy_count: .import.derived_proxy_count, exploded_origin_count: .import.exploded_origin_count, derived_proxy_semantics: .export.derived_proxy_semantics, exploded_origin_editability: .export.exploded_origin_editability}]}' \
  build/editor_roundtrip/20260307_003234_184_a0fe/summary.json

bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate
```

### Result
- round-trip smoke: PASS.
  - run_id: `20260307_003234_184_a0fe`
  - summary: `build/editor_roundtrip/20260307_003234_184_a0fe/summary.json`
  - fixture coverage:
    - `cadgf_smoke_fixture_derived_proxy`: PASS
    - `cadgf_smoke_fixture_minimal`: PASS
- derived-proxy semantics on the new fixture: PASS.
  - `derived_proxy_count=2`
  - `exploded_origin_count=1`
  - `derived_proxy_semantics`:
    - `checked=2 missing=0 metadata_drift=0 editable=0`
  - `exploded_origin_editability`:
    - `checked=1 missing=0 metadata_drift=0 blocked=0`
- UI flow gate smoke after status bar selection chip change: PASS.
  - summary: `build/editor_ui_flow_smoke/20260307_003246_ui_flow/summary.json`
- convert-enabled round-trip rerun for workflow parity: PASS.
  - run_id: `20260307_003459_228_7606`
  - summary: `build/editor_roundtrip/20260307_003459_228_7606/summary.json`
- conclusion:
  - selection provenance can be surfaced in the status bar without regressing the editor shell.
  - fixture-driven round-trip smoke now proves both invariants:
    - proxy-derived entities remain read-only after export/re-import
    - exploded insert fragments remain editable after export/re-import.
