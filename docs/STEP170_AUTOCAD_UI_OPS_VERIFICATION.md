# STEP170 AutoCAD-like UI + 2D Operations Verification

本报告记录 STEP170 Web 主线与 Qt 关键同步的开发验证。

## 本次运行信息
- date_utc: `2026-02-06T13:56:27Z`
- workspace: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion`
- submodule_branch: `docs/vemcad-docs-closure`
- web_mode_switch:
  - preview(default): `tools/web_viewer/app.js -> preview_app.js`
  - editor: `tools/web_viewer/app.js -> ui/workspace.js` (triggered by `?mode=editor`)

## 开发实现覆盖
### 1) Web 主线（类 AutoCAD 工作区）
- UI 框架：
  - 顶部命令区、左侧工具栏、右侧属性/图层、底部状态栏、中心画布
  - 文件：`tools/web_viewer/index.html`, `tools/web_viewer/style.css`
- 模块拆分：
  - `state/`: `documentState`, `selectionState`, `snapState`, `viewState`
  - `commands/`: `command_bus`, `command_registry`
  - `tools/`: `select/line/polyline/circle/arc/text/move/copy/rotate/trim/extend/delete`
  - `ui/`: `workspace`, `canvas_view`, `toolbar`, `statusbar`, `property_panel`, `layer_panel`
  - `adapters/`: `document_json_adapter`
- 编辑能力（当前可运行）:
  - 绘制：Line/Polyline/Circle/Arc/Text
  - 修改：Select/Move/Copy/Rotate/Trim/Extend/Delete
  - 辅助：Ortho/Snap/Grid 开关，Undo/Redo，JSON 导入导出

### 2) Qt 关键同步
- Snap 语义扩展：`center/intersection/ortho`
- 涉及文件：
  - `editor/qt/include/snap/snap_settings.hpp`
  - `editor/qt/src/snap/snap_settings.cpp`
  - `editor/qt/include/panels/snap_panel.hpp`
  - `editor/qt/src/panels/snap_panel.cpp`
  - `editor/qt/src/snap_manager.hpp`
  - `editor/qt/src/snap_manager.cpp`
  - `editor/qt/src/canvas.cpp`
  - `editor/qt/src/mainwindow.cpp`（F7/F8 快捷切换）

## 开发自检
1. Python 脚本语法检查
```bash
python3 -m py_compile scripts/compare_autocad_pdf.py scripts/cad_input_sanity_check.py scripts/cad_regression_run.py
```
- 结果：PASS

2. STEP166 observe 回归（兼容性验证）
```bash
./scripts/cad_regression_run.py \
  --cases docs/STEP166_CAD_REGRESSION_CASES.json \
  --outdir build/cad_regression \
  --mode observe \
  --max-workers 2 \
  --report docs/STEP166_CAD_REGRESSION_VERIFICATION.md \
  --port-base 19300 \
  --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib
```
- run_id: `20260206_135520`
- totals: `pass=3 fail=2 skipped=0`
- failure_buckets:
  - `INPUT_INVALID=1`
  - `VIEWPORT_LAYOUT_MISSING=1`
  - 其余为 `0`
- gate_would_fail: `true`（原因：`VIEWPORT_LAYOUT_MISSING > 0`）

3. STEP166 gate 回归（门禁路径验证）
```bash
./scripts/cad_regression_run.py \
  --cases docs/STEP166_CAD_REGRESSION_CASES.json \
  --outdir build/cad_regression \
  --mode gate \
  --max-workers 2 \
  --report docs/STEP166_CAD_REGRESSION_VERIFICATION.md \
  --port-base 19400 \
  --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --baseline build/cad_regression/20260206_132201/summary.json
```
- run_id: `20260206_135552`
- process exit code: `2`（符合 gate 预期）
- totals: `pass=3 fail=2 skipped=0`
- baseline_compare: `compared_cases=3 improved_cases=3 degraded_cases=0`
- gate_fail_reasons: `VIEWPORT_LAYOUT_MISSING > 0`

## 指标汇总（observe: 20260206_135520）
| case | layout | filter | status | jaccard | jaccard_aligned | shift_dx | shift_dy |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| BTJ01239601522-03_layout2 | 布局2 | - | FAIL |  |  |  |  |
| ACAD_blank_2013_negative | 布局1 | - | FAIL |  |  |  |  |
| BTJ01239601522-03_layout1 | 布局1 | all | PASS | 0.005628 | 0.019746 | 32 | -36 |
| BTJ01239601522-03_layout1 | 布局1 | text | PASS | 0.005833 | 0.020475 | 32 | -36 |
| BTJ01239601522-03_layout1 | 布局1 | dimension | PASS | 0.005724 | 0.020167 | 29 | -36 |

## 失败归因
- `VIEWPORT_LAYOUT_MISSING`
  - case: `BTJ01239601522-03_layout2`
  - detail: `viewport_count=2, known_layouts=['布局1']`
- `INPUT_INVALID`
  - case: `ACAD_blank_2013_negative`
  - detail: `IMPORT_FAIL`

## 结论与下一步
- 结论：
  - Web 主线已形成“类 AutoCAD UI + 2D 核心命令”可运行骨架。
  - Qt 已同步关键 Snap 状态语义（center/intersection/ortho）。
  - STEP166 observe/gate 路径保持可运行，说明默认 preview 回归链路未被编辑模式改造破坏。
- 下一步（Sprint 1）:
  - 强化 `trim/extend` 对 polyline 段与边界选择策略。
  - 增加 Web 端命令级自动化测试（命令输入 -> 文档快照断言）。
  - 引入每周固定 observe 报告追加节奏，并建立首份 STEP170 gate 基线。

## 增量开发验证（2026-02-07）
### Web 编辑器能力增强
- `Trim/Extend`：
  - `Trim`（polyline 更像 CAD）：
    - 点击的 segment 上求交点，并删除“包含 pick 点”的一侧（不再只是改一个顶点）
    - 当 pick 点位于同一 segment 的两条边界交点之间时，可拆分为两条 polyline
  - `Extend`（endpoint-only）：
    - 对 polyline 仅延伸起点/终点到边界交点，并要求交点在 endpoint 外侧（避免误“缩短”）
  - 支持多边界（`boundaryIds[]`）与连续操作（边界保持，重复点击目标；`Esc` 退出）
  - 文件：`tools/web_viewer/commands/command_registry.js`, `tools/web_viewer/tools/trim_tool.js`, `tools/web_viewer/tools/extend_tool.js`, `tools/web_viewer/ui/canvas_view.js`
- 性能基线（命中测试/框选不再全量扫描）：
  - 增加轻量空间分桶索引（cell grid），`pickEntityAt` 与 `selection.box` 优先走候选集
  - 文件：`tools/web_viewer/state/spatialIndex.js`, `tools/web_viewer/state/documentState.js`, `tools/web_viewer/tools/tool_context.js`, `tools/web_viewer/commands/command_registry.js`

### Web 命令级自动化测试（Node 内建 test runner）
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
```
- 结果：PASS（7 tests）

### Web 编辑器增强（CADGF import/export + Snap 可视化 + Grips）
- CADGF Document JSON 适配（对齐 `schemas/document.schema.json`）：
  - 文件：`tools/web_viewer/adapters/cadgf_document_adapter.js`
  - 支持：导入 `plm_preview` 产物 `document.json` 并编辑后导出回 CADGF 格式（按钮 `Export CADGF` 或命令 `exportcadgf`）
  - 不支持类型：导入为 `unsupported` 并原样 passthrough，保证 round-trip 不丢失
  - 额外校验：对真实样例导出结果已通过 `schemas/document.schema.json` 验证（必要时会剔除不合法的 `null` 数字字段，例如 `line_weight=null`）
- OSnap 命中可视化：
  - `resolveSnappedPoint()` 返回 `kind=END/MID/CEN/INT/GRID/NONE`，画布 overlay 绘制提示
  - 文件：`tools/web_viewer/tools/tool_context.js`, `tools/web_viewer/tools/geometry.js`, `tools/web_viewer/ui/canvas_view.js`
- OSnap 性能：
  - 当空间索引可用时，`resolveSnappedPoint()` 只扫描光标附近候选实体（避免大图全量扫描）
  - 文件：`tools/web_viewer/tools/tool_context.js`, `tools/web_viewer/state/documentState.js`, `tools/web_viewer/state/spatialIndex.js`
- Grips（MVP）：
  - Select 工具下可拖拽端点/顶点/中心/文本位置，提交时以单条 `selection.propertyPatch` 进入 Undo/Redo
  - 文件：`tools/web_viewer/tools/select_tool.js`
  
### Editor 快捷加载（URL 参数）
- 支持：`?mode=editor&cadgf=<path>` 直接加载同源可访问的 CADGF `document.json`，并自动 Fit View
- 文件：`tools/web_viewer/ui/workspace.js`

### STEP166 observe 回归（真实环境，允许绑定端口）
```bash
./scripts/cad_regression_run.py \
  --cases docs/STEP166_CAD_REGRESSION_CASES.json \
  --outdir build/cad_regression \
  --mode observe \
  --max-workers 2 \
  --report docs/STEP166_CAD_REGRESSION_VERIFICATION.md \
  --port-base 19600 \
  --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib
```
- run_id: `20260207_011326`
- totals: `pass=3 fail=2 skipped=0`
- failure_buckets: `INPUT_INVALID=1`, `VIEWPORT_LAYOUT_MISSING=1`

