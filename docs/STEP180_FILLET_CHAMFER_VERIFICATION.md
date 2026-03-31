# STEP180 Fillet / Chamfer 验证记录

## 2026-03-21

### 增量验证：共享 two-target pick helper + curve preselection/pair-preselection 收口
- 代码现状：
  - 新增共享 helper：`tools/web_viewer/tools/two_target_pick_tool_helpers.js`
  - `fillet_tool` / `chamfer_tool` 复用同一套 target 识别、selection key、pick fallback、status 格式化与曲线投影逻辑
  - `fillet_tool` 不再把预选 `arc/circle` 的 pick 原样透传；single preselection 与 pair preselection 都会先投影到曲线
  - `chamfer_tool` 保持既有曲线投影行为，并与 `fillet_tool` 对齐到同一 helper
  - `editor_ui_flow_smoke` 的 fillet/chamfer preselection/polyline-preselection 段已改为 `canvas-relative click`，不再依赖会掉出视口的页面绝对坐标
  - README 已补上 `Fillet` / `Chamfer` 的工具列表与命令示例

### 本轮新增/确认的自动化覆盖
- `fillet tool uses single preselected circle as first target when clicking line directly`
- `fillet tool projects curve picks in one-click mode with preselected circle-line pair`
- `chamfer tool uses single preselected circle as first target when clicking line directly`
- `chamfer tool projects curve picks in one-click mode with preselected circle-line pair`
- `editor_ui_flow_smoke`：
  - single preselected `circle -> line`（fillet/chamfer）
  - pair preselection `circle + line` one-click path（fillet/chamfer）
  - line/pair/polyline preselection 改走相对 canvas 点击后继续保持全绿

### 验证命令
```bash
cd deps/cadgamefusion
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/ci_editor_light.sh
```

### 结果
- `editor_commands.test.js`：PASS（tests=159, fail=0）
- `ci_editor_light.sh`：PASS
- 关键产物：
  - UI flow smoke:
    - `build/editor_ui_flow_smoke/20260321_224241_ui_flow/summary.json`
  - roundtrip smoke:
    - `build/editor_roundtrip/20260321_224240_869_8e5f/summary.json`

### 关键观测
- `fillet/chamfer` 的 single-target preselection：
  - 当预选目标为 `circle`，再直接点击 `line` 时，payload 中的第一侧 pick 已投影到 circle
- `fillet/chamfer` 的 pair preselection：
  - 当 pair 中含 `circle`，one-click path 会分别把两侧 pick 投影到各自实体，而不是把同一个 raw click 生搬给曲线侧
- `editor_ui_flow_smoke` 的新浏览器路径断言：
  - `interaction_checks.fillet_curve_single_preselection_ok = true`
  - `interaction_checks.chamfer_curve_single_preselection_ok = true`
  - `interaction_checks.fillet_curve_pair_preselection_ok = true`
  - `interaction_checks.chamfer_curve_pair_preselection_ok = true`
- `interaction_checks.complete = true`
- `interaction_checks.fillet_pair_preselection_ok = true`
- `interaction_checks.chamfer_pair_preselection_ok = true`
- `interaction_checks.fillet_polyline_preselection_ok = true`
- `interaction_checks.chamfer_polyline_preselection_ok = true`

## 2026-03-20

