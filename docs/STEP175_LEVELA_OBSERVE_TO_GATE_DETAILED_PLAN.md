# STEP175 Level A 详细开发与验证计划（Observe -> Gate 收口）

## 1. 目标
- 在不引入 CAD GUI 依赖的前提下，继续推进 Level A（model space 可编辑 + CADGF round-trip）稳定化。
- 把 `editor + STEP166 + perf + trend` 固化为可长期运行的门禁流水线。
- 以最小风险方式把标准样本从 observe 逐步切到 gate。

## 2. 当前基线（2026-02-12）
- editor smoke observe（limit=8）：`pass=8 fail=0`
- one-button gate（limit=5）：连续通过，7 天趋势 `stable`
- synthetic perf（10k）p95：`pick=0.010833`、`box=0.022417`、`drag=0.027917`
- real-scene perf（固定输入）p95：`pick=0.001084`、`box=0.148167`、`drag=0.033500`

## 3. 范围与非范围
### In Scope
- `tools/editor_weekly_validation.sh` 标准化周运行
- `tools/editor_gate.sh` 持续 gate 历史沉淀
- `tools/web_viewer/scripts/editor_real_scene_perf_smoke.js` 真实场景基线收敛
- Web editor 交互收口（grip hover、arc radius、trim/extend 异常路径）

### Out of Scope
- layout/paper space/viewport 编辑
- dimension/dimstyle/hatch/blocks/xref 全量能力
- Qt 全量对齐（仅保留关键语义同步）

## 4. 开发工作包（执行顺序固定）
### WP1: 真实场景热点优化（box query）
- 文件：
  - `tools/web_viewer/state/document_state.js`
  - `tools/web_viewer/tools/tool_context.js`
  - `tools/web_viewer/ui/canvas_view.js`
- 任务：
  1. 优化查询候选集合复用，避免 pointer move 重复构建大数组。
  2. 增加可选采样日志（默认关闭）用于定位大图 `box_query` 尖峰。
  3. 不改变命令语义，不破坏 undo/redo。
- 验收：
  - real-scene `box_query p95 <= 0.16ms` 且无功能回归。

### WP2: Gate 样本切换策略落地
- 文件：
  - `tools/local_ci.sh`
  - `tools/editor_weekly_validation.sh`
  - `tools/editor_gate_trend.py`
- 任务：
  1. 保持 quick gate `limit=3`。
  2. 标准 observe 维持 `limit=8`，累计 1 周稳定窗口。
  3. 满足条件后把标准 gate 从 `5` 升至 `8`（仅改默认，不改命令兼容）。
- 切换条件：
  - 连续 7 天：`editor_would_fail=0`、`step166_would_fail=0`、real-scene PASS。

### WP3: 文档与报告自动追加
- 文件：
  - `docs/STEP173_EDITOR_PERFORMANCE_BASELINE_VERIFICATION.md`
  - `docs/STEP174_LEVELA_STABILIZATION_VERIFICATION.md`
  - `docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md`
- 任务：
  1. 每周运行后追加 run_id、阈值、结论。
  2. 报告中固定包含 observe 与 gate 两组结果。
  3. 明确给出下周动作（继续 observe / 切 gate / 回退阈值）。