### STEP166 observe 回归（2026-02-07 新增一次）
```bash
./scripts/cad_regression_run.py \
  --cases docs/STEP166_CAD_REGRESSION_CASES.json \
  --outdir build/cad_regression \
  --mode observe \
  --max-workers 2 \
  --report docs/STEP166_CAD_REGRESSION_VERIFICATION.md \
  --port-base 19700 \
  --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib
```
- run_id: `20260207_015512`
- totals: `pass=3 fail=2 skipped=0`
- failure_buckets: `INPUT_INVALID=1`, `VIEWPORT_LAYOUT_MISSING=1`

### STEP166 observe 回归（2026-02-07 新增一次）
```bash
./scripts/cad_regression_run.py \
  --cases docs/STEP166_CAD_REGRESSION_CASES.json \
  --outdir build/cad_regression \
  --mode observe \
  --max-workers 2 \
  --report docs/STEP166_CAD_REGRESSION_VERIFICATION.md \
  --port-base 19800 \
  --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib
```
- run_id: `20260207_033343`
- totals: `pass=3 fail=2 skipped=0`
- failure_buckets: `INPUT_INVALID=1`, `VIEWPORT_LAYOUT_MISSING=1`

### 备注：沙盒限制下的 compare 失败
- 运行环境若禁止 socket bind（无法启动 `http.server`），`compare_autocad_pdf.py` 会报 `HTTP server failed to start`，并被 `cad_regression_run.py` 归因到 `RENDER_DRIFT`（实际是环境限制，不代表渲染退化）。

## 增量开发验证（2026-02-07：Grips v2 + Fit View）
### Web 编辑器：Arc grips + Polyline 顶点增删
- Arc grips：
  - Select 下可拖拽 `start/end` grip 更新 `startAngle/endAngle`（保留 `center/radius/cw`）
  - 文件：`tools/web_viewer/tools/select_tool.js`, `tools/web_viewer/ui/canvas_view.js`
- Polyline grips：
  - midpoint grip：点击即插入新顶点并进入拖拽（Undo/Redo 单步）
  - vertex grip：双击删除顶点（保留最小顶点数：open>=2, closed>=3）
  - 文件：`tools/web_viewer/tools/select_tool.js`, `tools/web_viewer/ui/canvas_view.js`

### Web 编辑器：Fit View（Zoom Extents）
- 顶部按钮：`Fit`
- 命令：`ze` / `fit` / `extents`
- 文件：`tools/web_viewer/index.html`, `tools/web_viewer/ui/toolbar.js`, `tools/web_viewer/ui/workspace.js`

### Web 命令级自动化测试（Node）
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
```
- 结果：PASS（9 tests）

### STEP166 observe 回归（兼容性验证，新增一次）
```bash
./scripts/cad_regression_run.py \
  --cases docs/STEP166_CAD_REGRESSION_CASES.json \
  --outdir build/cad_regression \
  --mode observe \
  --max-workers 2 \
  --report docs/STEP166_CAD_REGRESSION_VERIFICATION.md \
  --port-base 19900 \
  --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib
```
- run_id: `20260207_051042`
- totals: `pass=3 fail=2 skipped=0`
- failure_buckets: `INPUT_INVALID=1`, `VIEWPORT_LAYOUT_MISSING=1`

## Editor Round-Trip Smoke（真实样例编辑闭环）
目标：把“能编辑”落到可重复的护栏：导入真实 CADGF `document.json` -> 命令级编辑 -> 导出 CADGF -> schema 校验 -> `plm_convert` smoke（json importer）。

### 本次运行信息（2026-02-07）
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 5
```
- run_id: `20260207_134710`
- outdir: `build/editor_roundtrip/20260207_134710`
- summary:
  - `build/editor_roundtrip/20260207_134710/summary.json`
  - `build/editor_roundtrip/20260207_134710/summary.md`
- totals: `pass=5 fail=0 skipped=0`

| case | status | entities | unsupported | warnings | schema | convert |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 20260207_051042__btj01239601522_03_layout1_1 | PASS | 370 | 4 | 4 | OK | OK |
| 20260207_051042__btj01239601522_03_layout2_2 | PASS | 370 | 4 | 4 | OK | OK |
| 20260207_033343__btj01239601522_03_layout1_1 | PASS | 370 | 4 | 4 | OK | OK |
| 20260207_033343__btj01239601522_03_layout2_2 | PASS | 370 | 4 | 4 | OK | OK |
| 20260207_015512__btj01239601522_03_layout1_1 | PASS | 370 | 4 | 4 | OK | OK |

## 增量开发验证（2026-02-07：Arc radius grip + Grip hover + Round-trip gate mode）
### Web 编辑器：Arc radius grip
- 行为：
  - radius grip 位于 arc sweep 的 midAngle（避免与 start/end grips 冲突）
  - 拖拽更新 `radius = distance(center, point)`（clamp `>= 0.001`），保持 `center/startAngle/endAngle/cw` 不变
- 文件：`tools/web_viewer/tools/select_tool.js`, `tools/web_viewer/ui/canvas_view.js`

### Web 编辑器：Grip hover 高亮
- 仅对 primary entity 的 grips 做 hover 命中（通过 overlay 绘制 ring）
- 文件：`tools/web_viewer/tools/select_tool.js`, `tools/web_viewer/ui/canvas_view.js`

### Web 命令级自动化测试（Node）
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
```
- 结果：PASS（10 tests）

### STEP166 observe 回归（兼容性验证，新增一次）
```bash
./scripts/cad_regression_run.py \
  --cases docs/STEP166_CAD_REGRESSION_CASES.json \
  --outdir build/cad_regression \
  --mode observe \
  --max-workers 2 \
  --report docs/STEP166_CAD_REGRESSION_VERIFICATION.md \
  --port-base 20000 \
  --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib
```
- run_id: `20260207_070632`
- totals: `pass=3 fail=2 skipped=0`

### Editor Round-Trip Smoke：observe + gate
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 5
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode gate --limit 5
```
- observe run_id: `20260207_150605`（pass=5 fail=0 skipped=0）
- gate run_id: `20260207_150616`（pass=5 fail=0 skipped=0）

### 本地 CI 接入（可选门禁）
- 环境变量：
  - `RUN_EDITOR_SMOKE=1`（observe，不阻塞）
  - `RUN_EDITOR_SMOKE_GATE=1`（gate，仅在 `--strict-exit` 时阻塞）
  - `EDITOR_SMOKE_LIMIT=5`（默认）
  - `EDITOR_SMOKE_CASES=<path>`（可选）
- 示例：
```bash
RUN_EDITOR_SMOKE=1 bash tools/local_ci.sh --build-dir build_vcpkg --quick
RUN_EDITOR_SMOKE_GATE=1 bash tools/local_ci.sh --build-dir build_vcpkg --quick --strict-exit
```

## 增量开发验证（2026-02-07：OSnap 象限点 + Snap priority + Round-trip 稳定性）
### Web 编辑器：OSnap 更像 CAD（QUA + Arc END）
- 新增 snap 类型：
  - `QUA`：circle/arc 象限点
  - `END`：arc 端点（按 `startAngle/endAngle` 计算）
- Snap 命中策略：
  - 距离优先；在小范围候选内按优先级：`END > INT > MID > QUA > CEN > GRID`
  - 目标：降低象限点/中点等把端点“抢走”的概率
- 交互：
  - 新增命令：`quad` / `quadrant`（单独切换象限点 snap）
  - `snap` 开关会同时切换 `endpoint/midpoint/quadrant/center/intersection`
- 文件：
  - `tools/web_viewer/state/snapState.js`
  - `tools/web_viewer/tools/geometry.js`
  - `tools/web_viewer/tools/tool_context.js`
  - `tools/web_viewer/ui/canvas_view.js`
  - `tools/web_viewer/ui/statusbar.js`
  - `tools/web_viewer/ui/workspace.js`

### Web 命令级自动化测试（Node）
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
```
- 结果：PASS（12 tests）

### Editor Round-Trip Smoke：新增 round-trip 稳定性检查（observe + gate）
- 新增检查：`exported_document.json -> re-import -> exported_document_roundtrip.json` 必须稳定（忽略 `metadata.modified_at`）
- 输出增强：每个 case 写入 `failure_codes[]` 与 `roundtrip{ok,hash,...}`
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 5
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode gate --limit 5
```
- observe run_id: `20260207_164646`（pass=5 fail=0 skipped=0）
- gate run_id: `20260207_164655`（pass=5 fail=0 skipped=0）

### STEP166 observe 回归（兼容性验证，新增一次）
```bash
./scripts/cad_regression_run.py \
  --cases docs/STEP166_CAD_REGRESSION_CASES.json \
  --outdir build/cad_regression \
  --mode observe \
  --max-workers 2 \
  --report docs/STEP166_CAD_REGRESSION_VERIFICATION.md \
  --port-base 20100 \
  --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib
```
- run_id: `20260207_084748`
- totals: `pass=3 fail=2 skipped=0`
- failure_buckets: `INPUT_INVALID=1`, `VIEWPORT_LAYOUT_MISSING=1`

## 增量开发验证（2026-02-07：OSnap Tangent/Nearest + Snap Panel + Local CI gate 默认启用）
### Web 编辑器：OSnap 扩展（TAN/NEA + arc midpoint）
- 新增 snap 类型：
  - `TAN`：circle/arc 切点（需要 reference point；当前实现：Line/Polyline 的上一个点作为 `tangentFrom`）
  - `NEA`：nearest point（线段/多段线/圆/弧最近点）
  - arc midpoint：当 `midpoint=On` 时，arc 也会产出 `MID`（midAngle）
