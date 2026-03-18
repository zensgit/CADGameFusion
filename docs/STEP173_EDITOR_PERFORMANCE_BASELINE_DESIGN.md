# STEP173 Editor Performance Baseline Design

## 背景
- Level A 功能闭环已稳定，当前主要风险从“功能缺失”转为“交互延迟与规模化稳定性”。
- 需要先建立量化基线，再决定优化优先级与门禁阈值，避免主观评估。

## 目标
1. 建立可重复的性能 smoke 脚本（Node 环境，无浏览器依赖）。
2. 固定三类关键指标：`pick_entity_at`、`box_select_query`、`drag_property_patch`。
3. 对 `drag_property_patch` 增加成本分解（snapshot 前后 + patch 应用）量化依据。
4. 先 `observe`，后 `gate`：先积累 2 周数据，再设阈值阻塞。

## 范围
### In Scope
- `tools/web_viewer/scripts/editor_performance_smoke.js`
  - 合成实体
  - 采样计时
  - `drag_breakdown` 分项计时（`snapshot_before/patch_apply/snapshot_after`）
  - 输出 `summary.json` + `summary.md`
- `tools/web_viewer/commands/command_registry.js`
  - `withSnapshot` 增加可选性能钩子（`ctx.__perfHooks.onSnapshotProfile`），用于真实命令路径分解采样
- `tools/editor_weekly_validation.sh`
  - 固化每周验证命令（tests + smoke + step166 + perf）
  - 输出 `build/editor_weekly_validation_summary.{json,md}`
- 文档与周报接入：
  - `docs/STEP173_EDITOR_PERFORMANCE_BASELINE_VERIFICATION.md`
  - 关键结论同步到 STEP170/STEP171 验证文档

### Out of Scope
- 直接改造渲染管线（WebGL/多线程）的大重构
- Qt 侧性能优化（本阶段仅 Web 主线）

## 基线接口（锁定）
### 命令
```bash
node tools/web_viewer/scripts/editor_performance_smoke.js \
  --entities 10000 \
  --pick-samples 3000 \
  --box-samples 1000 \
  --drag-samples 120 \
  --label step173_weekly_baseline
```

### 输出
- `build/editor_perf/<run_id>/summary.json`
- `build/editor_perf/<run_id>/summary.md`

### 指标
- `metrics.pick.{avg_ms,p50_ms,p95_ms,max_ms}`
- `metrics.box_query.{avg_ms,p50_ms,p95_ms,max_ms}`
- `metrics.drag_commit.{avg_ms,p50_ms,p95_ms,max_ms}`
- `metrics.drag_breakdown.snapshot_before.{avg_ms,p50_ms,p95_ms,max_ms}`
- `metrics.drag_breakdown.patch_apply.{avg_ms,p50_ms,p95_ms,max_ms}`
- `metrics.drag_breakdown.snapshot_after.{avg_ms,p50_ms,p95_ms,max_ms}`
- `metrics.drag_breakdown.capture_total.{avg_ms,p50_ms,p95_ms,max_ms}`
- `metrics.drag_breakdown.estimated_total.{avg_ms,p50_ms,p95_ms,max_ms}`

### 周验证入口（固定）
```bash
bash tools/editor_weekly_validation.sh
```

## 阶段性门禁策略
### Phase A（第 1-2 周）
- 仅记录，不阻塞。
- 每周至少 2 次基线采样。

### Phase B（第 3-4 周）
- 软门禁（报告告警，不失败）：
  - `pick.p95_ms` 相比 2 周中位值上升 > 30%
  - `box_query.p95_ms` 上升 > 30%
  - `drag_commit.p95_ms` 上升 > 40%

### Phase C（第 5 周后）
- 硬门禁候选（明确同意后启用）：
  - 连续 2 周软门禁稳定后，转为 `exit 2`

## 优化优先级（与基线绑定）
1. `drag_commit`：优先排查 history snapshot/patch 合并成本
2. `box_query`：继续优化空间索引命中比例
3. `pick`：在大图情况下维持低延迟，不做过度优化

## 说明
- 性能分解默认关闭；仅当脚本注入 `ctx.__perfHooks` 时启用，不影响业务行为与门禁语义。

## 风险与控制
- 风险：不同机器噪声导致误判。
  - 控制：使用相对变化阈值，不用绝对毫秒值做硬门禁。
- 风险：合成数据与真实图纸差异。
  - 控制：性能脚本只做趋势预警，最终以 editor smoke + STEP166 gate 联合决策。
