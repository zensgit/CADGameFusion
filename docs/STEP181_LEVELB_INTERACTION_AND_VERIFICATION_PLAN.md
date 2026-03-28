# STEP181 Level B 交互与验证收口计划（Break/Join/Fillet/Chamfer）

## 背景
目前 Level B 的命令级能力已经开始具备（Offset/Break/Join/Fillet/Chamfer 等），并且有 Node 命令级测试与 editor light gate。
下一阶段的关键不再是“有没有命令”，而是把它们推进到：
- 交互更像 CAD（连续操作、参数可控、错误可解释）
- 回归更像工程（命令级 + round-trip + CI 可选门禁）

## 目标（Definition of Done）
1) 交互层：
- Break：支持两点模式（删除中段）与更清晰的状态提示
- Join：支持 2+ 链式合并并给出不可连接的明确原因
- Fillet/Chamfer：至少完成 line-line 的“可连续操作”（不要求预览）

2) 验证层：
- Node tests 覆盖新增/变更行为（Undo/Redo 单步）
- `bash tools/ci_editor_light.sh` 持续 PASS（作为 PR/CI light gate）
- round-trip smoke 能在 `--mode observe|gate` 下复用（本地/CI）

3) 文档层：
- 新增/更新 STEP 设计与验证文档，记录 run_id 与门禁结论

## 范围（本 STEP 覆盖）
- Web editor：命令行为与工具交互收口
- CI：light gate 与可选门禁（observe -> gate）

不包含：
- paper space/layout/viewport 可编辑
- dimension/dimstyle 完整编辑
- blocks/xref/hatch 等重型特性

## 实施拆分（按优先级）

### P0：Break 两点模式一致性（命令 + 工具）
现状：
- `selection.break` 已支持 line/open polyline 的两点删除中段
- closed polyline 已支持两点模式（删除 pick1->pick2 中段，输出 1 条 open polyline）

收口任务：
1) 工具层提示与易用性：
- 文件：`tools/web_viewer/tools/break_tool.js`
- 目标：两点模式的状态提示更明确（例如：`Shift+click` 进入/退出两点模式）
- 连续模式：完成一次 break 后回到 `pickTarget`

2) 命令层稳定性：
- 文件：`tools/web_viewer/commands/command_registry.js`
- 目标：确保 pick2 基于 pick1 插入后的 points 重新寻段投影（避免索引偏移）
- 目标：若 pick2 需要插入的新顶点位置在 pick1 之前（insertIndex2 <= breakIndex），同步修正 breakIndex，避免删除范围计算错误
- 失败必须可解释：保持 `error_code` 稳定

验证：
- Node tests：两点 break（line/open polyline/closed polyline）+ open polyline “pick2 插入在 pick1 之前”覆盖

### P0：Fillet/Chamfer v0 的门禁化（命令级）
现状：
- `selection.fillet` / `selection.chamfer` 已落地（line-line）
- `fillet` / `chamfer` tool 已落地（两次 pick 后触发命令；参数从 command input args 读取）

收口任务：
1) error_code 稳定与边界补齐：
- 平行、夹角过小、半径/距离过大必须返回可解释错误（不产出脏实体）
2) 属性继承策略最小化一致：
- connector/arc 继承 layer/color/visible（已做）；后续再扩展 lineType/weight

验证：
- Node tests：fillet/chamfer undo/redo
- editor light gate：保持 PASS

### P1：Join 的失败归因与属性继承
收口任务：
- 文件：`tools/web_viewer/commands/command_registry.js`
- 目标：
  - `NO_MATCH` 返回时附带 remaining count（已做），并补充 tolerance 显示（可选）
  - 合并后 polyline 的 name/style 继承策略固定（以 primary 为准）

验证：
- Node tests：disjoint `NO_MATCH`（已覆盖）

### P2：UI 级最小 smoke（可选增强）
目的：捕捉“命令级测试覆盖不到”的 UI 回归（如按钮 wiring、工具状态机崩溃、overlay 异常）。

建议做法（可选）：
- 现已提供脚本：`tools/web_viewer/scripts/editor_ui_smoke.sh`
  - 方式：启动本地 http.server + `npx playwright screenshot` 捕捉 `?mode=editor` 的加载截图
  - 前置：首次需执行 `npx playwright install chromium`
- 接入到 `tools/ci_editor_light.sh` 的可选步骤（默认不阻塞）：
  - `RUN_EDITOR_UI_SMOKE=1`：observe（失败不阻塞）
  - `RUN_EDITOR_UI_SMOKE_GATE=1`：gate（失败 exit 2 阻塞）
  - `EDITOR_UI_SMOKE_PORT`：可选端口覆盖（默认 18080）