- UI：
  - 右侧新增 `Snap` panel（逐项开关 + `gridSize/snapRadiusPx`）
  - 新增命令：`tan/tangent`、`nea/nearest`（逐项切换）
- Snap 命中策略更新：
  - 距离优先；在小范围候选内按优先级：`END > INT > MID > TAN > QUA > CEN > NEA > GRID`

### Web 命令级自动化测试（Node）
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
```
- 结果：PASS（13 tests）

### Editor Round-Trip Smoke：run_id 唯一性修复 + failure buckets 输出
- 修复：run_id 增加 `ms + nonce`，避免同秒并发/连续运行互相覆盖
- summary.json 新增：
  - `failure_buckets`（对齐 STEP166 bucket 命名）
  - `gate_decision{would_fail,fail_reasons[]}`
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 3
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode gate --limit 3
```
- observe run_id: `20260207_192257_231_e707`（pass=3 fail=0 skipped=0）
- gate run_id: `20260207_192302_827_f42c`（pass=3 fail=0 skipped=0）

### 本地 CI：--strict-exit 默认启用 editor smoke gate
- 变更：
  - `--strict-exit` 且未显式开启/关闭时，默认 `RUN_EDITOR_SMOKE_GATE=1`
  - 可用 `SKIP_EDITOR_SMOKE=1` 作为 escape hatch
  - Summary JSON 追加：`editorSmokeRunId` + `editorSmoke*Count`（failure buckets）

## 增量开发验证（2026-02-07：Editor Smoke Gate + STEP166 observe 复跑）
### Web 命令级自动化测试（Node）
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
```
- 结果：PASS（13 tests）

### Editor Round-Trip Smoke（gate）
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode gate --limit 5
```
- gate run_id: `20260207_223158_332_1ae7`（pass=5 fail=0 skipped=0）
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260207_223158_332_1ae7/summary.json`

### STEP166 observe 回归（复跑）
```bash
./scripts/cad_regression_run.py --mode observe
```
- run_id: `20260207_143225`
- totals: `pass=3 fail=2 skipped=0`
- gate_would_fail: `True`（原因：`VIEWPORT_LAYOUT_MISSING > 0`）
- failures_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260207_143225/failures.json`

### STEP166：修正 viewport 期望语义（按 layout 统计）后复跑（observe + gate）
- 变更：
  - `expected.has_viewport` 视为 case 级语义：`space=paper + layout` 时按 `dxf.viewport.*.layout` 统计
  - `docs/STEP166_CAD_REGRESSION_CASES.json`：`BTJ01239601522-03_layout2` 设置 `has_viewport=false`（该 DXF 只有布局1 viewport）
  - `scripts/cad_input_sanity_check.py`：新增 `meta.viewport_count_all` / `meta.viewport_layouts`，并按布局计算 `meta.viewport_count`
```bash
./scripts/cad_regression_run.py --mode observe
./scripts/cad_regression_run.py --mode gate
```
- observe run_id: `20260207_144649`（gate_would_fail=False）
- gate run_id: `20260207_144751`（gate_would_fail=False）

