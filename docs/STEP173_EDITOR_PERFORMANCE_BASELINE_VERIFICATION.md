# STEP173 Editor Performance Baseline Verification

## Run Info
- date_utc: `2026-02-11T17:05:00Z`
- workspace: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion`
- command:
```bash
node tools/web_viewer/scripts/editor_performance_smoke.js \
  --entities 10000 \
  --pick-samples 3000 \
  --box-samples 1000 \
  --drag-samples 120 \
  --label step173_weekly_baseline
```

## Current Baseline
- run_id: `20260211_170413`
- summary_json:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260211_170413/summary.json`
- summary_md:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260211_170413/summary.md`

| metric | avg_ms | p50_ms | p95_ms | max_ms |
| --- | ---: | ---: | ---: | ---: |
| pick_entity_at | 0.0053 | 0.0041 | 0.0110 | 0.4463 |
| box_select_query | 0.0140 | 0.0109 | 0.0234 | 2.2607 |
| drag_property_patch | 43.9675 | 43.5962 | 47.7381 | 135.3226 |

## Trend Snapshot (recent 3 runs)
| run_id | label | pick p95 | box p95 | drag p95 |
| --- | --- | ---: | ---: | ---: |
| `20260211_165543` | `step173_baseline` | 0.0125 | 0.0231 | 43.1872 |
| `20260211_170018` | `step173_weekly_baseline` | 0.0126 | 0.0248 | 51.2619 |
| `20260211_170413` | `step173_weekly_baseline` | 0.0110 | 0.0234 | 47.7381 |
| `20260212_023240` | `step173_weekly_baseline` | 0.0113 | 0.0225 | 49.0885 |
| `20260212_025653` | `step173_weekly_baseline` | 0.0114 | 0.0228 | 47.8547 |
| `20260212_025946` | `step173_weekly_baseline` | 0.0110 | 0.0225 | 59.0691 |
| `20260212_030317` | `step173_weekly_baseline` | 0.0113 | 0.0228 | 46.2226 |
| `20260212_030706` | `step173_weekly_baseline` | 0.0108 | 0.0222 | 47.4606 |

## Analysis
- `pick` 与 `box_query` 指标稳定，当前无显著退化。
- `drag_commit` 明显高于其他指标，符合当前 `selection.propertyPatch + history` 提交路径的成本特征。
- 最近一次 run 相比上一 run（`20260211_170018`）已有回落，说明未出现持续恶化。

## Next Actions
1. 保持每周至少 2 次相同参数采样，积累 2 周窗口。
2. 在不改变命令语义前提下，评估 `drag_commit` 的 patch/snapshot 成本分解。
3. 暂不启用硬门禁，仅在周报中给出软告警判断。

## Incremental Verification (2026-02-12T02:32:40Z)
```bash
node tools/web_viewer/scripts/editor_performance_smoke.js --entities 10000 --pick-samples 3000 --box-samples 1000 --drag-samples 120 --label step173_weekly_baseline
```
- run_id: `20260212_023240`
- summary_json:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260212_023240/summary.json`
- metrics:
  - `pick p95=0.0113ms`
  - `box p95=0.0225ms`
  - `drag p95=49.0885ms`

