# STEP172 Editor Interaction Refinement Verification

## Run Info
- date_utc: `2026-02-11T17:06:00Z`
- workspace: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion`
- scope: `Arc radius grip + grip hover + polyline path-aware extend + gate regression`

## Commands
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode gate --limit 5
./scripts/cad_regression_run.py --mode observe --max-workers 2
./scripts/cad_regression_run.py --mode gate --baseline docs/baselines/STEP166_baseline_summary.json --max-workers 2
EDITOR_SMOKE_LIMIT=5 CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=1 bash tools/editor_gate.sh
```

## Results
### Web command tests
- status: PASS
- totals: `14/14 pass`（基线）
- note: 包含新增 polyline path-aware extend 测试

### Editor round-trip smoke (gate)
- run_id: `20260212_010243_020_2187`
- summary_json:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260212_010243_020_2187/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets:
  - `INPUT_INVALID=0`
  - `IMPORT_FAIL=0`
  - `VIEWPORT_LAYOUT_MISSING=0`
  - `RENDER_DRIFT=0`
  - `TEXT_METRIC_DRIFT=0`

### STEP166 observe
- run_id: `20260211_170253`
- summary_json:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260211_170253/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- gate_would_fail: `False`

### STEP166 gate (baseline compare)
- run_id: `20260211_170331`
- summary_json:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260211_170331/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- baseline_compare: `compared_cases=6 degraded_cases=0 improved_cases=0`
- gate_would_fail: `False`

### One-button gate
- command:
  - `EDITOR_SMOKE_LIMIT=5 CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=1 bash tools/editor_gate.sh`
- editor_smoke run_id: `20260212_010456_733_b2d3`
- step166 run_id: `20260211_170458`
- history snapshot:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_history/gate_20260211_170528_20260212_010456_733_b2d3_20260211_170458.json`
- result:
  - editor smoke: `pass=5 fail=0 skipped=0`
  - step166 gate: `pass=6 fail=0 skipped=1`
  - gate_would_fail: `False`

## 5-run trend (standard gate)
- source: `build/editor_gate_history/gate_*.json`

| seq | editor_smoke_run_id | step166_run_id | editor totals | step166 totals | gate_would_fail |
| --- | --- | --- | --- | --- | --- |
| 1 | `20260212_005603_846_8ad8` | `20260211_165605` | `5/0/0` | `6/0/1` | `False` |
| 2 | `20260212_005639_770_7642` | `20260211_165642` | `5/0/0` | `6/0/1` | `False` |
| 3 | `20260212_005714_280_a052` | `20260211_165716` | `5/0/0` | `6/0/1` | `False` |
| 4 | `20260212_005748_269_83e9` | `20260211_165750` | `5/0/0` | `6/0/1` | `False` |
| 5 | `20260212_005922_404_ae80` | `20260211_165924` | `5/0/0` | `6/0/1` | `False` |

## Conclusion
- STEP172 目标项在当前范围内已达成：交互行为更一致、回归链路持续稳定。
- 当前可继续推进 STEP173（性能基线量化与阈值管理），无需回滚。
- 建议保持 `EDITOR_SMOKE_LIMIT=5` 作为标准 gate 样本规模，周内 observe 持续运行。

## Incremental Verification (2026-02-11T17:14:59Z)
### Web command tests (expanded)
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
```
- status: PASS
- totals: `18/18 pass`（首轮）
- 新增覆盖：
  - `selection.extend` 多边界最近交点命中
  - `selection.trim` 多边界按 pick 侧裁剪
  - `trim/extend tool` 连续操作 + `Esc` 重置语义