### Local CI 严格模式（包含 Editor Smoke Gate）
```bash
bash tools/local_ci.sh --strict-exit
```
- 结果：PASS
- editor_smoke run_id: `20260207_225017_173_86c3`（pass=5 fail=0 skipped=0）
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`

## 增量开发验证（2026-02-11：一键门禁脚本复跑通过）
### One-button Gate（Editor + STEP166 baseline gate）
```bash
EDITOR_SMOKE_LIMIT=1 CAD_ATTEMPTS=1 bash tools/editor_gate.sh
```
- 结果：PASS
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- editor_smoke_run_id: `20260212_004129_341_36fc`（pass=1 fail=0 skipped=0）
- step166_run_id: `20260211_164131`
- gate summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### STEP166 gate 结果（来自 one-button gate）
```bash
./scripts/cad_regression_run.py --mode gate --baseline docs/baselines/STEP166_baseline_summary.json --max-workers 2 --port-base 27472
```
- run_id: `20260211_164131`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets:
  - `INPUT_INVALID=0`
  - `IMPORT_FAIL=0`
  - `VIEWPORT_LAYOUT_MISSING=0`
  - `RENDER_DRIFT=0`
  - `TEXT_METRIC_DRIFT=0`
- baseline_compare: `compared_cases=6 degraded_cases=0 improved_cases=3`
- gate_would_fail: `False`

### 说明
- 该次复跑验证了 `tools/editor_gate.sh` 的可复现链路：
  - Node 命令级测试
  - editor round-trip smoke（gate）
  - STEP166 baseline gate
- 当前已满足 Level A 稳定化的“可一键验证”要求，可作为后续 STEP171/STEP172 的持续验收入口。

## Incremental Verification (2026-02-11T16:48:26Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/1`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_004750_144_48aa`
- summary_json: `build/editor_roundtrip/20260212_004750_144_48aa/summary.json`
- totals: `pass=1 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260211_164751`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260211_164751`
- summary_json: `build/cad_regression/20260211_164751/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-13 Editor UI flow smoke)
### Editor UI flow smoke (observe)
```bash
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --port 18116
```
- run_id: `20260213_200145_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260213_200145_ui_flow/summary.json`
- ok: `true`
- flow_keys:
  - `line`, `fillet_polyline`, `chamfer_polyline`, `break_keep`, `arc_radius_grip`, `offset_line`, `join`, `text_edit`,
    `trim_line`, `extend_line`, `layer_lock_grip`, `toggles_and_snap`

### Editor UI flow smoke (gate)
```bash
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port 18117
```
- run_id: `20260213_200229_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260213_200229_ui_flow/summary.json`
- ok: `true`

### CI light gate (editor round-trip + UI flow gate)
```bash
RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 EDITOR_UI_FLOW_SMOKE_PORT=18118 bash tools/ci_editor_light.sh
```
- editor_roundtrip run_id: `20260213_200323_790_efa8`
- editor_roundtrip summary_json: `build/editor_roundtrip/20260213_200323_790_efa8/summary.json`
- editor_ui_flow_smoke run_id: `20260213_200323_ui_flow`
- editor_ui_flow_smoke summary_json: `build/editor_ui_flow_smoke/20260213_200323_ui_flow/summary.json`
- CI result: `PASS`

## Incremental Verification (2026-02-13T08:19:04Z editor UI flow smoke)
目标：把 Editor 交互（绘制/修改/UndoRedo/属性面板）验证从一次性人工验证，变成可复现的门禁步骤（observe -> gate）。

### UI flow smoke (observe)
```bash
cd deps/cadgamefusion
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --port 18091 --timeout-ms 25000
```
- run_id: `20260213_161809_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260213_161809_ui_flow/summary.json`
- ok: `true` (exit_code=0)
- screenshot: `build/editor_ui_flow_smoke/20260213_161809_ui_flow/editor_ui_flow.png`

### UI flow smoke (gate)
```bash
cd deps/cadgamefusion
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port 18092 --timeout-ms 25000
```
- run_id: `20260213_161851_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260213_161851_ui_flow/summary.json`
- ok: `true` (exit_code=0)
- screenshot: `build/editor_ui_flow_smoke/20260213_161851_ui_flow/editor_ui_flow.png`

### CI editor light gate（包含 UI flow smoke gate）
```bash
cd deps/cadgamefusion
RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 EDITOR_UI_FLOW_SMOKE_PORT=18093 bash tools/ci_editor_light.sh
```
- editor_roundtrip_smoke run_id: `20260213_162422_583_daf0`
  - summary_json: `build/editor_roundtrip/20260213_162422_583_daf0/summary.json`
- ui_flow_smoke run_id: `20260213_162422_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260213_162422_ui_flow/summary.json` (ok=true)

## Incremental Verification (2026-02-13T10:46:00Z editor UI flow smoke v2: arc radius grip)
本次更新：UI flow smoke 增加 `arc radius grip` 拖拽 + Undo/Redo 断言，覆盖 grips 提交必须为单条 `selection.propertyPatch`（单步回退）。

### UI flow smoke (observe)
```bash
cd deps/cadgamefusion
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --port 18095 --timeout-ms 25000
```
- run_id: `20260213_184509_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260213_184509_ui_flow/summary.json`
- ok: `true` (exit_code=0)

### UI flow smoke (gate)
```bash
cd deps/cadgamefusion
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port 18096 --timeout-ms 25000
```
- run_id: `20260213_184543_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260213_184543_ui_flow/summary.json`
- ok: `true` (exit_code=0)

### CI editor light gate（UI flow smoke gate 默认 timeout=15000）
```bash
cd deps/cadgamefusion
RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 EDITOR_UI_FLOW_SMOKE_PORT=18097 bash tools/ci_editor_light.sh
```
- editor_roundtrip_smoke run_id: `20260213_184639_593_1db8`
  - summary_json: `build/editor_roundtrip/20260213_184639_593_1db8/summary.json`
- ui_flow_smoke run_id: `20260213_184639_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260213_184639_ui_flow/summary.json` (ok=true)

## Incremental Verification (2026-02-13T10:57:27Z editor UI flow smoke v3: offset + join)
本次更新：UI flow smoke 增加 `offset(line)` 与 `join(two lines)`，覆盖 command input wiring + 多选（Shift）+ Undo/Redo。

### UI flow smoke (observe)
```bash
cd deps/cadgamefusion
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --port 18098 --timeout-ms 25000
```
- run_id: `20260213_185537_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260213_185537_ui_flow/summary.json`
- ok: `true` (exit_code=0)

### UI flow smoke (gate)
```bash
cd deps/cadgamefusion
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port 18099 --timeout-ms 25000
```
- run_id: `20260213_185623_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260213_185623_ui_flow/summary.json`
- ok: `true` (exit_code=0)

### CI editor light gate（UI flow smoke gate 默认 timeout=15000）
```bash
cd deps/cadgamefusion
RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 EDITOR_UI_FLOW_SMOKE_PORT=18100 bash tools/ci_editor_light.sh
```
- editor_roundtrip_smoke run_id: `20260213_185708_896_e121`
  - summary_json: `build/editor_roundtrip/20260213_185708_896_e121/summary.json`
- ui_flow_smoke run_id: `20260213_185709_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260213_185709_ui_flow/summary.json` (ok=true)

## Incremental Verification (2026-02-13T11:02:34Z editor UI flow smoke v4: text edit)
本次更新：UI flow smoke 增加 Text 创建（命令输入 override）+ 属性面板修改 Text 字段 + Undo/Redo。

### UI flow smoke (observe)
```bash
cd deps/cadgamefusion
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --port 18101 --timeout-ms 25000
```
- run_id: `20260213_190059_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260213_190059_ui_flow/summary.json`
- ok: `true` (exit_code=0)

### UI flow smoke (gate)
```bash
cd deps/cadgamefusion
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port 18102 --timeout-ms 25000
```
- run_id: `20260213_190140_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260213_190140_ui_flow/summary.json`
- ok: `true` (exit_code=0)

### CI editor light gate（UI flow smoke gate 默认 timeout=15000）
```bash
cd deps/cadgamefusion
RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 EDITOR_UI_FLOW_SMOKE_PORT=18103 bash tools/ci_editor_light.sh
```
- editor_roundtrip_smoke run_id: `20260213_190216_879_6935`
  - summary_json: `build/editor_roundtrip/20260213_190216_879_6935/summary.json`
- ui_flow_smoke run_id: `20260213_190217_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260213_190217_ui_flow/summary.json` (ok=true)

## Incremental Verification (2026-02-13T12:56:47Z editor UI flow smoke v5: move/copy/rotate + box select + layer visibility + snap kinds)
本次更新：UI flow smoke 扩展覆盖 Move/Copy/Rotate、框选语义、图层可见性以及 MID/CEN/INT 捕捉命中断言，用于 Level A 稳定化门禁增量。

### UI flow smoke (observe)
```bash
cd deps/cadgamefusion
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --port 18133
```
- run_id: `20260213_205647_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260213_205647_ui_flow/summary.json`
- ok: `true` (exit_code=0)
- flow_keys added:
  - `move_line`, `copy_line`, `rotate_line`, `box_select`, `layer_visibility`, `snap_kinds_extra`

### UI flow smoke (gate)
```bash
cd deps/cadgamefusion
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port 18134
```
- run_id: `20260213_205736_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260213_205736_ui_flow/summary.json`
- ok: `true` (exit_code=0)

### CI editor light gate（command tests + round-trip gate + UI flow gate）
```bash
cd deps/cadgamefusion
RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 EDITOR_UI_FLOW_SMOKE_PORT=18135 bash tools/ci_editor_light.sh
```
- node tests: `pass=65 fail=0`
- editor_roundtrip_smoke run_id: `20260213_210557_622_3047`
  - summary_json: `build/editor_roundtrip/20260213_210557_622_3047/summary.json`
- ui_flow_smoke run_id: `20260213_210557_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260213_210557_ui_flow/summary.json` (ok=true)
- CI result: `PASS`

## Incremental Verification (2026-02-13T13:41:19Z editor UI flow smoke v6: snap kinds QUA/NEA + end-click snap disable)
本次更新：`snap_kinds_extra` 扩展覆盖 `QUA/NEA`，并对所有 snap-kind 相关的 line 创建增加“第二次 click 前临时关闭 snap”策略，避免 `Line: end point is identical to start point` 造成 UI flow flake。

### UI flow smoke (gate)
```bash
cd deps/cadgamefusion
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port 18145
```
- run_id: `20260213_214119_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260213_214119_ui_flow/summary.json`
- ok: `true` (exit_code=0)
- snap_kinds_extra keys: `mid/cen/int/qua/nea` (tan covered by Node tests)

### CI editor light gate（command tests + round-trip gate + UI flow gate）
```bash
cd deps/cadgamefusion
RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 EDITOR_UI_FLOW_SMOKE_PORT=18146 bash tools/ci_editor_light.sh
```
- node tests: `pass=65 fail=0`
- editor_roundtrip_smoke run_id: `20260213_214212_075_a3b6`
  - summary_json: `build/editor_roundtrip/20260213_214212_075_a3b6/summary.json`
- ui_flow_smoke run_id: `20260213_214212_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260213_214212_ui_flow/summary.json` (ok=true)
- CI result: `PASS`

## Incremental Verification (2026-02-13T15:09:38Z editor UI flow smoke v7: trim/extend polyline + layer visibility box select)
本次更新：把 STEP182 的两个 P1 UI-flow 扩展落到门禁级覆盖：
- Trim：polyline 中段 + 两条 boundary -> split 为两条 polyline
- Extend：polyline endpoint -> 延伸到 boundary，并用 END snap 几何断言验证延伸结果
- Layer visibility：hidden layer 不参与 crossing box；显示后 crossing box 能选中两条线

### UI flow smoke (gate)
```bash
cd deps/cadgamefusion
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port 18163
```
- run_id: `20260213_230843_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260213_230843_ui_flow/summary.json`
- ok: `true`
- key results:
  - `trim_polyline_split.summary`: `2 selected (polyline, polyline)`
  - `extend_polyline_endpoint.snappedStart.x == boundaryX`: `true`
  - `layer_visibility.hiddenBox`: `1 selected (line)`
  - `layer_visibility.shownBox`: `2 selected (line, line)`

### CI editor light gate（command tests + round-trip gate + UI flow gate）
```bash
cd deps/cadgamefusion
RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 EDITOR_UI_FLOW_SMOKE_PORT=18164 bash tools/ci_editor_light.sh
```
- editor_roundtrip_smoke run_id: `20260213_231140_660_d8ca`
  - summary_json: `build/editor_roundtrip/20260213_231140_660_d8ca/summary.json`
- ui_flow_smoke run_id: `20260213_231140_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260213_231140_ui_flow/summary.json` (ok=true)
- CI result: `PASS`

## Incremental Verification (2026-02-11T16:49:56Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/1`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_004923_627_3ba1`
- summary_json: `build/editor_roundtrip/20260212_004923_627_3ba1/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260211_164925`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260211_164925`
- summary_json: `build/cad_regression/20260211_164925/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-11T17:05:28Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/1`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_010456_733_b2d3`
- summary_json: `build/editor_roundtrip/20260212_010456_733_b2d3/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260211_170458`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260211_170458`
- summary_json: `build/cad_regression/20260211_170458/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=1`

## Incremental Verification (2026-02-14T08:20:03Z editor ui-flow tighten)
### Editor UI flow smoke
- mode: `gate`
- run_id: `20260214_161932_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_161932_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- note: `trim_polyline_continue_after_failure` upgraded from entityCount-only to geometry assertions (endpoints pinned to base/boundary).
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_161932_ui_flow/editor_ui_flow.png`

## Incremental Verification (2026-02-14T08:25:23Z editor ui-flow tighten #2)
### Editor UI flow smoke
- mode: `gate`
- run_id: `20260214_162452_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_162452_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- note: `trim_polyline_split` upgraded from entityCount-only to geometry assertions (both split results endpoints pinned to base/boundary; y drift checked).
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_162452_ui_flow/editor_ui_flow.png`

## Incremental Verification (2026-02-14T08:29:56Z editor ui-flow tighten #3)
### Editor UI flow smoke
- mode: `gate`
- run_id: `20260214_162956_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_162956_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- note: `trim_continue_after_failure` / `extend_continue_after_failure` setup no longer depends on debug entityCount (reduces coupling to debug state).
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_162956_ui_flow/editor_ui_flow.png`

## Incremental Verification (2026-02-14T08:39:19Z editor ui-flow tighten #4)
### Editor UI flow smoke
- mode: `gate`
- run_id: `20260214_163919_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_163919_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- note: `trim_polyline_continue_after_failure` undo/redo upgraded from entityCount-only to geometry rollback assertions (undo restores original polyline endpoints; redo re-splits with pinned endpoints).
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_163919_ui_flow/editor_ui_flow.png`

## Incremental Verification (2026-02-14T09:39:48Z editor ui-flow tighten #5)
### Editor UI flow smoke
- mode: `gate`
- run_id: `20260214_173948_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_173948_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- note: `trim_polyline_split` undo/redo upgraded from entityCount-only to geometry rollback assertions (undo picks Q row to validate endpoints; redo box-select validates re-split pinned endpoints).
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_173948_ui_flow/editor_ui_flow.png`

