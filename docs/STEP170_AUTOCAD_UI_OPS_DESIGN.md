# STEP170 AutoCAD-like UI + 2D Operations Design (Web Mainline, Qt Key Sync)

## 背景与目标
- 在不依赖 CAD 客户端 GUI 的前提下，持续推进 VemCAD 类 AutoCAD 界面与核心 2D 操作闭环。
- 保持已有 `tools/plm_preview.py` + `scripts/compare_autocad_pdf.py` + STEP166 回归链路可用。
- 采用双线策略：Web 主线快速演进；Qt 同步关键命令状态与捕捉语义。

## 架构与数据流
1. 模式分流
   - `tools/web_viewer/app.js`：默认加载预览模式（`preview_app.js`）；`?mode=editor` 启用 2D 编辑器。
   - Editor 快捷加载：`?mode=editor&cadgf=<path>` 直接加载 CADGF `document.json`（同源可访问路径）。
2. Web 编辑器模块
   - `state/`：`documentState`, `selectionState`, `snapState`, `viewState`
     - `spatialIndex`：轻量分桶索引用于 hit test/box select 候选集
   - `commands/`：`command_bus`, `command_registry`
   - `tools/`：`select/line/polyline/circle/arc/text/move/copy/rotate/trim/extend/delete`
   - `ui/`：`workspace`, `canvas_view`, `toolbar`, `statusbar`, `property_panel`, `layer_panel`
   - `adapters/`：`document_json_adapter`（导入/导出）
3. 编辑执行流
   - Pointer/keyboard -> Tool -> CommandBus -> State mutate -> Canvas redraw -> status/panel refresh
4. Qt 关键同步
   - 扩展 `SnapSettings/SnapPanel/SnapManager/Canvas`，支持 `center/intersection/ortho` 选项。

## 接口与 Schema
### 命令接口（Web）
- `CommandContext`: `{ document, selection, snap, viewport }`
- `CommandResult`: `{ ok, changed, message, error_code, undo?, redo? }`
- `Command`: `{ id, label, canExecute(ctx,payload), execute(ctx,payload) }`

### 工具状态接口（Web）
- `ToolState`: `idle | drawing | modifying`
- `SnapOptions`: `{ endpoint, midpoint, quadrant, center, intersection, nearest, tangent, ortho, grid, gridSize, snapRadiusPx }`

### 选择与属性接口（Web）
- `SelectionModel`: `{ entityIds[], primaryId, boxSelectEnabled }`
- `PropertyPatch`: 公共字段 `layerId/color/visible` + 实体特化字段
  - `line`: `start/end`
  - `polyline`: `closed`
  - `circle`: `center/radius`
  - `arc`: `center/radius/startAngle/endAngle`
  - `text`: `position/value/height/rotation`

### 文档适配接口（Web）
- `adapters/document_json_adapter.js`
  - `serializeDocument(...)`
  - `hydrateDocument(...)`
- `adapters/cadgf_document_adapter.js`（对齐 `schemas/document.schema.json`）
  - `isCadgfDocument(payload)`
  - `importCadgfDocument(cadgfJson) -> { docSnapshot, warnings[], baseCadgfJson }`
  - `exportCadgfDocument(documentState, { baseCadgfJson? }) -> cadgfJson`
  - 约定：不支持的 CADGF 实体类型导入为 `type='unsupported'`（read-only），并通过 `cadgf` 字段 passthrough 保持 round-trip 不丢失。

## 命令清单（当前实现）
- 创建：`entity.create`, `entity.createMany`
- 选择与删除：`selection.box`, `selection.delete`
- 修改（几何）：`selection.move`, `selection.copy`, `selection.rotate`, `selection.trim`, `selection.extend`, `selection.offset`
- 修改（拓扑）：`selection.break`, `selection.join`
- 圆角/倒角：`selection.fillet`, `selection.filletByPick`, `selection.chamfer`, `selection.chamferByPick`
- 属性：`selection.propertyPatch`
- 历史：`history.undo`, `history.redo`

补充约束：
- `selection.offset` 当前支持 `line/circle/arc/polyline(open/closed)`；对自交 polyline 等不可稳定 offset 的输入会返回可解释 `error_code`（避免 silent 破坏几何）。

