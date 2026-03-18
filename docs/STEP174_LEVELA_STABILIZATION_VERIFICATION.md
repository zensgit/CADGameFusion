# STEP174 Level A 持续开发与验证报告

## 本次执行信息
- 执行时间：`2026-02-12`
- 工作区：`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion`
- 对应计划：`docs/STEP174_LEVELA_STABILIZATION_PLAN.md`

## 开发变更
### 1) 交互异常路径测试补强
- 文件：`tools/web_viewer/tests/editor_commands.test.js`
- 新增测试：
  - `selection.trim rejects locked target layer`
  - `selection.extend rejects boundary without line segments`
  - `selection.trim returns no-intersection on disjoint boundaries`
- 同时修正一条既有测试构造：
  - `selection.extend rejects locked target layer` 改为先建目标实体再锁层，避免构造假失败

## 验证执行记录
### A. 命令级测试
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
```
- 结果：`PASS`
- 统计：`25/25 pass`

### B. Editor round-trip observe
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 3
```
- run_id：`20260212_111249_817_2ff1`
- summary：
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260212_111249_817_2ff1/summary.json`
- totals：`pass=3 fail=0 skipped=0`

### C. One-button gate
```bash
EDITOR_SMOKE_LIMIT=3 CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_gate.sh
```
- editor_smoke run_id：`20260212_111257_883_e3f4`
- step166 run_id：`20260212_031258`
- gate summary：
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- gate history：
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_history/gate_20260212_031327_20260212_111257_883_e3f4_20260212_031258.json`
- 结果：
  - editor smoke：`pass=3 fail=0 skipped=0`
  - step166：`pass=6 fail=0 skipped=1`
  - `gate_would_fail=False`

### D. Weekly fixed validation (标准链路)
```bash
RUN_GATE=1 EDITOR_SMOKE_LIMIT=5 GATE_SMOKE_LIMIT=5 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
- weekly summary：
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.md`
- run_ids：
  - editor_smoke(observe)：`20260212_111042_285_f12e`
  - step166(observe)：`20260212_031044`
  - performance：`20260212_031118`
  - one-button gate editor_smoke：`20260212_111118_628_1e9d`
  - one-button gate step166：`20260212_031120`

## 性能摘要（run_id `20260212_031118`）
| metric | p95_ms |
| --- | ---: |
| pick_entity_at | 0.0113 |
| box_select_query | 0.0224 |
| drag_property_patch | 50.0310 |
| drag_breakdown.snapshot_before | 27.7129 |
| drag_breakdown.patch_apply | 0.0460 |
| drag_breakdown.snapshot_after | 21.8663 |

## 结论
- 本轮变更后，Level A 关键链路继续稳定：
  - 功能测试全绿（25/25）
  - round-trip observe/gate 全通过
  - STEP166 gate 未触发失败
- `drag_commit` 成本仍主要集中于 snapshot 前后，后续优化方向保持不变。
- 可按 STEP174 计划继续推进 Week 1/Week 2（交互异常路径 + gate 稳定化）。

## Incremental Verification (2026-02-12T03:21:34Z)
### A. Weekly fixed validation + gate + trend
```bash
RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- run_ids:
  - editor_smoke(observe): `20260212_112030_769_7f0e`
  - step166(observe): `20260212_032032`
  - performance: `20260212_032105`
  - one-button gate editor_smoke: `20260212_112105_543_bad8`
  - one-button gate step166: `20260212_032107`
- trend output:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_trend.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_trend.md`
  - trend status: `stable`

### B. Performance after snapshot-path optimization
comparison baseline: `20260212_031118` -> optimized: `20260212_032105`

| metric | old p95_ms | new p95_ms | delta |
| --- | ---: | ---: | ---: |
| pick_entity_at | 0.0113 | 0.0115 | +2.2% |
| box_select_query | 0.0224 | 0.0237 | +5.9% |
| drag_property_patch | 50.0310 | 27.7378 | -44.6% |
| drag_breakdown.snapshot_before | 27.7129 | 16.7495 | -39.6% |
| drag_breakdown.snapshot_after | 21.8663 | 17.2122 | -21.3% |
| drag_breakdown.patch_apply | 0.0460 | 0.0450 | -2.1% |

### C. Decision
- Level A gate remains stable and explainable across 7-day trend window.
- Keep default gate sample size at `5` for standard runs; keep `3` for quick runs.
- Next optimization should focus on reducing snapshot variance (`max` spikes), not patch apply.