## Incremental Verification (2026-02-14T09:42:19Z editor round-trip expand)
### Editor round-trip smoke
- cases: `local/editor_roundtrip_smoke_cases.json` (generated from latest STEP166 previews; limit=20 requested, discovered=2)
- observe run_id: `20260214_174211_968_7252` totals=`pass=2 fail=0 skipped=0`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260214_174211_968_7252/summary.json`
- gate run_id: `20260214_174219_413_d8af` totals=`pass=2 fail=0 skipped=0` gate_would_fail=`False`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260214_174219_413_d8af/summary.json`

## Incremental Verification (2026-02-14T09:45:00Z step166+roundtrip refresh)
### STEP166 observe
- run_id: `20260214_094332` gate_would_fail=`False`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260214_094332/summary.json`

### Editor round-trip smoke (from STEP166 run `20260214_094332`)
- cases: `local/editor_roundtrip_smoke_cases.json` (limit=20 requested, discovered=2)
- gate run_id: `20260214_174500_475_fca7` totals=`pass=2 fail=0 skipped=0` gate_would_fail=`False`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260214_174500_475_fca7/summary.json`

## Incremental Verification (2026-02-14T09:53:46Z editor round-trip 20x from DXF previews)
### Editor round-trip smoke
- cases: `local/editor_roundtrip_smoke_cases.json` (generated by `tools/generate_editor_roundtrip_previews.py`; DXF-only previews, no PDF required)
- preview_run_id: `20260214_095014` previews_dir: `build/editor_roundtrip_previews/20260214_095014`
- gate run_id: `20260214_175346_308_2474` totals=`pass=20 fail=0 skipped=0` gate_would_fail=`False`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260214_175346_308_2474/summary.json`

## Incremental Verification (2026-02-11T17:14:59Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/1`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_011428_599_d1bf`
- summary_json: `build/editor_roundtrip/20260212_011428_599_d1bf/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260211_171430`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260211_171430`
- summary_json: `build/cad_regression/20260211_171430/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=3`

## Incremental Verification (2026-02-12T02:32:06Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/1`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_103134_069_861e`
- summary_json: `build/editor_roundtrip/20260212_103134_069_861e/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_023136`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_023136`
- summary_json: `build/cad_regression/20260212_023136/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=5`

## Incremental Verification (2026-02-12T03:11:47Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/1`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_111118_628_1e9d`
- summary_json: `build/editor_roundtrip/20260212_111118_628_1e9d/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_031120`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_031120`
- summary_json: `build/cad_regression/20260212_031120/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-12T03:21:34Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/1`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_112105_543_bad8`
- summary_json: `build/editor_roundtrip/20260212_112105_543_bad8/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_032107`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_032107`
- summary_json: `build/cad_regression/20260212_032107/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-12T03:51:13Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/1`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_115043_017_1b4f`
- summary_json: `build/editor_roundtrip/20260212_115043_017_1b4f/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_035044`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_035044`
- summary_json: `build/cad_regression/20260212_035044/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-12T04:01:59Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/1`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_120128_625_6da7`
- summary_json: `build/editor_roundtrip/20260212_120128_625_6da7/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_040130`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_040130`
- summary_json: `build/cad_regression/20260212_040130/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-12T04:06:31Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/1`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_120559_512_2ed0`
- summary_json: `build/editor_roundtrip/20260212_120559_512_2ed0/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_040601`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_040601`
- summary_json: `build/cad_regression/20260212_040601/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-12T05:14:03Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_131334_988_3532`
- summary_json: `build/editor_roundtrip/20260212_131334_988_3532/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_051336`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_051336`
- summary_json: `build/cad_regression/20260212_051336/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-12T05:43:07Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_134230_105_429e`
- summary_json: `build/editor_roundtrip/20260212_134230_105_429e/summary.json`
- totals: `pass=8 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_054236`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_054236`
- summary_json: `build/cad_regression/20260212_054236/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=3`

## Incremental Verification (2026-02-12T05:54:08Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_135336_100_d454`
- summary_json: `build/editor_roundtrip/20260212_135336_100_d454/summary.json`
- totals: `pass=8 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_055339`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_055339`
- summary_json: `build/cad_regression/20260212_055339/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-12T05:55:49Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_135505_770_81a7`
- summary_json: `build/editor_roundtrip/20260212_135505_770_81a7/summary.json`
- totals: `pass=8 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_055508`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_055508`
- summary_json: `build/cad_regression/20260212_055508/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=4`

## Incremental Verification (2026-02-12T05:56:53Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_135621_939_6866`
- summary_json: `build/editor_roundtrip/20260212_135621_939_6866/summary.json`
- totals: `pass=8 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_055624`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_055624`
- summary_json: `build/cad_regression/20260212_055624/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-12T05:57:57Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_135725_324_0baf`
- summary_json: `build/editor_roundtrip/20260212_135725_324_0baf/summary.json`
- totals: `pass=8 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_055728`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_055728`
- summary_json: `build/cad_regression/20260212_055728/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=1`

## Incremental Verification (2026-02-12T06:00:40Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_140010_143_9994`
- summary_json: `build/editor_roundtrip/20260212_140010_143_9994/summary.json`
- totals: `pass=8 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_060012`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_060012`
- summary_json: `build/cad_regression/20260212_060012/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-12T06:03:49Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_140318_597_c9ec`
- summary_json: `build/editor_roundtrip/20260212_140318_597_c9ec/summary.json`
- totals: `pass=8 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_060321`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_060321`
- summary_json: `build/cad_regression/20260212_060321/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-12T06:04:55Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_140425_660_39b1`
- summary_json: `build/editor_roundtrip/20260212_140425_660_39b1/summary.json`
- totals: `pass=8 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_060428`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_060428`
- summary_json: `build/cad_regression/20260212_060428/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-12T06:05:59Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_140527_241_8154`
- summary_json: `build/editor_roundtrip/20260212_140527_241_8154/summary.json`
- totals: `pass=8 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_060529`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_060529`
- summary_json: `build/cad_regression/20260212_060529/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-12T06:07:00Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_140630_268_8425`
- summary_json: `build/editor_roundtrip/20260212_140630_268_8425/summary.json`
- totals: `pass=8 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_060632`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_060632`
- summary_json: `build/cad_regression/20260212_060632/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-12T08:33:14Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_163244_238_bc02`
- summary_json: `build/editor_roundtrip/20260212_163244_238_bc02/summary.json`
- totals: `pass=8 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_083246`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_083246`
- summary_json: `build/cad_regression/20260212_083246/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-12T08:43:55Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_164322_757_8b2a`
- summary_json: `build/editor_roundtrip/20260212_164322_757_8b2a/summary.json`
- totals: `pass=8 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_084325`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_084325`
- summary_json: `build/cad_regression/20260212_084325/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-12T08:55:03Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_165429_858_3acc`
- summary_json: `build/editor_roundtrip/20260212_165429_858_3acc/summary.json`
- totals: `pass=8 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_085432`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_085432`
- summary_json: `build/cad_regression/20260212_085432/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=1`

## Incremental Verification (2026-02-12T09:25:20Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260212_172432_588_2976`
- summary_json: `build/editor_roundtrip/20260212_172432_588_2976/summary.json`
- totals: `pass=8 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: `20260212_092440`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260212_092440`
- summary_json: `build/cad_regression/20260212_092440/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-13T16:05:00Z editor smoke + UI flow gate)
### Editor UI flow smoke (gate)
```bash
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port 18173 --timeout-ms 25000
```
- run_id: `20260214_000500_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260214_000500_ui_flow/summary.json` (ok=true)
- note: `snap_kinds_extra` 新增 TAN（tangent）落点不变量断言（end-on-circle + dot(radiusVec, lineDir) ~= 0）

### Editor round-trip smoke (observe)
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 5 --outdir build/editor_roundtrip
```
- run_id: `20260214_000500_374_f979`
- summary_json: `build/editor_roundtrip/20260214_000500_374_f979/summary.json`
- totals: `pass=5 fail=0 skipped=0`

## Incremental Verification (2026-02-13T17:09:00Z CI light gate default UI-flow gate)
### CI light gate (default)
```bash
bash tools/ci_editor_light.sh
```
- editor_roundtrip run_id: `20260214_010851_756_1388`
  - summary_json: `build/editor_roundtrip/20260214_010851_756_1388/summary.json` (pass=1 fail=0)
- editor_ui_flow_smoke run_id: `20260214_010851_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260214_010851_ui_flow/summary.json` (ok=true)

## Incremental Verification (2026-02-13T17:13:20Z CI light gate rerun)
### CI light gate (default)
```bash
EDITOR_UI_FLOW_SMOKE_TIMEOUT_MS=25000 bash tools/ci_editor_light.sh
```
- editor_roundtrip run_id: `20260214_011320_341_41f1`
  - summary_json: `build/editor_roundtrip/20260214_011320_341_41f1/summary.json` (pass=1 fail=0)
- editor_ui_flow_smoke run_id: `20260214_011320_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260214_011320_ui_flow/summary.json` (ok=true)

## Incremental Verification (2026-02-13T17:21:36Z UI flow gate expansion + CI light gate)
### Editor UI flow smoke (gate)
```bash
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port 18243 --timeout-ms 25000
```
- run_id: `20260214_012135_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260214_012135_ui_flow/summary.json` (ok=true)
- note:
  - URL uses `debug=1` to expose overlays for assertions.
  - Added `grip_hover_vs_snap`: require overlays `gripHover` and `snapHint(kind=END)` to coexist.
  - Expanded `extend_polyline_endpoint` to extend 2 polylines continuously.

