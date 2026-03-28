# STEP176 Level A 持续开发与验证报告

## 1. 执行信息
- 执行日期：`2026-02-12`
- 工作区：`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion`
- 对应计划：`docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_PLAN.md`

## 2. 本轮执行命令
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
python3 -m py_compile scripts/cad_regression_run.py tools/editor_stability_soak.py tools/editor_gate_trend.py
RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=3 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
python3 tools/editor_stability_soak.py --rounds 3 --run-gate 1 --append-report 0
```

## 3. 功能与脚本验证
- Node command tests: `25/25 pass`
- Python syntax checks: `PASS`
- 结论：本轮新增/已存量脚本在执行层面无语法与单测回退。

## 4. Weekly 链路结果（latest）
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- generated_at: `2026-02-12T06:07:00.604703+00:00`
- run_ids:
  - editor_smoke(observe): `20260212_140559_799_7fb0`
  - step166(observe): `20260212_060602` (`gate_would_fail=false`)
  - synthetic perf: `20260212_060630`
  - real-scene perf: `20260212_060630` (`PASS`)
  - gate(editor+step166): `20260212_140630_268_8425` + `20260212_060632`

## 5. STEP166 漂移确认机制状态
- observe summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_060602/summary.json`
- gate summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_060632/summary.json`
- `drift_confirmation`:
  - enabled: `true`
  - rechecked: `0`
  - confirmed: `0`
  - recovered: `0`
  - compare_fail: `0`
- 结论：本轮无 `TEXT_METRIC_DRIFT` 复现，不触发二次确认流程分支。

## 6. 性能结果
### 6.1 synthetic perf（run_id `20260212_060630`）
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260212_060630/summary.json`

| metric | p95_ms |
| --- | ---: |
| pick | 0.009208 |
| box_query | 0.006625 |
| drag_commit | 0.023750 |
| snapshot_before | 0.002500 |
| patch_apply | 0.007833 |
| snapshot_after | 0.003583 |

### 6.2 real-scene perf（run_id `20260212_060630`）
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260212_060630/summary.json`

| metric | p95_ms | threshold_ms | status |
| --- | ---: | ---: | --- |
| pick | 0.001708 | 0.050000 | PASS |
| box_query | 0.025625 | 0.200000 | PASS |
| drag_commit | 0.028833 | 0.200000 | PASS |

### 6.3 real-scene 最近 3 次中位数
- run_ids:
  - `20260212_060009`
  - `20260212_060318`
  - `20260212_060630`
- `box_query p95` median: `0.025625ms`（远低于 `0.200000ms` 阈值）

## 7. Stability Soak（3 rounds）
- soak summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_stability_soak/20260212_060355/summary.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_stability_soak/20260212_060355/summary.md`
- overall_status: `stable`
- metrics:
  - passes: `3`
  - failures: `0`
  - stable_rounds: `3`

## 8. 趋势结论
- trend:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_trend.json`
- status: `stable`
- samples_in_window: `31`
- recommended_gate_limit: `8`
- editor/step166 gate 失败统计：`0/0`

## 9. 结论与下一步
- 本轮 `1+2+3` 路线继续稳定：
  - 功能、回归、性能、trend、soak 全部通过。
- 当前可执行策略：
  1. 标准链路保持 `gate limit=8`（quick 继续 `3`）。
  2. 继续保留 STEP166 文本漂移二次确认。
  3. 维持每周一次 3-round soak，防止稳定性回退。

## 10. Incremental Verification (2026-02-12T08:33:15Z, locked propertyPatch hard-fail)
### 10.1 本轮开发点（Week A / A1）
- `selection.propertyPatch` 行为收口：
  - 当所有选中实体都处于锁层时，返回 `ok=false` + `error_code=LAYER_LOCKED`（不再 silent no-op）。
  - 当部分实体锁层时：对可编辑实体正常 patch，并在 message 中记录 skipped 数量。
- 新增命令级回归用例（Node tests）：
  - `selection.propertyPatch updates arc radius and preserves center/angles`
  - `selection.propertyPatch rejects locked target layer`

涉及文件：
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/commands/command_registry.js`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

### 10.2 执行命令
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 3
RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=3 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```

### 10.3 结果摘要
- Node command tests: `27/27 pass`
- quick round-trip observe:
  - run_id: `20260212_163136_034_d1ac` (`pass=3 fail=0`)

### 10.4 Weekly 链路结果（latest）
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- generated_at: `2026-02-12T08:33:15.072149+00:00`
- run_ids:
  - editor_smoke(observe): `20260212_163145_340_7a39`
  - step166(observe): `20260212_083147` (`gate_would_fail=false`)
  - synthetic perf: `20260212_083243`
  - real-scene perf: `20260212_083244` (`PASS`)
  - gate(editor+step166): `20260212_163244_238_bc02` + `20260212_083246`
- trend:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_trend.json`
  - status: `stable`

### 10.5 性能结果（p95）
#### synthetic perf (`20260212_083243`)
| metric | p95_ms |
| --- | ---: |
| pick | 0.009250 |
| box_query | 0.006459 |
| drag_commit | 0.023208 |

#### real-scene perf (`20260212_083244`)
| metric | p95_ms | threshold_ms | status |
| --- | ---: | ---: | --- |
| pick | 0.001709 | 0.050000 | PASS |
| box_query | 0.024625 | 0.200000 | PASS |
| drag_commit | 0.033958 | 0.200000 | PASS |

### 10.6 STEP166 漂移二次确认状态
- observe: `20260212_083147`
- gate: `20260212_083246`
- `drift_confirmation`: `enabled=true, rechecked=0, confirmed=0, recovered=0`

### 10.7 本轮结论
- `selection.propertyPatch` 的锁层行为已变成“可解释的硬失败”，避免 UI 误以为成功编辑。
- Level A 标准验证链路保持全绿（observe + gate + trend stable）。

## 11. Incremental Verification (2026-02-12T08:43:55Z, A2+A3)
### 11.1 本轮开发点（Week A / A2 + A3）
- A2: grip hover 与 snap hint 共存稳定性
  - `select_tool` 增加 hover hysteresis（enter=10px, exit=14px），减少手柄附近光标抖动导致的 hover 闪烁。
  - `select_tool` 单次 `onPointerMove` 只计算一次 `resolveSnappedPoint`，避免重复 overlay 更新。
- A3: Trim/Extend 连续操作异常路径补强（命令级）
  - 新增测试：命令失败时不清空 boundary（连续操作可继续下一目标），ESC 必须清空 overlay。
  - 新增测试：select tool hover + snap overlay 同时存在且 jitter 下稳定。

涉及文件：
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tools/select_tool.js`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

### 11.2 本轮执行命令
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 3
RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=3 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```

### 11.3 结果摘要
- Node command tests: `30/30 pass`
- quick round-trip observe:
  - run_id: `20260212_164233_092_2fd1` (`pass=3 fail=0`)
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- generated_at: `2026-02-12T08:43:55.339199+00:00`
- run_ids:
  - editor_smoke(observe): `20260212_164245_305_ddb9`
  - step166(observe): `20260212_084248` (`gate_would_fail=false`)
  - synthetic perf: `20260212_084322`
  - real-scene perf: `20260212_084322` (`PASS`)
  - gate(editor+step166): `20260212_164322_757_8b2a` + `20260212_084325`
- trend:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_trend.json`
  - status: `stable` (`samples_in_window=33`)

### 11.4 性能结果（p95）
#### synthetic perf (`20260212_084322`)
| metric | p95_ms |
| --- | ---: |
| pick | 0.009500 |
| box_query | 0.006375 |
| drag_commit | 0.030875 |

#### real-scene perf (`20260212_084322`)
| metric | p95_ms | threshold_ms | status |
| --- | ---: | ---: | --- |
| pick | 0.001833 | 0.050000 | PASS |
| box_query | 0.025916 | 0.200000 | PASS |
| drag_commit | 0.027250 | 0.200000 | PASS |

### 11.5 STEP166 漂移二次确认状态
- observe: `20260212_084248`
- gate: `20260212_084325`
- `drift_confirmation`: `enabled=true, rechecked=0, confirmed=0, recovered=0`

### 11.6 本轮结论
- A2+A3 引入的交互防抖与异常路径补强未引入回归：weekly/gate/trend/real-scene 仍保持全绿。
- trend 窗口继续稳定（`samples_in_window=33`），可继续保持标准 gate `limit=8`。

## 12. Incremental Verification (2026-02-12T08:55:03Z, real-scene 3-run median guard)
### 12.1 本轮开发点（Week B / C2）
- `tools/editor_weekly_validation.sh` 支持可选 real-scene repeat：
  - `REAL_SCENE_REPEAT=N`：重复执行 `editor_real_scene_perf_smoke.js` N 次
  - 自动生成 batch 聚合产物：
    - `build/editor_real_scene_perf_batch/<batch_id>/summary.json`
    - `build/editor_real_scene_perf_batch/<batch_id>/summary.md`
  - weekly summary 的 `real_scene_perf.summary_json` 指向 batch 聚合 summary（metric 为 median p95）

涉及文件：
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/editor_weekly_validation.sh`

### 12.2 本轮执行命令
```bash
REAL_SCENE_REPEAT=3 REAL_SCENE_INTERVAL_SEC=1 \
  RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=3 EDITOR_GATE_APPEND_REPORT=0 \
  bash tools/editor_weekly_validation.sh
```

### 12.3 结果摘要
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- generated_at: `2026-02-12T08:55:03.172253+00:00`
- run_ids:
  - editor_smoke(observe): `20260212_165334_501_97f9`
  - step166(observe): `20260212_085337` (`gate_would_fail=false`)
  - synthetic perf: `20260212_085427`
  - real-scene batch: `20260212_085427` (`PASS`, repeat=3)
  - gate(editor+step166): `20260212_165429_858_3acc` + `20260212_085432`
- trend:
  - status: `stable`
  - samples_in_window: `33`

### 12.4 real-scene batch 聚合结果（median p95）
- batch summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf_batch/20260212_085427/summary.json`
- per-run summaries:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260212_085427/summary.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260212_085428/summary.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260212_085429/summary.json`

| metric | median_p95_ms | threshold_ms | status |
| --- | ---: | ---: | --- |
| pick | 0.001834 | 0.050000 | PASS |
| box_query | 0.025250 | 0.200000 | PASS |
| drag_commit | 0.027625 | 0.200000 | PASS |

### 12.5 本轮结论
- real-scene 使用 3-run median 后，性能判断更稳健，降低单次系统抖动导致的误判风险。
- 当前 median 指标远低于阈值，可继续维持 gate `limit=8` 与 observe->gate 收口节奏。

## 13. Incremental Verification (2026-02-12T09:25:21Z, synthetic+real-scene 3-run median + weekly gate)
### 13.1 本轮开发点（Week B / C1+C2 + 脚本收口）
- synthetic perf 使用 3-run median：
  - 通过 `PERF_REPEAT=3` 生成 `build/editor_perf_batch/<batch_id>/summary.json`（median p95 聚合）。
  - weekly summary 的 `performance.summary_json` 指向 batch 聚合 summary（更稳健）。
- weekly gate 报告追加开关收口：
  - `tools/editor_weekly_validation.sh` 现在以 `EDITOR_GATE_APPEND_REPORT` 作为唯一控制（与 `tools/editor_gate.sh` 一致）。
  - `GATE_APPEND_REPORT` 保留为 deprecated alias（仅用于兼容旧环境）。
  - 备注：本节记录的 weekly run 执行发生在该收口修复之前，因此当次 gate 仍发生过一次“误追加”；修复后后续 run 将按 `EDITOR_GATE_APPEND_REPORT` 生效。

涉及文件：
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/editor_weekly_validation.sh`

### 13.2 本轮执行命令
```bash
PERF_REPEAT=3 PERF_INTERVAL_SEC=1 \
REAL_SCENE_REPEAT=3 REAL_SCENE_INTERVAL_SEC=1 \
  RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=3 EDITOR_GATE_APPEND_REPORT=0 \
  bash tools/editor_weekly_validation.sh
```

### 13.3 结果摘要（latest weekly）
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- generated_at: `2026-02-12T09:25:21.046499+00:00`
- run_ids:
  - editor_smoke(observe): `20260212_172258_120_67f7` (`pass=8 fail=0`)
  - step166(observe): `20260212_092308` (`gate_would_fail=false`)
  - synthetic perf batch: `20260212_092426` (`PASS`, repeat=3)
  - real-scene perf batch: `20260212_092429` (`PASS`, repeat=3)
  - gate(editor+step166): `20260212_172432_588_2976` + `20260212_092440`
- trend:
  - status: `stable`

### 13.4 synthetic perf batch 聚合结果（median p95）
- batch summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf_batch/20260212_092426/summary.json`
- per-run summaries:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260212_092426/summary.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260212_092427/summary.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260212_092428/summary.json`

| metric | median_p95_ms |
| --- | ---: |
| pick | 0.018417 |
| box_query | 0.006709 |
| drag_commit | 0.032125 |

### 13.5 real-scene perf batch 聚合结果（median p95）
- batch summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf_batch/20260212_092429/summary.json`

| metric | median_p95_ms | threshold_ms | status |
| --- | ---: | ---: | --- |
| pick | 0.002542 | 0.050000 | PASS |
| box_query | 0.050208 | 0.200000 | PASS |
| drag_commit | 0.031625 | 0.200000 | PASS |