## 交互流程（当前实现）
1. 绘图
   - `Line/Polyline/Circle/Arc/Text`：均支持点击驱动与捕捉对齐。
2. 修改
   - `Select`：点选+框选
   - `Grips`（MVP）：
     - `Line`：start/end
     - `Polyline`：vertex（拖拽）；midpoint grip（插入新顶点后拖拽）；双击 vertex grip 删除顶点
     - `Circle`：center/radius
     - `Arc`：center/start/end/radius（radius grip 位于 sweep 的 midAngle；start/end 更新 angle；radius 更新半径）
     - `Text`：position
     - hover 高亮：仅 primary entity grips（通过 overlay 绘制 ring 高亮）
     - 提交策略：拖拽预览期间直接更新实体；PointerUp 时回滚到拖拽前快照，再用单条 `selection.propertyPatch` 提交，确保 Undo/Redo 为单步操作。
   - `Move/Copy/Rotate`：基点 + 目标点流程
   - `Trim/Extend`：先边界、后目标；支持多边界（`boundaryIds[]`）与连续操作
     - `Trim`：polyline 在被点击 segment 上求交点后，删除“包含 pick 点”的一侧；必要时拆分为两条 polyline
     - `Extend`：polyline 仅延伸起点/终点到边界交点（endpoint-only），避免中段改形导致不可预期
   - `Offset`：对选中实体生成偏移（line/circle/arc/polyline）；失败返回可解释 `error_code`（例如自交 polyline）
   - `Break/Join`：基础拓扑编辑（断开/合并），`Break` 支持两点模式（two-point）
   - `Fillet/Chamfer`：两实体（或同一 polyline 的相邻段）倒圆/倒角；支持按 pick 点决定修剪侧
   - `Delete`：命令或工具触发
3. 辅助
   - `Ortho`, `Snap`, `Grid` 开关
     - `Snap` 面板：可单独开关 `endpoint/midpoint/quadrant/center/intersection/tangent/nearest` 与 `gridSize/snapRadiusPx`
   - 视图：`Fit/ZE/Extents`（缩放到图形范围），以及滚轮缩放、Alt+拖拽平移
   - `OSnap` 命中可视化：`resolveSnappedPoint()` 返回 `{point,snapped,kind}`，画布 overlay 绘制 `END/MID/TAN/QUA/CEN/INT/NEA/GRID` 提示。
     - 支持圆/弧的 `QUA`（象限点）与弧端点 `END`
     - `TAN`（切点）：需要参考点（当前实现：Line/Polyline 的上一个点作为 tangentFrom）
     - `NEA`（最近点）：对线段/多段线/圆/弧投影到最近点
     - `INT`（交点）护栏：当候选 segments 数量过大（>2000）时跳过两两求交，避免 O(N^2) 鼠标移动卡顿；不影响 END/MID/CEN/QUA/NEA/TAN/GRID
     - snap 选择策略：距离优先；在小范围候选内按 kind priority（`END > INT > MID > TAN > QUA > CEN > NEA > GRID`）决策，减少“抓错点”
   - `Ctrl/Cmd+Z`, `Ctrl/Cmd+Y`, `Ctrl/Cmd+Shift+Z`

## 风险与控制
- 风险：`Trim/Extend` 当前主要覆盖线段，复杂样条/椭圆未纳入。
  - 控制：保持命令接口稳定，后续以命令扩展而非重构接口。
- 风险：Web 与 Qt 渲染能力不完全同速。
  - 控制：Qt 先同步关键捕捉/状态，功能闭环由 Web 先行验证。
- 风险：新增 UI 影响现有预览链路。
  - 控制：`mode` 分流，默认仍为 preview，STEP166 链路继续回归验证。