### 增量验证：fillet/chamfer curve-curve 组合收口 + editor light gate 全绿
- 代码现状：
  - `selection.filletByPick` 已支持 `polyline+arc`（open polyline segment）
  - `selection.filletByPick` 已支持 `closed polyline+arc`，并在被 pick 的 segment 上插入 tangent point，同时保持 `closed: true`
  - `selection.filletByPick` / `selection.chamferByPick` 已支持 closed polyline cross-entity，并在被 pick 的 segment 上插入 trim 点，同时保持 `closed: true`
  - `selection.filletByPick` 已支持 `line+circle`
  - `selection.filletByPick` 已支持 `circle+arc`
  - `selection.filletByPick` 已支持 `circle+circle`
  - `selection.filletByPick` 已支持 `polyline+circle`（open/closed）
  - `selection.chamferByPick` 已支持 `line+arc`
  - `selection.chamferByPick` 已支持 `line+circle`
  - `selection.chamferByPick` 已支持 `arc+arc`
  - `selection.chamferByPick` 已支持 `arc+circle`
  - `selection.chamferByPick` 已支持 `circle+circle`
  - `fillet_tool` / `chamfer_tool` 在预选 polyline、selection fallback、失败后重试场景下，都会把真实失败状态和 `error_code` 透传到 UI
  - `editor_ui_flow_smoke` 里的 `layer_visibility` 与 `snap_kinds_extra` 已做确定性加固，避免因为视图和主 Snap toggle 状态导致假红

### 验证命令
```bash
cd deps/cadgamefusion
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/ci_editor_light.sh
```

### 结果
- `editor_commands.test.js`：PASS（tests=156, fail=0）
- `ci_editor_light.sh`：PASS
- 关键产物：
  - UI flow smoke:
    - `build/editor_ui_flow_smoke/20260320_164459_ui_flow/summary.json`
  - roundtrip smoke:
    - `build/editor_roundtrip/20260320_164458_841_0d4a/summary.json`

### 关键观测
- `fillet_polyline`
  - `failCode = RADIUS_TOO_LARGE`
  - `retrySucceeded = true`
- `chamfer_polyline`
  - `failCode = DISTANCE_TOO_LARGE`
  - `retrySucceeded = true`
- `snap_kinds_extra`
  - `mid / cen / int / qua / nea / tan` 都通过
- `interaction_checks.complete = true`
- `selection.filletByPick` 的新增闭环命令层回归：
  - `closed polyline+arc` 成功路径 PASS
  - polyline 结果保持 `closed: true`
  - 被 pick 的 segment 插入 tangent point，fillet arc 正常创建
- `selection.filletByPick` / `selection.chamferByPick` 的新增 closed polyline cross-entity 回归：
  - `closed polyline + line` fillet 成功路径 PASS
  - `closed polyline + line` chamfer 成功路径 PASS
  - polyline 结果保持 `closed: true`
  - 被 pick 的 segment 插入 trim 点
- `selection.filletByPick` 的新增 circle 命令层回归：
  - `line+circle` 成功路径 PASS
  - `circle+arc` 成功路径 PASS
  - `circle+circle` 成功路径 PASS
  - `open polyline+circle` 成功路径 PASS
  - `closed polyline+circle` 成功路径 PASS
- `selection.chamferByPick` 的新增 curve 命令层回归：
  - `line+arc` 成功路径 PASS
  - `line+circle` 成功路径 PASS
  - `arc+arc` 成功路径 PASS
  - `arc+circle` 成功路径 PASS
  - `circle+circle` 成功路径 PASS
- `chamfer` tool 的新增 UI/命令桥接回归：
  - `line -> arc` 可正确进入 `selection.chamferByPick`
  - `line -> circle` 可正确进入 `selection.chamferByPick`
  - 单个预选 `line` 后直接 pick `circle` 可正确进入 `selection.chamferByPick`
- `editor_ui_flow_smoke` 的 runtime preselection 清选已加硬：
  - `interaction_checks.chamfer_runtime_preselection_ok = true`
- `fillet` tool 的新增 UI/命令桥接回归：
  - 允许直接 pick `arc/circle` 作为目标
  - 单个预选 `circle` 后再直接 pick `line` 可正确进入 `selection.filletByPick`
  - `circle -> circle` 两次 pick 可正确进入 `selection.filletByPick`
  - `polyline -> circle` 两次 pick 可正确进入 `selection.filletByPick`