## Incremental Verification (2026-02-12T02:56:53Z)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.md`
- performance run_id: `20260212_025653`
- performance summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_perf/20260212_025653/summary.json`

### Drag breakdown (20260212_025653)
| metric | avg_ms | p50_ms | p95_ms | max_ms |
| --- | ---: | ---: | ---: | ---: |
| snapshot_before | 20.7243 | 20.3933 | 22.0326 | 27.1343 |
| patch_apply_only | 0.0285 | 0.0293 | 0.0356 | 0.0467 |
| snapshot_after | 20.7321 | 20.4622 | 22.0000 | 24.2372 |
| capture_total | 41.4564 | 41.0362 | 42.7977 | 47.7674 |
| estimated_total | 41.4849 | 41.0583 | 42.8279 | 47.8030 |

### Interpretation
- 当前 `drag_commit` 成本主要来自前后 snapshot（`capture_total` 占主导）。
- 纯 patch 写入成本很低（`patch_apply_only`），后续优化优先应放在 snapshot/历史链路。

## Incremental Verification (2026-02-12T03:21:34Z, snapshot-path optimization + trend)
### Weekly fixed validation with trend aggregation
```bash
RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
- performance run_id: `20260212_032105`
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- trend summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_trend.json`
  - status: `stable`

### P95 delta vs previous weekly baseline (`20260212_031118`)
| metric | old p95_ms | new p95_ms | delta |
| --- | ---: | ---: | ---: |
| pick_entity_at | 0.0113 | 0.0115 | +2.2% |
| box_select_query | 0.0224 | 0.0237 | +5.9% |
| drag_property_patch | 50.0310 | 27.7378 | -44.6% |
| snapshot_before | 27.7129 | 16.7495 | -39.6% |
| snapshot_after | 21.8663 | 17.2122 | -21.3% |
| patch_apply_only | 0.0460 | 0.0450 | -2.1% |

### Interpretation
- Removing redundant deep clone in command snapshot capture significantly reduced `drag_commit` cost.
- `pick`/`box` stayed in the same order of magnitude, so the optimization did not regress query paths.
- Remaining tail latency is dominated by snapshot variance (`max` spikes), not by patch apply logic.

## Incremental Verification (2026-02-12T03:51:13Z, propertyPatch subset-history optimization)
### Weekly fixed validation with gate + trend
```bash
RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- performance run_id: `20260212_035042`
- trend status: `stable`

### P95 delta vs previous optimized baseline (`20260212_032105`)
| metric | old p95_ms | new p95_ms | delta |
| --- | ---: | ---: | ---: |
| pick_entity_at | 0.0115 | 0.0117 | +1.8% |
| box_select_query | 0.0237 | 0.0237 | -0.3% |
| drag_property_patch | 27.7378 | 0.0285 | -99.9% |
| snapshot_before | 16.7495 | 0.0031 | -100.0% |
| snapshot_after | 17.2122 | 0.0048 | -100.0% |
| patch_apply_only | 0.0450 | 0.0087 | -80.6% |

### Interpretation
- `selection.propertyPatch` 切换为“实体子集历史”后，`drag_commit` 基本消除全量 snapshot 成本。
- `pick/box` 保持稳定，说明本次优化未影响查询路径行为。
- 当前性能瓶颈已从 history snapshot 转移，下一步可聚焦大图渲染与 hit-test 热点。

## Incremental Verification (2026-02-12T03:00:24Z, weekly script + gate option)
```bash
RUN_GATE=1 EDITOR_SMOKE_LIMIT=3 GATE_SMOKE_LIMIT=3 GATE_CAD_ATTEMPTS=1 GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- performance run_id: `20260212_025946`
- metrics (p95):
  - `pick=0.0110ms`
  - `box=0.0225ms`
  - `drag_commit=59.0691ms`
  - `snapshot_before=22.3840ms`
  - `patch_apply=0.0393ms`
  - `snapshot_after=22.6683ms`
  - `capture_total=45.1930ms`
  - `estimated_total=45.2260ms`

## Incremental Verification (2026-02-12T03:03:48Z, weekly script + gate refreshed)
```bash
RUN_GATE=1 EDITOR_SMOKE_LIMIT=3 GATE_SMOKE_LIMIT=3 GATE_CAD_ATTEMPTS=1 GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- performance run_id: `20260212_030317`
- metrics (p95):
  - `pick=0.0113ms`
  - `box=0.0228ms`
  - `drag_commit=46.2226ms`
  - `snapshot_before=24.4188ms`
  - `patch_apply=0.0397ms`
  - `snapshot_after=25.6840ms`
  - `capture_total=49.2076ms`
  - `estimated_total=49.2440ms`