## 门禁策略（承接 STEP166）
- 周内：`observe` 回归（记录趋势，不阻塞）
- 双周：`gate` 回归（基线对比）
- 维持失败桶：`INPUT_INVALID`, `IMPORT_FAIL`, `VIEWPORT_LAYOUT_MISSING`, `RENDER_DRIFT`, `TEXT_METRIC_DRIFT`
- 编辑器闭环自检：`node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe|gate`
  - 导入真实 CADGF -> 命令级编辑 -> 导出 -> schema 校验 -> `plm_convert` smoke
  - 可选集成到本地 CI：`RUN_EDITOR_SMOKE=1` / `RUN_EDITOR_SMOKE_GATE=1`（配合 `--strict-exit`）
- 编辑器 UI flow smoke（Playwright）：`bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe|gate`
  - 覆盖：绘制（Line/Polyline/Arc/Text）+ 选择（click/box select/window&crossing/Shift add-remove/Ctrl+A）+ 修改（Move/Copy/Rotate/Fillet/Chamfer/Break/Offset/Join/Trim/Extend/Grips/Text edit）+ Undo/Redo
    - 属性面板：Closed/Radius/Text + Layer lock（锁层时 `selection.propertyPatch` 必须被阻止；解锁后可编辑并 Undo/Redo）
    - 状态栏 wiring：Grid/Ortho/Snap toggles + snap 命中断言（END/MID/CEN/INT/QUA/NEA 最小覆盖；TAN 主要由 Node tests 覆盖）
    - 图层：visibility/lock wiring（hidden layer 不参与 pick/hit-test/box select）
  - 失败可解释性：flow JSON 输出包含 `__step`/`__error`（含 selection/status 快照），便于定位卡点步骤
  - 可选集成到本地 CI：`RUN_EDITOR_UI_FLOW_SMOKE=1` / `RUN_EDITOR_UI_FLOW_SMOKE_GATE=1`（配合 `--strict-exit`）
- 一键门禁：`bash tools/editor_gate.sh`
  - 标准输出：`build/editor_gate_summary.json`
  - 历史快照：`build/editor_gate_history/gate_*.json`
  - 可选自动追加报告：`EDITOR_GATE_APPEND_REPORT=1 bash tools/editor_gate.sh`（调用 `tools/write_editor_gate_report.py`）

## 回滚策略
- 若编辑器功能出现回归，可通过 `mode=editor` 层回滚而不影响默认预览。
- 若 Qt 新增捕捉选项异常，可仅回滚 `snap_*` 变更，不影响文档/导出链路。

## 后续开发与验证计划（STEP171/STEP172）
### 目标拆分
1. STEP171（Level A 稳定化）
   - 将 `tools/editor_gate.sh` 作为固定验收入口（先 observe，再默认 gate）。
   - 强化失败可解释性：失败明细聚合到 `build/editor_gate_summary.json` 与验证报告。
   - 对 `negative` case 持续保持 `expected + skipped` 语义，不阻塞 gate。
2. STEP172（交互与性能收口）
   - `Trim/Extend` 段级行为补齐（多段 polyline 中段处理）。
   - 大图编辑性能优化（空间索引命中路径 + overlay 刷新成本控制）。
   - grips 交互一致性（hover/drag/undo 单步）回归。

### 每周开发节奏（固定）
- 周一：冻结本周范围（命令、交互、性能三条线）。
- 周三：中期可运行检查（`node --test` + `editor_roundtrip_smoke --mode observe`）。
- 周五：一键门禁复跑（`tools/editor_gate.sh`）并追加验证报告。

### 验证矩阵（固定）
- 快速回归（每次提交前）：
  - `node --test tools/web_viewer/tests/editor_commands.test.js`
  - `node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 3`
- 周回归（observe）：
  - `./scripts/cad_regression_run.py --mode observe`
  - `bash tools/editor_weekly_validation.sh`
- 双周验收（gate）：
  - `EDITOR_SMOKE_LIMIT=5 bash tools/editor_gate.sh`
  - 或分步执行 `editor_roundtrip_smoke --mode gate` + `cad_regression_run.py --mode gate --baseline ...`

### 里程碑完成判定
- M1（STEP171 完成）：
  - 连续 2 周 `editor_gate.sh` 在固定样例集无非预期失败。
  - STEP166 baseline gate 连续通过（`degraded_cases=0`）。
