# STEP171 Editor Gate Stabilization Design

## Background
- STEP170 already delivered Level A editor capability and baseline regression flow.
- Current objective is to make gate execution repeatable and auditable for long-running development.
- Scope focuses on automation and verification, not new CAD entity features.

## Objectives
1. Keep one-button gate as the primary acceptance entry.
2. Persist each gate run for trend analysis.
3. Standardize verification report append format.
4. Keep baseline gate semantics aligned with STEP166 (`negative` cases do not block).

## Deliverables
- `tools/editor_gate.sh`
  - outputs `build/editor_gate_summary.json`
  - writes history snapshot under `build/editor_gate_history/`
  - optionally appends verification report when `EDITOR_GATE_APPEND_REPORT=1`
- `tools/write_editor_gate_report.py`
  - appends structured run records to `docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md`
- this design and verification pair:
  - `docs/STEP171_EDITOR_GATE_STABILIZATION_DESIGN.md`
  - `docs/STEP171_EDITOR_GATE_STABILIZATION_VERIFICATION.md`

## Data Contract
### `build/editor_gate_summary.json`
- `generated_at`
- `baseline`
- `cad_attempts.{max,used}`
- `editor_smoke`
  - `run_id`
  - `summary_json`
  - `totals`
  - `failure_buckets`
  - `gate_decision`
- `step166`
  - `run_id`
  - `run_dir`
  - `summary_json`
  - `totals`
  - `failure_buckets`
  - `gate_decision`
  - `baseline_compare`

### `build/editor_gate_history/gate_*.json`
- same schema as `editor_gate_summary.json`
- immutable run snapshots for trend tracking

## Execution Model
1. Node command tests
2. Editor round-trip smoke in gate mode
3. STEP166 baseline gate with retry on transient `HTTP server failed to start` drift-only failures
4. Write summary + history snapshot
5. Optional report append

## Verification Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode gate --limit 5
./scripts/cad_regression_run.py --mode gate --baseline docs/baselines/STEP166_baseline_summary.json
bash tools/editor_gate.sh
```

## Risks and Controls
- Risk: transient local bind/network failures in compare stage.
  - Control: bounded retry (`CAD_ATTEMPTS`) only for drift-only transient signature.
- Risk: report inconsistency from manual edits.
  - Control: use `tools/write_editor_gate_report.py` to append a normalized section.
- Risk: overfitting to a tiny smoke set.
  - Control: keep quick mode for dev (`limit=1..3`) and standard mode for weekly gate (`limit=5`).

## Rollback
- If gate automation regresses, rollback only:
  - `tools/editor_gate.sh`
  - `tools/write_editor_gate_report.py`
- Do not rollback STEP166 semantics or editor command logic in this step.