### 13.6 本轮结论
- synthetic 与 real-scene 都切换到 3-run median 后，周验证结果更抗抖动，可作为长期守卫策略。
- gate/trend 继续稳定（`limit=8`），可继续保持 observe->gate 的节奏收口。

## 14. Incremental Verification (2026-02-12T10:34:49Z, synthetic perf trend 14d)
### 14.1 本轮开发点（Week B / C4）
- 新增 synthetic perf trend 工具：
  - `tools/editor_perf_trend.py`：汇总 `build/editor_perf*/**/summary.json` 并输出 `build/editor_perf_trend.{json,md}`
  - status 信号只依赖 `box_query/drag/hotspot`（pick 回归仅信息提示，避免噪声误判）
- `tools/editor_weekly_validation.sh` 已接入该趋势输出（后续 weekly summary 会包含 perf_trend 字段）。

涉及文件：
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/editor_perf_trend.py`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/editor_weekly_validation.sh`

### 14.2 本轮执行命令
```bash
python3 tools/editor_perf_trend.py --days 14 \
  --out-json build/editor_perf_trend.json \
  --out-md build/editor_perf_trend.md
```

### 14.3 结果摘要
- perf trend:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf_trend.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf_trend.md`
- generated_at: `2026-02-12T10:34:49.852724+00:00`
- status: `stable`
- latest batch: `20260212_092426` (repeat=3)
- baseline (median, excluding latest when possible, samples_used=34):
  - pick_p95_ms_median: `0.0112085`
  - box_p95_ms_median: `0.0207290`
  - drag_p95_ms_median: `0.0330000`
- latest metrics (median p95):
  - pick_p95_ms: `0.0184170` (ratio=1.643, informational)
  - box_p95_ms: `0.0067090` (ratio=0.324)
  - drag_p95_ms: `0.0321250` (ratio=0.973)

### 14.4 本轮结论
- synthetic perf trend 已形成长期可用的“观测型守卫”，可用于提醒性能慢性回退并绑定后续优化优先级。

## 15. Incremental Verification (2026-02-12T18:38:28Z, editor round-trip clean env fixture)
### 15.1 本轮开发点（Week B / B4）
- 新增非专有的 CADGF fixture（用于 CI/clean env）：
  - `tools/web_viewer/tests/fixtures/cadgf_smoke_document.json`
  - `tools/web_viewer/tests/fixtures/editor_roundtrip_smoke_cases.json`
- `editor_roundtrip_smoke.js` 发现 `build/cad_regression/**/document.json` 为空时自动 fallback 到 fixture cases（避免 DISCOVERY_EMPTY 误判为回归）。

涉及文件：
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_roundtrip_smoke.js`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/fixtures/cadgf_smoke_document.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/fixtures/editor_roundtrip_smoke_cases.json`

### 15.2 本轮执行命令
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode gate \
  --cases tools/web_viewer/tests/fixtures/editor_roundtrip_smoke_cases.json \
  --limit 1
```

### 15.3 结果摘要
- run_id: `20260212_183828_506_f532`
- totals: `pass=1 fail=0 skipped=0`
- artifacts:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260212_183828_506_f532/summary.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260212_183828_506_f532/summary.md`

### 15.4 本轮结论
- editor round-trip smoke 现在具备“无 STEP166 previews 也能跑”的底线能力，便于在 CI/全新环境做最小门禁与持续验证。

## 16. Incremental Verification (2026-02-12T10:40:20Z, weekly includes perf_trend artifact)
### 16.1 本轮执行命令
```bash
RUN_GATE=0 RUN_REAL_SCENE_PERF=0 PERF_REPEAT=1 CAD_MAX_WORKERS=2 EDITOR_GATE_APPEND_REPORT=0 \
  bash tools/editor_weekly_validation.sh
```

### 16.2 结果摘要
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- generated_at: `2026-02-12T10:40:20.624481+00:00`
- run_ids:
  - editor_smoke(observe): `20260212_183923_095_8ee5` (`pass=8 fail=0`)
  - step166(observe): `20260212_103925` (`gate_would_fail=false`)
  - synthetic perf: `20260212_104020`
- perf trend:
  - status: `stable`
  - artifacts:
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf_trend.json`
    - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf_trend.md`

### 16.3 本轮结论
- weekly summary 已包含 perf_trend 产物路径，可用于后续趋势观测与门禁策略收口。

## Weekly Snapshot (2026-02-12T11:00:46.077890+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260212_190013_258_4793`
- step166_run_id: `20260212_110013` (gate_would_fail=`False`)
- perf_run_id: `20260212_110045`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `skipped`
- trend: `stable`
- perf_trend: `stable`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260212_190013_258_4793/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_110013/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260212_110045/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`

### Perf p95 (best-effort)
- pick: `0.009000ms`, box_query: `0.006292ms`, drag_commit: `0.024042ms`

## 17. Incremental Verification (2026-02-12T10:56:10Z, editor_gate perf_trend gate)
### 17.1 本轮开发点（Priority 1）
- `tools/editor_gate.sh` 接入 synthetic perf trend 的可选门禁：
  - 默认 `observe`（只写产物，不阻塞）
  - `RUN_PERF_TREND_GATE=1` 时以 `--mode gate` 执行，若 `status=watch|unstable` 则 gate exit=2
- gate summary 增加 `perf_trend` 字段（追溯门禁决策的输入）。

涉及文件：
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/editor_gate.sh`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/editor_perf_trend.py`

### 17.2 本轮执行命令
```bash
RUN_PERF_TREND_GATE=1 PERF_TREND_DAYS=14 \
  EDITOR_GATE_APPEND_REPORT=0 EDITOR_SMOKE_LIMIT=2 CAD_ATTEMPTS=1 \
  bash tools/editor_gate.sh
```

### 17.3 结果摘要
- gate summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- generated_at: `2026-02-12T10:56:10Z`
- run_ids:
  - editor_smoke(gate): `20260212_185513_998_36ad` (`pass=2 fail=0`)
  - step166(gate): `20260212_105515` (`gate_would_fail=false`)
- perf_trend:
  - enabled: `true`
  - mode: `gate`
  - status: `stable`

### 17.4 本轮结论
- perf trend 已可作为可选门禁并写入 gate summary，满足 “observe->gate” 收口路径的可追溯要求。

## 18. Incremental Verification (2026-02-12, local stable editor_smoke cases)
### 18.1 本轮开发点（Priority 2）
- 固定真实样例的 round-trip cases（本地私有，不进仓库）：
  - `tools/generate_editor_roundtrip_cases.py` 从最新 STEP166 previews 生成 `local/editor_roundtrip_smoke_cases.json`（已加入 `.gitignore`）。
  - weekly/gate 脚本若检测到该文件且未显式设置 `EDITOR_SMOKE_CASES`，自动使用它（稳定样本集）。

涉及文件：
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/generate_editor_roundtrip_cases.py`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/editor_weekly_validation.sh`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/editor_gate.sh`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/.gitignore`

### 18.2 本轮执行命令
```bash
python3 tools/generate_editor_roundtrip_cases.py --limit 8
```

### 18.3 结果摘要
- selected_run_id: `20260212_103925`
- out:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/local/editor_roundtrip_smoke_cases.json`
- weekly 输出可见 `editor_smoke_cases=local/editor_roundtrip_smoke_cases.json`（证明已生效）。

### 18.4 本轮结论
- 本地稳定样本集已具备自动落盘与自动采纳能力，可显著降低 round-trip 样本漂移带来的趋势噪声。

## 19. Incremental Verification (2026-02-12T11:00:46Z, STEP176 auto-append weekly snapshot)
### 19.1 本轮开发点（Priority 3）
- `tools/editor_weekly_validation.sh` 支持可选自动追加 STEP176 报告：
  - `STEP176_APPEND_REPORT=1` 时调用 `tools/write_step176_weekly_report.py`，把 weekly summary 快照追加到 STEP176 验证文档尾部。

涉及文件：
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/editor_weekly_validation.sh`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/write_step176_weekly_report.py`

### 19.2 本轮结论
- 本文档尾部已出现 `Weekly Snapshot (...)` 章节（由脚本自动追加），证明该机制可用于持续周报沉淀而无需人工复制 run_id/路径。

## Weekly Snapshot (2026-02-12T11:11:19.252724+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`

### Inputs
- editor_smoke: `mode=observe` `limit=3`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260212_191047_591_6556`
- step166_run_id: `20260212_111048` (gate_would_fail=`False`)
- perf_run_id: `20260212_111118`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `skipped`
- trend: `stable`
- perf_trend: `stable`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260212_191047_591_6556/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_111048/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260212_111118/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`

### Perf p95 (best-effort)
- pick: `0.011000ms`, box_query: `0.007250ms`, drag_commit: `0.026791ms`


## Weekly Snapshot (2026-02-12T12:30:04.155153+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`

### Inputs
- editor_smoke: `mode=observe` `limit=3`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260212_202910_594_117b`
- step166_run_id: `20260212_122912` (gate_would_fail=`False`)
- perf_run_id: `20260212_123001`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `skipped`
- trend: `stable`
- perf_trend: `stable`
- real_scene_trend: `stable`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260212_202910_594_117b/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_122912/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260212_123001/summary.json`
- real_scene_perf_summary: `build/editor_real_scene_perf_batch/20260212_123001/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### Perf p95 (best-effort)
- pick: `0.010250ms`, box_query: `0.006959ms`, drag_commit: `0.023959ms`


## Gate Snapshot (2026-02-12T12:31:27Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- editor_smoke_run_id: `20260212_203050_507_6fa9`
- step166_run_id: `20260212_123051` (gate_would_fail=`False`)
- perf_trend: `stable` (mode=`observe` enabled=`False`)
- real_scene_trend: `` (mode=`gate` enabled=`True`)
- note: this snapshot predates exporting `REAL_SCENE_TREND_*` into `build/editor_gate_summary.json`; see later Gate Snapshot for the fixed real_scene_trend fields.

### Artifacts
- editor_smoke_summary: `build/editor_roundtrip/20260212_203050_507_6fa9/summary.json`
- step166_summary: `build/cad_regression/20260212_123051/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`


## Gate Snapshot (2026-02-12T12:33:00Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- editor_smoke_run_id: `20260212_203225_300_00a4`
- step166_run_id: `20260212_123226` (gate_would_fail=`False`)
- perf_trend: `stable` (mode=`observe` enabled=`False`)
- real_scene_trend: `stable` (mode=`gate` enabled=`True`)

### Artifacts
- editor_smoke_summary: `build/editor_roundtrip/20260212_203225_300_00a4/summary.json`
- step166_summary: `build/cad_regression/20260212_123226/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

