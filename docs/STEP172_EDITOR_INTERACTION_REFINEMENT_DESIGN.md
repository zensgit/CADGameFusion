# STEP172 Editor Interaction Refinement Design

## 背景
- STEP170 已完成 Level A 的主干能力（Web 可编辑 + CADGF round-trip + STEP166 不回退）。
- STEP171 已完成一键门禁稳定化（`tools/editor_gate.sh` + history snapshot + 报告追加）。
- STEP172 聚焦“能改”到“好改”：交互一致性、命令可预测性、回归稳定化。

## 目标
1. Arc 半径编辑符合 CAD 直觉（radius grip 位于 sweep 中点，单步可撤销）。
2. grips 可发现、可控（hover 高亮、锁层防误改、Undo/Redo 单步）。
3. Trim/Extend 在 polyline 上优先段级操作，并在失败时可回退到端点语义。
4. 门禁验证可持续（5x standard gate 趋势 + 周期性验证模板）。

## 范围
### In Scope
- `tools/web_viewer/tools/select_tool.js`
  - arc `ARC_RADIUS` grip
  - primary entity grip hover overlay
- `tools/web_viewer/ui/canvas_view.js`
  - grip hover 视觉反馈
- `tools/web_viewer/commands/command_registry.js`
  - polyline extend endpoint path-aware 选择
- `tools/web_viewer/tests/editor_commands.test.js`
  - 新增/补强交互命令级测试

### Out of Scope
- paper space/layout/viewport 编辑
- dimension/dimstyle 编辑
- blocks/xref/hatch 深度编辑

## 实现约束（锁定）
1. Arc radius grip 语义：
   - `center`、`startAngle`、`endAngle`、`cw` 不变
   - `radius = max(0.001, distance(center, targetPoint))`
2. Grip 提交语义：
   - 拖拽预览允许即时更新
   - `pointerup` 回滚到 pre-drag，再走单条 `selection.propertyPatch`
3. Hover 范围：
   - 仅 primary selection，避免多选性能与视觉噪声
4. Extend 端点判定：
   - 不使用“pick 到端点欧氏距离”
   - 使用“pick 在 polyline 路径上的累计距离”选择更近端
5. Polyline extend 优先级：
   - 优先尝试“被点击 segment 的就近端点”向外延伸（segment-level）
   - 若段级无合法交点，再回退到 polyline 全局端点延伸（兼容旧行为）

## 持续开发计划（4 周滚动）
### Week 1（已落地）
- Arc radius grip + hover overlay + path-aware extend
- Node tests 更新并纳入回归

### Week 2（已落地）
- polyline segment-level extend（优先段级，回退端点）
- trim/extend 多边界 + 连续操作语义自动化测试

### Week 2
- Trim/Extend 补充多边界与连续操作回归用例
- 整理失败归因映射（editor smoke -> STEP166 buckets）

### Week 3
- 增加交互异常场景测试（锁层、空选区、命令取消）
- 统一状态栏文案，减少命令步骤歧义

### Week 4
- 复盘 2 周 gate 结果，决定是否扩大 smoke case 规模（5 -> 8）
- 输出 STEP172 收口结论并进入 STEP173 性能优化

## 验证计划（固定）
### 每次提交前（快速）
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 3
```

### 每周（标准）
```bash
EDITOR_SMOKE_LIMIT=5 CAD_ATTEMPTS=1 bash tools/editor_gate.sh
./scripts/cad_regression_run.py --mode observe --max-workers 2
```

### 双周（门禁）
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode gate --limit 5
./scripts/cad_regression_run.py --mode gate --baseline docs/baselines/STEP166_baseline_summary.json --max-workers 2
```

## 风险与控制
- 风险：grip 行为迭代破坏 Undo 语义。
  - 控制：保持 `selection.propertyPatch` 单步提交不变，并用命令级测试覆盖。
- 风险：polyline 算法变化引入边界场景退化。
  - 控制：新增 segment/path-aware 专项用例，保留旧路径用于对比。
- 风险：门禁数据噪声影响判定。
  - 控制：保留 history snapshots，按 5-run 趋势判断，不用单次结果决策。