增强版（已落地）：最小交互流 smoke
- 脚本：`tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
  - Flow（当前覆盖）：
    - Line：两次点击画线 -> `#cad-selection-summary` 包含 `line` -> Undo/Redo
    - Polyline + Fillet：画折线（右键结束）-> Fillet 点两次（同一 polyline 拐角相邻段）-> selection 包含 `arc` -> Undo
    - Polyline + Chamfer：画折线（右键结束）-> Chamfer 点两次（同一 polyline 拐角相邻段）-> selection 包含 `line` -> Undo
    - Break Keep + two-point break：Closed toggle -> Break Keep toggle -> Break（清选择避免 preselect）-> Shift+click 两点 -> 断言 `Closed` 变为 unchecked
    - Arc grips：Arc(center->start->end) -> Select -> Arc radius grip 拖拽 -> Radius 输入值变化 -> Undo/Redo
    - Offset：命令输入 `offset 5` -> Offset tool -> pick target -> pick side -> 断言 Start/End 数值变化 -> Undo/Redo
    - Join：Shift 多选两条相连 line -> 命令输入 `join` -> selection 变为 `polyline` -> Undo/Redo
    - Text edit：命令输入 `text HELLO 3` + Text tool 点选 -> 属性面板修改 Text -> Undo/Redo
  - 断言策略：优先读 `#cad-selection-summary` + 属性面板字段（例如 `input[name=radius]`），避免依赖 status 文案（可能被后续事件覆盖）
- 接入到 `tools/ci_editor_light.sh` 的可选步骤（默认不阻塞）：
  - `RUN_EDITOR_UI_FLOW_SMOKE=1`：observe
  - `RUN_EDITOR_UI_FLOW_SMOKE_GATE=1`：gate（失败 exit 2）
  - `EDITOR_UI_FLOW_SMOKE_PORT`：可选端口覆盖（默认 18081）
 - 接入到 `tools/local_ci.sh` 的可选步骤（默认不阻塞；`--strict-exit` + gate 时可作为门禁）：
   - `RUN_EDITOR_UI_FLOW_SMOKE=1`：observe（exit 0，但 summary.json 记录 ok=false）
   - `RUN_EDITOR_UI_FLOW_SMOKE_GATE=1`：gate（失败时 `tools/local_ci.sh --strict-exit` 会汇总为失败并 exit 2）
   - `SKIP_EDITOR_UI_FLOW_SMOKE=1`：跳过（escape hatch）
   - `EDITOR_UI_FLOW_SMOKE_PORT/VIEWPORT/TIMEOUT_MS/HEADED`：可选覆盖

## 统一验证入口（推荐执行顺序）
1) 命令级：
```bash
cd deps/cadgamefusion
node --test tools/web_viewer/tests/editor_commands.test.js
```

2) Light gate：
```bash
cd deps/cadgamefusion
bash tools/ci_editor_light.sh
```

3) （可选）预览链路回归（STEP166 observe）：
```bash
cd deps/cadgamefusion
./scripts/cad_regression_run.py --mode observe
```

## 交付物（本 STEP）
- 计划：`docs/STEP181_LEVELB_INTERACTION_AND_VERIFICATION_PLAN.md`
- 设计（已有/新增）：
  - `docs/STEP179_BREAK_JOIN_DESIGN.md`
  - `docs/STEP180_FILLET_CHAMFER_DESIGN.md`
- 验证（已有/新增）：
  - `docs/STEP179_BREAK_JOIN_VERIFICATION.md`
  - `docs/STEP180_FILLET_CHAMFER_VERIFICATION.md`

## 下一阶段建议（STEP182 提案，已落地 2026-02-13）
目标：从“命令可用”推进到“更像 CAD + 更少误操作 + 更工程化门禁”。

UI flow smoke 扩展计划：
- `docs/STEP182_EDITOR_UI_FLOW_SMOKE_EXPANSION_PLAN.md`

1) Fillet/Chamfer：支持 pick-based 语义（v0：line-line）
- 命令层：新增 `selection.filletByPick` / `selection.chamferByPick`
  - payload：`{ firstId, secondId, pick1, pick2, radius|d1|d2 }`
  - 语义：用 pick1/pick2 决定 trim 的 segment/端点（避免只按交点最近端导致“修错边”）
- 工具层：Fillet/Chamfer tool 改为传入 pick 点（从纯 selection 驱动升级为 pick 驱动）

2) UI smoke：从“截图”升级为“最小交互流”
- Playwright：选择 line tool -> 两次点击画线 -> 断言 `#cad-selection-summary` 包含 `line`
- 产物：截图 + 控制台日志（作为 UI wiring 的快速回归证据）

3) Break(closed polyline) 两点：显式保留短段/长段
- 当前通过 pick 顺序隐式控制；建议增加显式 flag（例如：payload `keep:short|long` 或 Shift/Ctrl 修饰键）