- M2（STEP172 完成）：
  - Trim/Extend 新增场景有自动化用例覆盖且通过。
  - 大图操作（选择/拖拽/命令）在可接受交互延迟范围内，且无随机失败。

### 后续文档分解（详细计划）
- STEP172（交互收口）：`docs/STEP172_EDITOR_INTERACTION_REFINEMENT_DESIGN.md`
- STEP172（验证记录）：`docs/STEP172_EDITOR_INTERACTION_REFINEMENT_VERIFICATION.md`
- STEP173（性能基线）：`docs/STEP173_EDITOR_PERFORMANCE_BASELINE_DESIGN.md`
- STEP173（验证记录）：`docs/STEP173_EDITOR_PERFORMANCE_BASELINE_VERIFICATION.md`

## 2026-02-21 交互收口补丁（Fillet/Chamfer）
- 目标：降低“命令失败后需要重选 first target”的操作成本，提升连续编辑效率。
- 设计变更：
  - `tools/web_viewer/tools/fillet_tool.js`
  - `tools/web_viewer/tools/chamfer_tool.js`
- 行为调整：
  - pick 命中容差从 `14px` 提升到 `18px`，降低近距离 miss。
  - `selection.filletByPick` / `selection.chamferByPick` 失败时，工具保持在 `pickSecond`，允许直接重试 second pick（first pick 与 firstId 保持不变）。
  - 失败状态增加 `error_code` 后缀（`[CODE]`），便于快速归因。
- 不变约束：
  - 成功后仍保持连续模式（自动回到 `pickFirst`）。
  - 命令写历史路径不变（仍通过 command bus，Undo/Redo 语义不变）。
- UI-flow 验证强化：
  - `tools/web_viewer/scripts/editor_ui_flow_smoke.sh` 的 fillet/chamfer 场景新增“故障参数 -> 失败 -> 不重选 first 直接重试”路径。
  - 结果字段新增 `failStatus` 与 `retrySucceeded`，用于长期回归追踪交互稳定性。

## 增量设计（2026-02-22）：Unsupported proxy 只读收口
- 目标：`unsupported` 实体继续可见、可 round-trip passthrough，但禁止编辑导致结构漂移。
- 命令层策略：
  - 在 `selection.move/copy/rotate/propertyPatch/delete` 中统一识别只读实体（`readOnly=true` 或 `type=unsupported`）。
  - 全只读选择：返回 `UNSUPPORTED_READ_ONLY`。
  - 混合选择：仅对可编辑实体生效，并在 message 标注 skipped read-only 数量。
- 属性面板策略：
  - 选择集包含只读代理时显示明确提示；
  - 全只读时禁用编辑表单。

## 增量设计（2026-02-23）：快捷键语义对齐（Web/Qt）
- Web 工作区快捷键新增：
  - `F7` 切换 Grid
  - `F8` 切换 Ortho
  - `F3` 切换 Snap（endpoint/midpoint/quadrant/center/intersection/nearest/tangent 统一开关）
- 设计原则：
  - 与状态栏按钮复用同一 toggle 逻辑，避免按钮与快捷键语义漂移。
  - 输入框聚焦时不拦截，避免影响命令输入。
  - `event.repeat` 去抖，避免长按导致多次翻转。
- 落点：`tools/web_viewer/ui/workspace.js`

## 增量设计（2026-02-23）：Qt F3 Snap 主开关对齐
- 目标：Qt 侧与 Web `F3` 语义统一（对象捕捉总开关）。
- 设计：
  - `SnapSettings` 新增：
    - `objectSnapEnabled()`：判断 endpoint/midpoint/center/intersection 是否任一启用；
    - `setObjectSnapEnabled(bool)`：一次性批量开/关上述四类 snap，并只发一次 `settingsChanged()`。
  - `MainWindow` 新增 `F3` 动作：
    - `next = !objectSnapEnabled()`，然后 `setObjectSnapEnabled(next)`。
    - 状态栏提示 `Snap On/Off`。
- 落点：
  - `editor/qt/include/snap/snap_settings.hpp`
  - `editor/qt/src/snap/snap_settings.cpp`
  - `editor/qt/src/mainwindow.cpp`