### 结论
- STEP180 当前已形成可回归、可门禁的支持矩阵：
  - `line+line`
  - `polyline+line`
  - `polyline corner`
  - `line+arc`
  - `arc+arc`
  - `line+circle`
  - `line+arc/chamfer`
  - `line+circle/chamfer`
  - `arc+arc/chamfer`
  - `arc+circle/chamfer`
  - `circle+circle/chamfer`
  - `circle+arc`
  - `circle+circle`
  - `polyline+circle`（open polyline segment）
  - `closed polyline+circle`（保持闭环并插入 tangent point）
  - `polyline+arc`（open polyline segment）
  - `closed polyline+arc`（保持闭环并插入 tangent point）
  - `closed polyline + line/chamfer` cross-entity（保持闭环并插入 trim 点）

## 2026-03-19

### 增量验证：fillet/chamfer 扩展到更完整的错误码 contract
- 代码现状：
  - `selection.filletByPick` 已支持 `line+arc`
  - `selection.filletByPick` 已支持 `arc+arc`
  - `selection.filletByPick` / `selection.chamferByPick` 在 open polyline cross-entity 需要 extend 才能相交时，现统一返回 `NO_INTERSECTION`
- 本轮新增/确认的自动化覆盖：
  - `line+arc` 成功路径
  - `arc+arc` 成功路径
  - `arc+arc` 边界失败：
    - `CONCENTRIC`
    - `NO_INTERSECTION`
  - `polyline+line/chamfer` 需要 extend 才能相交：
    - `selection.filletByPick` -> `NO_INTERSECTION`
    - `selection.chamferByPick` -> `NO_INTERSECTION`

### 验证命令
```bash
cd deps/cadgamefusion
node --test --test-name-pattern='selection\\.fillet' tools/web_viewer/tests/editor_commands.test.js
ctest --test-dir build -R '^core_tests_constraints_basic$' --output-on-failure
```

### 结果
- `selection.fillet*` / `selection.chamfer*` 定向回归：PASS
- `core_tests_constraints_basic`：PASS

### 结论
- Fillet 当前已形成可回归支持矩阵：
  - `line+line`
  - `polyline+line`
  - `polyline corner`
  - `line+arc`
  - `arc+arc`

## 2026-02-13

### 变更摘要
- 新增命令：
  - `selection.fillet`（line-line + radius -> trim 两条线 + 插入 arc）
  - `selection.chamfer`（line-line + d1/d2 -> trim 两条线 + 插入 connector line）
- 新增工具：
  - `fillet`（pick first line -> pick second line）
  - `chamfer`（pick first line -> pick second line）
- CLI：
  - `fillet [r]`（alias: `f`）
  - `chamfer [d1] [d2]`（alias: `ch`/`cha`）
- Node tests：
  - 新增 fillet/chamfer undo/redo 覆盖
  - 新增 fillet/chamfer tool harness 覆盖（参数从 command input args 读取）

### 验证命令
1) Node tests：
```bash
cd deps/cadgamefusion
node --test tools/web_viewer/tests/editor_commands.test.js
```
- 结果：PASS（tests=54, fail=0）

2) Editor light gate：
```bash
cd deps/cadgamefusion
bash tools/ci_editor_light.sh
```
- 结果：PASS
- editor_roundtrip_smoke（gate, --no-convert）run_id：`20260213_123901_563_61a9`
- 产物：`build/editor_roundtrip/20260213_123901_563_61a9/summary.json`

### 增量验证：失败场景可解释性（2026-02-13）
- Node tests 新增：
  - fillet：parallel lines -> `NO_INTERSECTION`
  - fillet：radius too large -> `RADIUS_TOO_LARGE`
  - chamfer：parallel lines -> `NO_INTERSECTION`
  - chamfer：distance too large -> `DISTANCE_TOO_LARGE`