### Editor smoke gate
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode gate --limit 5
```
- run_id: `20260212_011418_279_3dbb`（首次）
- run_id: `20260212_011606_380_da21`（trim/extend 状态栏收口后复跑）
- totals: `pass=5 fail=0 skipped=0`

### One-button gate
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

### Weekly fixed script
```bash
bash tools/editor_weekly_validation.sh
```
- summary_json:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- run_ids:
  - editor_smoke: `20260212_105611_519_cda1`
  - step166(observe): `20260212_025613`
  - performance: `20260212_025653`

### Weekly fixed script (with gate)
```bash
RUN_GATE=1 EDITOR_SMOKE_LIMIT=3 GATE_SMOKE_LIMIT=3 GATE_CAD_ATTEMPTS=1 GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
- summary_json:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- run_ids:
  - editor_smoke(observe): `20260212_105905_164_ff12`
  - step166(observe): `20260212_025906`
  - performance: `20260212_025946`
  - one-button gate editor_smoke: `20260212_105946_892_b670`
  - one-button gate step166(gate): `20260212_025948`

### Weekly fixed script (with gate, refreshed)
```bash
RUN_GATE=1 EDITOR_SMOKE_LIMIT=3 GATE_SMOKE_LIMIT=3 GATE_CAD_ATTEMPTS=1 GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
- summary_json:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- run_ids:
  - editor_smoke(observe): `20260212_110238_120_c89d`
  - step166(observe): `20260212_030239`
  - performance: `20260212_030317`
  - one-button gate editor_smoke: `20260212_110318_106_730a`
  - one-button gate step166(gate): `20260212_030319`

### Weekly fixed script (with gate, command-level perf profiling)
```bash
RUN_GATE=1 EDITOR_SMOKE_LIMIT=3 GATE_SMOKE_LIMIT=3 GATE_CAD_ATTEMPTS=1 GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
- summary_json:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- run_ids:
  - editor_smoke(observe): `20260212_110631_140_0987`
  - step166(observe): `20260212_030632`
  - performance: `20260212_030706`
  - one-button gate editor_smoke: `20260212_110706_619_aa9a`
  - one-button gate step166(gate): `20260212_030707`

## Incremental Verification (2026-02-12T02:32:06Z)
### Web command tests (segment-level extend enabled)
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
```
- status: PASS
- totals: `19/19 pass`
- 新增覆盖：
  - `selection.extend on polyline supports segment-level endpoint extension`

### Editor smoke gate
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode gate --limit 5
```
- run_id: `20260212_103122_228_0b9c`
- totals: `pass=5 fail=0 skipped=0`

### One-button gate
```bash
EDITOR_SMOKE_LIMIT=5 CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=1 bash tools/editor_gate.sh
```
- editor_smoke run_id: `20260212_103134_069_861e`
- step166 run_id: `20260212_023136`
- history snapshot:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_history/gate_20260212_023206_20260212_103134_069_861e_20260212_023136.json`
- result:
  - editor smoke: `pass=5 fail=0 skipped=0`
  - step166 gate: `pass=6 fail=0 skipped=1`
  - gate_would_fail: `False`

## Incremental Verification (2026-02-12T03:13:27Z)
### Web command tests (edge-path hardening)
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
```
- status: PASS
- totals: `25/25 pass`
- 新增覆盖：
  - `selection.trim rejects locked target layer`
  - `selection.extend rejects boundary without line segments`
  - `selection.trim returns no-intersection on disjoint boundaries`
- 修正项：
  - `selection.extend rejects locked target layer` 用例改为“先建实体后锁层”，避免 `addEntity` 被锁层拦截造成假失败

### Editor smoke observe
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 3
```
- run_id: `20260212_111249_817_2ff1`
- totals: `pass=3 fail=0 skipped=0`

### One-button gate
```bash
EDITOR_SMOKE_LIMIT=3 CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_gate.sh
```
- editor_smoke run_id: `20260212_111257_883_e3f4`
- step166 run_id: `20260212_031258`
- history snapshot:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_history/gate_20260212_031327_20260212_111257_883_e3f4_20260212_031258.json`
- result:
  - editor smoke: `pass=3 fail=0 skipped=0`
  - step166 gate: `pass=6 fail=0 skipped=1`
  - gate_would_fail: `False`
