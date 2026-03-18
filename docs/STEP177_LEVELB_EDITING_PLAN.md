# STEP177 Level B 编辑能力推进计划（Web 主线）

## 1. 目标（Level B 的可交付定义）
在已达成 Level A（可编辑 CADGF document.json + round-trip + STEP166/STEP176 回归闭环）的基础上，推进到“可用生产一部分图纸”的 Level B：
- 大图可用（选择/拖拽/命令不明显卡顿）
- 常用编辑命令覆盖更完整（Offset/Break/Join/Fillet/Chamfer 等）
- 交互更像 CAD（抓手/捕捉可视化一致、命令可连续、状态栏提示明确）
- 每个增量都有自动化验证（Node 命令级测试 + smoke + STEP176 追踪）

本计划默认仍以 Web 主线为主；Qt 仅按需同步关键语义，不追求同速全量对齐。

## 2. 现状基线（2026-02-12）
- Level A 已闭环：
  - editor：绘制 + Move/Copy/Rotate/Trim/Extend/Delete + grips + Snap 可视化
  - round-trip：`tools/web_viewer/scripts/editor_roundtrip_smoke.js`
  - 回归：`STEP166` + `STEP176`（observe->auto->gate）
- 已新增 Level B 的第一块能力：`Offset`（line/circle/arc；polyline 暂不支持）

## 3. 代码落点（固定约束）
### 命令（CommandBus）
- 文件：`tools/web_viewer/commands/command_registry.js`
- 原则：
  - 每个命令必须通过 `withSnapshot(...)` 形成单步 Undo/Redo
  - 新命令必须补 Node 测试（`tools/web_viewer/tests/editor_commands.test.js`）

### 工具（Tools）
- 目录：`tools/web_viewer/tools/`
- 原则：
  - Tool 负责交互状态机；最终修改必须落到 Command（避免绕过历史）
  - Preview 走 `canvasView.setTransientOverlay(...)`，并在 deactivate/Escape 清理

### UI（workspace/toolbar/status）
- 文件：`tools/web_viewer/ui/workspace.js`, `tools/web_viewer/ui/toolbar.js`, `tools/web_viewer/index.html`
- 原则：
  - 命令输入别名需要同步（避免“有命令但不可用”）
  - 工具栏按钮与命令输入应一致（同名 tool id）

## 4. 迭代拆分（2 周一个 Sprint）
### Sprint 1：Offset 收口 + polyline 支持（2 周）
- Offset 扩展：
  - 支持 `polyline`（先做 open polyline；closed 后续）
  - corner join 策略：miter（默认）+ bevel（可选）
  - 提供最小可解释失败：自交/过小半径/无有效偏移时给出 error_code
  - 详细设计：`docs/STEP178_OFFSET_POLYLINE_DESIGN.md`
- 验证：
  - 增加命令级测试：polyline offset（凸角/凹角）
  - e2e smoke：编辑 -> 导出 -> 重新导入保持拓扑稳定

### Sprint 2：Break / Join（2 周）
- Break（先支持 line/polyline）：
  - line：在 pick 点断成两条 line（或删除中段）
  - polyline：在 segment 上断开，生成两条 polyline（保持 layer/style）
- Join（先支持 polyline + line-to-polyline）：
  - endpoint 近似合并（容差：EPSILON*10）
  - 方向选择：优先保持 primary entity 方向
- 设计参考：`docs/STEP179_BREAK_JOIN_DESIGN.md`
- 设计参考：`docs/STEP180_FILLET_CHAMFER_DESIGN.md`
- 详细收口计划：`docs/STEP181_LEVELB_INTERACTION_AND_VERIFICATION_PLAN.md`
- 验证：
  - Node 测试覆盖：break/join + undo/redo + locked layer 拒绝

### Sprint 3：Fillet / Chamfer（2 周）
- 先做 line-line / polyline-segment：
  - Fillet：圆角半径 R（先支持定值 R）
  - Chamfer：倒角距离 d1/d2（先 d1=d2）
- 交互：
  - 命令连续：多次点选边界/目标，ESC 退出
- 验证：
  - 几何边界：平行线/无交点/半径过大必须可解释失败（不产生脏数据）

### Sprint 4：性能与交互一致性收口（2 周）
- 空间索引优化：
  - hit test / box select / snap candidates 的候选集上限与分桶策略
- overlay 成本控制：
  - grips/snap/preview 刷新避免全量重算
- 验证：
  - synthetic perf smoke（10k entities）结果稳定；STEP176 trend 保持可解释

## 5. 验证与门禁（复用 STEP176）
- 每日：`bash tools/editor_daily_validation.sh`
- 每周（repeat=3 中位数采样）：`bash tools/editor_weekly_median_validation.sh`
- PR/CI（light gate）：`bash tools/ci_editor_light.sh`
- 新命令必须满足：
  - Node tests 覆盖 + PASS
  - round-trip smoke 至少 1 个 fixture case PASS（schema OK）

## 6. 风险与对策
- 几何复杂度快速上升：
  - 对策：先支持 line/arc/circle，再逐步扩展到 polyline；每步都加测试
- 自交与数值稳定性：
  - 对策：明确拒绝策略（返回 error_code），不产出不可恢复实体
- 交互一致性：
  - 对策：统一 Tool 状态机风格（Pick targets -> Pick params -> Commit），并标准化 statusbar 提示

## 7. 交付物
- 设计/计划：`docs/STEP177_LEVELB_EDITING_PLAN.md`
- 每个 Sprint 的验证追加：`docs/STEP177_LEVELB_EDITING_VERIFICATION.md`
- 代码：
  - 新命令 + Tool + UI + Node tests