## Gate Snapshot (2026-02-12T12:57:12Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- editor_smoke_run_id: `20260212_205609_942_f7f9`
- step166_run_id: `20260212_125610` (gate_would_fail=`False`)
- perf_trend: `stable` (mode=`observe` enabled=`False`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`)

### Artifacts
- editor_smoke_summary: `build/editor_roundtrip/20260212_205609_942_f7f9/summary.json`
- step166_summary: `build/cad_regression/20260212_125610/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

## Local CI Snapshot (2026-02-12T12:59:13Z)
- command: `RUN_EDITOR_GATE=1 SKIP_EDITOR_SMOKE=1 bash tools/local_ci.sh --build-dir build --quick --skip-compare --offline`
- local_ci_summary_json: `build/local_ci_summary.json`
- editor_gate: `ok` (rc=`0`, summary=`build/editor_gate_summary.json`)

## Weekly Snapshot (2026-02-12T13:13:29.631871+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- perf: `entities=10000` `repeat=3`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260212_211241_561_94bb`
- step166_run_id: `20260212_131242` (gate_would_fail=`False`)
- perf_run_id: `20260212_131324`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `skipped`
- trend: `stable`
- perf_trend: `stable`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260212_211241_561_94bb/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_131242/summary.json`
- perf_summary: `build/editor_perf_batch/20260212_131324/summary.json`
- real_scene_perf_summary: `build/editor_real_scene_perf_batch/20260212_131326/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### Perf p95 (best-effort)
- pick: `0.009333ms`, box_query: `0.007291ms`, drag_commit: `0.025041ms`


## Weekly Snapshot (2026-02-12T13:21:54.176582+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260212_132154_20260212_212050_727_592c_20260212_132052.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=1`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260212_212050_727_592c`
- step166_run_id: `20260212_132052` (gate_would_fail=`False`)
- perf_run_id: `20260212_132153`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260212_212050_727_592c/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_132052/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260212_132153/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260212_132153/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### Perf p95 (best-effort)
- pick: `0.011541ms`, box_query: `0.007375ms`, drag_commit: `0.031750ms`


## Gate Snapshot (2026-02-12T16:24:22Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- editor_smoke_run_id: `20260213_002339_695_2e4a`
- step166_run_id: `20260212_162341` (gate_would_fail=`False`)
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `build/editor_roundtrip/20260213_002339_695_2e4a/summary.json`
- step166_summary: `build/cad_regression/20260212_162341/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-12T16:28:38.880739+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260212_162838_20260213_002804_700_038b_20260212_162805.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260213_002804_700_038b`
- step166_run_id: `20260212_162805` (gate_would_fail=`False`)
- perf_run_id: `20260212_162838`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260213_002804_700_038b/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_162805/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260212_162838/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260212_162838/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### Perf p95 (best-effort)
- pick: `0.008542ms`, box_query: `0.006708ms`, drag_commit: `0.027709ms`


## Gate Snapshot (2026-02-12T16:48:04Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260213_004706_906_9531`
- step166_run_id: `20260212_164718` (gate_would_fail=`False`)
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `build/editor_roundtrip/20260213_004706_906_9531/summary.json`
- step166_summary: `build/cad_regression/20260212_164718/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-13T18:11:23Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260214_021048_575_91cd`
- step166_run_id: `20260213_181049` (gate_would_fail=`False`)
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `build/editor_roundtrip/20260214_021048_575_91cd/summary.json`
- step166_summary: `build/cad_regression/20260213_181049/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-13T18:11:23.337157+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260213_181123_20260214_021012_170_0c91_20260213_181012.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- ui_flow_smoke: `mode=gate` `port=50563` `viewport=1400,900`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`

### Runs
- editor_smoke_run_id: `20260214_021012_170_0c91`
- ui_flow_smoke: `PASS` run_id=`20260214_020942_ui_flow`
- step166_run_id: `20260213_181012` (gate_would_fail=`False`)
- perf_run_id: `20260213_181048`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `ok`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260214_021012_170_0c91/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_020942_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260213_181012/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260213_181048/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260213_181048/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### Perf p95 (best-effort)
- pick: `0.009834ms`, box_query: `0.006292ms`, drag_commit: `0.035959ms`


## Weekly Snapshot (2026-02-15T14:20:58.974640+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260215_142058_20260215_221902_127_840a_20260215_142015.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- ui_flow_smoke: `mode=observe` `port=56380` `viewport=1400,900`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260215_221902_127_840a`
- ui_flow_smoke: `PASS` run_id=`20260215_221821_ui_flow`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166_run_id: `20260215_142015` (gate_would_fail=`False`)
- perf_run_id: `20260215_142057`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260215_221902_127_840a/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260215_221821_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260215_142015/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260215_142057/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260215_142057/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### Perf p95 (best-effort)
- pick: `0.009708ms`, box_query: `0.006209ms`, drag_commit: `0.028791ms`


## Weekly Snapshot (2026-02-15T15:09:02.700706+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260215_150902_20260215_230708_226_7b50_20260215_150818.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- ui_flow_smoke: `mode=observe` `port=54398` `viewport=1400,900`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260215_230708_226_7b50`
- ui_flow_smoke: `PASS` run_id=`20260215_230626_ui_flow`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166_run_id: `20260215_150818` (gate_would_fail=`False`)
- perf_run_id: `20260215_150902`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260215_230708_226_7b50/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260215_230626_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260215_150818/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260215_150902/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260215_150902/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### STEP166 Import Meta (DXF/HATCH)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`

### Perf p95 (best-effort)
- pick: `0.009500ms`, box_query: `0.006500ms`, drag_commit: `0.036917ms`


## Weekly Snapshot (2026-02-15T15:50:15.818464+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260215_155015_20260215_234823_751_97fe_20260215_154934.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- ui_flow_smoke: `mode=observe` `port=64678` `viewport=1400,900`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260215_234823_751_97fe`
- ui_flow_smoke: `PASS` run_id=`20260215_234735_ui_flow`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166_run_id: `20260215_154934` (gate_would_fail=`False`)
- perf_run_id: `20260215_155014`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260215_234823_751_97fe/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260215_234735_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260215_154934/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260215_155014/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260215_155015/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### Perf p95 (best-effort)
- pick: `0.009792ms`, box_query: `0.006458ms`, drag_commit: `0.036584ms`


## Weekly Snapshot (2026-02-15T16:53:19.085168+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260215_165319_20260216_005132_661_0a36_20260215_165240.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- ui_flow_smoke: `mode=observe` `port=64888` `viewport=1400,900`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260216_005132_661_0a36`
- ui_flow_smoke: `PASS` run_id=`20260216_005059_ui_flow`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166_run_id: `20260215_165240` (gate_would_fail=`False`)
- perf_run_id: `20260215_165318`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260216_005132_661_0a36/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_005059_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260215_165240/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260215_165318/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260215_165318/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.009083ms`, box_query: `0.006291ms`, drag_commit: `0.030542ms`


## Weekly Snapshot (2026-02-16T01:17:07.508942+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260216_011707_20260216_091530_662_5157_20260216_011633.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- ui_flow_smoke: `mode=observe` `port=52656` `viewport=1400,900`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260216_091530_662_5157`
- ui_flow_smoke: `PASS` run_id=`20260216_091500_ui_flow`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166_run_id: `20260216_011633` (gate_would_fail=`False`)
- perf_run_id: `20260216_011706`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260216_091530_662_5157/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_091500_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_011633/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260216_011706/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260216_011707/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.008792ms`, box_query: `0.006334ms`, drag_commit: `0.028167ms`


## Weekly Snapshot (2026-02-16T01:20:44.730620+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260216_012044_20260216_091908_818_cd3d_20260216_012011.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- ui_flow_smoke: `mode=observe` `port=54465` `viewport=1400,900`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260216_091908_818_cd3d`
- ui_flow_smoke: `PASS` run_id=`20260216_091840_ui_flow`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166_run_id: `20260216_012011` (gate_would_fail=`False`)
- step166_baseline_refresh: `eligible=True` `applied=False` `candidate=20260216_012011`
- perf_run_id: `20260216_012044`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260216_091908_818_cd3d/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_091840_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_012011/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260216_012044/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260216_012044/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.008625ms`, box_query: `0.006667ms`, drag_commit: `0.025833ms`


## Weekly Snapshot (2026-02-16T02:10:50.866330+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260216_021050_20260216_100905_284_c717_20260216_021015.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- ui_flow_smoke: `mode=observe` `port=64659` `viewport=1400,900`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260216_100905_284_c717`
- ui_flow_smoke: `PASS` run_id=`20260216_100830_ui_flow`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166_run_id: `20260216_021015` (gate_would_fail=`False`)
- perf_run_id: `20260216_021050`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260216_100905_284_c717/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_100830_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_021015/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260216_021050/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.010416ms`, box_query: `0.006750ms`, drag_commit: `0.038583ms`


## Weekly Snapshot (2026-02-16T02:32:47.326594+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260216_023247_20260216_103102_232_2573_20260216_023212.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- ui_flow_smoke: `mode=observe` `port=53311` `viewport=1400,900`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260216_103102_232_2573`
- ui_flow_smoke: `PASS` run_id=`20260216_103021_ui_flow`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166_run_id: `20260216_023212` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=5` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_run_id: `20260216_023246`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260216_103102_232_2573/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_103021_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_023212/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260216_023246/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.013458ms`, box_query: `0.008166ms`, drag_commit: `0.022500ms`


## Weekly Snapshot (2026-02-16T02:43:30.154269+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260216_024330_20260216_104146_889_24f8_20260216_024255.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- ui_flow_smoke: `mode=observe` `port=57235` `viewport=1400,900`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260216_104146_889_24f8`
- ui_flow_smoke: `PASS` run_id=`20260216_104116_ui_flow`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166_run_id: `20260216_024255` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`not enough consecutive days: have=1 need=5 missing_day=2026-02-15`
- perf_run_id: `20260216_024329`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260216_104146_889_24f8/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_104116_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_024255/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260216_024329/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.009959ms`, box_query: `0.006375ms`, drag_commit: `0.028708ms`


## Gate Snapshot (2026-02-16T02:38:54Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260216_103708_880_c599`
- ui_flow_smoke: `True` run_id=`20260216_103636_ui_flow` (mode=`gate`)
- step166_run_id: `20260216_023816` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `build/editor_roundtrip/20260216_103708_880_c599/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_103636_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260216_023816/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-16T04:33:12Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260216_123133_834_367a`
- ui_flow_smoke: `True` run_id=`20260216_123052_ui_flow` (mode=`gate`)
- step166_run_id: `20260216_043238` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `build/editor_roundtrip/20260216_123133_834_367a/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_123052_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260216_043238/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-16T04:37:11.013434+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260216_043710_20260216_123529_371_4941_20260216_043637.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- ui_flow_smoke: `mode=observe` `port=51047` `viewport=1400,900`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260216_123529_371_4941`
- ui_flow_smoke: `PASS` run_id=`20260216_123458_ui_flow`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166_run_id: `20260216_043637` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`not enough consecutive days: have=1 need=5 missing_day=2026-02-15`
  - refresh_window: `days=2` `present=1` `stable=1` `latest=2026-02-16` `first_missing=2026-02-15`
- perf_run_id: `20260216_043710`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260216_123529_371_4941/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_123458_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_043637/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260216_043710/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.009125ms`, box_query: `0.006542ms`, drag_commit: `0.027042ms`


## Weekly Snapshot (2026-02-16T11:16:53.585132+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260216_111653_20260216_191513_514_8570_20260216_111616.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- ui_flow_smoke: `mode=observe` `port=63494` `viewport=1400,900`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260216_191513_514_8570`
- ui_flow_smoke: `PASS` run_id=`20260216_191437_ui_flow`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166_run_id: `20260216_111616` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`not enough consecutive days: have=1 need=5 missing_day=2026-02-15`
  - refresh_window: `days=2` `present=1` `stable=1` `latest=2026-02-16` `first_missing=2026-02-15`
- perf_run_id: `20260216_111651`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260216_191513_514_8570/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_191437_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_111616/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260216_111651/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260216_111651/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.008959ms`, box_query: `0.006292ms`, drag_commit: `0.029625ms`


## Gate Snapshot (2026-02-17T05:20:28Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260217_131947_715_1f83`
- ui_flow_smoke: `True` run_id=`20260217_131856_ui_flow` (mode=`gate`)
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- step166_run_id: `20260217_051950` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `build/editor_roundtrip/20260217_131947_715_1f83/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_131856_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260217_051950/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-17T11:56:50Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`True` exit_code=`2` reasons=`UI_FLOW_SMOKE:FAIL, UI_FLOW_SMOKE_GATE_FAIL_COUNT:2`
- editor_smoke_run_id: `20260217_195612_320_7c3b`
- ui_flow_smoke: `False` run_id=`20260217_195600_ui_flow` (mode=`gate`)
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
  - first_failed_run: run_id=`20260217_195543_ui_flow` step=`` selection=`` status=`[OPEN] http://127.0.0.1:59635/tools/web_viewer/index.html?mode=editor&seed=0&debug=1`
- step166_run_id: `20260217_115613` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `build/editor_roundtrip/20260217_195612_320_7c3b/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_195600_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260217_115613/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-17T12:09:40Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260217_200856_812_95b0`
- ui_flow_smoke: `True` run_id=`20260217_200806_ui_flow` (mode=`gate`)
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- step166_run_id: `20260217_120857` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `build/editor_roundtrip/20260217_200856_812_95b0/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_200806_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260217_120857/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-17T12:18:13Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260217_201727_207_1739`
- ui_flow_smoke: `True` run_id=`20260217_201621_ui_flow` (mode=`gate`)
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=1` `fail=0`
- step166_run_id: `20260217_121728` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=2` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `build/editor_roundtrip/20260217_201727_207_1739/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_201621_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260217_121728/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-17T12:20:24Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_failcheck.json`

### Runs
- gate_decision: would_fail=`True` exit_code=`2` reasons=`UI_FLOW_SMOKE:FAIL, UI_FLOW_SMOKE_GATE_FAIL_COUNT:1, UI_FLOW_FLOW_JSON_INVALID:1`
- editor_smoke_run_id: `20260217_201946_255_b36b`
- ui_flow_smoke: `False` run_id=`20260217_201931_ui_flow` (mode=`gate`)
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=0` `fail=1`
- ui_flow_gate_failure_codes: `UI_FLOW_FLOW_JSON_INVALID=1`
  - first_failed_run: run_id=`20260217_201931_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` step=`` selection=`` detail=`[OPEN] http://127.0.0.1:52488/tools/web_viewer/index.html?mode=editor&seed=0&debug=1`
- step166_run_id: `20260217_121946` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=1` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `build/editor_roundtrip/20260217_201946_255_b36b/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_201931_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260217_121946/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-17T12:35:28.710627+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260217_123528_20260217_203447_206_9950_20260217_123448.json`

### Inputs
- editor_smoke: `mode=observe` `limit=1`
- ui_flow_smoke: `mode=observe` `port=60532` `viewport=1400,900`
- ui_flow_failure_injection: `timeout_ms=1` `strict=False`
- perf: `entities=2000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260217_203447_206_9950`
- ui_flow_smoke: `PASS` run_id=`20260217_203337_ui_flow`
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=1` `fail=0`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- ui_flow_failure_injection: `PASS` run_id=`20260217_203435_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:60532/tools/web_viewer/index.html?mode=editor&seed=0&debug=1`
- step166_run_id: `20260217_123448` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=5` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`not enough consecutive days: have=2 need=5 missing_day=2026-02-15`
  - refresh_window: `days=3` `present=2` `stable=2` `latest=2026-02-17` `first_missing=2026-02-15`
- perf_run_id: `20260217_123528`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260217_203447_206_9950/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_203337_ui_flow/summary.json`
- ui_flow_failure_injection_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_203435_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260217_123448/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260217_123528/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.013417ms`, box_query: `0.005667ms`, drag_commit: `0.063708ms`


## Gate Snapshot (2026-02-18T11:35:12Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_injectcheck.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260218_193426_987_2cd6`
- ui_flow_smoke: `True` run_id=`20260218_193322_ui_flow` (mode=`gate`)
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=1` `fail=0`
- ui_flow_failure_injection: `PASS` run_id=`20260218_193417_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` exit_code=`2` detail=`[OPEN] http://127.0.0.1:49301/tools/web_viewer/index.html?mode=editor&seed=0&debug=1`
- step166_run_id: `20260218_113429` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `build/editor_roundtrip/20260218_193426_987_2cd6/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260218_193322_ui_flow/summary.json`
- ui_flow_failure_injection_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260218_193417_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260218_113429/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-18T13:18:35.469763+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260218_131835_20260218_211643_128_7894_20260218_131754.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- ui_flow_smoke: `mode=observe` `port=61975` `viewport=1400,900`
- ui_flow_failure_injection: `timeout_ms=1` `strict=False`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260218_211643_128_7894` status=`PASS` pass=`8` fail=`0` skipped=`0`
- ui_flow_smoke: `PASS` run_id=`20260218_211531_ui_flow`
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=1` `fail=0`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- ui_flow_failure_injection: `PASS` run_id=`20260218_211630_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:61975/tools/web_viewer/index.html?mode=editor&seed=0&debug=1`
- step166_run_id: `20260218_131754` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`not enough consecutive days: have=3 need=5 missing_day=2026-02-15`
  - refresh_window: `days=4` `present=3` `stable=3` `latest=2026-02-18` `first_missing=2026-02-15`
- perf_run_id: `20260218_131834`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260218_211643_128_7894/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260218_211531_ui_flow/summary.json`
- ui_flow_failure_injection_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260218_211630_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260218_131754/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260218_131834/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260218_131834/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.010167ms`, box_query: `0.006667ms`, drag_commit: `0.028125ms`


## Gate Snapshot (2026-02-18T13:47:01Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_roundtrip_attr.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260218_214621_112_3eb3` status=`PASS` pass=`3` fail=`0` skipped=`0`
- ui_flow_smoke: `True` run_id=`20260218_214510_ui_flow` (mode=`gate`)
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=1` `fail=0`
- ui_flow_failure_injection: `PASS` run_id=`20260218_214608_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` exit_code=`2` detail=`[OPEN] http://127.0.0.1:53172/tools/web_viewer/index.html?mode=editor&seed=0&debug=1`
- step166_run_id: `20260218_134623` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `build/editor_roundtrip/20260218_214621_112_3eb3/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260218_214510_ui_flow/summary.json`
- ui_flow_failure_injection_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260218_214608_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260218_134623/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-19T04:22:52Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260219_122217_184_e579` status=`PASS` pass=`1` fail=`0` skipped=`0`
- editor_smoke_failure_injection: `PASS` run_id=`20260219_122217_726_c8a5` code=`CONVERT_FAIL` exit_code=`2` detail=`case=btj01230901522_00_v2`
- step166_run_id: `20260219_042218` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260219_122217_184_e579/summary.json`
- editor_smoke_failure_injection_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260219_122217_726_c8a5/summary.json`
- step166_summary: `build/cad_regression/20260219_042218/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-19T04:22:53.333312+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260219_042253_20260219_122029_007_8a7e_20260219_042141.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- perf: `entities=2000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`

### Runs
- editor_smoke_run_id: `20260219_122029_007_8a7e` status=`PASS` pass=`8` fail=`0` skipped=`0`
- step166_run_id: `20260219_042141` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=5` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`not enough consecutive days: have=4 need=5 missing_day=2026-02-15`
  - refresh_window: `days=5` `present=4` `stable=4` `latest=2026-02-19` `first_missing=2026-02-15`
- perf_run_id: `20260219_042217`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `ok`
- gate_editor_smoke: run_id=`20260219_122217_184_e579` status=`PASS` pass=`1` fail=`0` skipped=`0`
- gate_editor_smoke_failure_injection: `PASS` run_id=`20260219_122217_726_c8a5` code=`CONVERT_FAIL` detail=`case=btj01230901522_00_v2`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260219_122029_007_8a7e/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260219_042141/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260219_042217/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- gate_editor_smoke_failure_injection_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260219_122217_726_c8a5/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.007208ms`, box_query: `0.003334ms`, drag_commit: `0.032500ms`


## Gate Snapshot (2026-02-20T15:10:52Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260220_230834_619_f16d` status=`PASS` pass=`8` fail=`0` skipped=`0`
- ui_flow_smoke: `True` run_id=`20260220_230752_ui_flow` (mode=`gate`)
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- step166_run_id: `20260220_150954` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=1` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260220_230834_619_f16d/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260220_230752_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260220_150954/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-20T15:10:53.320332+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260220_151053_20260220_230439_840_4f5d_20260220_150601.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- ui_flow_smoke: `mode=observe` `port=49974` `viewport=1400,900`
- ui_flow_failure_injection: `timeout_ms=1` `strict=False`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`

### Runs
- editor_smoke_run_id: `20260220_230439_840_4f5d` status=`PASS` pass=`8` fail=`0` skipped=`0`
- editor_smoke_case_selection: `selected=8` `matched=20` `candidate=20` `total=20` `fallback=false`
- ui_flow_smoke: `PASS` run_id=`20260220_230334_ui_flow`
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=1` `fail=0`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- ui_flow_failure_injection: `PASS` run_id=`20260220_230417_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:49974/tools/web_viewer/index.html?mode=editor&seed=0&debug=1&v=20260220_230417_ui_flow`
- step166_run_id: `20260220_150601` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=True` `applied=False` `candidate=20260220_150601` reason=`ok`
  - refresh_window: `days=5` `present=5` `stable=5` `latest=2026-02-20`
- perf_run_id: `20260220_150706`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `ok`
- gate_editor_smoke: run_id=`20260220_230834_619_f16d` status=`PASS` pass=`8` fail=`0` skipped=`0`
- gate_editor_smoke_case_selection: `selected=8` `matched=20` `candidate=20` `total=20` `fallback=false`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260220_230439_840_4f5d/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260220_230334_ui_flow/summary.json`
- ui_flow_failure_injection_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260220_230417_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260220_150601/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260220_150706/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260220_150706/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.009250ms`, box_query: `0.006750ms`, drag_commit: `0.027708ms`


## Gate Snapshot (2026-02-20T16:48:52Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260221_004631_773_6c30` status=`PASS` pass=`8` fail=`0` skipped=`0`
- step166_run_id: `20260220_164756` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_004631_773_6c30/summary.json`
- step166_summary: `build/cad_regression/20260220_164756/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-20T16:48:53.111907+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260220_164853_20260221_004402_188_5b6a_20260220_164526.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`

### Runs
- editor_smoke_run_id: `20260221_004402_188_5b6a` status=`PASS` pass=`8` fail=`0` skipped=`0`
- editor_smoke_filters: `priority_set=P0,P1` `tag_any=text-heavy,arc-heavy,polyline-heavy,import-stress`
- editor_smoke_case_selection: `selected=8` `matched=19` `candidate=19` `total=20` `fallback=false`
- step166_run_id: `20260220_164526` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=5` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=True` `applied=False` `candidate=20260220_164526` reason=`ok`
  - refresh_window: `days=5` `present=5` `stable=5` `latest=2026-02-20`
- perf_run_id: `20260220_164631`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `ok`
- gate_editor_smoke: run_id=`20260221_004631_773_6c30` status=`PASS` pass=`8` fail=`0` skipped=`0`
- gate_editor_smoke_filters: `priority_set=P0,P1` `tag_any=text-heavy,arc-heavy,polyline-heavy,import-stress`
- gate_editor_smoke_case_selection: `selected=8` `matched=19` `candidate=19` `total=20` `fallback=false`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_004402_188_5b6a/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260220_164526/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260220_164631/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260220_164631/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.009958ms`, box_query: `0.006542ms`, drag_commit: `0.027167ms`


## Gate Snapshot (2026-02-21T03:04:00Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260221_110200_608_bf48` status=`PASS` pass=`8` fail=`0` skipped=`0`
- step166_run_id: `20260221_030322` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_110200_608_bf48/summary.json`
- step166_summary: `build/cad_regression/20260221_030322/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-21T03:04:01.363576+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260221_030401_20260221_105924_743_0b2f_20260221_030052.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`

### Runs
- editor_smoke_run_id: `20260221_105924_743_0b2f` status=`PASS` pass=`8` fail=`0` skipped=`0`
- editor_smoke_filters: `priority_set=P0,P1` `tag_any=text-heavy,arc-heavy,polyline-heavy,import-stress`
- editor_smoke_case_selection: `selected=8` `matched=19` `candidate=19` `total=20` `fallback=false`
- step166_run_id: `20260221_030052` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=True` `applied=False` `candidate=20260221_030052` reason=`ok`
  - refresh_window: `days=5` `present=5` `stable=5` `latest=2026-02-21`
- perf_run_id: `20260221_030200`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `ok`
- gate_editor_smoke: run_id=`20260221_110200_608_bf48` status=`PASS` pass=`8` fail=`0` skipped=`0`
- gate_editor_smoke_filters: `priority_set=P0,P1` `tag_any=text-heavy,arc-heavy,polyline-heavy,import-stress`
- gate_editor_smoke_case_selection: `selected=8` `matched=19` `candidate=19` `total=20` `fallback=false`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`80`
- case_selection_trend_windows: `7d:m=0.960,fb=0.000,n=5 | 14d:m=0.960,fb=0.000,n=5`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_105924_743_0b2f/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_030052/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260221_030200/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260221_030200/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.010583ms`, box_query: `0.007125ms`, drag_commit: `0.041208ms`


## Gate Snapshot (2026-02-21T12:33:19Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260221_203125_391_0eac` status=`PASS` pass=`5` fail=`0` skipped=`0`
- step166_run_id: `20260221_123241` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=1` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_203125_391_0eac/summary.json`
- step166_summary: `build/cad_regression/20260221_123241/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-21T12:33:20.738333+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260221_123320_20260221_202902_518_1e02_20260221_123016.json`

### Inputs
- editor_smoke: `mode=observe` `limit=5`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`

### Runs
- editor_smoke_run_id: `20260221_202902_518_1e02` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_filters: `priority_set=P0,P1` `tag_any=text-heavy,arc-heavy,polyline-heavy,import-stress`
- editor_smoke_case_selection: `selected=5` `matched=19` `candidate=19` `total=20` `fallback=false`
- step166_run_id: `20260221_123016` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=True` `applied=False` `candidate=20260221_123016` reason=`ok`
  - refresh_window: `days=5` `present=5` `stable=5` `latest=2026-02-21`
- perf_run_id: `20260221_123125`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `ok`
- gate_editor_smoke: run_id=`20260221_203125_391_0eac` status=`PASS` pass=`5` fail=`0` skipped=`0`
- gate_editor_smoke_filters: `priority_set=P0,P1` `tag_any=text-heavy,arc-heavy,polyline-heavy,import-stress`
- gate_editor_smoke_case_selection: `selected=5` `matched=19` `candidate=19` `total=20` `fallback=false`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`83`
- case_selection_trend_windows: `7d:m=0.956,fb=0.000,n=8 | 14d:m=0.956,fb=0.000,n=8`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_202902_518_1e02/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_123016/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260221_123125/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260221_123125/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.011917ms`, box_query: `0.006917ms`, drag_commit: `0.027792ms`


## Gate Snapshot (2026-02-21T12:34:41Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260221_203233_260_db9d` status=`PASS` pass=`8` fail=`0` skipped=`0`
- step166_run_id: `20260221_123358` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=1` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_203233_260_db9d/summary.json`
- step166_summary: `build/cad_regression/20260221_123358/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-21T12:34:41.555019+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260221_123441_20260221_203028_387_a888_20260221_123153.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`

### Runs
- editor_smoke_run_id: `20260221_203028_387_a888` status=`PASS` pass=`8` fail=`0` skipped=`0`
- editor_smoke_filters: `priority_set=P0,P1` `tag_any=text-heavy,arc-heavy,polyline-heavy,import-stress`
- editor_smoke_case_selection: `selected=8` `matched=19` `candidate=19` `total=20` `fallback=false`
- step166_run_id: `20260221_123153` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=True` `applied=False` `candidate=20260221_123153` reason=`ok`
  - refresh_window: `days=5` `present=5` `stable=5` `latest=2026-02-21`
- perf_run_id: `20260221_123232`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `ok`
- gate_editor_smoke: run_id=`20260221_203233_260_db9d` status=`PASS` pass=`8` fail=`0` skipped=`0`
- gate_editor_smoke_filters: `priority_set=P0,P1` `tag_any=text-heavy,arc-heavy,polyline-heavy,import-stress`
- gate_editor_smoke_case_selection: `selected=8` `matched=19` `candidate=19` `total=20` `fallback=false`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`84`
- case_selection_trend_windows: `7d:m=0.956,fb=0.000,n=9 | 14d:m=0.956,fb=0.000,n=9`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_203028_387_a888/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_123153/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260221_123232/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260221_123232/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.010792ms`, box_query: `0.006792ms`, drag_commit: `0.030292ms`


## Gate Snapshot (2026-02-21T12:41:05Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260221_203859_375_0292` status=`PASS` pass=`8` fail=`0` skipped=`0`
- step166_run_id: `20260221_124022` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=1` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_203859_375_0292/summary.json`
- step166_summary: `build/cad_regression/20260221_124022/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-21T12:41:05.746827+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260221_124105_20260221_203647_315_4eaf_20260221_123812.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`

### Runs
- editor_smoke_run_id: `20260221_203647_315_4eaf` status=`PASS` pass=`8` fail=`0` skipped=`0`
- editor_smoke_filters: `priority_set=P0,P1` `tag_any=text-heavy,arc-heavy,polyline-heavy,import-stress`
- editor_smoke_case_selection: `selected=8` `matched=19` `candidate=19` `total=20` `fallback=false`
- step166_run_id: `20260221_123812` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=True` `applied=False` `candidate=20260221_123812` reason=`ok`
  - refresh_window: `days=5` `present=5` `stable=5` `latest=2026-02-21`
- perf_run_id: `20260221_123859`
- real_scene_perf: `enabled=True` status=`PASS`
- gate: `ok`
- gate_editor_smoke: run_id=`20260221_203859_375_0292` status=`PASS` pass=`8` fail=`0` skipped=`0`
- gate_editor_smoke_filters: `priority_set=P0,P1` `tag_any=text-heavy,arc-heavy,polyline-heavy,import-stress`
- gate_editor_smoke_case_selection: `selected=8` `matched=19` `candidate=19` `total=20` `fallback=false`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`86`
- case_selection_trend_windows: `7d:m=0.955,fb=0.000,n=11 | 14d:m=0.955,fb=0.000,n=11`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_203647_315_4eaf/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_123812/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260221_123859/summary.json`
- real_scene_perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_real_scene_perf/20260221_123859/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.009167ms`, box_query: `0.006375ms`, drag_commit: `0.026875ms`


## Gate Snapshot (2026-02-21T14:01:40Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_step186_laneB2.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260221_220139_193_4d9c` status=`PASS` pass=`2` fail=`0` skipped=`0`
- step166_run_id: `` (gate_would_fail=`False`)
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_220139_193_4d9c/summary.json`
- step166_summary: `(missing)`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-21T14:16:58.016688+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260221_141657_20260221_221546_502_3bcb_20260221_141547.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- editor_smoke_cases: `tools/web_viewer/tests/fixtures/editor_roundtrip_smoke_cases.json` `count=1` `min=4`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260221_221546_502_3bcb` status=`PASS` pass=`1` fail=`0` skipped=`0`
- editor_smoke_case_selection: `selected=1` `matched=1` `candidate=1` `total=1` `fallback=false`
- step166_run_id: `20260221_141547` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=True` `applied=False` `candidate=20260221_141547` reason=`ok`
  - refresh_window: `days=5` `present=5` `stable=5` `latest=2026-02-21`
- perf_run_id: `20260221_141656`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`91`
- case_selection_trend_windows: `7d:m=0.968,fb=0.000,n=16 | 14d:m=0.968,fb=0.000,n=16`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_221546_502_3bcb/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_141547/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260221_141656/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.009750ms`, box_query: `0.006291ms`, drag_commit: `0.036625ms`


## Weekly Snapshot (2026-02-21T14:18:17.009349+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260221_141816_20260221_221728_274_5e5c_20260221_141729.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- editor_smoke_cases: `local/editor_roundtrip_smoke_cases.json` `count=2` `min=4`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260221_221728_274_5e5c` status=`PASS` pass=`2` fail=`0` skipped=`0`
- editor_smoke_case_selection: `selected=2` `matched=2` `candidate=2` `total=2` `fallback=false`
- step166_run_id: `20260221_141729` (gate_would_fail=`True`)
- step166_baseline_compare: `compared=6` `degraded=1` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`day=2026-02-21 run_id=20260221_141729 unstable: totals.fail=1`
  - refresh_window: `days=5` `present=5` `stable=4` `latest=2026-02-21`
- perf_run_id: `20260221_141816`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`91`
- case_selection_trend_windows: `7d:m=0.968,fb=0.000,n=16 | 14d:m=0.968,fb=0.000,n=16`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_221728_274_5e5c/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_141729/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260221_141816/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.009917ms`, box_query: `0.006417ms`, drag_commit: `0.025875ms`


## Weekly Snapshot (2026-02-21T14:36:59.621280+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260221_143659_20260221_223547_598_f4b3_20260221_143550.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260221_223547_598_f4b3` status=`PASS` pass=`8` fail=`0` skipped=`0`
- editor_smoke_case_selection: `selected=8` `matched=32` `candidate=32` `total=32` `fallback=false`
- step166_run_id: `20260221_143550` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=True` `applied=False` `candidate=20260221_143550` reason=`ok`
  - refresh_window: `days=5` `present=5` `stable=5` `latest=2026-02-21`
- perf_run_id: `20260221_143659`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`93`
- case_selection_trend_windows: `7d:m=0.970,fb=0.000,n=18 | 14d:m=0.970,fb=0.000,n=18`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_223547_598_f4b3/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_143550/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260221_143659/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.009917ms`, box_query: `0.006833ms`, drag_commit: `0.029416ms`


## Weekly Snapshot (2026-02-21T14:36:59.621280+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260221_143659_20260221_223547_598_f4b3_20260221_143550.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- editor_smoke_cases: `<discovery>` `count=0` `min=4`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260221_223547_598_f4b3` status=`PASS` pass=`8` fail=`0` skipped=`0`
- editor_smoke_case_selection: `selected=8` `matched=32` `candidate=32` `total=32` `fallback=false`
- step166_run_id: `20260221_143550` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=True` `applied=False` `candidate=20260221_143550` reason=`ok`
  - refresh_window: `days=5` `present=5` `stable=5` `latest=2026-02-21`
- perf_run_id: `20260221_143659`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`93`
- case_selection_trend_windows: `7d:m=0.970,fb=0.000,n=18 | 14d:m=0.970,fb=0.000,n=18`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_223547_598_f4b3/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_143550/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260221_143659/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.009917ms`, box_query: `0.006833ms`, drag_commit: `0.029416ms`


## Gate Snapshot (2026-02-23T13:37:42Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260223_213741_417_ab01` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- ui_flow_smoke: `True` run_id=`20260223_213711_ui_flow` (mode=`gate`)
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- step166_run_id: `` (gate_would_fail=`False`)
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260223_213741_417_ab01/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_213711_ui_flow/summary.json`
- step166_summary: `(missing)`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-23T15:25:34Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260223_232532_886_ae04` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- ui_flow_smoke: `True` run_id=`20260223_232504_ui_flow` (mode=`gate`)
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- step166_run_id: `` (gate_would_fail=`False`)
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260223_232532_886_ae04/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_232504_ui_flow/summary.json`
- step166_summary: `(missing)`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-23T15:32:19Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260223_233110_438_8ed0` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- ui_flow_smoke: `True` run_id=`20260223_233040_ui_flow` (mode=`gate`)
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- step166_run_id: `20260223_153113` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=1` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260223_233110_438_8ed0/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_233040_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260223_153113/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-23T15:34:34Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260223_233434_005_ff05` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- ui_flow_smoke: `True` run_id=`20260223_233353_ui_flow` (mode=`gate`)
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- step166_run_id: `` (gate_would_fail=`False`)
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260223_233434_005_ff05/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_233353_ui_flow/summary.json`
- step166_summary: `(missing)`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-24T05:37:08Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260224_133633_732_74f1` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `True` run_id=`20260224_133558_ui_flow` (mode=`gate`)
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- step166_run_id: `20260224_053635` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_133633_732_74f1/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_133558_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260224_053635/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-24T06:13:52Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260224_141351_458_4082` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `True` run_id=`20260224_141316_ui_flow` (mode=`gate`)
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- step166_run_id: `` (gate_would_fail=`False`)
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_141351_458_4082/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_141316_ui_flow/summary.json`
- step166_summary: `(missing)`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-21T14:36:59.621280+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260221_143659_20260221_223547_598_f4b3_20260221_143550.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- editor_smoke_cases: `<discovery>` `count=0` `min=4`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260221_223547_598_f4b3` status=`PASS` pass=`8` fail=`0` skipped=`0`
- editor_smoke_case_selection: `selected=8` `matched=32` `candidate=32` `total=32` `fallback=false`
- step166_run_id: `20260221_143550` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=True` `applied=False` `candidate=20260221_143550` reason=`ok`
  - refresh_window: `days=5` `present=5` `stable=5` `latest=2026-02-21`
- perf_run_id: `20260221_143659`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`93`
- case_selection_trend_windows: `7d:m=0.970,fb=0.000,n=18 | 14d:m=0.970,fb=0.000,n=18`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_223547_598_f4b3/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_143550/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260221_143659/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.009917ms`, box_query: `0.006833ms`, drag_commit: `0.029416ms`


## Gate Snapshot (2026-02-24T06:28:05Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260224_142804_258_3623` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- step166_run_id: `` (gate_would_fail=`False`)
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_142804_258_3623/summary.json`
- step166_summary: `(missing)`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-24T09:08:26Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260224_170750_843_21d4` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `True` run_id=`20260224_170716_ui_flow` (mode=`gate`)
- ui_flow_gate_required: `required=True` `explicit=False`
- ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:49659`
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- step166_run_id: `20260224_090753` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_170750_843_21d4/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_170716_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260224_090753/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-24T09:11:18Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260224_171116_863_7273` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `True` run_id=`20260224_171039_ui_flow` (mode=`gate`)
- ui_flow_gate_required: `required=True` `explicit=False`
- ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:50282`
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- step166_run_id: `` (gate_would_fail=`False`)
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_171116_863_7273/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_171039_ui_flow/summary.json`
- step166_summary: `(missing)`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-21T14:36:59.621280+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260221_143659_20260221_223547_598_f4b3_20260221_143550.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- editor_smoke_cases: `<discovery>` `count=0` `min=4`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260221_223547_598_f4b3` status=`PASS` pass=`8` fail=`0` skipped=`0`
- editor_smoke_case_selection: `selected=8` `matched=32` `candidate=32` `total=32` `fallback=false`
- step166_run_id: `20260221_143550` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=True` `applied=False` `candidate=20260221_143550` reason=`ok`
  - refresh_window: `days=5` `present=5` `stable=5` `latest=2026-02-21`
- perf_run_id: `20260221_143659`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`93`
- case_selection_trend_windows: `7d:m=0.970,fb=0.000,n=18 | 14d:m=0.970,fb=0.000,n=18`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_223547_598_f4b3/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_143550/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260221_143659/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.009917ms`, box_query: `0.006833ms`, drag_commit: `0.029416ms`


## Gate Snapshot (2026-02-24T11:27:38Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260224_192701_361_4279` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `True` run_id=`20260224_192624_ui_flow` (mode=`gate`)
- ui_flow_run_ids: `20260224_192548_ui_flow 20260224_192624_ui_flow`
- ui_flow_gate_required: `required=True` `explicit=False`
- ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:59530`
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- step166_run_id: `20260224_112704` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_192701_361_4279/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_192624_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260224_112704/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-21T14:36:59.621280+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260221_143659_20260221_223547_598_f4b3_20260221_143550.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- editor_smoke_cases: `<discovery>` `count=0` `min=4`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260221_223547_598_f4b3` status=`PASS` pass=`8` fail=`0` skipped=`0`
- editor_smoke_case_selection: `selected=8` `matched=32` `candidate=32` `total=32` `fallback=false`
- step166_run_id: `20260221_143550` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=True` `applied=False` `candidate=20260221_143550` reason=`ok`
  - refresh_window: `days=5` `present=5` `stable=5` `latest=2026-02-21`
- perf_run_id: `20260221_143659`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `skipped`
- trend: `stable`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`93`
- case_selection_trend_windows: `7d:m=0.970,fb=0.000,n=18 | 14d:m=0.970,fb=0.000,n=18`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_223547_598_f4b3/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_143550/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260221_143659/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.009917ms`, box_query: `0.006833ms`, drag_commit: `0.029416ms`


## Gate Snapshot (2026-02-24T14:18:55Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260224_221818_530_27b2` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `True` run_id=`20260224_221742_ui_flow` (mode=`gate`)
- ui_flow_run_ids: `20260224_221703_ui_flow 20260224_221742_ui_flow`
- ui_flow_gate_required: `required=True` `explicit=False`
- ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:49877`
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- step166_run_id: `20260224_141821` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_221818_530_27b2/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_221742_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260224_141821/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-25T11:09:18Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260225_190838_459_17d4` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `True` run_id=`20260225_190801_ui_flow` (mode=`gate`)
- ui_flow_run_ids: `20260225_190725_ui_flow 20260225_190801_ui_flow`
- ui_flow_gate_required: `required=True` `explicit=False`
- ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:59017`
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- step166_run_id: `20260225_110841` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=1` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260225_190838_459_17d4/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_190801_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260225_110841/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-25T12:16:59Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260225_201620_908_744d` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `True` run_id=`20260225_201543_ui_flow` (mode=`gate`)
- ui_flow_run_ids: `20260225_201506_ui_flow 20260225_201543_ui_flow`
- ui_flow_gate_required: `required=True` `explicit=False`
- ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:61393`
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- step166_run_id: `20260225_121624` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=2` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260225_201620_908_744d/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_201543_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260225_121624/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-25T14:38:31Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260225_223753_684_a7a5` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `True` run_id=`20260225_223717_ui_flow` (mode=`gate`)
- ui_flow_run_ids: `20260225_223639_ui_flow 20260225_223717_ui_flow`
- ui_flow_gate_required: `required=True` `explicit=False`
- ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:64569`
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- step166_run_id: `20260225_143757` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260225_223753_684_a7a5/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_223717_ui_flow/summary.json`
- step166_summary: `build/cad_regression/20260225_143757/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-25T15:05:38Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_full_qt.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260225_230502_479_4772` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `True` run_id=`20260225_230424_ui_flow` (mode=`gate`)
- ui_flow_run_ids: `20260225_230348_ui_flow 20260225_230424_ui_flow`
- ui_flow_gate_required: `required=True` `explicit=False`
- ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:49645`
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- qt_project_persistence: `status=skipped` `mode=observe` `gate_required=False` `require_on=False` run_id=`20260225_150505` reason=`BUILD_EDITOR_QT_OFF`
- qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- step166_run_id: `20260225_150505` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=1` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260225_230502_479_4772/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_230424_ui_flow/summary.json`
- qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- step166_summary: `build/cad_regression/20260225_150505/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-26T02:16:36Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260226_101551_046_2fb6` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `True` run_id=`20260226_101510_ui_flow` (mode=`gate`)
- ui_flow_run_ids: `20260226_101418_ui_flow 20260226_101510_ui_flow`
- ui_flow_gate_required: `required=True` `explicit=False`
- ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:57873`
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- qt_project_persistence: `status=skipped` `mode=gate` `gate_required=True` `require_on=False` run_id=`20260226_021555` reason=`BUILD_EDITOR_QT_OFF`
- qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- step166_run_id: `20260226_021555` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=5` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- real_scene_trend: `observe` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260226_101551_046_2fb6/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260226_101510_ui_flow/summary.json`
- qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- step166_summary: `build/cad_regression/20260226_021555/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-26T03:39:10Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260226_113833_253_a1c6` status=`PASS` pass=`4` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `True` run_id=`20260226_113754_ui_flow` (mode=`gate`)
- ui_flow_run_ids: `20260226_113715_ui_flow 20260226_113754_ui_flow`
- ui_flow_gate_required: `required=True` `explicit=False`
- ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:50033`
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- qt_project_persistence: `status=skipped` `mode=gate` `gate_required=True` `require_on=False` run_id=`20260226_033836` reason=`BUILD_EDITOR_QT_OFF`
- qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- step166_run_id: `20260226_033836` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=2` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260226_113833_253_a1c6/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260226_113754_ui_flow/summary.json`
- qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- step166_summary: `build/cad_regression/20260226_033836/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-26T03:39:11.299857+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_qt_policy.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260226_033911_20260226_113640_059_8902_20260226_033642.json`

### Inputs
- editor_smoke: `mode=observe` `limit=4`
- editor_smoke_cases: `<discovery>` `count=0` `min=4`
- ui_flow_failure_injection: `timeout_ms=1` `strict=False`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`

### Runs
- editor_smoke_run_id: `20260226_113640_059_8902` status=`PASS` pass=`4` fail=`0` skipped=`0`
- editor_smoke_case_selection: `selected=4` `matched=16` `candidate=16` `total=16` `fallback=false`
- ui_flow_failure_injection: `PASS` run_id=`20260226_113621_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:49850/tools/web_viewer/index.html?mode=editor&seed=0&debug=1&v=20260226_113621_ui_flow`
- step166_run_id: `20260226_033642` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`not enough consecutive days: have=4 need=5 missing_day=2026-02-22`
  - refresh_window: `days=5` `present=4` `stable=4` `latest=2026-02-26` `first_missing=2026-02-22`
- perf_run_id: `20260226_033714`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `ok`
- qt_persistence_policy: `status=observe` `recommended_require_on=False` `effective_require_on=False` `source=auto-policy` samples=`1/1`
  - recommendation: `Need >= 5 samples before enabling require_on=1.`
  - thresholds: `min_samples=5` `min_consecutive_target_passes=3`
  - target_available: `runs=0` `pass=0` `fail=0` `consecutive_pass=0`
- gate_editor_smoke: run_id=`20260226_113833_253_a1c6` status=`PASS` pass=`4` fail=`0` skipped=`0`
- gate_editor_smoke_case_selection: `selected=4` `matched=16` `candidate=16` `total=16` `fallback=false`
- gate_editor_smoke_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`
- gate_qt_project_persistence: `status=skipped` `mode=gate` `gate_required=True` `require_on=False` run_id=`20260226_033836` reason=`BUILD_EDITOR_QT_OFF`
- gate_qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- trend: `watch`
- perf_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.16`, selected=`2`, selection_mode=`batch_only`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `observe` (auto_gate_mode=`observe`, coverage_days=`0.18`, selected=`4`, selection_mode=`batch_only`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`144`
- case_selection_trend_windows: `7d:m=0.993,fb=0.000,n=69 | 14d:m=0.993,fb=0.000,n=69`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260226_113640_059_8902/summary.json`
- ui_flow_failure_injection_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260226_113621_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260226_033642/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260226_033714/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- gate_qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`
- qt_persistence_policy_json: `build/qt_project_persistence_gate_policy.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.010083ms`, box_query: `0.006250ms`, drag_commit: `0.052958ms`


## Gate Snapshot (unknown)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_full_current.json`

### Runs
- editor_smoke_run_id: `` status=`` pass=`0` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- step166_run_id: `` (gate_would_fail=`False`)

### Artifacts
- editor_smoke_summary: `(missing)`
- step166_summary: `(missing)`


## Gate Snapshot (2026-02-27T14:19:45Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_full_current.json`

### Runs
- gate_decision: would_fail=`True` exit_code=`2` reasons=`STEP166:RC_2`
- editor_smoke_run_id: `20260227_221818_596_7670` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `True` run_id=`20260227_221735_ui_flow` (mode=`gate`)
- ui_flow_run_ids: `20260227_221652_ui_flow 20260227_221735_ui_flow`
- ui_flow_gate_required: `required=True` `explicit=False`
- ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:65471`
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- qt_project_persistence: `status=skipped` `mode=observe` `gate_required=False` `require_on=False` run_id=`20260227_141822` reason=`BUILD_EDITOR_QT_OFF`
- qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- step166_run_id: `20260227_141822` (gate_would_fail=`True`)
- step166_baseline_compare: `compared=6` `degraded=6` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260227_221818_596_7670/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260227_221735_ui_flow/summary.json`
- qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- step166_summary: `build/cad_regression/20260227_141822/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-28T03:45:56Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`True` exit_code=`2` reasons=`STEP166:RC_2`
- editor_smoke_run_id: `20260228_114433_042_1874` status=`PASS` pass=`4` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `True` run_id=`20260228_114351_ui_flow` (mode=`gate`)
- ui_flow_run_ids: `20260228_114310_ui_flow 20260228_114351_ui_flow`
- ui_flow_gate_required: `required=True` `explicit=False`
- ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:55629`
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- qt_project_persistence: `status=skipped` `mode=gate` `gate_required=True` `require_on=False` run_id=`20260228_034436` reason=`BUILD_EDITOR_QT_OFF`
- qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- step166_run_id: `20260228_034436` (gate_would_fail=`True`)
- step166_baseline_compare: `compared=6` `degraded=6` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_114433_042_1874/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260228_114351_ui_flow/summary.json`
- qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- step166_summary: `build/cad_regression/20260228_034436/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-28T03:45:57.285680+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_gatefail.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260228_034557_20260228_114144_006_4214_20260228_034147.json`

### Inputs
- editor_smoke: `mode=observe` `limit=4`
- editor_smoke_cases: `<discovery>` `count=0` `min=4`
- ui_flow_failure_injection: `timeout_ms=1` `strict=False`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`

### Runs
- editor_smoke_run_id: `20260228_114144_006_4214` status=`PASS` pass=`4` fail=`0` skipped=`0`
- editor_smoke_case_selection: `selected=4` `matched=16` `candidate=16` `total=16` `fallback=false`
- ui_flow_failure_injection: `PASS` run_id=`20260228_114123_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:53558/tools/web_viewer/index.html?mode=editor&seed=0&debug=1&v=20260228_114123_ui_flow`
- step166_run_id: `20260228_034147` (gate_would_fail=`True`)
- step166_baseline_compare: `compared=6` `degraded=6` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`day=2026-02-27 run_id=20260227_141822 unstable: totals.fail=6`
  - refresh_window: `days=5` `present=5` `stable=3` `latest=2026-02-28`
- perf_run_id: `20260228_034309`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `fail`
- qt_persistence_policy: `status=observe` `recommended_require_on=False` `effective_require_on=False` `source=auto-policy` samples=`5/5`
  - recommendation: `No target-available Qt runs in window; keep require_on=0.`
  - thresholds: `min_samples=5` `min_consecutive_target_passes=3`
  - target_available: `runs=0` `pass=0` `fail=0` `consecutive_pass=0`
- gate_editor_smoke: run_id=`20260228_114433_042_1874` status=`PASS` pass=`4` fail=`0` skipped=`0`
- gate_editor_smoke_case_selection: `selected=4` `matched=16` `candidate=16` `total=16` `fallback=false`
- gate_editor_smoke_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`
- gate_qt_project_persistence: `status=skipped` `mode=gate` `gate_required=True` `require_on=False` run_id=`20260228_034436` reason=`BUILD_EDITOR_QT_OFF`
- gate_qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- trend: `watch`
- perf_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`13.98`, selected=`26`, selection_mode=`all`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`7.35`, selected=`15`, selection_mode=`all`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`148`
- case_selection_trend_windows: `7d:m=0.996,fb=0.000,n=68 | 14d:m=0.993,fb=0.000,n=73`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_114144_006_4214/summary.json`
- ui_flow_failure_injection_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260228_114123_ui_flow/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_034147/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260228_034309/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- gate_qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`
- qt_persistence_policy_json: `build/qt_project_persistence_gate_policy.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.008791ms`, box_query: `0.006458ms`, drag_commit: `0.027125ms`


## Gate Snapshot (2026-02-28T04:10:09Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260228_120825_769_32b4` status=`PASS` pass=`4` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `False` run_id=`` (mode=`skipped` enabled=`False`)
- ui_flow_gate_required: `required=False` `explicit=True`
- ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- qt_project_persistence: `status=skipped` `mode=gate` `gate_required=True` `require_on=False` run_id=`20260228_040828` reason=`BUILD_EDITOR_QT_OFF`
- qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- step166_run_id: `20260228_040828` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_120825_769_32b4/summary.json`
- qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- step166_summary: `build/cad_regression/20260228_040828/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-28T04:10:09.845545+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_step185_alignfix.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260228_041009_20260228_120644_514_aab9_20260228_040645.json`

### Inputs
- editor_smoke: `mode=observe` `limit=4`
- editor_smoke_cases: `<discovery>` `count=0` `min=4`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`

### Runs
- editor_smoke_run_id: `20260228_120644_514_aab9` status=`PASS` pass=`4` fail=`0` skipped=`0`
- editor_smoke_case_selection: `selected=4` `matched=16` `candidate=16` `total=16` `fallback=false`
- step166_run_id: `20260228_040645` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`day=2026-02-27 run_id=20260227_141822 unstable: totals.fail=6`
  - refresh_window: `days=5` `present=5` `stable=4` `latest=2026-02-28`
- perf_run_id: `20260228_040825`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `ok`
- qt_persistence_policy: `status=observe` `recommended_require_on=False` `effective_require_on=False` `source=auto-policy` samples=`8/8`
  - recommendation: `No target-available Qt runs in window; keep require_on=0.`
  - thresholds: `min_samples=5` `min_consecutive_target_passes=3`
  - target_available: `runs=0` `pass=0` `fail=0` `consecutive_pass=0`
- gate_editor_smoke: run_id=`20260228_120825_769_32b4` status=`PASS` pass=`4` fail=`0` skipped=`0`
- gate_editor_smoke_case_selection: `selected=4` `matched=16` `candidate=16` `total=16` `fallback=false`
- gate_editor_smoke_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`
- gate_qt_project_persistence: `status=skipped` `mode=gate` `gate_required=True` `require_on=False` run_id=`20260228_040828` reason=`BUILD_EDITOR_QT_OFF`
- gate_qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- trend: `watch`
- perf_trend: `watch` (auto_gate_mode=`observe`, coverage_days=`12.57`, selected=`26`, selection_mode=`all`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`5.93`, selected=`14`, selection_mode=`all`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`151`
- case_selection_trend_windows: `7d:m=0.996,fb=0.000,n=71 | 14d:m=0.993,fb=0.000,n=76`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_120644_514_aab9/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_040645/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260228_040825/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- gate_qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`
- qt_persistence_policy_json: `build/qt_project_persistence_gate_policy.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.010084ms`, box_query: `0.006917ms`, drag_commit: `0.042584ms`


## Gate Snapshot (2026-02-28T04:25:37Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260228_122347_744_8b5a` status=`PASS` pass=`4` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `False` run_id=`` (mode=`skipped` enabled=`False`)
- ui_flow_gate_required: `required=False` `explicit=True`
- ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- qt_project_persistence: `status=skipped` `mode=gate` `gate_required=True` `require_on=False` run_id=`20260228_042350` reason=`BUILD_EDITOR_QT_OFF`
- qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- step166_run_id: `20260228_042350` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_122347_744_8b5a/summary.json`
- qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- step166_summary: `build/cad_regression/20260228_042350/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-28T04:25:39.531088+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_step185_gatecontext.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260228_042539_20260228_122206_778_ca66_20260228_042208.json`

### Inputs
- editor_smoke: `mode=observe` `limit=4`
- editor_smoke_cases: `<discovery>` `count=0` `min=4`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`

### Runs
- editor_smoke_run_id: `20260228_122206_778_ca66` status=`PASS` pass=`4` fail=`0` skipped=`0`
- editor_smoke_case_selection: `selected=4` `matched=16` `candidate=16` `total=16` `fallback=false`
- step166_run_id: `20260228_042208` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`day=2026-02-27 run_id=20260227_141822 unstable: totals.fail=6`
  - refresh_window: `days=5` `present=5` `stable=4` `latest=2026-02-28`
- perf_run_id: `20260228_042347`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `ok`
- gate_ui_flow_smoke: `mode=skipped` `status=` `run_count=0` `pass=0` `fail=0`
- gate_step166_run_id: `20260228_042350` (enabled=`True` gate_would_fail=`False`)
- gate_step166_baseline_compare: `compared=6` `degraded=0` `improved=3`
- qt_persistence_policy: `status=observe` `recommended_require_on=False` `effective_require_on=False` `source=auto-policy` samples=`9/9`
  - recommendation: `No target-available Qt runs in window; keep require_on=0.`
  - thresholds: `min_samples=5` `min_consecutive_target_passes=3`
  - target_available: `runs=0` `pass=0` `fail=0` `consecutive_pass=0`
- gate_editor_smoke: run_id=`20260228_122347_744_8b5a` status=`PASS` pass=`4` fail=`0` skipped=`0`
- gate_editor_smoke_case_selection: `selected=4` `matched=16` `candidate=16` `total=16` `fallback=false`
- gate_editor_smoke_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`
- gate_qt_project_persistence: `status=skipped` `mode=gate` `gate_required=True` `require_on=False` run_id=`20260228_042350` reason=`BUILD_EDITOR_QT_OFF`
- gate_qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- trend: `watch`
- perf_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`12.59`, selected=`27`, selection_mode=`all`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`5.93`, selected=`14`, selection_mode=`all`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`152`
- case_selection_trend_windows: `7d:m=0.996,fb=0.000,n=72 | 14d:m=0.994,fb=0.000,n=77`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_122206_778_ca66/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_042208/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260228_042347/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- gate_qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`
- qt_persistence_policy_json: `build/qt_project_persistence_gate_policy.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.010167ms`, box_query: `0.006500ms`, drag_commit: `0.028792ms`


## Weekly Snapshot (2026-02-28T04:25:39.531088+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_step185_gatecontext.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260228_042539_20260228_122206_778_ca66_20260228_042208.json`

### Inputs
- editor_smoke: `mode=observe` `limit=4`
- editor_smoke_cases: `<discovery>` `count=0` `min=4`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`

### Runs
- editor_smoke_run_id: `20260228_122206_778_ca66` status=`PASS` pass=`4` fail=`0` skipped=`0`
- editor_smoke_case_selection: `selected=4` `matched=16` `candidate=16` `total=16` `fallback=false`
- step166_run_id: `20260228_042208` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`day=2026-02-27 run_id=20260227_141822 unstable: totals.fail=6`
  - refresh_window: `days=5` `present=5` `stable=4` `latest=2026-02-28`
- perf_run_id: `20260228_042347`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `ok`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
- gate_step166_run_id: `20260228_042350` (enabled=`True` gate_would_fail=`False`)
- gate_step166_baseline_compare: `compared=6` `degraded=0` `improved=3`
- qt_persistence_policy: `status=observe` `recommended_require_on=False` `effective_require_on=False` `source=auto-policy` samples=`9/9`
  - recommendation: `No target-available Qt runs in window; keep require_on=0.`
  - thresholds: `min_samples=5` `min_consecutive_target_passes=3`
  - target_available: `runs=0` `pass=0` `fail=0` `consecutive_pass=0`
- gate_editor_smoke: run_id=`20260228_122347_744_8b5a` status=`PASS` pass=`4` fail=`0` skipped=`0`
- gate_editor_smoke_case_selection: `selected=4` `matched=16` `candidate=16` `total=16` `fallback=false`
- gate_editor_smoke_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`
- gate_qt_project_persistence: `status=skipped` `mode=gate` `gate_required=True` `require_on=False` run_id=`20260228_042350` reason=`BUILD_EDITOR_QT_OFF`
- gate_qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- trend: `watch`
- perf_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`12.59`, selected=`27`, selection_mode=`all`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`5.93`, selected=`14`, selection_mode=`all`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`152`
- case_selection_trend_windows: `7d:m=0.996,fb=0.000,n=72 | 14d:m=0.994,fb=0.000,n=77`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_122206_778_ca66/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_042208/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260228_042347/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- gate_qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`
- qt_persistence_policy_json: `build/qt_project_persistence_gate_policy.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.010167ms`, box_query: `0.006500ms`, drag_commit: `0.028792ms`


## Weekly Snapshot (2026-02-28T04:25:39.531088+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_step185_gatecontext.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260228_042539_20260228_122206_778_ca66_20260228_042208.json`

### Inputs
- editor_smoke: `mode=observe` `limit=4`
- editor_smoke_cases: `<discovery>` `count=0` `min=4`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`

### Runs
- editor_smoke_run_id: `20260228_122206_778_ca66` status=`PASS` pass=`4` fail=`0` skipped=`0`
- editor_smoke_case_selection: `selected=4` `matched=16` `candidate=16` `total=16` `fallback=false`
- step166_run_id: `20260228_042208` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`day=2026-02-27 run_id=20260227_141822 unstable: totals.fail=6`
  - refresh_window: `days=5` `present=5` `stable=4` `latest=2026-02-28`
- perf_run_id: `20260228_042347`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `ok`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
- gate_step166_run_id: `20260228_042350` (enabled=`True` gate_would_fail=`False`)
- gate_step166_baseline_compare: `compared=6` `degraded=0` `improved=3`
- qt_persistence_policy: `status=observe` `recommended_require_on=False` `effective_require_on=False` `source=auto-policy` samples=`9/9`
  - recommendation: `No target-available Qt runs in window; keep require_on=0.`
  - thresholds: `min_samples=5` `min_consecutive_target_passes=3`
  - target_available: `runs=0` `pass=0` `fail=0` `consecutive_pass=0`
- gate_editor_smoke: run_id=`20260228_122347_744_8b5a` status=`PASS` pass=`4` fail=`0` skipped=`0`
- gate_editor_smoke_case_selection: `selected=4` `matched=16` `candidate=16` `total=16` `fallback=false`
- gate_editor_smoke_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`
- gate_qt_project_persistence: `status=skipped` `mode=gate` `gate_required=True` `require_on=False` run_id=`20260228_042350` reason=`BUILD_EDITOR_QT_OFF`
- gate_qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- trend: `watch`
- perf_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`12.59`, selected=`27`, selection_mode=`all`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`5.93`, selected=`14`, selection_mode=`all`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`152`
- case_selection_trend_windows: `7d:m=0.996,fb=0.000,n=72 | 14d:m=0.994,fb=0.000,n=77`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_122206_778_ca66/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_042208/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260228_042347/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- gate_qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`
- qt_persistence_policy_json: `build/qt_project_persistence_gate_policy.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.010167ms`, box_query: `0.006500ms`, drag_commit: `0.028792ms`


## Weekly Snapshot (2026-02-28T05:50:00.860620+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_step185_casegen.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260228_055000_20260228_134749_339_99ff_20260228_054752.json`

### Inputs
- editor_smoke: `mode=observe` `limit=4`
- editor_smoke_cases: `local/editor_roundtrip_smoke_cases_weekly.json` `source=generated` `count=4` `min=4`
- editor_smoke_generated_cases: `local/editor_roundtrip_smoke_cases_weekly.json` `count=4` `min=4` `priorities=P0,P1`
- editor_smoke_generated_runs: `run_id=20260228_042350` `run_ids=20260228_042350,20260228_042208`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `False`

### Runs
- editor_smoke_run_id: `20260228_134749_339_99ff` status=`PASS` pass=`4` fail=`0` skipped=`0`
- editor_smoke_filters: `priority_set=P0,P1` `tag_any=text-heavy,arc-heavy,polyline-heavy,import-stress`
- editor_smoke_case_selection: `selected=4` `matched=4` `candidate=4` `total=4` `fallback=false`
- step166_run_id: `20260228_054752` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`day=2026-02-27 run_id=20260227_141822 unstable: totals.fail=6`
  - refresh_window: `days=5` `present=5` `stable=4` `latest=2026-02-28`
- perf_run_id: `20260228_054958`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `skipped`
- qt_persistence_policy: `status=observe` `recommended_require_on=False` `effective_require_on=False` `source=auto-policy` samples=`11/11`
  - recommendation: `No target-available Qt runs in window; keep require_on=0.`
  - thresholds: `min_samples=5` `min_consecutive_target_passes=3`
  - target_available: `runs=0` `pass=0` `fail=0` `consecutive_pass=0`
- trend: `watch`
- perf_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`12.65`, selected=`28`, selection_mode=`all`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`5.93`, selected=`14`, selection_mode=`all`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`153`
- case_selection_trend_windows: `7d:m=0.996,fb=0.000,n=73 | 14d:m=0.994,fb=0.000,n=78`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_134749_339_99ff/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_054752/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260228_054958/summary.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`
- qt_persistence_policy_json: `build/qt_project_persistence_gate_policy.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.008708ms`, box_query: `0.006500ms`, drag_commit: `0.029208ms`


## Weekly Snapshot (2026-02-28T05:56:53.118869+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_step185_casegen_gate.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260228_055653_20260228_135333_291_a136_20260228_055334.json`

### Inputs
- editor_smoke: `mode=observe` `limit=4`
- editor_smoke_cases: `local/editor_roundtrip_smoke_cases_weekly.json` `source=generated` `count=4` `min=4`
- editor_smoke_generated_cases: `local/editor_roundtrip_smoke_cases_weekly.json` `count=4` `min=4` `priorities=P0,P1`
- editor_smoke_generated_runs: `run_id=20260228_054752` `run_ids=20260228_054752,20260228_042350`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`
- gate_editor_smoke_cases: `local/editor_roundtrip_smoke_cases_weekly.json` `source=generated`
- gate_editor_smoke_generated_cases: `local/editor_roundtrip_smoke_cases_weekly_gate.json` `count=2` `priorities=P0,P1`
- gate_editor_smoke_generated_runs: `run_id=20260228_055334` `run_ids=20260228_055334`

### Runs
- editor_smoke_run_id: `20260228_135333_291_a136` status=`PASS` pass=`4` fail=`0` skipped=`0`
- editor_smoke_filters: `priority_set=P0,P1` `tag_any=text-heavy,arc-heavy,polyline-heavy,import-stress`
- editor_smoke_case_selection: `selected=4` `matched=4` `candidate=4` `total=4` `fallback=false`
- step166_run_id: `20260228_055334` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`day=2026-02-27 run_id=20260227_141822 unstable: totals.fail=6`
  - refresh_window: `days=5` `present=5` `stable=4` `latest=2026-02-28`
- perf_run_id: `20260228_055507`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `ok`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
- gate_step166_run_id: `20260228_055511` (enabled=`True` gate_would_fail=`False`)
- gate_step166_baseline_compare: `compared=6` `degraded=0` `improved=3`
- qt_persistence_policy: `status=observe` `recommended_require_on=False` `effective_require_on=False` `source=auto-policy` samples=`11/11`
  - recommendation: `No target-available Qt runs in window; keep require_on=0.`
  - thresholds: `min_samples=5` `min_consecutive_target_passes=3`
  - target_available: `runs=0` `pass=0` `fail=0` `consecutive_pass=0`
- gate_editor_smoke: run_id=`20260228_135508_362_203d` status=`PASS` pass=`4` fail=`0` skipped=`0`
- gate_editor_smoke_filters: `priority_set=P0,P1` `tag_any=text-heavy,arc-heavy,polyline-heavy,import-stress`
- gate_editor_smoke_case_selection: `selected=4` `matched=4` `candidate=4` `total=4` `fallback=false`
- gate_editor_smoke_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`
- gate_qt_project_persistence: `status=skipped` `mode=gate` `gate_required=True` `require_on=False` run_id=`20260228_055511` reason=`BUILD_EDITOR_QT_OFF`
- gate_qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- trend: `watch`
- perf_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`12.65`, selected=`29`, selection_mode=`all`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`5.93`, selected=`14`, selection_mode=`all`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`154`
- case_selection_trend_windows: `7d:m=0.996,fb=0.000,n=74 | 14d:m=0.994,fb=0.000,n=79`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_135333_291_a136/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_055334/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260228_055507/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- gate_qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`
- qt_persistence_policy_json: `build/qt_project_persistence_gate_policy.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.008750ms`, box_query: `0.006416ms`, drag_commit: `0.030583ms`


## Gate Snapshot (2026-02-28T06:16:40Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_step186_provenance.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260228_141638_427_8954` status=`PASS` pass=`4` fail=`0` skipped=`0`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `False` run_id=`` (mode=`skipped` enabled=`False`)
- ui_flow_gate_required: `required=False` `explicit=True`
- ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- qt_project_persistence: `status=skipped` `mode=observe` `gate_required=False` `require_on=False` run_id=`20260228_061639` reason=`BUILD_EDITOR_QT_OFF`
- qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- step166_run_id: `` (gate_would_fail=`False`)
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_141638_427_8954/summary.json`
- qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- step166_summary: `(missing)`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-28T06:34:55Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_step186_generatedmeta.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260228_143452_681_3920` status=`PASS` pass=`4` fail=`0` skipped=`0`
- editor_smoke_case_guard: `source=generated` `cases=4` `min=4`
- editor_smoke_generated_cases: `local/editor_roundtrip_smoke_cases_weekly.json` `count=4` `min=4` `priorities=P0,P1`
- editor_smoke_generated_runs: `run_id=20260228_055511` `run_ids=20260228_055511,20260228_055334`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `False` run_id=`` (mode=`skipped` enabled=`False`)
- ui_flow_gate_required: `required=False` `explicit=True`
- ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- qt_project_persistence: `status=skipped` `mode=observe` `gate_required=False` `require_on=False` run_id=`20260228_063454` reason=`BUILD_EDITOR_QT_OFF`
- qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- step166_run_id: `` (gate_would_fail=`False`)
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_143452_681_3920/summary.json`
- qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- step166_summary: `(missing)`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-28T06:34:55Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_step186_generatedmeta.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260228_143452_681_3920` status=`PASS` pass=`4` fail=`0` skipped=`0`
- editor_smoke_case_guard: `source=generated` `cases=4` `min=4`
- editor_smoke_generated_cases: `local/editor_roundtrip_smoke_cases_weekly.json` `count=4` `min=4` `priorities=P0,P1`
- editor_smoke_generated_runs: `run_id=20260228_055511` `run_ids=20260228_055511,20260228_055334`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `False` run_id=`` (mode=`skipped` enabled=`False`)
- ui_flow_gate_required: `required=False` `explicit=True`
- ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- qt_project_persistence: `status=skipped` `mode=observe` `gate_required=False` `require_on=False` run_id=`20260228_063454` reason=`BUILD_EDITOR_QT_OFF`
- qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- step166_run_id: `` (gate_would_fail=`False`)
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_143452_681_3920/summary.json`
- qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- step166_summary: `(missing)`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-28T06:40:08Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260228_143825_419_88ae` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_case_guard: `source=generated` `cases=8` `min=4`
- editor_smoke_generated_cases: `local/editor_roundtrip_smoke_cases_weekly_gate.json` `count=2` `min=4` `priorities=P0,P1`
- editor_smoke_generated_runs: `run_id=20260228_063519` `run_ids=20260228_063519`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `True` run_id=`20260228_143744_ui_flow` (mode=`gate`)
- ui_flow_run_ids: `20260228_143658_ui_flow 20260228_143744_ui_flow`
- ui_flow_gate_required: `required=True` `explicit=False`
- ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:53837`
- ui_flow_gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow_failure_attribution: `complete=True` `code_total=0`
- qt_project_persistence: `status=skipped` `mode=gate` `gate_required=True` `require_on=False` run_id=`20260228_063828` reason=`BUILD_EDITOR_QT_OFF`
- qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- step166_run_id: `20260228_063829` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_143825_419_88ae/summary.json`
- ui_flow_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260228_143744_ui_flow/summary.json`
- qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- step166_summary: `build/cad_regression/20260228_063829/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-28T06:40:08.969083+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_step186_generatedmeta.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260228_064008_20260228_143516_791_13e6_20260228_063519.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- editor_smoke_cases: `local/editor_roundtrip_smoke_cases_weekly.json` `source=generated` `count=8` `min=4`
- editor_smoke_generated_cases: `local/editor_roundtrip_smoke_cases_weekly.json` `count=8` `min=4` `priorities=P0,P1`
- editor_smoke_generated_runs: `run_id=20260228_061121` `run_ids=20260228_061121,20260228_060938,20260228_055511,20260228_055334`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`
- gate_editor_smoke_cases: `local/editor_roundtrip_smoke_cases_weekly.json` `source=generated`
- gate_editor_smoke_generated_cases: `local/editor_roundtrip_smoke_cases_weekly_gate.json` `count=2` `priorities=P0,P1`
- gate_editor_smoke_generated_runs: `run_id=20260228_063519` `run_ids=20260228_063519`

### Runs
- editor_smoke_run_id: `20260228_143516_791_13e6` status=`PASS` pass=`8` fail=`0` skipped=`0`
- editor_smoke_case_selection: `selected=8` `matched=8` `candidate=8` `total=8` `fallback=false`
- step166_run_id: `20260228_063519` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`day=2026-02-27 run_id=20260227_141822 unstable: totals.fail=6`
  - refresh_window: `days=5` `present=5` `stable=4` `latest=2026-02-28`
- perf_run_id: `20260228_063657`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `ok`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=2` `fail=0`
- gate_ui_flow_run_ids: `20260228_143658_ui_flow 20260228_143744_ui_flow`
- gate_step166_run_id: `20260228_063829` (enabled=`True` gate_would_fail=`False`)
- gate_step166_baseline_compare: `compared=6` `degraded=0` `improved=3`
- qt_persistence_policy: `status=observe` `recommended_require_on=False` `effective_require_on=False` `source=auto-policy` samples=`15/15`
  - recommendation: `No target-available Qt runs in window; keep require_on=0.`
  - thresholds: `min_samples=5` `min_consecutive_target_passes=3`
  - target_available: `runs=0` `pass=0` `fail=0` `consecutive_pass=0`
- gate_editor_smoke: run_id=`20260228_143825_419_88ae` status=`PASS` pass=`5` fail=`0` skipped=`0`
- gate_editor_smoke_case_source: `generated`
- gate_editor_smoke_case_selection: `selected=5` `matched=8` `candidate=8` `total=8` `fallback=false`
- gate_editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- gate_qt_project_persistence: `status=skipped` `mode=gate` `gate_required=True` `require_on=False` run_id=`20260228_063828` reason=`BUILD_EDITOR_QT_OFF`
- gate_qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- trend: `watch`
- perf_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`12.68`, selected=`31`, selection_mode=`all`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`5.93`, selected=`14`, selection_mode=`all`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `stable` windows=`7,14` samples_total=`158`
- case_selection_trend_windows: `7d:m=0.996,fb=0.000,rs=0.000,n=78,src=discovery:73/explicit:2/generated:3 | 14d:m=0.994,fb=0.000,rs=0.000,n=83,src=discovery:108/explicit:2/generated:3`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_143516_791_13e6/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_063519/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260228_063657/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- gate_qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`
- qt_persistence_policy_json: `build/qt_project_persistence_gate_policy.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.008667ms`, box_query: `0.006292ms`, drag_commit: `0.024416ms`


## Gate Snapshot (2026-02-28T06:55:44Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260228_145542_075_0efd` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_case_guard: `source=generated` `cases=8` `min=4`
- editor_smoke_generated_cases: `local/editor_roundtrip_smoke_cases_weekly.json` `count=4` `min=4` `priorities=P0,P1`
- editor_smoke_generated_runs: `run_id=20260228_055511` `run_ids=20260228_055511,20260228_055334`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `False` run_id=`` (mode=`skipped` enabled=`False`)
- ui_flow_gate_required: `required=False` `explicit=True`
- ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- qt_project_persistence: `status=skipped` `mode=observe` `gate_required=False` `require_on=False` run_id=`20260228_065544` reason=`BUILD_EDITOR_QT_OFF`
- qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- step166_run_id: `` (gate_would_fail=`False`)
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_145542_075_0efd/summary.json`
- qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- step166_summary: `(missing)`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Gate Snapshot (2026-02-28T11:10:20Z)
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_step186_gen_consistency.json`

### Runs
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260228_191018_671_f1cc` status=`PASS` pass=`4` fail=`0` skipped=`0`
- editor_smoke_case_guard: `source=discovery` `cases=0` `min=4`
- editor_smoke_generated_cases: `local/editor_roundtrip_smoke_cases_nightly.json` `count=0` `declared=5` `actual=0` `mismatch=True` `min=4` `priorities=P0,P1`
- editor_smoke_generated_runs: `run_id=20260228_042350` `run_ids=20260228_042350,20260228_042208`
- editor_smoke_failure_attribution: `complete=True` `code_total=0`
- editor_smoke_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`
- ui_flow_smoke: `False` run_id=`` (mode=`skipped` enabled=`False`)
- ui_flow_gate_required: `required=False` `explicit=True`
- ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- qt_project_persistence: `status=skipped` `mode=observe` `gate_required=False` `require_on=False` run_id=`20260228_111020` reason=`BUILD_EDITOR_QT_OFF`
- qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- step166_run_id: `` (gate_would_fail=`False`)
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (policy=`auto`, min_selected=`5`, coverage_days=`0.00`, selected=`0`)

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_191018_671_f1cc/summary.json`
- qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- step166_summary: `(missing)`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`


## Weekly Snapshot (2026-02-28T12:02:26.553433+00:00)
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_step186_parallel.json`
- history_json: `build/editor_weekly_validation_history/weekly_20260228_120226_20260228_195854_116_f495_20260228_115858.json`

### Inputs
- editor_smoke: `mode=observe` `limit=8`
- editor_smoke_cases: `local/editor_roundtrip_smoke_cases_weekly.json` `source=generated` `count=8` `min=4`
- editor_smoke_generated_cases: `local/editor_roundtrip_smoke_cases_weekly.json` `count=8` `declared=8` `actual=8` `mismatch=False` `min=4` `priorities=P0,P1`
- editor_smoke_generated_runs: `run_id=20260228_063829` `run_ids=20260228_063829,20260228_063519,20260228_061121,20260228_060938`
- perf: `entities=10000` `repeat=1`
- step166: `mode=observe` `max_workers=2`
- run_gate: `True`
- gate_editor_smoke_cases: `local/editor_roundtrip_smoke_cases_weekly.json` `source=generated`
- gate_editor_smoke_generated_cases: `local/editor_roundtrip_smoke_cases_weekly_gate.json` `count=2` `declared=2` `actual=2` `mismatch=False` `priorities=P0,P1`
- gate_editor_smoke_generated_runs: `run_id=20260228_115858` `run_ids=20260228_115858`

### Runs
- editor_smoke_run_id: `20260228_195854_116_f495` status=`PASS` pass=`8` fail=`0` skipped=`0`
- editor_smoke_case_selection: `selected=8` `matched=8` `candidate=8` `total=8` `fallback=false`
- step166_run_id: `20260228_115858` (gate_would_fail=`False`)
- step166_baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- step166_baseline_refresh: `eligible=False` `applied=False` `candidate=` reason=`day=2026-02-27 run_id=20260227_141822 unstable: totals.fail=6`
  - refresh_window: `days=5` `present=5` `stable=4` `latest=2026-02-28`
- perf_run_id: `20260228_120038`
- real_scene_perf: `enabled=False` status=`skipped`
- gate: `ok`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
- gate_step166_run_id: `20260228_120043` (enabled=`True` gate_would_fail=`False`)
- gate_step166_baseline_compare: `compared=6` `degraded=0` `improved=3`
- qt_persistence_policy: `status=observe` `recommended_require_on=False` `effective_require_on=False` `source=auto-policy` samples=`21/21`
  - recommendation: `No target-available Qt runs in window; keep require_on=0.`
  - thresholds: `min_samples=5` `min_consecutive_target_passes=3`
  - target_available: `runs=0` `pass=0` `fail=0` `consecutive_pass=0`
- gate_editor_smoke: run_id=`20260228_200039_043_8ff7` status=`PASS` pass=`5` fail=`0` skipped=`0`
- gate_editor_smoke_case_source: `generated`
- gate_editor_smoke_case_selection: `selected=5` `matched=8` `candidate=8` `total=8` `fallback=false`
- gate_editor_smoke_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- gate_qt_project_persistence: `status=skipped` `mode=gate` `gate_required=True` `require_on=False` run_id=`20260228_120042` reason=`BUILD_EDITOR_QT_OFF`
- gate_qt_project_persistence_build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False` `script_rc=0` `build_rc=0` `test_rc=0`
- trend: `watch`
- perf_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`12.90`, selected=`32`, selection_mode=`all`)
- perf_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- perf_trend_hotspot: `box_p95_ms=0.05`
- real_scene_trend: `stable` (auto_gate_mode=`observe`, coverage_days=`5.93`, selected=`14`, selection_mode=`all`)
- real_scene_trend_thresholds: `ratio pick=1.3` `box=1.3` `drag=1.4`
- real_scene_trend_hotspot: `box_p95_ms=0.2`
- case_selection_trend: `watch` windows=`7,14` samples_total=`164` mismatch_runs=`2` mismatch_rate_max=`0.012`
- case_selection_trend_warning_codes: `GENERATED_COUNT_MISMATCH`
- case_selection_trend_windows: `7d:m=0.982,fb=0.012,mm=0.012,rs=0.000,n=84,src=discovery:76/explicit:2/generated:6 | 14d:m=0.981,fb=0.011,mm=0.008,rs=0.000,n=89,src=discovery:110/explicit:2/generated:6`

### Artifacts
- editor_smoke_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_195854_116_f495/summary.json`
- step166_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_115858/summary.json`
- perf_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260228_120038/summary.json`
- gate_summary: `build/editor_gate_summary.json`
- gate_qt_project_persistence_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- trend_json: `build/editor_gate_trend.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`
- case_selection_trend_json: `build/editor_case_selection_trend.json`
- qt_persistence_policy_json: `build/qt_project_persistence_gate_policy.json`

### STEP166 Import Meta (DXF)
- hatch_pattern_clamped_cases: `0`
- hatch_pattern_clamped_hatches_total: `0`
- hatch_pattern_emitted_lines_total: `0`
- hatch_pattern_stride_max_max: `1`
- hatch_pattern_ksteps_limit_max: `5000`
- hatch_pattern_edge_budget_exhausted_cases: `0`
- hatch_pattern_edge_budget_exhausted_hatches_total: `0`
- hatch_pattern_edge_checks_total: `0`
- hatch_pattern_boundary_points_clamped_cases: `0`
- hatch_pattern_boundary_points_clamped_hatches_total: `0`
- hatch_pattern_boundary_points_max_max: `0`
- text_align_partial_cases: `0`
- text_align_partial_total: `0`
- text_align_used_total: `52`
- text_nonfinite_values_total: `0`
- text_skipped_missing_xy_total: `0`

### STEP166 Sanity Warnings (Non-blocking)
- cases_warned: `0`

### Perf p95 (best-effort)
- pick: `0.010083ms`, box_query: `0.006291ms`, drag_commit: `0.036875ms`