### 增量验证：Pick-based 语义（2026-02-13）
- 变更摘要：
  - 新增命令：
    - `selection.filletByPick`（line-line + radius + pick1/pick2：trim side 由 pick 决定）
    - `selection.chamferByPick`（line-line + d1/d2 + pick1/pick2：trim side 由 pick 决定）
  - 工具更新：
    - `fillet` tool：两次 pick 后触发 `selection.filletByPick`
    - `chamfer` tool：两次 pick 后触发 `selection.chamferByPick`
  - tests：新增 pick-based cross case 覆盖 + tool harness 更新

### 验证命令
1) Node tests：
```bash
cd deps/cadgamefusion
node --test tools/web_viewer/tests/editor_commands.test.js
```
- 结果：PASS（tests=58, fail=0）

2) Editor light gate（含 round-trip gate）：
```bash
cd deps/cadgamefusion
bash tools/ci_editor_light.sh
```
- 结果：PASS
- editor_roundtrip_smoke（gate, --no-convert）run_id：`20260213_140538_284_9819`
- 产物：`build/editor_roundtrip/20260213_140538_284_9819/summary.json`

### 增量验证：polyline segment（同一 polyline 相邻拐角）支持（2026-02-13）
- 变更摘要：
  - `selection.filletByPick`：支持 `firstId==secondId` 的 polyline 相邻拐角（输出 `polyline + arc`）
  - `selection.chamferByPick`：支持 `firstId==secondId` 的 polyline 相邻拐角（输出 `polyline + connector line`）
  - `fillet/chamfer` tool：允许 pick `line/polyline`，并允许同一 polyline 两次 pick（corner）
- Node tests：
  - `node --test tools/web_viewer/tests/editor_commands.test.js`
  - 结果：PASS（tests=63, fail=0）
- Editor light gate：
  - `bash tools/ci_editor_light.sh`
  - 结果：PASS
  - editor_roundtrip_smoke（gate, --no-convert）run_id：`20260213_144748_984_2636`
  - 产物：`build/editor_roundtrip/20260213_144748_984_2636/summary.json`

### 增量验证：Editor UI flow smoke（Playwright，覆盖 Fillet/Chamfer/Break）（2026-02-13）
目的：验证真实 UI 操作路径（点击/右键结束 polyline、工具切换、Undo/Redo、属性面板 Closed、Break Keep toggle）稳定可复现，并可作为门禁步骤（observe -> gate）。

```bash
cd deps/cadgamefusion
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --timeout-ms 25000
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --timeout-ms 25000
```

- observe run_id: `20260213_161809_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260213_161809_ui_flow/summary.json` (ok=true)
- gate run_id: `20260213_161851_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260213_161851_ui_flow/summary.json` (ok=true)

补充：CI-friendly 轻量门禁（包含 UI flow smoke gate）
```bash
cd deps/cadgamefusion
RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 bash tools/ci_editor_light.sh
```
- editor_roundtrip_smoke run_id: `20260213_162422_583_daf0`
  - summary_json: `build/editor_roundtrip/20260213_162422_583_daf0/summary.json`
- ui_flow_smoke run_id: `20260213_162422_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260213_162422_ui_flow/summary.json` (ok=true)

### 增量验证：UI flow smoke 增加 Arc radius grip（2026-02-13）
目的：覆盖 grips 交互最关键的“拖拽 + 单步 Undo/Redo”路径，避免 grips 提交拆成多步历史或 silent no-op。

```bash
cd deps/cadgamefusion
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --port 18095 --timeout-ms 25000
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port 18096 --timeout-ms 25000
RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 EDITOR_UI_FLOW_SMOKE_PORT=18097 bash tools/ci_editor_light.sh
```

- observe run_id: `20260213_184509_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260213_184509_ui_flow/summary.json` (ok=true)
- gate run_id: `20260213_184543_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260213_184543_ui_flow/summary.json` (ok=true)
- CI light gate ui_flow_smoke run_id: `20260213_184639_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260213_184639_ui_flow/summary.json` (ok=true)