## Incremental Verification (2026-02-12T03:51:13Z)
### A. 本轮继续推进内容
- `selection.propertyPatch` 历史记录改为实体子集快照（替代全量文档快照）。
- 目标：在不改变 Undo/Redo 语义下，进一步降低 `drag_commit` 交互时延。

### B. 验证执行
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 5
RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
- command tests: `25/25 pass`
- editor observe run_id: `20260212_115011_781_2886` (`pass=5 fail=0`)
- step166 observe run_id: `20260212_035013` (`gate_would_fail=False`)
- one-button gate:
  - editor run_id: `20260212_115043_017_1b4f`
  - step166 run_id: `20260212_035044`
  - result: `pass` and `gate_would_fail=False`
- trend:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_trend.json`
  - status: `stable`

### C. 性能结果（p95）
- baseline `20260212_032105` -> current `20260212_035042`
  - `drag_commit`: `27.7378ms -> 0.0285ms`（-99.9%）
  - `snapshot_before`: `16.7495ms -> 0.0031ms`
  - `snapshot_after`: `17.2122ms -> 0.0048ms`
  - `pick`: `0.0115ms -> 0.0117ms`（稳定）
  - `box`: `0.0237ms -> 0.0237ms`（稳定）

### D. 结论
- Level A 现阶段可持续开发与验证链路已稳定：
  - 功能回归全绿
  - gate 连续通过
  - 趋势评估为 `stable`
- 下一阶段可进入“样本规模提升 + 大图渲染热点优化”。

## Incremental Verification (2026-02-12T04:06:31Z, limit=8 observe + real-scene observe)
### A. 本轮执行命令
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```

### B. 结果摘要
- command tests: `25/25 pass`
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- run_ids:
  - editor_smoke(observe, limit=8): `20260212_120515_356_0979` (`pass=8 fail=0 skipped=0`)
  - step166(observe): `20260212_040518` (`gate_would_fail=false`)
  - synthetic perf: `20260212_040559`
  - real-scene perf(observe): `20260212_040559` (`status=PASS`)
  - one-button gate editor_smoke: `20260212_120559_512_2ed0`
  - one-button gate step166: `20260212_040601`
