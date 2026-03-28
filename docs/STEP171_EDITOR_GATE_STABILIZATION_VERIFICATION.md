# STEP171 Editor Gate Stabilization Verification

## Run Info
- date_utc: `2026-02-11T16:42:08Z`
- workspace: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion`
- baseline: `docs/baselines/STEP166_baseline_summary.json`

## Commands
```bash
EDITOR_SMOKE_LIMIT=1 CAD_ATTEMPTS=1 bash tools/editor_gate.sh
```

## Results
### Editor command tests
- status: PASS
- command: `node --test tools/web_viewer/tests/editor_commands.test.js`
- tests: `13/13 pass`

### Editor round-trip smoke (gate)
- run_id: `20260212_004129_341_36fc`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260212_004129_341_36fc/summary.json`
- totals: `pass=1 fail=0 skipped=0`
- gate_would_fail: `False`

### STEP166 baseline gate
- run_id: `20260211_164131`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260211_164131`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260211_164131/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets:
  - `INPUT_INVALID=0`
  - `IMPORT_FAIL=0`
  - `VIEWPORT_LAYOUT_MISSING=0`
  - `RENDER_DRIFT=0`
  - `TEXT_METRIC_DRIFT=0`
- baseline_compare: `compared_cases=6 degraded_cases=0 improved_cases=3`
- gate_would_fail: `False`

## Artifacts
- current summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- history snapshot:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_history/`

## Conclusion
- STEP171 gate stabilization baseline is working end-to-end with one-button execution.
- Result data is now persisted in both latest summary and immutable history snapshots.
- Next iteration can raise smoke size (`EDITOR_SMOKE_LIMIT=5`) for weekly standard gate.

## Re-run (2026-02-11T16:48:26Z)
```bash
EDITOR_SMOKE_LIMIT=1 CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=1 bash tools/editor_gate.sh
```
- editor_smoke run_id: `20260212_004750_144_48aa`
- step166 run_id: `20260211_164751`
- gate summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- history snapshot:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_history/gate_20260211_164826_20260212_004750_144_48aa_20260211_164751.json`
- result:
  - editor smoke: `pass=1 fail=0 skipped=0`
  - step166 gate: `pass=6 fail=0 skipped=1`
  - gate_would_fail: `False`

## Standard Gate Re-run (2026-02-11T16:49:56Z)
```bash
EDITOR_SMOKE_LIMIT=5 CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=1 bash tools/editor_gate.sh
```
- editor_smoke run_id: `20260212_004923_627_3ba1`
- step166 run_id: `20260211_164925`
- gate summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- history snapshot:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_history/gate_20260211_164956_20260212_004923_627_3ba1_20260211_164925.json`
- result:
  - editor smoke: `pass=5 fail=0 skipped=0`
  - step166 gate: `pass=6 fail=0 skipped=1`
  - gate_would_fail: `False`

## 5x Standard Gate Trend (2026-02-11, historical snapshots)
- source: `build/editor_gate_history/gate_*.json`
- criteria: `EDITOR_SMOKE_LIMIT=5` + STEP166 baseline gate

| seq | editor_smoke_run_id | step166_run_id | editor totals | step166 totals | gate_would_fail |
| --- | --- | --- | --- | --- | --- |
| 1 | `20260212_005603_846_8ad8` | `20260211_165605` | `5/0/0` | `6/0/1` | `False` |
| 2 | `20260212_005639_770_7642` | `20260211_165642` | `5/0/0` | `6/0/1` | `False` |
| 3 | `20260212_005714_280_a052` | `20260211_165716` | `5/0/0` | `6/0/1` | `False` |
| 4 | `20260212_005748_269_83e9` | `20260211_165750` | `5/0/0` | `6/0/1` | `False` |
| 5 | `20260212_005922_404_ae80` | `20260211_165924` | `5/0/0` | `6/0/1` | `False` |

## Latest One-button Gate (2026-02-11T17:05:28Z)
```bash
EDITOR_SMOKE_LIMIT=5 CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=1 bash tools/editor_gate.sh
```
- editor_smoke run_id: `20260212_010456_733_b2d3`
- step166 run_id: `20260211_170458`
- history snapshot:
  - `build/editor_gate_history/gate_20260211_170528_20260212_010456_733_b2d3_20260211_170458.json`
- result:
  - editor smoke: `pass=5 fail=0 skipped=0`
  - step166 gate: `pass=6 fail=0 skipped=1`
  - gate_would_fail: `False`

## Latest One-button Gate (2026-02-11T17:14:59Z)
```bash
EDITOR_SMOKE_LIMIT=5 CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=1 bash tools/editor_gate.sh
```
- editor_smoke run_id: `20260212_011428_599_d1bf`
- step166 run_id: `20260211_171430`
- history snapshot:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_history/gate_20260211_171459_20260212_011428_599_d1bf_20260211_171430.json`
- result:
  - editor smoke: `pass=5 fail=0 skipped=0`
  - step166 gate: `pass=6 fail=0 skipped=1`
  - gate_would_fail: `False`