## 5. 验证矩阵（固定命令）
### 提交前（快速）
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 3
```

### 每日（标准）
```bash
RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=3 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```

### 周验收（拟切 gate 前）
```bash
EDITOR_SMOKE_LIMIT=8 CAD_ATTEMPTS=1 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_gate.sh
```

## 6. 通过标准
- 功能：`editor_commands.test.js` 全绿（当前 25/25）。
- round-trip：observe/gate 均 `fail=0`。
- STEP166：`gate_would_fail=false`。
- real-scene perf：`pick/box/drag` 全部低于 profile 阈值。
- 趋势：`build/editor_gate_trend.json.status == "stable"`。

## 7. 失败处理与回退
- 若 real-scene `box_query p95 > 0.20ms`：
  1. 不切 gate，维持 observe；
  2. 回看最近 3 次 run 的输入规模与平台波动；
  3. 仅在确认结构性回退后触发修复任务。
- 若 gate 首次切 8 失败：
  1. 当日回退默认 gate 至 5；
  2. 保留 8 为 observe；
  3. 一周后重新评估。
- 若 STEP166 出现单点文本漂移（TEXT_METRIC_DRIFT）：
  1. 先以 `GATE_CAD_ATTEMPTS>=2` 复跑确认是否偶发；
  2. 仅连续复现时才判定为结构性回退并进入修复流程。

## 8. 工时估算（单人全职）
- WP1：`2~3 天`
- WP2：`1 天`
- WP3：`0.5~1 天`
- 总计：`3.5~5 天`

## 9. 本阶段交付物
- 代码：
  - 热点优化与脚本默认值收口
- 报告：
  - `STEP173` 周性能追加
  - `STEP174` 稳定性追加
  - `STEP170` 周验收追加
- 运行产物：
  - `build/editor_weekly_validation_summary.{json,md}`
  - `build/editor_gate_trend.{json,md}`
  - `build/editor_real_scene_perf/<run_id>/summary.json`

## 10. 执行进展（2026-02-12）
### 已完成
- WP1：`box_query` 热点轻量化（`documentState + selection.box`）并验证通过。
- WP2：自动 gate 样本切换已落地：
  - `editor_gate_trend.py` 输出 `gate_limit_policy`；
  - `editor_weekly_validation.sh` 支持 pre-trend 自动选择 `GATE_SMOKE_LIMIT`；
  - 周链路已实测 `auto-trend -> gate_limit=8` 全绿。

### 最新验证快照
- weekly summary: `build/editor_weekly_validation_summary.json`
- core status:
  - editor_smoke(observe limit=8): pass
  - step166(observe): gate_would_fail=false
  - real_scene_perf: PASS
  - gate(editor+step166): PASS
  - trend(7d): stable

### 下一步（继续推进）
1. 保持 1 周自动 gate=8 观测窗口，跟踪是否出现结构性漂移。
2. 若连续稳定，固定标准 gate 默认值为 8（保留 quick=3）。
3. 若出现单点 text 漂移，按“重试判定后再定性”为默认流程。

## 11. 细化执行计划（按周推进，可直接执行）
### Week A（当前周）: Gate 稳定性固化
- 目标：
  - 保持 `RUN_GATE=1` 的每日链路全绿。
  - 维持 `trend.status=stable`，并保持 `recommended_gate_limit=8`。
- 每日动作：
  1. 运行 `tools/editor_weekly_validation.sh`（`GATE_CAD_ATTEMPTS=3`）。
  2. 记录 `editor/step166` run_id 与 `gate_would_fail`。
  3. 若出现单点 `TEXT_METRIC_DRIFT`，仅在二次确认后判为回退。
- 通过标准：
  - 每日 `editor_fail=0`、`step166_fail=0`、real-scene `PASS`。

### Week B（下周）: 性能防抖与阈值守卫
- 目标：
  - 把性能观察从“热点修复”切换为“防抖守卫”。
- 每周动作：
  1. 固定采样 synthetic perf（10k）2 次。
  2. 固定采样 real-scene perf（profile）3 次，记录中位数。
  3. 若 `box_query p95` 3-run median > `0.05ms`，触发热点剖析工单。
- 通过标准：
  - synthetic `pick/box/drag` 不出现连续 3 次同比 >20% 恶化。
  - real-scene 全指标低于阈值（`0.05/0.20/0.20`）。

### Week C（第二周）: Observe -> Gate 制度化收口
- 目标：
  - 将“门禁策略”沉淀为默认开发约束，而非一次性动作。
- 动作：
  1. 固化标准 gate 默认 `limit=8`（quick 保留 `3`）。
  2. 每周至少 1 次 `editor_stability_soak.py --rounds 3 --run-gate 1`。
  3. 周报里固定输出：trend、soak、drift_confirmation 三块。
- 通过标准：
  - 周度 soak `overall_status=stable`。
  - trend 连续保持 `stable` 且无失败桶累积。

## 12. 退出条件（Level A 阶段完成定义）
- 连续两周满足：
  - `editor_weekly_validation` 每日通过；
  - `editor_stability_soak` 周度通过；
  - STEP166 无结构性失败（含文本漂移二次确认后）。
- 满足后可切入下一阶段：
  - Level B 前置能力（更强 trim/extend、grips 细化、更多实体和样式）。