### CI light gate (default)
```bash
EDITOR_UI_FLOW_SMOKE_PORT=18244 bash tools/ci_editor_light.sh
```
- editor_roundtrip run_id: `20260214_012136_432_66d5`
  - summary_json: `build/editor_roundtrip/20260214_012136_432_66d5/summary.json` (pass=1 fail=0)
- editor_ui_flow_smoke run_id: `20260214_012136_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260214_012136_ui_flow/summary.json` (ok=true)

## Incremental Verification (2026-02-13T17:31:09Z UI flow gate stabilization)
### Editor UI flow smoke (gate)
```bash
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port 18263 --timeout-ms 25000
```
- run_id: `20260214_013109_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260214_013109_ui_flow/summary.json` (ok=true)
- note:
  - `extend_line` now verifies results by selecting targets and checking `end.x ~= boundaryX`, then undo/redo last.
  - `trim_polyline_split` now splits 2 polylines continuously and asserts entityCount deltas via `window.__cadDebug.getState()`.

## Incremental Verification (2026-02-13T17:35:40Z Extend(polyline) undo/redo + CI light auto-port)
### Editor UI flow smoke (gate)
```bash
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port 18273 --timeout-ms 25000
```
- run_id: `20260214_013537_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260214_013537_ui_flow/summary.json` (ok=true)
- note:
  - `extend_polyline_endpoint` now asserts undo/redo of the last extend by reading polyline endpoint x via `window.__cadDebug.getEntity()`.

### CI light gate (default)
```bash
bash tools/ci_editor_light.sh
```
- editor_roundtrip run_id: `20260214_013539_761_67a3`
  - summary_json: `build/editor_roundtrip/20260214_013539_761_67a3/summary.json` (pass=1 fail=0)
- editor_ui_flow_smoke run_id: `20260214_013540_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260214_013540_ui_flow/summary.json` (ok=true)

## Incremental Verification (2026-02-13T17:39:49Z Extend(polyline) undo/redo re-run)
### Editor UI flow smoke (gate)
```bash
# Suggestion: pick a free port to avoid collisions.
PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()
PY
)"
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port "$PORT" --timeout-ms 25000
```
- run_id: `20260214_013949_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260214_013949_ui_flow/summary.json` (ok=true)
- note:
  - Confirms `extend_polyline_endpoint` undo/redo invariant remains stable (`poly1` stays extended; `poly2` toggles on undo/redo).

## Incremental Verification (2026-02-13T17:40:50Z CI light default gate)
```bash
bash tools/ci_editor_light.sh
```
- editor_roundtrip run_id: `20260214_014050_448_c137`
  - summary_json: `build/editor_roundtrip/20260214_014050_448_c137/summary.json` (pass=1 fail=0)
- editor_ui_flow_smoke run_id: `20260214_014050_ui_flow`
  - summary_json: `build/editor_ui_flow_smoke/20260214_014050_ui_flow/summary.json` (ok=true)

## Incremental Verification (2026-02-13T18:11:23Z Weekly validation + gate snapshot appended to STEP176)
### Weekly validation (includes UI-flow gate + STEP166 observe + perf)
```bash
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion
STEP176_APPEND_REPORT=1 STEP176_REPORT=docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md \\
  EDITOR_UI_FLOW_MODE=gate CAD_MODE=observe RUN_GATE=1 \\
  bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `build/editor_weekly_validation_summary.json`
  - ui_flow_smoke: `PASS` run_id=`20260214_020942_ui_flow`
  - editor_roundtrip (observe): run_id=`20260214_021012_170_0c91`
  - step166 (observe): run_id=`20260213_181012` (gate_would_fail=false)
- gate_snapshot (one-button gate summary):
  - gate_summary_json: `build/editor_gate_summary.json`
  - editor_roundtrip (gate): run_id=`20260214_021048_575_91cd`
  - step166 (gate): run_id=`20260213_181049` (gate_would_fail=false)
- appended_report: `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md`

## Plan (Level A stabilization)
- See: `docs/STEP183_LEVELA_STABILIZATION_AND_GATE_PLAN.md`

## Incremental Verification (2026-02-14T10:52:56Z One-button gate includes UI-flow by default)
### One-button gate (now includes UI-flow gate)
```bash
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion
bash tools/editor_gate.sh
```
- gate_summary_json: `build/editor_gate_summary.json`
  - gate_decision.exit_code: `0`
  - ui_flow_smoke: `ok=true mode=gate` run_id=`20260214_105121_ui_flow`
  - editor_roundtrip (gate): run_id=`20260214_105154_079_3d6a`
  - step166 (gate): run_id=`20260214_025155` (gate_would_fail=false)

## Incremental Verification (2026-02-14T11:00:34Z UI-flow: trim continues after failure)
### Editor UI flow smoke (gate)
```bash
PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()
PY
)"
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port "$PORT" --timeout-ms 25000
```
- run_id: `20260214_110034_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260214_110034_ui_flow/summary.json` (ok=true)
- note:
  - Adds `trim_continue_after_failure`: after a no-intersection attempt, the boundary stays active and the next target trims successfully.

## Incremental Verification (2026-02-14T11:12:02Z UI-flow: extend continues after failure)
### Editor UI flow smoke (gate)
```bash
PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()
PY
)"
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port "$PORT" --timeout-ms 25000
```
- run_id: `20260214_111202_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260214_111202_ui_flow/summary.json` (ok=true)
- note:
  - Adds `extend_continue_after_failure`: after a no-intersection attempt, the boundary stays active and the next target extends successfully.

## Incremental Verification (2026-02-14T13:20:28Z UI-flow: failure-continue has undo/redo)
### Editor UI flow smoke (gate)
```bash
PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()
PY
)"
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port "$PORT" --timeout-ms 25000
```
- run_id: `20260214_132028_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260214_132028_ui_flow/summary.json` (ok=true)
- note:
  - `trim_continue_after_failure` and `extend_continue_after_failure` now assert undo/redo of the last successful operation using debug entity geometry (no extra entities; history stays clean).

## Incremental Verification (2026-02-14T16:05:25Z UI-flow: extend(polyline) continues after failure)
### Editor UI flow smoke (gate)
```bash
PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()
PY
)"
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port "$PORT" --timeout-ms 25000
```
- run_id: `20260214_160525_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260214_160525_ui_flow/summary.json` (ok=true)
- note:
  - Adds `extend_polyline_continue_after_failure`: boundary stays active after a no-intersection polyline click; next polyline extends successfully, and undo/redo toggles only the last success.

## Incremental Verification (2026-02-14T16:08:39Z UI-flow: trim(polyline) continues after failure)
### Editor UI flow smoke (gate)
```bash
PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()
PY
)"
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port "$PORT" --timeout-ms 25000
```
- run_id: `20260214_160839_ui_flow`
- summary_json: `build/editor_ui_flow_smoke/20260214_160839_ui_flow/summary.json` (ok=true)
- note:
  - Adds `trim_polyline_continue_after_failure`: boundaries stay active after a no-intersection polyline click; next polyline splits successfully, and undo/redo toggles entityCount for the last split.

## Incremental Verification (2026-02-13T18:11:23.337157+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260214_021012_170_0c91`
- ui_flow_smoke: `PASS` run_id=`20260214_020942_ui_flow`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_020942_ui_flow/summary.json`
- step166: run_id=`20260213_181012` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260213_181012/summary.json`
- perf: run_id=`20260213_181048`
- gate_summary_json: `build/editor_gate_summary.json`

## Incremental Verification (2026-02-14T04:06:31Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260214_120530_392_affd`
- summary_json: `build/editor_roundtrip/20260214_120530_392_affd/summary.json`
- totals: `pass=2 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260214_120459_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_120459_ui_flow/summary.json`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_120459_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260214_040532`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260214_040532`
- summary_json: `build/cad_regression/20260214_040532/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-14T04:08:36.035196+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260214_120802_576_96ae`
- ui_flow_smoke: `PASS` run_id=`20260214_120733_ui_flow`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_120733_ui_flow/summary.json`
- step166: run_id=`20260214_040803` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260214_040803/summary.json`
- perf: run_id=`20260214_040835`

## Incremental Verification (2026-02-14T07:59:06Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260214_155757_364_6931`
- summary_json: `build/editor_roundtrip/20260214_155757_364_6931/summary.json`
- totals: `pass=2 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260214_155723_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_155723_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260214_155723_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260214_075759`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260214_075759`
- summary_json: `build/cad_regression/20260214_075759/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=1`

## Incremental Verification (2026-02-15T14:10:17Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260215_220820_342_a28f`
- summary_json: `build/editor_roundtrip/20260215_220820_342_a28f/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260215_220722_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260215_220722_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260215_220722_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260215_140933`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260215_140933`
- summary_json: `build/cad_regression/20260215_140933/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-15T14:20:58.974640+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260215_221902_127_840a`
- ui_flow_smoke: `PASS` run_id=`20260215_221821_ui_flow`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260215_221821_ui_flow/summary.json`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166: run_id=`20260215_142015` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260215_142015/summary.json`
- perf: run_id=`20260215_142057`

## Incremental Verification (2026-02-15T15:09:02.700706+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260215_230708_226_7b50`
- ui_flow_smoke: `PASS` run_id=`20260215_230626_ui_flow`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260215_230626_ui_flow/summary.json`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166: run_id=`20260215_150818` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260215_150818/summary.json`
- perf: run_id=`20260215_150902`