## Incremental Verification (2026-02-12T03:07:35Z, command-level profiling enabled)
```bash
RUN_GATE=1 EDITOR_SMOKE_LIMIT=3 GATE_SMOKE_LIMIT=3 GATE_CAD_ATTEMPTS=1 GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- performance run_id: `20260212_030706`
- metrics (p95):
  - `pick=0.0108ms`
  - `box=0.0222ms`
  - `drag_commit=47.4606ms`
  - `snapshot_before=26.8641ms`
  - `patch_apply=0.0395ms`
  - `snapshot_after=21.1020ms`
  - `capture_total=47.4057ms`
  - `estimated_total=47.4387ms`
- gate check:
  - editor_smoke(gate): `20260212_110706_619_aa9a` (`pass=3 fail=0 skipped=0`)
  - step166(gate): `20260212_030707` (`pass=6 fail=0 skipped=1`)

## Incremental Verification (2026-02-12T03:11:47Z, weekly fixed script with gate)
```bash
RUN_GATE=1 EDITOR_SMOKE_LIMIT=5 GATE_SMOKE_LIMIT=5 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.md`
- run_ids:
  - editor_smoke(observe): `20260212_111042_285_f12e`
  - step166(observe): `20260212_031044`
  - performance: `20260212_031118`
  - one-button gate editor_smoke: `20260212_111118_628_1e9d`
  - one-button gate step166(gate): `20260212_031120`

### Performance metrics (run_id `20260212_031118`)
| metric | avg_ms | p50_ms | p95_ms | max_ms |
| --- | ---: | ---: | ---: | ---: |
| pick_entity_at | 0.0054 | 0.0042 | 0.0113 | 0.4378 |
| box_select_query | 0.0138 | 0.0108 | 0.0224 | 2.1762 |
| drag_property_patch | 44.8803 | 44.1247 | 50.0310 | 133.4739 |

### Drag breakdown (run_id `20260212_031118`)
| metric | avg_ms | p50_ms | p95_ms | max_ms |
| --- | ---: | ---: | ---: | ---: |
| snapshot_before | 23.9100 | 21.2648 | 27.7129 | 112.8312 |
| patch_apply_only | 0.0357 | 0.0334 | 0.0460 | 0.1938 |
| snapshot_after | 20.9061 | 20.5292 | 21.8663 | 44.3902 |
| capture_total | 44.8161 | 44.0499 | 49.9702 | 133.4018 |
| estimated_total | 44.8518 | 44.0882 | 50.0043 | 133.4390 |

### Interpretation
- 本轮 `pick/box` 维持稳定区间，未见趋势性回退。
- `drag_commit` 仍由 snapshot 前后主导，`patch_apply` 占比极低，优化优先级继续聚焦 history/snapshot 链路。

## Incremental Verification (2026-02-12T04:06:31Z, weekly rerun after 1+2+3 rollout)
### Weekly fixed validation + gate + trend
```bash
RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- performance run_id: `20260212_040559`
- trend status: `stable`

### P95 delta vs previous weekly baseline (`20260212_040128`)
| metric | old p95_ms | new p95_ms | delta |
| --- | ---: | ---: | ---: |
| pick_entity_at | 0.012292 | 0.010833 | -11.9% |
| box_select_query | 0.024250 | 0.022417 | -7.6% |
| drag_property_patch | 0.030458 | 0.027917 | -8.3% |
| snapshot_before | 0.002916 | 0.002916 | +0.0% |
| snapshot_after | 0.002875 | 0.004250 | +47.8% |
| patch_apply_only | 0.009167 | 0.008541 | -6.8% |

### Interpretation
- 10k 合成场景下 `pick/box/drag` p95 继续保持在低毫秒量级，稳定满足 Level A 日常开发阈值。
- `snapshot_after` p95 有小幅波动，但绝对值仍在 `0.005ms` 内，未形成风险趋势。
- 性能链路可继续把重点转向真实图纸的 `box_query` 热点，而不是命令提交主路径。