- trend:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_trend.json`
  - status: `stable`

### C. 关键指标
#### synthetic perf (`20260212_040559`)
| metric | p95_ms |
| --- | ---: |
| pick_entity_at | 0.010833 |
| box_select_query | 0.022417 |
| drag_property_patch | 0.027917 |

#### real-scene perf (`20260212_040559`)
| metric | p95_ms | threshold_ms | status |
| --- | ---: | ---: | --- |
| pick | 0.001084 | 0.05 | PASS |
| box_query | 0.148167 | 0.20 | PASS |
| drag_commit | 0.033500 | 0.20 | PASS |

### D. 本轮结论
- `1+2+3` 路线已进入稳定执行态：标准 observe 样本提升到 `8` 后仍保持全绿。
- real-scene 固定输入回归持续通过，当前 `box_query` 接近阈值区间但仍有安全余量。
- gate 历史 7 天窗口为 `stable`，可按 STEP175 计划继续推进“observe->gate”收口。

## Incremental Verification (2026-02-12T05:14:04Z, hotspot optimization + gate retry)
### A. 本轮变更
- `tools/web_viewer/state/documentState.js`
  - 为 `queryVisibleEntityIdsNearPoint/queryVisibleEntityIdsInRect` 增加可选 `sortById`，并在无隐藏图层时走快速路径。
- `tools/web_viewer/commands/command_registry.js`
  - `selection.box` 改为 ID 直接遍历、预计算边界、减少循环内对象分配与重复判断。

### B. 验证执行与结果
1. 初次 weekly（`GATE_CAD_ATTEMPTS=1`）出现单点波动：
   - step166 gate run_id: `20260212_051202`
   - 失败项：`BTJ01239601522-03_layout2/text`
   - bucket: `TEXT_METRIC_DRIFT`
2. 复跑 weekly（`GATE_CAD_ATTEMPTS=3`）恢复稳定：
   - weekly summary:
     - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
   - editor_smoke(observe, limit=8): `20260212_131259_602_35be` (`pass=8 fail=0`)
   - step166(observe): `20260212_051304` (`gate_would_fail=false`)
   - synthetic perf: `20260212_051334`
   - real-scene perf: `20260212_051334` (`status=PASS`)
   - gate(editor+step166): `20260212_131334_988_3532` + `20260212_051336` (`gate_would_fail=false`)
   - trend status: `stable`

### C. 指标快照
#### synthetic perf (`20260212_051334`)
| metric | p95_ms |
| --- | ---: |
| pick_entity_at | 0.009833 |
| box_select_query | 0.019083 |
| drag_property_patch | 0.031375 |

#### real-scene perf (`20260212_051334`)
| metric | p95_ms | threshold_ms | status |
| --- | ---: | ---: | --- |
| pick | 0.001958 | 0.05 | PASS |
| box_query | 0.144542 | 0.20 | PASS |
| drag_commit | 0.034000 | 0.20 | PASS |

### D. 本轮结论
- WP1 优化后，`box_query` 指标在 synthetic 与 real-scene 均保持改善/稳定。
- STEP166 gate 仍存在低概率文本漂移波动，建议周链路默认使用 `GATE_CAD_ATTEMPTS>=2`。
- Level A 总体状态仍为 `stable`，可继续按 STEP175 推进 observe->gate 收口。

## Incremental Verification (2026-02-12T05:43:08Z, WP2 auto gate limit)
### A. 本轮开发项
- `tools/editor_gate_trend.py`
  - 新增 `gate_limit_policy` 输出：
    - `recommended_gate_limit`
    - `promotion_ready`
    - rule 说明
- `tools/editor_weekly_validation.sh`
  - 新增 pre-trend 自动策略：
    - 当 `RUN_GATE=1` 且未手动指定 `GATE_SMOKE_LIMIT`，自动读取 trend 推荐值
    - 本轮实际生效：`gate_limit=8 source=auto-trend`
  - summary.json 新增输入字段：`auto_gate_limit/gate_limit_source/pretrend_status`

### B. 本轮验证命令
```bash
RUN_GATE=1 CAD_MAX_WORKERS=2 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```

### C. 结果摘要
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- run_ids:
  - editor_smoke(observe, limit=8): `20260212_134148_182_36e5` (`pass=8 fail=0`)
  - step166(observe): `20260212_054151` (`gate_would_fail=false`)
  - synthetic perf: `20260212_054229`
  - real-scene perf: `20260212_054229` (`status=PASS`)
  - gate(editor+step166): `20260212_134230_105_429e` + `20260212_054236` (`gate_would_fail=false`)
  - trend status: `stable`
- summary inputs:
  - `auto_gate_limit=true`
  - `gate_smoke_limit=8`
  - `gate_limit_source=auto-trend`
  - `pretrend_status=stable`

### D. 本轮结论
- WP2 已落地：门禁样本可按趋势自动切换，避免手工维护默认值。
- 当前状态满足 Level A 持续推进条件：observe/gate/real-scene/trend 均为稳定通过。

## Incremental Verification (2026-02-12T06:07:00Z, weekly + soak + drift-confirmation)
### A. 本轮执行命令
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=3 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
python3 tools/editor_stability_soak.py --rounds 3 --run-gate 1 --append-report 0
```

### B. 结果摘要
- command tests: `25/25 pass`
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- run_ids:
  - editor_smoke(observe, limit=8): `20260212_140559_799_7fb0` (`pass=8 fail=0`)
  - step166(observe): `20260212_060602` (`gate_would_fail=false`)
  - synthetic perf: `20260212_060630`
  - real-scene perf: `20260212_060630` (`status=PASS`)
  - gate(editor+step166): `20260212_140630_268_8425` + `20260212_060632` (`gate_would_fail=false`)
- trend:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_trend.json`
  - status: `stable` (`samples_in_window=31`)

### C. STEP166 漂移二次确认（TEXT_METRIC_DRIFT）
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
- 结论：本轮无文本漂移需二次确认，gate 仍保持可解释稳定。

### D. Stability Soak（3 rounds）
- soak summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_stability_soak/20260212_060355/summary.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_stability_soak/20260212_060355/summary.md`
- metrics:
  - passes: `3`
  - failures: `0`
  - stable_rounds: `3`
  - overall_status: `stable`
- rounds:
  - round1: editor `20260212_140355_750_7114`, step166 gate_would_fail=`false`
  - round2: editor `20260212_140456_073_592b`, step166 gate_would_fail=`false`
  - round3: editor `20260212_140559_799_7fb0`, step166 gate_would_fail=`false`

### E. 本轮结论
- Level A 的“开发-验证-门禁”闭环已进入稳定态：
  - 功能测试稳定全绿
  - STEP166 observe/gate 继续零失败桶
  - soak 三连跑稳定通过
- 可继续执行 Step175/Step176 的周节奏：默认 `gate=8`，保留 quick `gate=3`，并维持文本漂移二次确认策略。