## Incremental Verification (2026-02-15T15:50:15.818464+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260215_234823_751_97fe`
- ui_flow_smoke: `PASS` run_id=`20260215_234735_ui_flow`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260215_234735_ui_flow/summary.json`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166: run_id=`20260215_154934` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260215_154934/summary.json`
- perf: run_id=`20260215_155014`

## Incremental Verification (2026-02-15T16:29:41Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260216_002758_874_df51`
- summary_json: `build/editor_roundtrip/20260216_002758_874_df51/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260216_002721_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_002721_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_002721_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260215_162902`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260215_162902`
- summary_json: `build/cad_regression/20260215_162902/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-15T16:53:19.085168+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260216_005132_661_0a36`
- ui_flow_smoke: `PASS` run_id=`20260216_005059_ui_flow`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_005059_ui_flow/summary.json`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166: run_id=`20260215_165240` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260215_165240/summary.json`
- perf: run_id=`20260215_165318`

## Incremental Verification (2026-02-16T01:09:14Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260216_090731_593_499e`
- summary_json: `build/editor_roundtrip/20260216_090731_593_499e/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260216_090658_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_090658_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_090658_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260216_010837`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_010837`
- summary_json: `build/cad_regression/20260216_010837/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=2`

## Incremental Verification (2026-02-16T01:17:07.508942+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260216_091530_662_5157`
- ui_flow_smoke: `PASS` run_id=`20260216_091500_ui_flow`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_091500_ui_flow/summary.json`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166: run_id=`20260216_011633` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_011633/summary.json`
- perf: run_id=`20260216_011706`

## Incremental Verification (2026-02-16T02:07:31Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260216_100542_549_e1de`
- summary_json: `build/editor_roundtrip/20260216_100542_549_e1de/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260216_100508_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_100508_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_100508_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260216_020654`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_020654`
- summary_json: `build/cad_regression/20260216_020654/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=1`

## Incremental Verification (2026-02-16T02:10:50.866330+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260216_100905_284_c717`
- ui_flow_smoke: `PASS` run_id=`20260216_100830_ui_flow`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_100830_ui_flow/summary.json`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166: run_id=`20260216_021015` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_021015/summary.json`
- perf: run_id=`20260216_021050`

## Incremental Verification (2026-02-16T02:32:47.326594+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260216_103102_232_2573`
- ui_flow_smoke: `PASS` run_id=`20260216_103021_ui_flow`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_103021_ui_flow/summary.json`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166: run_id=`20260216_023212` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_023212/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=5` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260216_023246`

## Incremental Verification (2026-02-16T02:38:54Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260216_103708_880_c599`
- summary_json: `build/editor_roundtrip/20260216_103708_880_c599/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260216_103636_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_103636_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_103636_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260216_023816`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_023816`
- summary_json: `build/cad_regression/20260216_023816/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0`

## Incremental Verification (2026-02-16T02:43:30.154269+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260216_104146_889_24f8`
- ui_flow_smoke: `PASS` run_id=`20260216_104116_ui_flow`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_104116_ui_flow/summary.json`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166: run_id=`20260216_024255` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_024255/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260216_024329`

## Incremental Verification (2026-02-16T02:38:54Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260216_103708_880_c599`
- summary_json: `build/editor_roundtrip/20260216_103708_880_c599/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260216_103636_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_103636_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_103636_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260216_023816`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_023816`
- summary_json: `build/cad_regression/20260216_023816/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-16T04:33:12Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260216_123133_834_367a`
- summary_json: `build/editor_roundtrip/20260216_123133_834_367a/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260216_123052_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_123052_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_123052_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260216_043238`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_043238`
- summary_json: `build/cad_regression/20260216_043238/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-16T04:37:11.013434+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260216_123529_371_4941`
- ui_flow_smoke: `PASS` run_id=`20260216_123458_ui_flow`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_123458_ui_flow/summary.json`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166: run_id=`20260216_043637` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_043637/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260216_043710`

## Incremental Verification (2026-02-16T04:41:47Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260216_124011_667_8657`
- summary_json: `build/editor_roundtrip/20260216_124011_667_8657/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260216_123942_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_123942_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_123942_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260216_044115`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_044115`
- summary_json: `build/cad_regression/20260216_044115/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=6` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-16T12:44:08 local ui-flow gate hardening)
```bash
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --timeout-ms 25000
```
- run_id: `20260216_124408_ui_flow`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_124408_ui_flow/summary.json`
- result: `ok=True` `exit_code=0` `flow_step=snap_kinds_extra`
- offset geometry assertion (new):
  - base line -> offset line distance: `5.0000 / 5.0000` (start/end), command distance=`5`
  - post-offset topology: `entityCount=2`; undo/redo keeps expected geometry
- join geometry assertion (new):
  - pre-join: 2 selected lines
  - post-join: merged polyline `points=3`, shared endpoint continuity check passed, topology `entityCount=1`
  - undo/redo topology rollback check passed: `2 -> 1`

## Incremental Verification (2026-02-16T12:49 local ui-flow stability soak x5)
```bash
for i in 1 2 3 4 5; do
  bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --timeout-ms 25000
done
```
- pass runs:
  - `build/editor_ui_flow_smoke/20260216_124803_ui_flow/summary.json`
  - `build/editor_ui_flow_smoke/20260216_124831_ui_flow/summary.json`
  - `build/editor_ui_flow_smoke/20260216_124857_ui_flow/summary.json`
  - `build/editor_ui_flow_smoke/20260216_124923_ui_flow/summary.json`
  - `build/editor_ui_flow_smoke/20260216_124949_ui_flow/summary.json`
- result: `5/5 PASS`, no random failure observed on this commit.

## Incremental Verification (2026-02-16T04:47:44Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260216_124610_605_c3a3`
- summary_json: `build/editor_roundtrip/20260216_124610_605_c3a3/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260216_124541_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_124541_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_124541_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260216_044712`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_044712`
- summary_json: `build/cad_regression/20260216_044712/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-16T11:16:53.585132+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260216_191513_514_8570`
- ui_flow_smoke: `PASS` run_id=`20260216_191437_ui_flow`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_191437_ui_flow/summary.json`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- step166: run_id=`20260216_111616` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_111616/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260216_111651`

## Incremental Verification (2026-02-16T19:07 local ui-flow geometry hardening v2)
```bash
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --timeout-ms 25000
```
- run_id: `20260216_190742_ui_flow`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_190742_ui_flow/summary.json`
- result: `ok=True` `exit_code=0`
- move/copy/rotate assertions upgraded:
  - move: rigid translation + length invariance + undo/redo geometry rollback
  - copy: copied line geometry translation consistency + undo/redo topology rollback
  - rotate: center fixed + length invariance + near-90deg angle delta + undo/redo geometry rollback

## Incremental Verification (2026-02-16T19:13 local_ci strict + roundtrip gate soak)
```bash
RUN_EDITOR_SMOKE_GATE=1 EDITOR_SMOKE_GATE_LIMIT=20 EDITOR_SMOKE_GATE_RUNS=2 \
  bash tools/local_ci.sh --quick --offline --strict-exit
bash tools/check_local_summary.sh --offline-allowed
```
- local_ci_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- smoke gate counters: `target=2` `run_count=2` `pass=2` `fail=0`
- roundtrip runs:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260216_191335_665_915b/summary.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260216_191341_957_72e1/summary.json`

## Incremental Verification (2026-02-16T11:20:16Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260216_191840_451_da67`
- summary_json: `build/editor_roundtrip/20260216_191840_451_da67/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260216_191806_ui_flow`
- ok: `True` exit_code=`0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_191806_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_191806_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260216_111942`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260216_111942`
- summary_json: `build/cad_regression/20260216_111942/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=2` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-16T22:49 local_ci strict + UI-flow gate soak)
```bash
SKIP_EDITOR_SMOKE=1 RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 EDITOR_UI_FLOW_SMOKE_GATE_RUNS=2 RUN_EDITOR_GATE=0 \
  bash tools/local_ci.sh --quick --offline --clean-exports --strict-exit
bash tools/check_local_summary.sh --offline-allowed
```
- local_ci_summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- ui-flow smoke gate counters: `target=2` `run_count=2` `pass=2` `fail=0`
- ui-flow runs:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_224736_ui_flow_r1/summary.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260216_224810_ui_flow_r2/summary.json`
- summary guardrails confirmed:
  - `runEditorUiFlowSmokeGate=true`
  - `editorUiFlowSmokeGateRunsTarget=2`
  - `editorUiFlowSmokeGateRunCount=2`
  - `editorUiFlowSmokeGateFailCount=0`

## Incremental Verification (2026-02-17T03:47 weekly validation + UI-flow gate runs)
```bash
RUN_EDITOR_UI_FLOW_SMOKE=1 EDITOR_UI_FLOW_MODE=gate EDITOR_UI_FLOW_SMOKE_GATE_RUNS=2 \
  EDITOR_SMOKE_LIMIT=3 RUN_REAL_SCENE_PERF=0 PERF_PICK_SAMPLES=800 PERF_BOX_SAMPLES=250 PERF_DRAG_SAMPLES=60 \
  STEP170_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
  bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- ui_flow gate counters: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow runs:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_114510_ui_flow/summary.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_114610_ui_flow/summary.json`
- roundtrip observe: run_id=`20260217_114700_483_5afd` summary=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260217_114700_483_5afd/summary.json`
- step166 observe: run_id=`20260217_034703` summary=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260217_034703/summary.json`