## Incremental Verification (2026-02-12T05:14:04Z, box-query hotspot optimization)
### Weekly fixed validation + gate + trend
```bash
RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=3 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- performance run_id: `20260212_051334`
- trend status: `stable`

### P95 delta vs previous baseline (`20260212_040559`)
| metric | old p95_ms | new p95_ms | delta |
| --- | ---: | ---: | ---: |
| pick_entity_at | 0.010833 | 0.009833 | -9.2% |
| box_select_query | 0.022417 | 0.019083 | -14.9% |
| drag_property_patch | 0.027917 | 0.031375 | +12.4% |
| snapshot_before | 0.002916 | 0.002916 | +0.0% |
| snapshot_after | 0.004250 | 0.005917 | +39.2% |
| patch_apply_only | 0.008541 | 0.009208 | +7.8% |

### Interpretation
- `queryVisibleEntityIdsInRect + selection.box` 轻量化后，`box_query` p95 继续下降。
- `drag_commit` 和 breakdown 子项有小幅抖动，但量级仍维持在 `0.04ms` 以内，不构成性能风险。
- 优化方向有效，可继续在真实图纸路径推进 `box_query` 热点治理。

## Incremental Verification (2026-02-12T05:43:08Z, auto-gate-limit rollout)
### Weekly fixed validation (auto gate limit enabled)
```bash
RUN_GATE=1 CAD_MAX_WORKERS=2 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- performance run_id: `20260212_054229`
- gate limit policy: `auto-trend -> 8`

### P95 delta vs previous baseline (`20260212_051334`)
| metric | old p95_ms | new p95_ms | delta |
| --- | ---: | ---: | ---: |
| pick_entity_at | 0.009833 | 0.011000 | +11.9% |
| box_select_query | 0.019083 | 0.021375 | +12.0% |
| drag_property_patch | 0.031375 | 0.068917 | +119.6% |
| snapshot_before | 0.002916 | 0.005291 | +81.4% |
| snapshot_after | 0.005917 | 0.006333 | +7.0% |
| patch_apply_only | 0.009208 | 0.013084 | +42.1% |

### Interpretation
- 本轮合成场景有抖动回升，但各项仍保持在子毫秒至低毫秒量级，未触发功能/门禁问题。
- 结合趋势窗口仍为 `stable`，当前属于可接受波动，不判定为性能回退。
- 后续继续观察 3~5 次 run；若 `box_query p95` 连续高于 `0.022`，再进入下一轮热点剖析。

## Incremental Verification (2026-02-12T06:07:00Z, post-optimization weekly + soak)
### Weekly fixed validation (latest)
```bash
RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=3 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- performance run_id: `20260212_060630`
- trend status: `stable`

### P95 delta vs previous weekly baseline (`20260212_054229`)
| metric | old p95_ms | new p95_ms | delta |
| --- | ---: | ---: | ---: |
| pick | 0.011000 | 0.009208 | -16.3% |
| box_query | 0.021375 | 0.006625 | -69.0% |
| drag_commit | 0.068917 | 0.023750 | -65.5% |
| snapshot_before | 0.005291 | 0.002500 | -52.8% |
| snapshot_after | 0.006333 | 0.003583 | -43.4% |
| patch_apply | 0.013084 | 0.007833 | -40.1% |

### Real-scene companion check
- run_ids:
  - `20260212_060009`
  - `20260212_060318`
  - `20260212_060630`
- `box_query p95` median: `0.025625ms`
- threshold: `0.200000ms`
- status: `PASS`

### Interpretation
- 本轮 `1+2+3` 后，synthetic 与 real-scene 两条路径都显示 `box_query` 显著收敛。
- 趋势窗口 `samples_in_window=31`，且 `editor/step166` gate 失败计数均为 `0`，满足继续维持标准 gate `limit=8` 的条件。
- 下一步性能重点从“主路径热点治理”切换为“防抖与长期漂移监控”（保持周频采样与 soak）。
