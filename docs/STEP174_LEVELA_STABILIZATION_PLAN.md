# STEP174 Level A 持续开发与验证详细计划

## 1. 目标
- 将当前 Level A（Web 可编辑 + CADGF round-trip）从“可用”推进到“可长期稳定维护”。
- 把验证链路固定为可复现流水线：`command tests -> editor smoke -> STEP166 -> performance -> gate`。
- 在不引入 CAD GUI 依赖前提下，持续提升交互一致性、失败可归因性、回归确定性。

## 2. 范围
### In Scope
- Web editor 交互收口：
  - grips/Snap/Trim/Extend 的异常路径完善
  - 命令状态文案与可取消语义一致化
- Round-trip 稳定化：
  - `editor_roundtrip_smoke.js` 的 observe/gate 双模式持续运行
  - `tools/local_ci.sh` 与 `tools/editor_weekly_validation.sh` 接入标准化
- 回归门禁：
  - 继续使用 STEP166 作为预览链路不回退证明
  - editor gate 历史快照积累并形成趋势判断
- 性能基线：
  - 保持 STEP173 指标采样并记录 `drag_breakdown`

### Out of Scope
- paper space/layout/viewport 编辑
- dimension/dimstyle、hatch、blocks/xref 的完整编辑
- Qt 全量同速功能开发（仅关键语义同步）

## 3. 里程碑（4 周滚动）
### Week 1（交互异常路径闭环）
- 完成 trim/extend 对称边界测试矩阵（锁层、空边界、无交点）
- 固定 `tests/editor_commands.test.js` 基线规模并纳入日常回归
- 产物：
  - `STEP172` 验证报告追加
  - editor smoke observe（limit 3/5）记录

### Week 2（门禁稳定化）
- 固化 one-button gate 参数模板：
  - `EDITOR_SMOKE_LIMIT=3`（快速）
  - `EDITOR_SMOKE_LIMIT=5`（标准）
- 连续采集 gate history，确保失败可解释（bucket + reason）
- 产物：
  - `build/editor_gate_history/*.json`
  - `STEP170`/`STEP172` 验证报告追加

### Week 3（性能趋势化）
- 周期运行 `tools/editor_weekly_validation.sh`（含 RUN_GATE）
- 在 STEP173 中更新 `pick/box/drag` 与 `drag_breakdown` 趋势
- 产物：
  - `build/editor_weekly_validation_summary.{json,md}`
  - `STEP173` 验证报告追加

### Week 4（收口与准入评审）
- 基于 2 周以上数据评估是否扩大 gate 样本集（3 -> 5 -> 8）
- 输出 Level A 稳定化结论（继续 observe 或对部分环节启硬 gate）
- 产物：
  - `STEP174_LEVELA_STABILIZATION_VERIFICATION.md` 阶段结论

## 4. 固定命令基线
### 快速（提交前）
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 3
```

### 标准（每日/每周）
```bash
RUN_GATE=1 EDITOR_SMOKE_LIMIT=8 GATE_SMOKE_LIMIT=5 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```

### 门禁（手动或 CI）
```bash
EDITOR_SMOKE_LIMIT=3 CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_gate.sh
```

## 5. 验收与门禁标准
### 功能稳定
- `editor_commands.test.js` 全量通过（当前基线 `25` 条）
- `editor_roundtrip_smoke` 在 `limit=5` 下 `fail=0`

### 预览链路不回退
- STEP166 `gate_would_fail=False`
- `failure_buckets` 中 `IMPORT_FAIL` 与 `VIEWPORT_LAYOUT_MISSING` 保持 `0`

### 性能趋势可控
- `pick.p95`、`box.p95` 无连续 2 周恶化趋势
- `drag_commit` 如波动异常，能从 `drag_breakdown` 定位到 snapshot 或 patch 子项

## 6. 风险与应对
- 风险：测试数据波动导致误判
  - 应对：按趋势判断，不以单次 run 判定回退
- 风险：交互修复引入隐式行为变化
  - 应对：命令级测试先行，失败路径必须有 `error_code`
- 风险：回归链路耗时增长
  - 应对：保留 `limit=3` 快速门禁 + `limit=5` 标准门禁双轨

## 7. 默认假设
- 继续锁定 Level A（model space + CADGF round-trip）。
- 维持 Web 主线；Qt 仅同步关键语义，不做全量并行实现。
- 文档与验证结果按 STEP 编号持续追加，不覆盖既有记录。

## 8. Detailed Work Packages (execution-ready)
### WP1: Gate profile defaults in local CI
- Files:
  - `tools/local_ci.sh`
- Tasks:
  1. Add dual default profiles for smoke size:
     - quick: `EDITOR_SMOKE_LIMIT=3`
     - standard: `EDITOR_SMOKE_LIMIT=5`
  2. Keep env override as highest priority (`EDITOR_SMOKE_LIMIT`).
  3. Emit selected profile into logs and `local_ci_summary.json`.
- Done criteria:
  - quick and standard produce deterministic smoke sample size without manual input.

### WP2: 7-day trend aggregation + weekly conclusion
- Files:
  - `tools/editor_gate_trend.py` (new)
  - `tools/editor_weekly_validation.sh`
- Tasks:
  1. Aggregate `build/editor_gate_history/*.json`.
  2. Produce `build/editor_gate_trend.{json,md}` with status + recommendation.
  3. Attach trend status/artifacts into weekly summary payload.
- Done criteria:
  - weekly run emits one machine-readable trend JSON and one human-readable MD.

### WP3: drag_commit optimization (snapshot path)
- Files:
  - `tools/web_viewer/commands/command_registry.js`
  - `docs/STEP173_EDITOR_PERFORMANCE_BASELINE_VERIFICATION.md`
- Tasks:
  1. Remove duplicate deep clone in command snapshot capture.
  2. Re-run perf smoke on same dataset/params.
  3. Report before/after p95 deltas.
- Done criteria:
  - no regression in command tests or smoke gate,
  - measurable p95 reduction on `drag_commit`.

## 9. Effort estimate (single engineer, full-time)
- WP1: `0.5 day`
- WP2: `1 day`
- WP3: `0.5~1 day` (implementation + verification reruns + report update)
- Total for current package: `2~2.5 days`

## 10. STEP175 Preview (next 2 weeks)
### Gate sample size rollout
- Week A: standard observe uses `limit=8`, gate keeps `limit=5`.
- Week B: if trend stays `stable`, raise gate to `limit=8` (keep quick gate=3).

### Real-scene perf gate (observe first)
- Keep `tools/web_viewer/scripts/editor_real_scene_perf_smoke.js` in weekly runs.
- 2-week window: only report; no hard fail unless explicitly enabled.