## Incremental Verification (2026-02-17T05:20 editor_gate + UI-flow gate soak)
```bash
RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 EDITOR_UI_FLOW_SMOKE_GATE_RUNS=2 EDITOR_SMOKE_LIMIT=3 \
  EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
  bash tools/editor_gate.sh
```
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- ui_flow gate counters: `target=2` `run_count=2` `pass=2` `fail=0`
- ui_flow runs:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_131804_ui_flow/summary.json`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_131856_ui_flow/summary.json`
- roundtrip gate: run_id=`20260217_131947_715_1f83` summary=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260217_131947_715_1f83/summary.json`
- step166 gate: run_id=`20260217_051950` summary=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260217_051950/summary.json`

## Incremental Verification (2026-02-17T05:20:28Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260217_131947_715_1f83`
- summary_json: `build/editor_roundtrip/20260217_131947_715_1f83/summary.json`
- totals: `pass=3 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260217_131856_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_131856_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_131856_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260217_051950`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260217_051950`
- summary_json: `build/cad_regression/20260217_051950/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-17T11:56:50Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260217_195612_320_7c3b`
- summary_json: `build/editor_roundtrip/20260217_195612_320_7c3b/summary.json`
- totals: `pass=1 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260217_195600_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_195600_ui_flow/summary.json`
- failure_attribution: first_failed_run=`20260217_195543_ui_flow` step=`` selection=`` status=`[OPEN] http://127.0.0.1:59635/tools/web_viewer/index.html?mode=editor&seed=0&debug=1`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_195600_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260217_115613`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260217_115613`
- summary_json: `build/cad_regression/20260217_115613/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-17T12:09:40Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260217_200856_812_95b0`
- summary_json: `build/editor_roundtrip/20260217_200856_812_95b0/summary.json`
- totals: `pass=1 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260217_200806_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_200806_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_200806_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260217_120857`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260217_120857`
- summary_json: `build/cad_regression/20260217_120857/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-17T12:18:13Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260217_201727_207_1739`
- summary_json: `build/editor_roundtrip/20260217_201727_207_1739/summary.json`
- totals: `pass=1 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260217_201621_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=1` `run_count=1` `pass=1` `fail=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_201621_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_201621_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260217_121728`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260217_121728`
- summary_json: `build/cad_regression/20260217_121728/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=2` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-17T12:35:28.710627+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260217_203447_206_9950`
- ui_flow_smoke: `PASS` run_id=`20260217_203337_ui_flow`
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=1` `fail=0`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260217_203337_ui_flow/summary.json`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- ui_flow_failure_injection: `PASS` run_id=`20260217_203435_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:60532/tools/web_viewer/index.html?mode=editor&seed=0&debug=1`
- step166: run_id=`20260217_123448` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260217_123448/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=5` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260217_123528`

## Incremental Verification (2026-02-18T11:35:12Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_injectcheck.json`

### Editor round-trip gate result
- run_id: `20260218_193426_987_2cd6`
- summary_json: `build/editor_roundtrip/20260218_193426_987_2cd6/summary.json`
- totals: `pass=1 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260218_193322_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=1` `run_count=1` `pass=1` `fail=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260218_193322_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260218_193322_ui_flow/editor_ui_flow.png`

### Editor UI flow failure injection
- status: `PASS` run_id=`20260218_193417_ui_flow`
- code: `UI_FLOW_FLOW_JSON_INVALID` exit_code=`2` detail=`[OPEN] http://127.0.0.1:49301/tools/web_viewer/index.html?mode=editor&seed=0&debug=1`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260218_193417_ui_flow/summary.json`

### STEP166 baseline gate result
- run_id: `20260218_113429`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260218_113429`
- summary_json: `build/cad_regression/20260218_113429/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-18T13:18:35.469763+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260218_211643_128_7894` status=`PASS` pass=`8` fail=`0` skipped=`0`
- ui_flow_smoke: `PASS` run_id=`20260218_211531_ui_flow`
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=1` `fail=0`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260218_211531_ui_flow/summary.json`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- ui_flow_failure_injection: `PASS` run_id=`20260218_211630_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:61975/tools/web_viewer/index.html?mode=editor&seed=0&debug=1`
- step166: run_id=`20260218_131754` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260218_131754/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260218_131834`

## Incremental Verification (2026-02-18T13:47:01Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_roundtrip_attr.json`

### Editor round-trip gate result
- run_id: `20260218_214621_112_3eb3`
- status: `PASS`
- summary_json: `build/editor_roundtrip/20260218_214621_112_3eb3/summary.json`
- totals: `pass=3 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260218_214510_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=1` `run_count=1` `pass=1` `fail=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260218_214510_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260218_214510_ui_flow/editor_ui_flow.png`

### Editor UI flow failure injection
- status: `PASS` run_id=`20260218_214608_ui_flow`
- code: `UI_FLOW_FLOW_JSON_INVALID` exit_code=`2` detail=`[OPEN] http://127.0.0.1:53172/tools/web_viewer/index.html?mode=editor&seed=0&debug=1`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260218_214608_ui_flow/summary.json`

### STEP166 baseline gate result
- run_id: `20260218_134623`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260218_134623`
- summary_json: `build/cad_regression/20260218_134623/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-19T04:22:52Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/1`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260219_122217_184_e579`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260219_122217_184_e579/summary.json`
- totals: `pass=1 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor round-trip failure injection
- status: `PASS` run_id=`20260219_122217_726_c8a5`
- code: `CONVERT_FAIL` exit_code=`2` detail=`case=btj01230901522_00_v2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260219_122217_726_c8a5/summary.json`

### STEP166 baseline gate result
- run_id: `20260219_042218`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260219_042218`
- summary_json: `build/cad_regression/20260219_042218/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-19T04:22:53.333312+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260219_122029_007_8a7e` status=`PASS` pass=`8` fail=`0` skipped=`0`
- step166: run_id=`20260219_042141` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260219_042141/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=5` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260219_042217`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_editor_smoke: run_id=`20260219_122217_184_e579` status=`PASS` pass=`1` fail=`0` skipped=`0`
- gate_editor_smoke_failure_injection: `PASS` run_id=`20260219_122217_726_c8a5` code=`CONVERT_FAIL` detail=`case=btj01230901522_00_v2`

## Incremental Verification (2026-02-19T13:25:56Z ci_editor_light cross-env behavior)
```bash
bash tools/ci_editor_light.sh
CODEX_HOME=/tmp/codex_missing_$$ bash tools/ci_editor_light.sh
```
- default env (wrapper present): `PASS`
  - roundtrip summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260219_212417_324_3a19/summary.json`
  - ui_flow summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260219_212417_ui_flow/summary.json`
- missing wrapper env: `PASS`（默认 UI-flow 自动 skip）
  - roundtrip summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260219_212458_651_b207/summary.json`
  - skip reason: `missing Playwright wrapper at /tmp/codex_missing_11128/skills/playwright/scripts/playwright_cli.sh`

## Incremental Verification (2026-02-19T13:31:56Z nightly-lite gate + CI summary)
```bash
RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_STEP166_GATE=0 EDITOR_SMOKE_NO_CONVERT=1 \
EDITOR_SMOKE_LIMIT=1 EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_nightly_local.json HISTORY_DIR=build/editor_gate_history/nightly_local \
bash tools/editor_gate.sh

python3 tools/write_ci_artifact_summary.py --title \"cadgamefusion-editor-nightly\" --mode observe \
  --gate-summary build/editor_gate_summary_nightly_local.json \
  --roundtrip-summary build/editor_roundtrip/20260219_213135_124_beb9/summary.json \
  --out build/ci_editor_nightly_summary_local.md
```
- editor_gate (lightweight): `PASS`
  - gate summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_nightly_local.json`
  - roundtrip run_id: `20260219_213135_124_beb9`
  - step166: `skipped`（`RUN_STEP166_GATE=0`）
- ci artifact summary md:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_editor_nightly_summary_local.md`

## Incremental Verification (2026-02-19T13:47:32Z nightly observe + gate drill)
```bash
# Observe drill (job green even if gate fails)
RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_STEP166_GATE=0 EDITOR_SMOKE_NO_CONVERT=1 \
EDITOR_SMOKE_LIMIT=3 EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_nightly_observe_local.json \
HISTORY_DIR=build/editor_gate_history/nightly_local \
bash tools/editor_gate.sh

# Gate drill (same input, gate semantics)
RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 \
RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 RUN_STEP166_GATE=0 EDITOR_SMOKE_NO_CONVERT=1 \
EDITOR_SMOKE_LIMIT=3 EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_nightly_gate_local.json \
HISTORY_DIR=build/editor_gate_history/nightly_local \
bash tools/editor_gate.sh
```
- observe drill: `PASS` (exit_code=`0`)
  - gate summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_nightly_observe_local.json`
  - roundtrip run_id: `20260219_214722_608_2141`
  - markdown summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_editor_nightly_observe_local.md`
- gate drill: `PASS` (exit_code=`0`)
  - gate summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_nightly_gate_local.json`
  - roundtrip run_id: `20260219_214731_718_07b6`
  - markdown summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_editor_nightly_gate_local.md`
- GitHub dispatch precondition check:
  - command: `gh workflow run cadgamefusion-editor-nightly.yml -R zensgit/VemCAD -f mode=observe -f smoke_limit=3`
  - current result: `HTTP 404 workflow not found on default branch`（workflow 文件尚未进入远端默认分支）
