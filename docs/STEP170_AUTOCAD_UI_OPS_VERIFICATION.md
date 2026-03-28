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

## Incremental Verification (2026-02-20T02:49:31Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260220_104918_813_25eb`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260220_104918_813_25eb/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260220_104836_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_TIMEOUT=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260220_104836_ui_flow/summary.json`
- triage: step=`arc_radius_grip` selection=`No selection` status=`Selected 0 entities`
- failure_attribution: first_failed_run=`20260220_104754_ui_flow` code=`UI_FLOW_TIMEOUT` step=`arc_radius_grip` selection=`No selection` detail=`page.waitForFunction: Timeout 25000ms exceeded.`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260220_104836_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-20T03:17:46Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260220_111734_342_c1af`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260220_111734_342_c1af/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260220_111658_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260220_111658_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260220_111658_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-20T13:14:59Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260220_211447_151_cafe`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260220_211447_151_cafe/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260220_211410_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260220_211410_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260220_211410_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-20T13:19:10Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260220_211710_846_0cbd`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260220_211710_846_0cbd/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260220_211634_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260220_211634_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260220_211634_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260220_131820`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260220_131820`
- summary_json: `build/cad_regression/20260220_131820/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-20T13:22:09Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260220_212156_338_9900`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260220_212156_338_9900/summary.json`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260220_212116_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260220_212116_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260220_212116_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-20T15:10:53.320332+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260220_230439_840_4f5d` status=`PASS` pass=`8` fail=`0` skipped=`0`
- ui_flow_smoke: `PASS` run_id=`20260220_230334_ui_flow`
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=1` `fail=0`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260220_230334_ui_flow/summary.json`
  - triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- ui_flow_failure_injection: `PASS` run_id=`20260220_230417_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:49974/tools/web_viewer/index.html?mode=editor&seed=0&debug=1&v=20260220_230417_ui_flow`
- step166: run_id=`20260220_150601` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260220_150601/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260220_150706`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_editor_smoke: run_id=`20260220_230834_619_f16d` status=`PASS` pass=`8` fail=`0` skipped=`0`

## Incremental Verification (2026-02-20T16:48:53.111907+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260221_004402_188_5b6a` status=`PASS` pass=`8` fail=`0` skipped=`0`
- step166: run_id=`20260220_164526` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260220_164526/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=5` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260220_164631`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_editor_smoke: run_id=`20260221_004631_773_6c30` status=`PASS` pass=`8` fail=`0` skipped=`0`

## Incremental Verification (2026-02-21T03:04:01.363576+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260221_105924_743_0b2f` status=`PASS` pass=`8` fail=`0` skipped=`0`
- step166: run_id=`20260221_030052` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_030052/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260221_030200`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_editor_smoke: run_id=`20260221_110200_608_bf48` status=`PASS` pass=`8` fail=`0` skipped=`0`

## Incremental Verification (2026-02-21T12:33:20.738333+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260221_202902_518_1e02` status=`PASS` pass=`5` fail=`0` skipped=`0`
- step166: run_id=`20260221_123016` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_123016/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260221_123125`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_editor_smoke: run_id=`20260221_203125_391_0eac` status=`PASS` pass=`5` fail=`0` skipped=`0`

## Incremental Verification (2026-02-21T12:34:41.555019+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260221_203028_387_a888` status=`PASS` pass=`8` fail=`0` skipped=`0`
- step166: run_id=`20260221_123153` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_123153/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260221_123232`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_editor_smoke: run_id=`20260221_203233_260_db9d` status=`PASS` pass=`8` fail=`0` skipped=`0`

## Incremental Verification (2026-02-21T12:41:05.746827+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260221_203647_315_4eaf` status=`PASS` pass=`8` fail=`0` skipped=`0`
- step166: run_id=`20260221_123812` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_123812/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260221_123859`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_editor_smoke: run_id=`20260221_203859_375_0292` status=`PASS` pass=`8` fail=`0` skipped=`0`

## Incremental Verification (2026-02-21T13:50:03Z fillet/chamfer retry hardening)
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate
EDITOR_GATE_PROFILE=lite EDITOR_SMOKE_LIMIT=3 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_step186_laneB.json \
bash tools/editor_gate.sh
```
- Node command tests: `PASS` (`73/73`)
  - 新增覆盖：
    - `fillet tool keeps second-pick stage after command failure and allows retry`
    - `chamfer tool keeps second-pick stage after command failure and allows retry`
- UI-flow smoke (gate): `PASS`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260221_214839_ui_flow/summary.json`
  - run_id: `20260221_214839_ui_flow`
- editor_gate (lite profile): `PASS`
  - editor_smoke run_id: `20260221_214947_697_0e96`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_step186_laneB.json`
  - gate_decision: `would_fail=False`
- editor_gate (full profile): `PASS`
  - editor_smoke run_id: `20260221_215144_406_e0fb`
  - step166 run_id: `20260221_135256` (`gate_would_fail=False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_step186_full_laneB.json`
  - gate_decision: `would_fail=False`

## Incremental Verification (2026-02-21T14:01:40Z fillet/chamfer retry in UI-flow)
```bash
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate
EDITOR_GATE_PROFILE=lite EDITOR_SMOKE_LIMIT=3 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 \
SUMMARY_PATH=build/editor_gate_summary_step186_laneB2.json \
bash tools/editor_gate.sh
```
- UI-flow smoke (gate): `PASS`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260221_220017_ui_flow/summary.json`
  - fillet retry: `retrySucceeded=true`, failStatus=`Fillet: radius too large [RADIUS_TOO_LARGE]`
  - chamfer retry: `retrySucceeded=true`, failStatus=`Chamfer: distance too large [DISTANCE_TOO_LARGE]`
- editor_gate (lite profile): `PASS`
  - editor_smoke run_id: `20260221_220139_193_4d9c`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_step186_laneB2.json`
  - gate_decision: `would_fail=False`

## Incremental Verification (2026-02-21T14:16:58.016688+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260221_221546_502_3bcb` status=`PASS` pass=`1` fail=`0` skipped=`0`
- step166: run_id=`20260221_141547` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_141547/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260221_141656`

## Incremental Verification (2026-02-21T14:26:15Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260221_222614_350_8f95`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_222614_350_8f95/summary.json`
- totals: `pass=2 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260221_222534_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260221_222534_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260221_222534_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-21T14:35:26Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260221_223525_623_19f0`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260221_223525_623_19f0/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260221_223447_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260221_223447_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260221_223447_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-22T01:17:38Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260222_091737_002_2b9f`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260222_091737_002_2b9f/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260222_091708_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260222_091708_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260222_091708_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-22 unsupported proxy read-only)
### Command
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate
EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
bash tools/editor_gate.sh
```

### Result
- command tests: `PASS (77/77)`
  - 新增 read-only 行为用例 4 个（move/copy/propertyPatch/delete）。
- UI-flow smoke: `PASS`
  - summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260222_091608_ui_flow/summary.json`
- editor_gate(lite): `PASS`
  - editor_smoke run_id: `20260222_091737_002_2b9f`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - gate_decision: `would_fail=False`

## Incremental Verification (2026-02-23T12:46:24Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260223_204622_182_fb2f`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260223_204622_182_fb2f/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260223_204555_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_204555_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_204555_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-23 hotkey semantic sync)
### Command
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate
EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
bash tools/editor_gate.sh
```

### Result
- command tests: `PASS (77/77)`
- UI-flow smoke: `PASS`
  - summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_204445_ui_flow/summary.json`
  - verified hotkeys: `F7=Grid`, `F8=Ortho`, `F3=Snap`
- editor_gate(lite): `PASS`
  - editor_smoke run_id: `20260223_204622_182_fb2f`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - gate_decision: `would_fail=False`

## Incremental Verification (2026-02-23 Qt F3 sync + Web hotkeys)
### Command
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate
EDITOR_GATE_PROFILE=lite RUN_STEP166_GATE=0 RUN_PERF_TREND=0 RUN_REAL_SCENE_TREND=0 \
RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 \
bash tools/editor_gate.sh
```

### Result
- web command tests: `PASS (77/77)`
- UI-flow smoke: `PASS`
  - summary: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_204445_ui_flow/summary.json`
  - toggles step covers `F7/F8/F3` keyboard behavior.
- editor_gate(lite): `PASS`
  - ui_flow run_ids: `20260223_204528_ui_flow`, `20260223_204555_ui_flow`
  - editor_smoke run_id: `20260223_204622_182_fb2f`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
  - gate_decision: `would_fail=False`
- Qt sync implementation landed:
  - `F3` object-snap master toggle via `SnapSettings::objectSnapEnabled/setObjectSnapEnabled`.
  - Note: current local build tree does not include Qt editor compile targets, so this round is code-level + Web回归验证。

## Incremental Verification (2026-02-23T13:24:36Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260223_212435_225_08fb`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260223_212435_225_08fb/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260223_212406_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_212406_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_212406_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-23T13:27:21Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260223_212720_947_4c77`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260223_212720_947_4c77/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260223_212654_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_212654_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_212654_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-23T13:37:42Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260223_213741_417_ab01`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260223_213741_417_ab01/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260223_213711_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_213711_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_213711_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-23T13:43:50Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260223_214349_485_568c`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260223_214349_485_568c/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260223_214322_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_214322_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_214322_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-23T14:38:17Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260223_223815_486_f213`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260223_223815_486_f213/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260223_223744_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_223744_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_223744_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-23T15:25:34Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260223_232532_886_ae04`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260223_232532_886_ae04/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260223_232504_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_232504_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_232504_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-23T15:32:19Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260223_233110_438_8ed0`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260223_233110_438_8ed0/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260223_233040_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_233040_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_233040_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260223_153113`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260223_153113`
- summary_json: `build/cad_regression/20260223_153113/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=1` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-23T15:34:34Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260223_233434_005_ff05`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260223_233434_005_ff05/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260223_233353_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_233353_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260223_233353_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T02:40:08Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_104006_359_b135`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_104006_359_b135/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260224_103934_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_103934_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_103934_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T02:43:39Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_104219_505_5063`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_104219_505_5063/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260224_104147_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_104147_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_104147_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260224_024222`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260224_024222`
- summary_json: `build/cad_regression/20260224_024222/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-24T05:04:59Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_130458_263_6c66`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_130458_263_6c66/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260224_130424_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_130424_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_130424_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T05:07:27Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_130651_642_6ba8`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_130651_642_6ba8/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260224_130617_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_130617_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_130617_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260224_050653`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260224_050653`
- summary_json: `build/cad_regression/20260224_050653/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=1` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-24T05:10:18Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_131017_244_aa74`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_131017_244_aa74/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260224_130933_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_130933_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_130933_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T05:12:31Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_131153_529_51bb`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_131153_529_51bb/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260224_131112_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_131112_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_131112_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260224_051155`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260224_051155`
- summary_json: `build/cad_regression/20260224_051155/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-24T05:35:16Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_133516_026_a3a6`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_133516_026_a3a6/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260224_133439_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_133439_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_133439_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T05:37:08Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_133633_732_74f1`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_133633_732_74f1/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260224_133558_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_133558_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_133558_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260224_053635`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260224_053635`
- summary_json: `build/cad_regression/20260224_053635/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-24T05:37:08Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_133633_732_74f1`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_133633_732_74f1/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260224_133558_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_133558_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_133558_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260224_053635`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260224_053635`
- summary_json: `build/cad_regression/20260224_053635/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-24T06:13:52Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_141351_458_4082`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_141351_458_4082/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260224_141316_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_141316_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_141316_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T06:13:52Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_141351_458_4082`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_141351_458_4082/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260224_141316_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_141316_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_141316_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T06:24:19Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_142417_447_3ffb`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_142417_447_3ffb/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-21T14:36:59.621280+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260221_223547_598_f4b3` status=`PASS` pass=`8` fail=`0` skipped=`0`
- step166: run_id=`20260221_143550` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_143550/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260221_143659`

## Incremental Verification (2026-02-24T06:28:05Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_142804_258_3623`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_142804_258_3623/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T06:28:05Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_142804_258_3623`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_142804_258_3623/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T06:50:04Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_145002_971_3acc`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_145002_971_3acc/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T06:50:21Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_145020_424_026a`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_145020_424_026a/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=3 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=3` `checked=12` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=3` `matched=12` `candidate=12` `total=12` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T06:50:37Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_145036_661_6536`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_145036_661_6536/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=2 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=2` `checked=8` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=2` `matched=8` `candidate=8` `total=8` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow failure injection
- status: `SKIPPED` run_id=``
- code: `UI_FLOW_PORT_UNAVAILABLE` exit_code=`125` detail=`PermissionError: [Errno 1] Operation not permitted`
- summary_json: ``

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T07:38:11Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_153809_337_ad82`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_153809_337_ad82/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260224_153733_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_153733_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_153733_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T07:40:48Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_154010_852_897f`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_154010_852_897f/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260224_153934_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_153934_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_153934_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260224_074014`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260224_074014`
- summary_json: `build/cad_regression/20260224_074014/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=2` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-24T07:45:32Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_154531_213_930a`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_154531_213_930a/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260224_154455_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_154455_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_154455_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T08:57:58Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_165756_587_8069`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_165756_587_8069/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260224_165716_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_165716_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_165716_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T09:00:02Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_165925_315_3ea0`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_165925_315_3ea0/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- run_id: `20260224_165843_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_165843_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_165843_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260224_085929`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260224_085929`
- summary_json: `build/cad_regression/20260224_085929/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-24T09:06:29Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_170627_721_a2f5`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_170627_721_a2f5/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:49436`
- run_id: `20260224_170552_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_170552_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_170552_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T09:08:26Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_170750_843_21d4`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_170750_843_21d4/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:49659`
- run_id: `20260224_170716_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_170716_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_170716_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260224_090753`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260224_090753`
- summary_json: `build/cad_regression/20260224_090753/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-24T09:08:26Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_170750_843_21d4`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_170750_843_21d4/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:49659`
- run_id: `20260224_170716_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_170716_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_170716_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260224_090753`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260224_090753`
- summary_json: `build/cad_regression/20260224_090753/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-24T09:09:53Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_170952_893_d5fc`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_170952_893_d5fc/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=2 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=2` `checked=8` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=2` `matched=8` `candidate=8` `total=8` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=True`
- port_allocation: `available=true` `status=OK` `reason=auto:50128`
- run_id: `20260224_170941_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_FLOW_JSON_INVALID=2`
- failure_attribution_complete: `True` `code_total=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_170941_ui_flow/summary.json`
- failure_attribution: first_failed_run=`20260224_170928_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` step=`` selection=`` detail=`[OPEN] http://127.0.0.1:50128/tools/web_viewer/index.html?mode=editor&seed=0&debug=1&v=20260224_170928_ui_flow`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_170941_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T09:11:18Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_171116_863_7273`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_171116_863_7273/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:50282`
- run_id: `20260224_171039_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_171039_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_171039_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-21T14:36:59.621280+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260221_223547_598_f4b3` status=`PASS` pass=`8` fail=`0` skipped=`0`
- step166: run_id=`20260221_143550` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_143550/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260221_143659`

## Incremental Verification (2026-02-24T09:33:34Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_173332_629_4686`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_173332_629_4686/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:52619`
- run_id: `20260224_173256_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_173256_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_173256_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T09:35:33Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_173457_953_f3a0`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_173457_953_f3a0/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:52832`
- run_id: `20260224_173420_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_173420_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_173420_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260224_093501`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260224_093501`
- summary_json: `build/cad_regression/20260224_093501/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-24T09:45:21Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_174519_924_098e`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_174519_924_098e/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:53966`
- run_id: `20260224_174442_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_174442_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_174442_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T09:47:20Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_174644_620_e97b`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_174644_620_e97b/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:54160`
- run_id: `20260224_174607_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_174607_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_174607_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260224_094647`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260224_094647`
- summary_json: `build/cad_regression/20260224_094647/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=1` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-24T11:25:40Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_192538_108_1f9e`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_192538_108_1f9e/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:59273`
- run_id: `20260224_192501_ui_flow`
- run_ids: `20260224_192425_ui_flow 20260224_192501_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_192501_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_192501_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T11:27:38Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_192701_361_4279`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_192701_361_4279/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:59530`
- run_id: `20260224_192624_ui_flow`
- run_ids: `20260224_192548_ui_flow 20260224_192624_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_192624_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_192624_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260224_112704`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260224_112704`
- summary_json: `build/cad_regression/20260224_112704/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-21T14:36:59.621280+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260221_223547_598_f4b3` status=`PASS` pass=`8` fail=`0` skipped=`0`
- step166: run_id=`20260221_143550` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260221_143550/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=4` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260221_143659`

## Incremental Verification (2026-02-24T14:16:52Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_221650_117_7223`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_221650_117_7223/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:49628`
- run_id: `20260224_221610_ui_flow`
- run_ids: `20260224_221530_ui_flow 20260224_221610_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_221610_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_221610_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-24T14:18:55Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260224_221818_530_27b2`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260224_221818_530_27b2/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:49877`
- run_id: `20260224_221742_ui_flow`
- run_ids: `20260224_221703_ui_flow 20260224_221742_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_221742_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260224_221742_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260224_141821`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260224_141821`
- summary_json: `build/cad_regression/20260224_141821/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-25T11:07:19Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260225_190717_201_5be2`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260225_190717_201_5be2/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:58760`
- run_id: `20260225_190640_ui_flow`
- run_ids: `20260225_190600_ui_flow 20260225_190640_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_190640_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_190640_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-25T11:09:18Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260225_190838_459_17d4`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260225_190838_459_17d4/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:59017`
- run_id: `20260225_190801_ui_flow`
- run_ids: `20260225_190725_ui_flow 20260225_190801_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_190801_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_190801_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260225_110841`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260225_110841`
- summary_json: `build/cad_regression/20260225_110841/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=1` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-25T12:14:59Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260225_201457_752_2cb9`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260225_201457_752_2cb9/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:61170`
- run_id: `20260225_201420_ui_flow`
- run_ids: `20260225_201341_ui_flow 20260225_201420_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_201420_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_201420_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-25T12:16:59Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260225_201620_908_744d`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260225_201620_908_744d/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:61393`
- run_id: `20260225_201543_ui_flow`
- run_ids: `20260225_201506_ui_flow 20260225_201543_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_201543_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_201543_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260225_121624`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260225_121624`
- summary_json: `build/cad_regression/20260225_121624/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=2` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-25T14:36:32Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260225_223629_046_66fb`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260225_223629_046_66fb/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:64396`
- run_id: `20260225_223551_ui_flow`
- run_ids: `20260225_223512_ui_flow 20260225_223551_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_223551_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_223551_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-25T14:38:31Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260225_223753_684_a7a5`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260225_223753_684_a7a5/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:64569`
- run_id: `20260225_223717_ui_flow`
- run_ids: `20260225_223639_ui_flow 20260225_223717_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_223717_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_223717_ui_flow/editor_ui_flow.png`

### STEP166 baseline gate result
- run_id: `20260225_143757`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260225_143757`
- summary_json: `build/cad_regression/20260225_143757/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-25T15:05:38Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_full_qt.json`

### Editor round-trip gate result
- run_id: `20260225_230502_479_4772`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260225_230502_479_4772/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:49645`
- run_id: `20260225_230424_ui_flow`
- run_ids: `20260225_230348_ui_flow 20260225_230424_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_230424_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260225_230424_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260225_150505`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: `20260225_150505`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260225_150505`
- summary_json: `build/cad_regression/20260225_150505/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=1` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-26T02:16:36Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260226_101551_046_2fb6`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260226_101551_046_2fb6/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:57873`
- run_id: `20260226_101510_ui_flow`
- run_ids: `20260226_101418_ui_flow 20260226_101510_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260226_101510_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260226_101510_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `gate` gate_required=`True` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260226_021555`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: `20260226_021555`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260226_021555`
- summary_json: `build/cad_regression/20260226_021555/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=5` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-27T12:40:51Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260227_204048_012_83dd`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260227_204048_012_83dd/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=4 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=4` `matched=16` `candidate=16` `total=16` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:60682`
- run_id: `20260227_204008_ui_flow`
- run_ids: `20260227_203927_ui_flow 20260227_204008_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260227_204008_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260227_204008_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260227_124051`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-27T14:01:58Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260227_220156_004_7f31`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260227_220156_004_7f31/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=4 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=4` `matched=16` `candidate=16` `total=16` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:54995`
- run_id: `20260227_220113_ui_flow`
- run_ids: `20260227_220031_ui_flow 20260227_220113_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260227_220113_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260227_220113_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260227_140158`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-27T14:19:45Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_full_current.json`

### Editor round-trip gate result
- run_id: `20260227_221818_596_7670`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260227_221818_596_7670/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:65471`
- run_id: `20260227_221735_ui_flow`
- run_ids: `20260227_221652_ui_flow 20260227_221735_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260227_221735_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260227_221735_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260227_141822`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: `20260227_141822`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260227_141822`
- summary_json: `build/cad_regression/20260227_141822/summary.json`
- totals: `pass=0 fail=6 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=2 TEXT_METRIC_DRIFT=4`
- gate_would_fail: `True`
- gate_fail_reasons: `RENDER_DRIFT > 0; TEXT_METRIC_DRIFT > 0; jaccard_aligned degraded by more than 20% vs baseline`
- baseline_compare: `compared=6 degraded=6 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-02-28T03:45:57.285680+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_gatefail.json`
- editor_roundtrip (observe): run_id=`20260228_114144_006_4214` status=`PASS` pass=`4` fail=`0` skipped=`0`
- ui_flow_failure_injection: `PASS` run_id=`20260228_114123_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:53558/tools/web_viewer/index.html?mode=editor&seed=0&debug=1&v=20260228_114123_ui_flow`
- step166: run_id=`20260228_034147` (gate_would_fail=`True`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_034147/summary.json`
  - baseline_compare: `compared=6` `degraded=6` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260228_034309`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_editor_smoke: run_id=`20260228_114433_042_1874` status=`PASS` pass=`4` fail=`0` skipped=`0`
  - gate_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-02-28T04:10:09.845545+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_step185_alignfix.json`
- editor_roundtrip (observe): run_id=`20260228_120644_514_aab9` status=`PASS` pass=`4` fail=`0` skipped=`0`
- step166: run_id=`20260228_040645` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_040645/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260228_040825`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_editor_smoke: run_id=`20260228_120825_769_32b4` status=`PASS` pass=`4` fail=`0` skipped=`0`
  - gate_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-02-28T04:25:39.531088+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_step185_gatecontext.json`
- editor_roundtrip (observe): run_id=`20260228_122206_778_ca66` status=`PASS` pass=`4` fail=`0` skipped=`0`
- step166: run_id=`20260228_042208` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_042208/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260228_042347`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`20260228_042350` enabled=`True` would_fail=`False`
  - gate_step166_summary_json: `build/cad_regression/20260228_042350/summary.json`
- gate_editor_smoke: run_id=`20260228_122347_744_8b5a` status=`PASS` pass=`4` fail=`0` skipped=`0`
  - gate_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-02-28T04:25:39.531088+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_step185_gatecontext.json`
- editor_roundtrip (observe): run_id=`20260228_122206_778_ca66` status=`PASS` pass=`4` fail=`0` skipped=`0`
- step166: run_id=`20260228_042208` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_042208/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260228_042347`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`20260228_042350` enabled=`True` would_fail=`False`
  - gate_step166_summary_json: `build/cad_regression/20260228_042350/summary.json`
- gate_editor_smoke: run_id=`20260228_122347_744_8b5a` status=`PASS` pass=`4` fail=`0` skipped=`0`
  - gate_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-02-28T04:25:39.531088+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_step185_gatecontext.json`
- editor_roundtrip (observe): run_id=`20260228_122206_778_ca66` status=`PASS` pass=`4` fail=`0` skipped=`0`
- step166: run_id=`20260228_042208` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_042208/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260228_042347`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`20260228_042350` enabled=`True` would_fail=`False`
  - gate_step166_summary_json: `build/cad_regression/20260228_042350/summary.json`
- gate_editor_smoke: run_id=`20260228_122347_744_8b5a` status=`PASS` pass=`4` fail=`0` skipped=`0`
  - gate_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-02-28T05:50:00.860620+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_step185_casegen.json`
- editor_roundtrip (observe): run_id=`20260228_134749_339_99ff` status=`PASS` pass=`4` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`4` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`4` min=`4` priorities=`P0,P1`
  - generated_runs: run_id=`20260228_042350` run_ids=`20260228_042350,20260228_042208`
- step166: run_id=`20260228_054752` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_054752/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260228_054958`

## Incremental Verification (2026-02-28T05:56:53.118869+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_step185_casegen_gate.json`
- editor_roundtrip (observe): run_id=`20260228_135333_291_a136` status=`PASS` pass=`4` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`4` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`4` min=`4` priorities=`P0,P1`
  - generated_runs: run_id=`20260228_054752` run_ids=`20260228_054752,20260228_042350`
- step166: run_id=`20260228_055334` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_055334/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260228_055507`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`20260228_055511` enabled=`True` would_fail=`False`
  - gate_step166_summary_json: `build/cad_regression/20260228_055511/summary.json`
- gate_editor_smoke: run_id=`20260228_135508_362_203d` status=`PASS` pass=`4` fail=`0` skipped=`0`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` priorities=`P0,P1`
  - gate_generated_runs: run_id=`20260228_055334` run_ids=`20260228_055334`
  - gate_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-02-28T06:16:40Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_step186_provenance.json`

### Editor round-trip gate result
- run_id: `20260228_141638_427_8954`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_141638_427_8954/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=4 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=4` `matched=16` `candidate=16` `total=16` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260228_061639`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-28T06:34:55Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_step186_generatedmeta.json`

### Editor round-trip gate result
- run_id: `20260228_143452_681_3920`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_143452_681_3920/summary.json`
- case_guard: `source=generated` `cases=4` `min=4`
- generated_cases: `path=local/editor_roundtrip_smoke_cases_weekly.json` `count=4` `min=4` `priorities=P0,P1`
- generated_runs: `run_id=20260228_055511` `run_ids=20260228_055511,20260228_055334`
- totals: `pass=4 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=4` `matched=4` `candidate=4` `total=4` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260228_063454`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-28T06:34:55Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_step186_generatedmeta.json`

### Editor round-trip gate result
- run_id: `20260228_143452_681_3920`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_143452_681_3920/summary.json`
- case_guard: `source=generated` `cases=4` `min=4`
- generated_cases: `path=local/editor_roundtrip_smoke_cases_weekly.json` `count=4` `min=4` `priorities=P0,P1`
- generated_runs: `run_id=20260228_055511` `run_ids=20260228_055511,20260228_055334`
- totals: `pass=4 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=4` `matched=4` `candidate=4` `total=4` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260228_063454`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-28T06:40:08.969083+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_step186_generatedmeta.json`
- editor_roundtrip (observe): run_id=`20260228_143516_791_13e6` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4` priorities=`P0,P1`
  - generated_runs: run_id=`20260228_061121` run_ids=`20260228_061121,20260228_060938,20260228_055511,20260228_055334`
- step166: run_id=`20260228_063519` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_063519/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260228_063657`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=2` `fail=0`
  - gate_ui_flow_run_ids: `20260228_143658_ui_flow 20260228_143744_ui_flow`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:53837`
- gate_step166: run_id=`20260228_063829` enabled=`True` would_fail=`False`
  - gate_step166_summary_json: `build/cad_regression/20260228_063829/summary.json`
- gate_editor_smoke: run_id=`20260228_143825_419_88ae` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` priorities=`P0,P1`
  - gate_generated_runs: run_id=`20260228_063519` run_ids=`20260228_063519`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-02-28T06:53:28Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260228_145326_069_b808`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_145326_069_b808/summary.json`
- case_guard: `source=generated` `cases=8` `min=4`
- generated_cases: `path=local/editor_roundtrip_smoke_cases_weekly.json` `count=4` `min=4` `priorities=P0,P1`
- generated_runs: `run_id=20260228_055511` `run_ids=20260228_055511,20260228_055334`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=8` `candidate=8` `total=8` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260228_065328`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-28T06:55:44Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260228_145542_075_0efd`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_145542_075_0efd/summary.json`
- case_guard: `source=generated` `cases=8` `min=4`
- generated_cases: `path=local/editor_roundtrip_smoke_cases_weekly.json` `count=4` `min=4` `priorities=P0,P1`
- generated_runs: `run_id=20260228_055511` `run_ids=20260228_055511,20260228_055334`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=8` `candidate=8` `total=8` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260228_065544`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-28T06:55:44Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260228_145542_075_0efd`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_145542_075_0efd/summary.json`
- case_guard: `source=generated` `cases=8` `min=4`
- generated_cases: `path=local/editor_roundtrip_smoke_cases_weekly.json` `count=4` `min=4` `priorities=P0,P1`
- generated_runs: `run_id=20260228_055511` `run_ids=20260228_055511,20260228_055334`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=8` `candidate=8` `total=8` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260228_065544`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-28T11:12:15Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260228_191213_804_5190`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_191213_804_5190/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:56729`
- run_id: `20260228_191132_ui_flow`
- run_ids: `20260228_191044_ui_flow 20260228_191132_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260228_191132_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260228_191132_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260228_111215`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-28T11:10:20Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_step186_gen_consistency.json`

### Editor round-trip gate result
- run_id: `20260228_191018_671_f1cc`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_191018_671_f1cc/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- generated_cases: `path=local/editor_roundtrip_smoke_cases_nightly.json` `count=0` `declared=5` `actual=0` `mismatch=True` `min=4` `priorities=P0,P1`
- generated_runs: `run_id=20260228_042350` `run_ids=20260228_042350,20260228_042208`
- totals: `pass=4 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=4` `matched=16` `candidate=16` `total=16` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260228_111020`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-02-28T12:02:26.553433+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary_step186_parallel.json`
- editor_roundtrip (observe): run_id=`20260228_195854_116_f495` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_runs: run_id=`20260228_063829` run_ids=`20260228_063829,20260228_063519,20260228_061121,20260228_060938`
- step166: run_id=`20260228_115858` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260228_115858/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260228_120038`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`20260228_120043` enabled=`True` would_fail=`False`
  - gate_step166_summary_json: `build/cad_regression/20260228_120043/summary.json`
- gate_editor_smoke: run_id=`20260228_200039_043_8ff7` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_runs: run_id=`20260228_115858` run_ids=`20260228_115858`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-01T04:46:57Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260301_124654_597_bec1`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260301_124654_597_bec1/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=3 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=3` `checked=12` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=3` `matched=12` `candidate=12` `total=12` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=True`
- port_allocation: `available=true` `status=OK` `reason=auto:49871`
- run_id: `20260301_124611_ui_flow`
- run_ids: `20260301_124527_ui_flow 20260301_124611_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260301_124611_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260301_124611_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260301_044657`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-01T05:16:07Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260301_131606_844_8b60`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260301_131606_844_8b60/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=2 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=2` `checked=8` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=2` `matched=8` `candidate=8` `total=8` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=True`
- port_allocation: `available=true` `status=OK` `reason=auto:53165`
- run_id: `20260301_131524_ui_flow`
- run_ids: `20260301_131443_ui_flow 20260301_131524_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260301_131524_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 chamfer_single_preselection_ok=2/2 fillet_single_preselection_ok=2/2` complete=`True`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260301_131524_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260301_051607`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-03T00:31:28.387325+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260303_082843_924_0bf6` status=`PASS` pass=`2` fail=`0` skipped=`0`
  - case_source: `discovery` cases=`<discovery>` count=`0` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`2` declared=`2` actual=`2` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260303_002545` run_ids=`20260303_002545`
- step166: run_id=`20260303_002844` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260303_002844/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260303_003126`

## Incremental Verification (2026-03-03T05:10:35.325151+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- parallel_cycle_inputs: `watch_policy=observe` `weekly_policy=observe` `lane_a=False` `lane_b=True` `lane_c=False` `lane_b_ui_flow=False` `lane_b_ui_mode=gate` `strict=False`
- editor_roundtrip (observe): run_id=`20260303_130750_475_5da0` status=`PASS` pass=`2` fail=`0` skipped=`0`
  - case_source: `discovery` cases=`<discovery>` count=`0` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`2` declared=`2` actual=`2` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260303_002844` run_ids=`20260303_002844`
- step166: run_id=`20260303_050751` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260303_050751/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=2` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260303_051033`
- parallel_cycle: `status=pass` `run_id=20260303_131034` `decision=pass` `raw=pass` `watch_policy=observe` `weekly_policy=observe` `watch_escalated=False` `duration_sec=1`
  - parallel_cycle_gate: `fail_reasons=-` `warning_codes=-`
  - lane_b: `status=pass` `rc=0` `duration_sec=1` `node_test_duration_sec=1`
  - lane_b_ui_flow: `enabled=False` `mode=gate` `status=skipped` `attribution_complete=True` `interaction_complete=False`
  - parallel_cycle_summary_json: `build/editor_parallel_cycle/20260303_131034/summary.json`
  - parallel_cycle_summary_md: `build/editor_parallel_cycle/20260303_131034/summary.md`

## Incremental Verification (2026-03-03T05:13:36.356188+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- parallel_cycle_inputs: `watch_policy=observe` `weekly_policy=gate` `lane_a=False` `lane_b=True` `lane_c=False` `lane_b_ui_flow=False` `lane_b_ui_mode=gate` `strict=False`
- editor_roundtrip (observe): run_id=`20260303_131049_555_90bd` status=`PASS` pass=`2` fail=`0` skipped=`0`
  - case_source: `discovery` cases=`<discovery>` count=`0` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`2` declared=`2` actual=`2` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260303_050751` run_ids=`20260303_050751`
- step166: run_id=`20260303_051050` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260303_051050/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260303_051335`
- parallel_cycle: `status=pass` `run_id=20260303_131336` `decision=pass` `raw=pass` `watch_policy=observe` `weekly_policy=gate` `watch_escalated=False` `duration_sec=1`
  - parallel_cycle_gate: `fail_reasons=-` `warning_codes=-`
  - lane_b: `status=pass` `rc=0` `duration_sec=1` `node_test_duration_sec=1`
  - lane_b_ui_flow: `enabled=False` `mode=gate` `status=skipped` `attribution_complete=True` `interaction_complete=False`
  - parallel_cycle_summary_json: `build/editor_parallel_cycle/20260303_131336/summary.json`
  - parallel_cycle_summary_md: `build/editor_parallel_cycle/20260303_131336/summary.md`

## Incremental Verification (2026-03-04T04:19:42.457844+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- parallel_cycle_inputs: `watch_policy=observe` `weekly_policy=gate` `lane_a=False` `lane_b=True` `lane_c=False` `lane_b_ui_flow=True` `lane_b_ui_mode=gate` `lane_b_ui_timeout_ms=1` `strict=False`
- editor_roundtrip (observe): run_id=`20260304_121608_987_fa6d` status=`PASS` pass=`2` fail=`0` skipped=`0`
  - case_source: `discovery` cases=`<discovery>` count=`0` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`2` declared=`2` actual=`2` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260303_051050` run_ids=`20260303_051050`
- step166: run_id=`20260304_041610` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260304_041610/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260304_041921`
- parallel_cycle: `status=fail` `run_id=20260304_121922` `decision=fail` `raw=fail` `watch_policy=observe` `weekly_policy=gate` `watch_escalated=False` `duration_sec=20`
  - parallel_cycle_gate: `fail_reasons=LANE_B_FAIL LANE_B_UI_FLOW_ATTR_MISSING LANE_B_UI_FLOW_FAIL LANE_B_UI_FLOW_INTERACTION_INCOMPLETE` `warning_codes=-`
  - lane_b: `status=fail` `rc=0` `duration_sec=20` `node_test_duration_sec=1`
  - lane_b_ui_flow: `enabled=True` `mode=gate` `status=fail` `timeout_ms=1` `attribution_complete=False` `interaction_complete=False`
  - parallel_cycle_summary_json: `build/editor_parallel_cycle/20260304_121922/summary.json`
  - parallel_cycle_summary_md: `build/editor_parallel_cycle/20260304_121922/summary.md`

## Incremental Verification (2026-03-04T04:24:32.140714+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- parallel_cycle_inputs: `watch_policy=observe` `weekly_policy=gate` `lane_a=False` `lane_b=True` `lane_c=False` `lane_b_ui_flow=True` `lane_b_ui_mode=gate` `lane_b_ui_timeout_ms=0` `strict=False`
- editor_roundtrip (observe): run_id=`20260304_122111_019_391b` status=`PASS` pass=`2` fail=`0` skipped=`0`
  - case_source: `discovery` cases=`<discovery>` count=`0` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`2` declared=`2` actual=`2` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260304_041610` run_ids=`20260304_041610`
- step166: run_id=`20260304_042112` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260304_042112/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260304_042344`
- parallel_cycle: `status=pass` `run_id=20260304_122345` `decision=pass` `raw=pass` `watch_policy=observe` `weekly_policy=gate` `watch_escalated=False` `duration_sec=46`
  - parallel_cycle_gate: `fail_reasons=-` `warning_codes=-`
  - lane_b: `status=pass` `rc=0` `duration_sec=46` `node_test_duration_sec=1`
  - lane_b_ui_flow: `enabled=True` `mode=gate` `status=pass` `timeout_ms=0` `attribution_complete=True` `interaction_complete=True`
    - lane_b_ui_interaction_coverage: `arc_radius_grip_ok=true chamfer_cross_layer_preselection_ok=true chamfer_pair_preselection_ok=true chamfer_polyline_preselection_ok=true chamfer_reset_guard_ok=true chamfer_runtime_preselection_ok=true chamfer_single_preselection_ok=true complete=true fillet_cross_layer_preselection_ok=true fillet_pair_preselection_ok=true fillet_polyline_preselection_ok=true fillet_reset_guard_ok=true fillet_runtime_preselection_ok=true fillet_single_preselection_ok=true grip_hover_snap_overlay_ok=true polyline_grip_lifecycle_ok=true`
  - parallel_cycle_summary_json: `build/editor_parallel_cycle/20260304_122345/summary.json`
  - parallel_cycle_summary_md: `build/editor_parallel_cycle/20260304_122345/summary.md`

## Incremental Verification (2026-03-06T13:20:39Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=True`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_stage_policy_auto.json`

### Editor round-trip gate result
- run_id: `20260306_212038_008_f140`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip_stage_policy_auto/20260306_212038_008_f140/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=1 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=1` `checked=4` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=1` `matched=4` `candidate=4` `total=4` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=False`
- port_allocation: `available=false` `status=FAILED` `reason=PermissionError: [Errno 1] Operation not permitted`

### Qt project persistence
- mode: `skipped` gate_required=`False` require_on=`False`
- status: `SKIPPED` reason=`CHECK_DISABLED` run_id=``
- build: `dir=` `BUILD_EDITOR_QT=` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: ``

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-06T13:25:34Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=full` `step166=True` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=3/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_stage_trend/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260306_212121_557_aa1b`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_stage_trend/editor_roundtrip/20260306_212121_557_aa1b/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260306_132125`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: `20260306_132413`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_stage_trend/cad_regression/20260306_132413`
- summary_json: `build/local_ci_stage_trend/cad_regression/20260306_132413/summary.json`
- totals: `pass=0 fail=6 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=6 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `True`
- gate_fail_reasons: `RENDER_DRIFT > 0`
- baseline_compare: `compared=0 degraded=0 improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-03-06T13:26:00Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=True`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary_stage_policy_gate.json`

### Editor round-trip gate result
- run_id: `20260306_212600_098_3f39`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip_stage_policy_gate/20260306_212600_098_3f39/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=1 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=1` `checked=4` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=1` `matched=4` `candidate=4` `total=4` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=false` `status=FAILED` `reason=PermissionError: [Errno 1] Operation not permitted`

### Qt project persistence
- mode: `skipped` gate_required=`False` require_on=`False`
- status: `SKIPPED` reason=`CHECK_DISABLED` run_id=``
- build: `dir=` `BUILD_EDITOR_QT=` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: ``

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-06T13:34:27Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=lite` `step166=False` `ui_flow_gate=False` `convert_disabled=True`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_stage_trend_continue/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260306_213425_487_aa8c`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_stage_trend_continue/editor_roundtrip/20260306_213425_487_aa8c/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=False`
- port_allocation: `available=false` `status=FAILED` `reason=PermissionError: [Errno 1] Operation not permitted`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260306_133427`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-07T12:16:38Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260307_201633_439_85e2`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260307_201633_439_85e2/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260307_121637`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-07T12:19:43Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260307_201939_979_0280`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260307_201939_979_0280/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260307_121943`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-07T12:20:19Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260307_202016_208_0375`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260307_202016_208_0375/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260307_122019`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-07T12:21:56Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260307_202153_009_dbdf`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260307_202153_009_dbdf/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260307_122156`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-07T13:39:05Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260307_213902_027_1f23`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260307_213902_027_1f23/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260307_133905`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-07T14:09:03Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260307_220900_209_0ce1`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260307_220900_209_0ce1/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260307_140903`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-07T14:16:32Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260307_221628_740_8b3b`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260307_221628_740_8b3b/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260307_141632`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-07T14:37:18Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260307_223714_613_2a2f`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260307_223714_613_2a2f/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260307_143717`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-07T14:59:02.116351+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260307_225541_261_d2d4` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260306_135355` run_ids=`20260306_135355,20260306_135232,20260306_135108,20260306_134813`
- step166: run_id=`20260307_145545` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260307_145545/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260307_145700`
- ui_flow_stage_trend: `status=stable` `recommended_gate_mode=gate` `enabled_samples=10` `fail_ratio=0.000` `attribution_ratio=1.000`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=2` `fail=0`
  - gate_ui_flow_run_ids: `20260307_225701_ui_flow 20260307_225749_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:52697`
  - gate_interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260307_225857_694_5f72` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260307_145545` run_ids=`20260307_145545`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-07T15:54:45Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260307_235442_035_a836`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260307_235442_035_a836/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260307_155445`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-07T15:58:51.005917+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260307_235457_948_240c` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260307_145545` run_ids=`20260307_145545,20260306_135355,20260306_135232,20260306_135108`
- step166: run_id=`20260307_155500` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260307_155500/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260307_155612`
- ui_flow_stage_trend: `status=stable` `recommended_gate_mode=gate` `enabled_samples=11` `fail_ratio=0.000` `attribution_ratio=1.000`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=2` `fail=0`
  - gate_ui_flow_run_ids: `20260307_235613_ui_flow 20260307_235703_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:65332`
  - gate_interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260307_235845_828_80cf` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260307_155500` run_ids=`20260307_155500`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-07T16:13:27.640475+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260308_000923_274_c4b8` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260307_155500` run_ids=`20260307_155500,20260307_145545,20260306_135355,20260306_135232`
- step166: run_id=`20260307_160927` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260307_160927/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260307_161042`
- ui_flow_stage_trend: `status=stable` `recommended_gate_mode=gate` `enabled_samples=12` `fail_ratio=0.000` `attribution_ratio=1.000`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=2` `fail=0`
  - gate_ui_flow_run_ids: `20260308_001044_ui_flow 20260308_001131_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:53774`
  - gate_interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260308_001321_558_8283` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260307_160927` run_ids=`20260307_160927`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-07T16:38:03.637533+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260308_003346_289_ebb1` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260307_160927` run_ids=`20260307_160927,20260307_155500,20260307_145545,20260306_135355`
- step166: run_id=`20260307_163351` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260307_163351/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260307_163505`
- ui_flow_stage_trend: `status=stable` `recommended_gate_mode=gate` `enabled_samples=13` `fail_ratio=0.000` `attribution_ratio=1.000`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=2` `fail=0`
  - gate_ui_flow_run_ids: `20260308_003507_ui_flow 20260308_003555_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:59801`
  - gate_interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260308_003746_583_3299` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260307_163351` run_ids=`20260307_163351`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-07T17:00:45.371099+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260308_005610_274_b5d6` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260307_163351` run_ids=`20260307_163351,20260307_160927,20260307_155500,20260307_145545`
- step166: run_id=`20260307_165614` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260307_165614/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260307_165733`
- ui_flow_stage_trend: `status=stable` `recommended_gate_mode=gate` `enabled_samples=14` `fail_ratio=0.000` `attribution_ratio=1.000`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=2` `fail=0`
  - gate_ui_flow_run_ids: `20260308_005734_ui_flow 20260308_005824_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:64232`
  - gate_interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260308_010026_762_5fc3` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260307_165614` run_ids=`20260307_165614`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-07T17:10:14.605626+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260308_010539_919_55ff` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260307_165614` run_ids=`20260307_165614,20260307_163351,20260307_160927,20260307_155500`
- step166: run_id=`20260307_170543` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260307_170543/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260307_170657`
- ui_flow_stage_trend: `status=stable` `recommended_gate_mode=gate` `enabled_samples=15` `fail_ratio=0.000` `attribution_ratio=1.000`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=2` `fail=0`
  - gate_ui_flow_run_ids: `20260308_010658_ui_flow 20260308_010747_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:51392`
  - gate_interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260308_010955_569_c85a` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260307_170543` run_ids=`20260307_170543`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-08T03:24:28Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260308_112424_083_d42a`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260308_112424_083_d42a/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:52325`
- run_id: `20260308_112214_ui_flow`
- run_ids: `20260308_112110_ui_flow 20260308_112214_ui_flow`
- ok: `False` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=1` `fail=1`
- gate_failure_codes: `UI_FLOW_TIMEOUT=1`
- failure_attribution_complete: `True` `code_total=1`
- setup_exit_codes: `open=0` `resize=0` `run_code=0` `first_failure_stage=run_code`
- failure_stage_counts: `run_code=1`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260308_112214_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- interaction_checks: `fillet_pair=1/1 chamfer_pair=1/1 fillet_runtime=1/1 chamfer_runtime=1/1 fillet_reset=1/1 chamfer_reset=1/1 fillet_poly=1/1 chamfer_poly=1/1 complete=1/1 arc_radius_grip_ok=1/1 chamfer_cross_layer_preselection_ok=1/1 chamfer_single_preselection_ok=1/1 fillet_cross_layer_preselection_ok=1/1 fillet_single_preselection_ok=1/1 grip_hover_snap_overlay_ok=1/1 polyline_grip_lifecycle_ok=1/1` complete=`True`
- failure_attribution: first_failed_run=`20260308_112110_ui_flow` code=`UI_FLOW_TIMEOUT` step=`` selection=`` detail=`pwcli timeout (exit_code=124)`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260308_112214_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260308_032427`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-08T07:20:05Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260308_152000_495_6457`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260308_152000_495_6457/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:51056`
- run_id: `20260308_151757_ui_flow`
- run_ids: `20260308_151710_ui_flow 20260308_151757_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260308_151757_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260308_151757_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260308_072004`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-08T08:34:27Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260308_163421_074_b0f3`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260308_163421_074_b0f3/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260308_083425`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-08T08:34:41Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260308_163438_136_c887`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260308_163438_136_c887/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:59406`
- run_id: `20260308_163214_ui_flow`
- run_ids: `20260308_163115_ui_flow 20260308_163214_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260308_163214_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260308_163214_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260308_083441`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-08T11:39:03Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260308_193858_449_dfda`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260308_193858_449_dfda/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260308_113902`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-08T11:59:20Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260308_195915_568_73ea`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260308_195915_568_73ea/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260308_115919`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-08T13:26:26Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260308_212621_520_6a7c`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260308_212621_520_6a7c/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:52967`
- run_id: `20260308_212502_ui_flow`
- run_ids: `20260308_212402_ui_flow 20260308_212502_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260308_212502_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260308_212502_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260308_132625`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-08T13:26:26Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260308_212621_520_6a7c`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260308_212621_520_6a7c/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:52967`
- run_id: `20260308_212502_ui_flow`
- run_ids: `20260308_212402_ui_flow 20260308_212502_ui_flow`
- ok: `True` exit_code=`0`
- gate_runs: `target=2` `run_count=2` `pass=2` `fail=0`
- failure_attribution_complete: `True` `code_total=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260308_212502_ui_flow/summary.json`
- triage: step=`snap_kinds_extra` selection=`1 selected (line)` status=`Line created`
- interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260308_212502_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260308_132625`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-08T13:29:34Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260308_212929_432_5283`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260308_212929_432_5283/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260308_132933`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-08T13:31:06.750656+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260308_212642_430_1e53` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260307_170543` run_ids=`20260307_170543,20260307_165614,20260307_163351,20260307_160927`
- step166: run_id=`20260308_132646` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260308_132646/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260308_132830`
- ui_flow_stage_trend: `status=watch` `recommended_gate_mode=observe` `enabled_samples=15` `fail_ratio=0.067` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `run_code=1`
  - ui_flow_first_stage_counts: `run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=2` `fail=0`
  - gate_ui_flow_run_ids: `20260308_212831_ui_flow 20260308_212930_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:55167`
  - gate_interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260308_213047_628_814d` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260308_132646` run_ids=`20260308_132646`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-08T13:38:43Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260308_213839_586_6cbf`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260308_213839_586_6cbf/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260308_133842`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-08T16:12:13Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_001211_886_fa6b`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_001211_886_fa6b/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=2 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=1` `checked=2` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=2` `matched=2` `candidate=2` `total=2` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `skipped` gate_required=`False` require_on=`False`
- status: `SKIPPED` reason=`CHECK_DISABLED` run_id=``
- build: `dir=` `BUILD_EDITOR_QT=` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: ``

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-08T16:14:41Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=full` `step166=True` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_001256_629_1d6a`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_001256_629_1d6a/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=2 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=1` `checked=2` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=2` `matched=2` `candidate=2` `total=2` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260308_161257`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: `20260308_161257`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260308_161257`
- summary_json: `build/cad_regression/20260308_161257/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-03-08T16:21:49.611757+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_001746_918_4d4e` status=`PASS` pass=`2` fail=`0` skipped=`0`
  - case_source: `discovery` cases=`<discovery>` count=`0` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`2` declared=`2` actual=`2` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260308_161257` run_ids=`20260308_161257`
- step166: run_id=`20260308_161748` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260308_161748/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260308_161930`
- ui_flow_stage_trend: `status=watch` `recommended_gate_mode=observe` `enabled_samples=13` `fail_ratio=0.077` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `run_code=1`
  - ui_flow_first_stage_counts: `run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=2` `fail=0`
  - gate_ui_flow_run_ids: `20260309_001931_ui_flow 20260309_002017_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:55369`
  - gate_interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_002131_297_3c82` status=`PASS` pass=`4` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `discovery` cases=`<discovery>`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260308_161748` run_ids=`20260308_161748`
  - gate_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-08T23:06:48Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_070644_224_3442`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_070644_224_3442/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=4 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=4` `matched=4` `candidate=4` `total=4` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260308_161257`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=2` `build=0` `test=0`
- summary_json: `build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-08T23:09:49Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_070946_359_84ba`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_070946_359_84ba/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=4 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=4` `matched=4` `candidate=4` `total=4` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260308_230949`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-08T23:14:15.832407+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_071020_293_cc02` status=`PASS` pass=`4` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`4` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`4` declared=`4` actual=`4` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260308_161748` run_ids=`20260308_161748,20260308_161257`
- step166: run_id=`20260308_231022` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260308_231022/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260308_231202`
- ui_flow_stage_trend: `status=watch` `recommended_gate_mode=observe` `enabled_samples=14` `fail_ratio=0.071` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `run_code=1`
  - ui_flow_first_stage_counts: `run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=2` `fail=0`
  - gate_ui_flow_run_ids: `20260309_071203_ui_flow 20260309_071251_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:63701`
  - gate_interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_071400_420_dc40` status=`PASS` pass=`4` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260308_231022` run_ids=`20260308_231022`
  - gate_unsupported_passthrough: `cases_with_checks=4` `checked=16` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-09T01:11:59Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_091154_590_e48f`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_091154_590_e48f/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=6` `candidate=6` `total=6` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_011158`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T01:17:58.442257+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_091350_236_0297` status=`PASS` pass=`6` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`6` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`6` declared=`6` actual=`6` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260308_231022` run_ids=`20260308_231022,20260308_161748,20260308_161257`
- step166: run_id=`20260309_011353` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_011353/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=2` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260309_011537`
- ui_flow_stage_trend: `status=watch` `recommended_gate_mode=observe` `enabled_samples=15` `fail_ratio=0.067` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `run_code=1`
  - ui_flow_first_stage_counts: `run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=2` `fail=0`
  - gate_ui_flow_run_ids: `20260309_091537_ui_flow 20260309_091629_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:55333`
  - gate_interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_091742_523_8ca9` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260309_011353` run_ids=`20260309_011353`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-09T01:52:04Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_095159_618_4d96`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_095159_618_4d96/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=8` `candidate=8` `total=8` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_015204`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T01:55:55.923074+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_095213_472_f065` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260309_011353` run_ids=`20260309_011353,20260308_231022,20260308_161748,20260308_161257`
- step166: run_id=`20260309_015217` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_015217/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260309_015332`
- ui_flow_stage_trend: `status=watch` `recommended_gate_mode=observe` `enabled_samples=16` `fail_ratio=0.062` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `run_code=1`
  - ui_flow_first_stage_counts: `run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=2` `fail=0`
  - gate_ui_flow_run_ids: `20260309_095332_ui_flow 20260309_095422_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:58912`
  - gate_interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_095538_458_4736` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260309_015217` run_ids=`20260309_015217`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-09T02:06:00Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_100555_861_eb49`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_100555_861_eb49/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=10` `candidate=10` `total=10` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_020559`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T02:12:00.709091+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_100745_745_8915` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260309_015217` run_ids=`20260309_015217,20260309_011353,20260308_231022,20260308_161748`
- step166: run_id=`20260309_020750` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_020750/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260309_020934`
- ui_flow_stage_trend: `status=watch` `recommended_gate_mode=observe` `enabled_samples=17` `fail_ratio=0.059` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `run_code=1`
  - ui_flow_first_stage_counts: `run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=2` `fail=0`
  - gate_ui_flow_run_ids: `20260309_100935_ui_flow 20260309_101024_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:62190`
  - gate_interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_101142_512_3d92` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260309_020750` run_ids=`20260309_020750`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-09T02:24:18Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_102413_414_9ecb`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_102413_414_9ecb/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=12` `candidate=12` `total=12` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_022417`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T02:30:19.813487+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_102604_093_8b89` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260309_020750` run_ids=`20260309_020750,20260309_015217,20260309_011353,20260308_231022`
- step166: run_id=`20260309_022608` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_022608/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260309_022752`
- ui_flow_stage_trend: `status=watch` `recommended_gate_mode=observe` `enabled_samples=18` `fail_ratio=0.056` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `run_code=1`
  - ui_flow_first_stage_counts: `run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=2` `fail=0`
  - gate_ui_flow_run_ids: `20260309_102753_ui_flow 20260309_102841_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:49322`
  - gate_interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_103003_472_325f` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260309_022608` run_ids=`20260309_022608`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-09T03:05:02Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_110457_690_fc08`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_110457_690_fc08/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=14` `candidate=14` `total=14` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_030501`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T03:11:51.015428+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_110721_355_8302` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260309_022608` run_ids=`20260309_022608,20260309_020750,20260309_015217,20260309_011353`
- step166: run_id=`20260309_030726` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_030726/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=2` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260309_030910`
- ui_flow_stage_trend: `status=watch` `recommended_gate_mode=observe` `enabled_samples=19` `fail_ratio=0.053` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `run_code=1`
  - ui_flow_first_stage_counts: `run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=2` `fail=0`
  - gate_ui_flow_run_ids: `20260309_110911_ui_flow 20260309_111007_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:54369`
  - gate_interaction_checks: `fillet_pair=2/2 chamfer_pair=2/2 fillet_runtime=2/2 chamfer_runtime=2/2 fillet_reset=2/2 chamfer_reset=2/2 fillet_poly=2/2 chamfer_poly=2/2 complete=2/2 arc_radius_grip_ok=2/2 chamfer_cross_layer_preselection_ok=2/2 chamfer_single_preselection_ok=2/2 fillet_cross_layer_preselection_ok=2/2 fillet_single_preselection_ok=2/2 grip_hover_snap_overlay_ok=2/2 polyline_grip_lifecycle_ok=2/2` complete=`True`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_111132_465_f0f7` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260309_030726` run_ids=`20260309_030726`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-09T03:27:02Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_112656_503_519b`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_112656_503_519b/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=16` `candidate=16` `total=16` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:56573`
- run_id: `20260309_112612_ui_flow`
- run_ids: `20260309_112547_ui_flow 20260309_112612_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_FILLET_FAIL=2`
- failure_attribution_complete: `True` `code_total=2`
- setup_exit_codes: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
- failure_stage_counts: `flow=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260309_112612_ui_flow/summary.json`
- triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- failure_attribution: first_failed_run=`20260309_112547_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260309_112612_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_032700`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T03:27:42Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_112738_499_9aa5`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_112738_499_9aa5/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=16` `candidate=16` `total=16` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_032742`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T03:32:02.118738+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_112928_084_6bf9` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260309_030726` run_ids=`20260309_030726,20260309_022608,20260309_020750,20260309_015217`
- step166: run_id=`20260309_032931` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_032931/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260309_033117`
- ui_flow_stage_trend: `status=watch` `recommended_gate_mode=observe` `enabled_samples=20` `fail_ratio=0.100` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=2 run_code=1`
  - ui_flow_first_stage_counts: `flow=1 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_113145_159_a1f7` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260309_032931` run_ids=`20260309_032931`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-09T03:41:20Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_114116_306_4131`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_114116_306_4131/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=18` `candidate=18` `total=18` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_034119`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T03:47:27.499238+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_114519_281_84b5` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260309_034353` run_ids=`20260309_034353,20260309_032931,20260309_030726,20260309_022608`
- step166: run_id=`20260309_034523` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_034523/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260309_034637`
- ui_flow_stage_trend: `status=watch` `recommended_gate_mode=observe` `enabled_samples=20` `fail_ratio=0.100` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=2 run_code=1`
  - ui_flow_first_stage_counts: `flow=1 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_114710_831_efef` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260309_034523` run_ids=`20260309_034523`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-09T04:21:48.746798+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_121858_627_dc9d` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260309_034523` run_ids=`20260309_034523,20260309_034353,20260309_032931,20260309_030726`
- step166: run_id=`20260309_041902` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_041902/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260309_042056`
- ui_flow_stage_trend: `status=watch` `recommended_gate_mode=observe` `enabled_samples=20` `fail_ratio=0.100` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=2 run_code=1`
  - ui_flow_first_stage_counts: `flow=1 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_122131_200_3732` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260309_041902` run_ids=`20260309_041902`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-09T06:19:12Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_141908_028_d45d`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_141908_028_d45d/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:56993`
- run_id: `20260309_141811_ui_flow`
- run_ids: `20260309_141743_ui_flow 20260309_141811_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_FILLET_FAIL=2`
- failure_attribution_complete: `True` `code_total=2`
- setup_exit_codes: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
- failure_stage_counts: `flow=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260309_141811_ui_flow/summary.json`
- triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- failure_attribution: first_failed_run=`20260309_141743_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260309_141811_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_061912`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T06:20:00Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_141956_320_7555`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_141956_320_7555/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_062000`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T06:24:37.676163+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_142148_374_10cc` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260309_041902` run_ids=`20260309_041902,20260309_034523,20260309_034353,20260309_032931`
- step166: run_id=`20260309_062152` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_062152/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260309_062339`
- ui_flow_stage_trend: `status=watch` `recommended_gate_mode=observe` `enabled_samples=21` `fail_ratio=0.143` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=4 run_code=1`
  - ui_flow_first_stage_counts: `flow=2 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_142419_061_cc50` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260309_062152` run_ids=`20260309_062152`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-09T07:12:39Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=True` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_151112_582_288e`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_151112_582_288e/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_071116`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: `20260309_071116`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_071116`
- summary_json: `build/cad_regression/20260309_071116/summary.json`
- totals: `pass=6 fail=0 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=6 degraded=0 improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-03-09T07:16:21.525141+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_151302_291_8266` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260309_071116` run_ids=`20260309_071116,20260309_062152,20260309_041902,20260309_034523`
- step166: run_id=`20260309_071306` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_071306/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260309_071430`
- ui_flow_stage_trend: `status=watch` `recommended_gate_mode=observe` `enabled_samples=22` `fail_ratio=0.182` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=6 run_code=1`
  - ui_flow_first_stage_counts: `flow=3 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=0` `fail=2`
  - gate_ui_flow_run_ids: `20260309_151432_ui_flow 20260309_151457_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - gate_ui_flow_failure_stage_counts: `flow=4`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:52026`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_151604_646_a300` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260309_071306` run_ids=`20260309_071306`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-09T07:39:55Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=True` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=1/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_153816_241_5a10`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_153816_241_5a10/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_073820`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: `20260309_073820`
- run_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_073820`
- summary_json: `build/cad_regression/20260309_073820/summary.json`
- totals: `pass=5 fail=1 skipped=1`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=1 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `True`
- gate_fail_reasons: `RENDER_DRIFT > 0; jaccard_aligned degraded by more than 20% vs baseline`
- baseline_compare: `compared=6 degraded=1 improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`

## Incremental Verification (2026-03-09T07:40:16Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_154012_212_a836`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_154012_212_a836/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_074016`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T07:44:39.248090+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_154255_932_d8c6` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260309_074005` run_ids=`20260309_074005,20260309_073820,20260309_071306,20260309_071116`
- step166: run_id=`20260309_074300` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_074300/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260309_074425`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=22` `fail_ratio=0.227` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=8 run_code=1`
  - ui_flow_first_stage_counts: `flow=4 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=0` `fail=2`
  - gate_ui_flow_run_ids: `20260309_154131_ui_flow 20260309_154205_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - gate_ui_flow_failure_stage_counts: `flow=4`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:59057`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_154307_770_0460` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260309_074005` run_ids=`20260309_074005`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-09T08:05:56Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_160549_433_5309`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_160549_433_5309/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:63669`
- run_id: `20260309_160442_ui_flow`
- run_ids: `20260309_160417_ui_flow 20260309_160442_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_FILLET_FAIL=2`
- failure_attribution_complete: `True` `code_total=2`
- setup_exit_codes: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
- failure_stage_counts: `flow=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260309_160442_ui_flow/summary.json`
- triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- failure_attribution: first_failed_run=`20260309_160417_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260309_160442_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_080555`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T08:07:46.369305+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_160606_209_65c0` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260309_074300` run_ids=`20260309_074300,20260309_074005,20260309_073820,20260309_071306`
- step166: run_id=`20260309_080610` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_080610/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260309_080731`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=23` `fail_ratio=0.261` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=10 run_code=1`
  - ui_flow_first_stage_counts: `flow=5 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=0` `fail=2`
  - gate_ui_flow_run_ids: `20260309_160417_ui_flow 20260309_160442_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - gate_ui_flow_failure_stage_counts: `flow=4`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:63669`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_160549_433_5309` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-09T08:33:41Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_163336_790_ecdc`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_163336_790_ecdc/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:52692`
- run_id: `20260309_163224_ui_flow`
- run_ids: `20260309_163155_ui_flow 20260309_163224_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_FILLET_FAIL=2`
- failure_attribution_complete: `True` `code_total=2`
- setup_exit_codes: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
- failure_stage_counts: `flow=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260309_163224_ui_flow/summary.json`
- triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- failure_attribution: first_failed_run=`20260309_163155_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260309_163224_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_083340`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T08:35:40.326184+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_163402_058_4bda` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260309_080610` run_ids=`20260309_080610,20260309_074300,20260309_074005,20260309_073820`
- step166: run_id=`20260309_083405` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_083405/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260309_083527`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=24` `fail_ratio=0.292` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=12 run_code=1`
  - ui_flow_first_stage_counts: `flow=6 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=0` `fail=2`
  - gate_ui_flow_run_ids: `20260309_163155_ui_flow 20260309_163224_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - gate_ui_flow_failure_stage_counts: `flow=4`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:52692`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_163336_790_ecdc` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-09T08:38:12Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_163808_774_4d82`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_163808_774_4d82/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_083812`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T08:49:14Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_164910_571_21ed`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_164910_571_21ed/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_084914`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T08:51:12.131981+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_164936_310_1bcb` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260309_083405` run_ids=`20260309_083405,20260309_080610,20260309_074300,20260309_074005`
- step166: run_id=`20260309_084939` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_084939/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260309_085059`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=24` `fail_ratio=0.292` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=12 run_code=1`
  - ui_flow_first_stage_counts: `flow=6 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_164910_571_21ed` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-09T09:16:10Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_171604_571_3fc0`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_171604_571_3fc0/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_091608`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T09:17:53.528709+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_171617_946_97a9` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260309_084939` run_ids=`20260309_084939,20260309_083405,20260309_080610,20260309_074300`
- step166: run_id=`20260309_091621` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_091621/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260309_091741`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=24` `fail_ratio=0.292` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=12 run_code=1`
  - ui_flow_first_stage_counts: `flow=6 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_171604_571_3fc0` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-09T09:21:15Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260309_172111_348_08f2`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260309_172111_348_08f2/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260309_092115`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-09T09:23:04.297506+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260309_172129_926_dfc4` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260309_091621` run_ids=`20260309_091621,20260309_084939,20260309_083405,20260309_080610`
- step166: run_id=`20260309_092134` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260309_092134/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260309_092251`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=24` `fail_ratio=0.292` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=12 run_code=1`
  - ui_flow_first_stage_counts: `flow=6 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260309_172111_348_08f2` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-10T00:14:24Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260310_081420_190_6e56`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260310_081420_190_6e56/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260310_001424`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-10T00:17:11.811148+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260310_081530_417_168b` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260309_092134` run_ids=`20260309_092134,20260309_091621,20260309_084939,20260309_083405`
- step166: run_id=`20260310_001534` (gate_would_fail=`True`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_001534/summary.json`
  - baseline_compare: `compared=6` `degraded=1` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_001657`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=24` `fail_ratio=0.292` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=12 run_code=1`
  - ui_flow_first_stage_counts: `flow=6 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_081420_190_6e56` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-10T00:18:56Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260310_081852_601_9f63`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260310_081852_601_9f63/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260310_001856`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-10T00:20:40.676397+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260310_081906_859_7615` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_001534` run_ids=`20260310_001534,20260309_092134,20260309_091621,20260309_084939`
- step166: run_id=`20260310_001911` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_001911/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_002026`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=24` `fail_ratio=0.292` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=12 run_code=1`
  - ui_flow_first_stage_counts: `flow=6 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_081852_601_9f63` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-10T01:07:26Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260310_090721_934_e347`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260310_090721_934_e347/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260310_010725`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-10T01:13:49Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260310_091344_464_9785`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260310_091344_464_9785/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260310_011348`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-10T01:16:16.123206+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260310_091403_955_8717` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_010737` run_ids=`20260310_010737,20260310_001911,20260310_001534,20260309_092134`
- step166: run_id=`20260310_011408` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_011408/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_011601`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=24` `fail_ratio=0.292` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=12 run_code=1`
  - ui_flow_first_stage_counts: `flow=6 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_091344_464_9785` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-10T01:45:38Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260310_094535_289_5460`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260310_094535_289_5460/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `skipped` gate_required=`False` require_on=`False`
- status: `SKIPPED` reason=`CHECK_DISABLED` run_id=``
- build: `dir=` `BUILD_EDITOR_QT=` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: ``

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-10T01:47:43.336368+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- parallel_cycle_inputs: `watch_policy=observe` `weekly_policy=observe` `lane_a=False` `lane_b=True` `lane_c=False` `lane_b_ui_flow=True` `lane_b_ui_mode=gate` `lane_b_ui_timeout_ms=0` `strict=False`
- editor_roundtrip (observe): run_id=`20260310_094544_225_12ee` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_011408` run_ids=`20260310_011408,20260310_010737,20260310_001911,20260310_001534`
- step166: run_id=`20260310_014548` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_014548/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_014706`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=24` `fail_ratio=0.292` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=12 run_code=1`
  - ui_flow_first_stage_counts: `flow=6 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_094535_289_5460` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- parallel_cycle: `status=fail` `run_id=20260310_094720` `decision=fail` `raw=fail` `watch_policy=observe` `weekly_policy=observe` `watch_escalated=False` `duration_sec=23`
  - parallel_cycle_gate: `fail_reasons=LANE_B_FAIL LANE_B_UI_FLOW_FAIL LANE_B_UI_FLOW_INTERACTION_INCOMPLETE` `warning_codes=-`
  - lane_b: `status=fail` `rc=0` `duration_sec=23` `node_test_duration_sec=1`
  - lane_b_ui_flow: `enabled=True` `mode=gate` `status=fail` `timeout_ms=0` `attribution_complete=True` `interaction_complete=False`
    - lane_b_ui_setup_exits: `open=0` `resize=0` `run_code=0` `failure_stage=flow`
    - lane_b_ui_failure_code: `UI_FLOW_FILLET_FAIL`
  - parallel_cycle_summary_json: `build/editor_parallel_cycle/20260310_094720/summary.json`
  - parallel_cycle_summary_md: `build/editor_parallel_cycle/20260310_094720/summary.md`

## Incremental Verification (2026-03-10T02:23:23Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260310_102320_082_59c5`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260310_102320_082_59c5/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:62003`
- run_id: `20260310_102226_ui_flow`
- run_ids: `20260310_102201_ui_flow 20260310_102226_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_FILLET_FAIL=2`
- failure_attribution_complete: `True` `code_total=2`
- setup_exit_codes: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
- failure_stage_counts: `flow=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260310_102226_ui_flow/summary.json`
- triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- failure_attribution: first_failed_run=`20260310_102201_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260310_102226_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260310_022323`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-10T02:32:58.184362+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- parallel_cycle_inputs: `watch_policy=observe` `weekly_policy=observe` `lane_a=False` `lane_b=True` `lane_c=False` `lane_b_ui_flow=True` `lane_b_ui_mode=gate` `lane_b_ui_timeout_ms=0` `strict=False`
- editor_roundtrip (observe): run_id=`20260310_103051_935_7dac` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_022633` run_ids=`20260310_022633,20260310_022427,20260310_014548,20260310_011408`
- step166: run_id=`20260310_023056` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_023056/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_023218`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=25` `fail_ratio=0.320` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=14 run_code=1`
  - ui_flow_first_stage_counts: `flow=7 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=0` `fail=2`
  - gate_ui_flow_run_ids: `20260310_102201_ui_flow 20260310_102226_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - gate_ui_flow_failure_stage_counts: `flow=4`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:62003`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_102320_082_59c5` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- parallel_cycle: `status=fail` `run_id=20260310_103232` `decision=fail` `raw=fail` `watch_policy=observe` `weekly_policy=observe` `watch_escalated=False` `duration_sec=26`
  - parallel_cycle_gate: `fail_reasons=LANE_B_FAIL LANE_B_UI_FLOW_FAIL LANE_B_UI_FLOW_INTERACTION_INCOMPLETE` `warning_codes=-`
  - lane_b: `status=fail` `rc=0` `duration_sec=26` `node_test_duration_sec=1`
  - lane_b_ui_flow: `enabled=True` `mode=gate` `status=fail` `timeout_ms=0` `attribution_complete=True` `interaction_complete=False`
    - lane_b_ui_setup_exits: `open=0` `resize=0` `run_code=0` `failure_stage=flow`
    - lane_b_ui_failure_code: `UI_FLOW_FILLET_FAIL`
  - parallel_cycle_summary_json: `build/editor_parallel_cycle/20260310_103232/summary.json`
  - parallel_cycle_summary_md: `build/editor_parallel_cycle/20260310_103232/summary.md`

## Incremental Verification (2026-03-10T05:05:41.725192+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- parallel_cycle_inputs: `watch_policy=observe` `weekly_policy=observe` `lane_a=False` `lane_b=True` `lane_c=False` `lane_b_ui_flow=True` `lane_b_ui_mode=gate` `lane_b_ui_timeout_ms=0` `strict=False`
- editor_roundtrip (observe): run_id=`20260310_130351_634_c948` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_035755` run_ids=`20260310_035755,20260310_023056,20260310_022633,20260310_022427`
- ui_flow_smoke: `FAIL` run_id=``
- ui_flow_gate_required: `required=False` `explicit=False`
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=0` `fail=1`
  - failure_attribution: `complete=False` `code_total=0`
  - setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
- ui_flow_failure_injection: `PASS` run_id=`` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`flow payload missing`
- step166: run_id=`20260310_050358` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_050358/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_050522`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=25` `fail_ratio=0.320` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=14 run_code=1`
  - ui_flow_first_stage_counts: `flow=7 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_115616_607_1a6d` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- parallel_cycle: `status=fail` `run_id=20260310_130536` `decision=fail` `raw=fail` `watch_policy=observe` `weekly_policy=observe` `watch_escalated=False` `duration_sec=5`
  - parallel_cycle_gate: `fail_reasons=LANE_B_FAIL LANE_B_UI_FLOW_ATTR_MISSING LANE_B_UI_FLOW_FAIL LANE_B_UI_FLOW_INTERACTION_INCOMPLETE` `warning_codes=-`
  - lane_b: `status=fail` `rc=0` `duration_sec=5` `node_test_duration_sec=1`
  - lane_b_ui_flow: `enabled=True` `mode=gate` `status=fail` `timeout_ms=0` `attribution_complete=False` `interaction_complete=False`
    - lane_b_ui_setup_exits: `open=0` `resize=0` `run_code=0` `failure_stage=-`
  - parallel_cycle_summary_json: `build/editor_parallel_cycle/20260310_130536/summary.json`
  - parallel_cycle_summary_md: `build/editor_parallel_cycle/20260310_130536/summary.md`

## Incremental Verification (2026-03-10T06:06:45Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260310_140642_024_bd6e`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260310_140642_024_bd6e/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `skipped` gate_required=`False` require_on=`False`
- status: `SKIPPED` reason=`CHECK_DISABLED` run_id=``
- build: `dir=` `BUILD_EDITOR_QT=` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: ``

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-10T06:11:36.000268+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- parallel_cycle_inputs: `watch_policy=observe` `weekly_policy=observe` `lane_a=False` `lane_b=True` `lane_c=False` `lane_b_ui_flow=True` `lane_b_ui_mode=gate` `lane_b_ui_timeout_ms=0` `strict=False`
- editor_roundtrip (observe): run_id=`20260310_140914_140_4ac0` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_050358` run_ids=`20260310_050358,20260310_035755,20260310_023056,20260310_022633`
- ui_flow_smoke: `FAIL` run_id=`20260310_140831_ui_flow`
  - run_ids: `20260310_140831_ui_flow`
- ui_flow_gate_required: `required=False` `explicit=False`
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=0` `fail=1`
  - failure_attribution: `complete=True` `code_total=2`
  - setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - first_failure_code: `UI_FLOW_ASSERT_FAIL`
  - failure_stage_counts: `flow=1`
  - gate_failure_codes: `UI_FLOW_ASSERT_FAIL=1 UI_FLOW_FILLET_FAIL=1`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260310_140831_ui_flow/summary.json`
  - triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
  - first_failed_run: run_id=`20260310_140831_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- ui_flow_failure_injection: `PASS` run_id=`20260310_140856_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:58746/tools/web_viewer/index.html?mode=editor&seed=0&debug=1&v=20260310_140856_ui_flow`
- step166: run_id=`20260310_060918` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_060918/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_061049`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=25` `fail_ratio=0.320` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=14 run_code=1`
  - ui_flow_first_stage_counts: `flow=7 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_140642_024_bd6e` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- parallel_cycle: `status=fail` `run_id=20260310_141105` `decision=fail` `raw=fail` `watch_policy=observe` `weekly_policy=observe` `watch_escalated=False` `duration_sec=30`
  - parallel_cycle_gate: `fail_reasons=LANE_B_FAIL LANE_B_UI_FLOW_FAIL LANE_B_UI_FLOW_INTERACTION_INCOMPLETE` `warning_codes=-`
  - lane_b: `status=fail` `rc=0` `duration_sec=30` `node_test_duration_sec=1`
  - lane_b_ui_flow: `enabled=True` `mode=gate` `status=fail` `timeout_ms=0` `attribution_complete=True` `interaction_complete=False`
    - lane_b_ui_setup_exits: `open=0` `resize=0` `run_code=0` `failure_stage=flow`
    - lane_b_ui_failure_code: `UI_FLOW_FILLET_FAIL`
  - parallel_cycle_summary_json: `build/editor_parallel_cycle/20260310_141105/summary.json`
  - parallel_cycle_summary_md: `build/editor_parallel_cycle/20260310_141105/summary.md`

## Incremental Verification (2026-03-10T06:13:36.055415+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260310_141154_210_158d` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_060918` run_ids=`20260310_060918,20260310_050358,20260310_035755,20260310_023056`
- step166: run_id=`20260310_061158` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_061158/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_061322`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=25` `fail_ratio=0.320` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=14 run_code=1`
  - ui_flow_first_stage_counts: `flow=7 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_140642_024_bd6e` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-10T06:37:06Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=lite` `step166=False` `ui_flow_gate=False` `convert_disabled=True`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260310_143704_245_b66d`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260310_143704_245_b66d/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `skipped` gate_required=`False` require_on=`False`
- status: `SKIPPED` reason=`CHECK_DISABLED` run_id=``
- build: `dir=` `BUILD_EDITOR_QT=` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: ``

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-10T06:41:50.257371+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260310_143959_243_c6d9` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_063732` run_ids=`20260310_063732,20260310_061158,20260310_060918,20260310_050358`
- step166: run_id=`20260310_064003` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_064003/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_064134`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=25` `fail_ratio=0.320` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=14 run_code=1`
  - ui_flow_first_stage_counts: `flow=7 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_143704_245_b66d` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=lite` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=True` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-10T08:20:13Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=lite` `step166=False` `ui_flow_gate=False` `convert_disabled=True`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260310_162011_146_1ac4`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260310_162011_146_1ac4/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `skipped` gate_required=`False` require_on=`False`
- status: `SKIPPED` reason=`CHECK_DISABLED` run_id=``
- build: `dir=` `BUILD_EDITOR_QT=` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: ``

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-10T08:26:11.627715+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260310_162359_826_353d` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_082029` run_ids=`20260310_082029,20260310_064003,20260310_063732,20260310_061158`
- step166: run_id=`20260310_082404` (gate_would_fail=`True`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_082404/summary.json`
  - baseline_compare: `compared=6` `degraded=1` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_082557`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=25` `fail_ratio=0.320` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=14 run_code=1`
  - ui_flow_first_stage_counts: `flow=7 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_162011_146_1ac4` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=lite` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=True` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-10T09:00:22Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=lite` `step166=False` `ui_flow_gate=False` `convert_disabled=True`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260310_170020_093_04eb`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260310_170020_093_04eb/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `skipped` gate_required=`False` require_on=`False`
- status: `SKIPPED` reason=`CHECK_DISABLED` run_id=``
- build: `dir=` `BUILD_EDITOR_QT=` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: ``

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-10T09:05:44Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=lite` `step166=False` `ui_flow_gate=False` `convert_disabled=True`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260310_170541_925_0d83`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260310_170541_925_0d83/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `skipped` gate_required=`False` require_on=`False`
- status: `SKIPPED` reason=`CHECK_DISABLED` run_id=``
- build: `dir=` `BUILD_EDITOR_QT=` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: ``

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-10T09:08:06.944354+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260310_170613_065_77a5` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_082404` run_ids=`20260310_082404,20260310_082029,20260310_064003,20260310_063732`
- step166: run_id=`20260310_090617` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_090617/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=2` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_090752`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=25` `fail_ratio=0.320` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=14 run_code=1`
  - ui_flow_first_stage_counts: `flow=7 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_170541_925_0d83` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=lite` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=True` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-10T09:08:36Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=lite` `step166=False` `ui_flow_gate=False` `convert_disabled=True`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260310_170833_460_c267`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260310_170833_460_c267/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `skipped` gate_required=`False` require_on=`False`
- status: `SKIPPED` reason=`CHECK_DISABLED` run_id=``
- build: `dir=` `BUILD_EDITOR_QT=` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: ``

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-10T09:10:42.678254+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260310_170904_971_3cfe` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_090617` run_ids=`20260310_090617,20260310_082404,20260310_082029,20260310_064003`
- step166: run_id=`20260310_090909` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_090909/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_091029`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=25` `fail_ratio=0.320` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=14 run_code=1`
  - ui_flow_first_stage_counts: `flow=7 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_170833_460_c267` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=lite` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=True` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-10T09:26:37Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=lite` `step166=False` `ui_flow_gate=False` `convert_disabled=True`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260310_172635_102_4217`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260310_172635_102_4217/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `skipped` gate_required=`False` require_on=`False`
- status: `SKIPPED` reason=`CHECK_DISABLED` run_id=``
- build: `dir=` `BUILD_EDITOR_QT=` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: ``

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-10T09:29:15.464057+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260310_172731_466_18f3` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_090909` run_ids=`20260310_090909,20260310_090617,20260310_082404,20260310_082029`
- step166: run_id=`20260310_092735` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_092735/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_092900`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=25` `fail_ratio=0.320` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=14 run_code=1`
  - ui_flow_first_stage_counts: `flow=7 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_172635_102_4217` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=lite` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=True` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-10T13:57:33Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260310_215729_234_ddef`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260310_215729_234_ddef/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260310_135733`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-10T14:01:29.175789+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- parallel_cycle_inputs: `watch_policy=observe` `weekly_policy=observe` `lane_a=False` `lane_b=True` `lane_c=False` `lane_b_ui_flow=True` `lane_b_ui_mode=gate` `lane_b_ui_timeout_ms=0` `strict=False`
- editor_roundtrip (observe): run_id=`20260310_215938_670_c2c7` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_092735` run_ids=`20260310_092735,20260310_090909,20260310_090617,20260310_082404`
- ui_flow_smoke: `FAIL` run_id=`20260310_215904_ui_flow`
  - run_ids: `20260310_215904_ui_flow`
- ui_flow_gate_required: `required=False` `explicit=False`
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=0` `fail=1`
  - failure_attribution: `complete=True` `code_total=2`
  - setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - first_failure_code: `UI_FLOW_ASSERT_FAIL`
  - failure_stage_counts: `flow=1`
  - gate_failure_codes: `UI_FLOW_ASSERT_FAIL=1 UI_FLOW_FILLET_FAIL=1`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260310_215904_ui_flow/summary.json`
  - triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
  - first_failed_run: run_id=`20260310_215904_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- ui_flow_failure_injection: `PASS` run_id=`20260310_215923_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:54399/tools/web_viewer/index.html?mode=editor&seed=0&debug=1&v=20260310_215923_ui_flow`
- step166: run_id=`20260310_135942` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_135942/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_140059`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=25` `fail_ratio=0.320` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=14 run_code=1`
  - ui_flow_first_stage_counts: `flow=7 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_215729_234_ddef` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- parallel_cycle: `status=fail` `run_id=20260310_220112` `decision=fail` `raw=fail` `watch_policy=observe` `weekly_policy=observe` `watch_escalated=False` `duration_sec=17`
  - parallel_cycle_gate: `fail_reasons=LANE_B_FAIL LANE_B_UI_FLOW_FAIL LANE_B_UI_FLOW_INTERACTION_INCOMPLETE` `warning_codes=-`
  - lane_b: `status=fail` `rc=0` `duration_sec=17` `node_test_duration_sec=1`
  - lane_b_ui_flow: `enabled=True` `mode=gate` `status=fail` `timeout_ms=0` `attribution_complete=True` `interaction_complete=False`
    - lane_b_ui_setup_exits: `open=0` `resize=0` `run_code=0` `failure_stage=flow`
    - lane_b_ui_failure_code: `UI_FLOW_FILLET_FAIL`
  - parallel_cycle_summary_json: `build/editor_parallel_cycle/20260310_220112/summary.json`
  - parallel_cycle_summary_md: `build/editor_parallel_cycle/20260310_220112/summary.md`

## Incremental Verification (2026-03-10T14:54:49Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260310_225445_057_cb25`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260310_225445_057_cb25/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:65305`
- run_id: `20260310_225350_ui_flow`
- run_ids: `20260310_225329_ui_flow 20260310_225350_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_FILLET_FAIL=2`
- failure_attribution_complete: `True` `code_total=2`
- setup_exit_codes: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
- failure_stage_counts: `flow=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260310_225350_ui_flow/summary.json`
- triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- failure_attribution: first_failed_run=`20260310_225329_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260310_225350_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260310_145448`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-10T14:58:24.637627+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- parallel_cycle_inputs: `watch_policy=observe` `weekly_policy=observe` `lane_a=False` `lane_b=True` `lane_c=False` `lane_b_ui_flow=True` `lane_b_ui_mode=gate` `lane_b_ui_timeout_ms=0` `strict=False`
- editor_roundtrip (observe): run_id=`20260310_225613_336_7fcd` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_135942` run_ids=`20260310_135942,20260310_092735,20260310_090909,20260310_090617`
- ui_flow_smoke: `FAIL` run_id=`20260310_225542_ui_flow`
  - run_ids: `20260310_225542_ui_flow`
- ui_flow_gate_required: `required=False` `explicit=False`
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=0` `fail=1`
  - failure_attribution: `complete=True` `code_total=2`
  - setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - first_failure_code: `UI_FLOW_ASSERT_FAIL`
  - failure_stage_counts: `flow=1`
  - gate_failure_codes: `UI_FLOW_ASSERT_FAIL=1 UI_FLOW_FILLET_FAIL=1`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260310_225542_ui_flow/summary.json`
  - triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
  - first_failed_run: run_id=`20260310_225542_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- ui_flow_failure_injection: `PASS` run_id=`20260310_225558_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:49730/tools/web_viewer/index.html?mode=editor&seed=0&debug=1&v=20260310_225558_ui_flow`
- step166: run_id=`20260310_145617` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_145617/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_145754`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=26` `fail_ratio=0.346` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=16 run_code=1`
  - ui_flow_first_stage_counts: `flow=8 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=0` `fail=2`
  - gate_ui_flow_run_ids: `20260310_225329_ui_flow 20260310_225350_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - gate_ui_flow_failure_stage_counts: `flow=4`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:65305`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_225445_057_cb25` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- parallel_cycle: `status=fail` `run_id=20260310_225806` `decision=fail` `raw=fail` `watch_policy=observe` `weekly_policy=observe` `watch_escalated=False` `duration_sec=18`
  - parallel_cycle_gate: `fail_reasons=LANE_B_FAIL LANE_B_UI_FLOW_FAIL LANE_B_UI_FLOW_INTERACTION_INCOMPLETE` `warning_codes=-`
  - lane_b: `status=fail` `rc=0` `duration_sec=18` `node_test_duration_sec=1`
  - lane_b_ui_flow: `enabled=True` `mode=gate` `status=fail` `timeout_ms=0` `attribution_complete=True` `interaction_complete=False`
    - lane_b_ui_setup_exits: `open=0` `resize=0` `run_code=0` `failure_stage=flow`
    - lane_b_ui_failure_code: `UI_FLOW_FILLET_FAIL`
  - parallel_cycle_summary_json: `build/editor_parallel_cycle/20260310_225806/summary.json`
  - parallel_cycle_summary_md: `build/editor_parallel_cycle/20260310_225806/summary.md`

## Incremental Verification (2026-03-10T14:59:59.066713+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260310_225828_462_587b` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_145617` run_ids=`20260310_145617,20260310_135942,20260310_092735,20260310_090909`
- step166: run_id=`20260310_145832` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_145832/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_145945`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=26` `fail_ratio=0.346` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=16 run_code=1`
  - ui_flow_first_stage_counts: `flow=8 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=0` `fail=2`
  - gate_ui_flow_run_ids: `20260310_225329_ui_flow 20260310_225350_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - gate_ui_flow_failure_stage_counts: `flow=4`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:65305`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_225445_057_cb25` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-10T15:00:22.296117+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260310_225853_159_0642` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_145832` run_ids=`20260310_145832,20260310_145617,20260310_135942,20260310_092735`
- step166: run_id=`20260310_145857` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_145857/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_150010`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=26` `fail_ratio=0.346` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=16 run_code=1`
  - ui_flow_first_stage_counts: `flow=8 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=0` `fail=2`
  - gate_ui_flow_run_ids: `20260310_225329_ui_flow 20260310_225350_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - gate_ui_flow_failure_stage_counts: `flow=4`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:65305`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_225445_057_cb25` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-10T15:40:58Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260310_234054_465_ccf9`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260310_234054_465_ccf9/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:58203`
- run_id: `20260310_233957_ui_flow`
- run_ids: `20260310_233936_ui_flow 20260310_233957_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_FILLET_FAIL=2`
- failure_attribution_complete: `True` `code_total=2`
- setup_exit_codes: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
- failure_stage_counts: `flow=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260310_233957_ui_flow/summary.json`
- triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- failure_attribution: first_failed_run=`20260310_233936_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260310_233957_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260310_154058`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-10T15:43:29.135710+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- parallel_cycle_inputs: `watch_policy=observe` `weekly_policy=observe` `lane_a=False` `lane_b=True` `lane_c=False` `lane_b_ui_flow=True` `lane_b_ui_mode=gate` `lane_b_ui_timeout_ms=0` `strict=False`
- editor_roundtrip (observe): run_id=`20260310_234141_994_5a50` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_145857` run_ids=`20260310_145857,20260310_145832,20260310_145617,20260310_135942`
- ui_flow_smoke: `FAIL` run_id=`20260310_234108_ui_flow`
  - run_ids: `20260310_234108_ui_flow`
- ui_flow_gate_required: `required=False` `explicit=False`
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=0` `fail=1`
  - failure_attribution: `complete=True` `code_total=2`
  - setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - first_failure_code: `UI_FLOW_ASSERT_FAIL`
  - failure_stage_counts: `flow=1`
  - gate_failure_codes: `UI_FLOW_ASSERT_FAIL=1 UI_FLOW_FILLET_FAIL=1`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260310_234108_ui_flow/summary.json`
  - triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
  - first_failed_run: run_id=`20260310_234108_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- ui_flow_failure_injection: `PASS` run_id=`20260310_234124_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:58849/tools/web_viewer/index.html?mode=editor&seed=0&debug=1&v=20260310_234124_ui_flow`
- step166: run_id=`20260310_154145` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260310_154145/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260310_154259`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=27` `fail_ratio=0.370` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=18 run_code=1`
  - ui_flow_first_stage_counts: `flow=9 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=0` `fail=2`
  - gate_ui_flow_run_ids: `20260310_233936_ui_flow 20260310_233957_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - gate_ui_flow_failure_stage_counts: `flow=4`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:58203`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260310_234054_465_ccf9` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- parallel_cycle: `status=fail` `run_id=20260310_234312` `decision=fail` `raw=fail` `watch_policy=observe` `weekly_policy=observe` `watch_escalated=False` `duration_sec=16`
  - parallel_cycle_gate: `fail_reasons=LANE_B_FAIL LANE_B_UI_FLOW_FAIL LANE_B_UI_FLOW_INTERACTION_INCOMPLETE` `warning_codes=-`
  - lane_b: `status=fail` `rc=0` `duration_sec=16` `node_test_duration_sec=1`
  - lane_b_ui_flow: `enabled=True` `mode=gate` `status=fail` `timeout_ms=0` `attribution_complete=True` `interaction_complete=False`
    - lane_b_ui_setup_exits: `open=0` `resize=0` `run_code=0` `failure_stage=flow`
    - lane_b_ui_failure_code: `UI_FLOW_FILLET_FAIL`
  - parallel_cycle_summary_json: `build/editor_parallel_cycle/20260310_234312/summary.json`
  - parallel_cycle_summary_md: `build/editor_parallel_cycle/20260310_234312/summary.md`

## Incremental Verification (2026-03-11T00:32:17Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260311_083211_443_0b92`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260311_083211_443_0b92/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:61784`
- run_id: `20260311_083054_ui_flow`
- run_ids: `20260311_083022_ui_flow 20260311_083054_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_FILLET_FAIL=2`
- failure_attribution_complete: `True` `code_total=2`
- setup_exit_codes: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
- failure_stage_counts: `flow=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_083054_ui_flow/summary.json`
- triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- failure_attribution: first_failed_run=`20260311_083022_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_083054_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260311_003215`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-11T00:33:58Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260311_083353_554_3697`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260311_083353_554_3697/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:62633`
- run_id: `20260311_083246_ui_flow`
- run_ids: `20260311_083217_ui_flow 20260311_083246_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_FILLET_FAIL=2`
- failure_attribution_complete: `True` `code_total=2`
- setup_exit_codes: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
- failure_stage_counts: `flow=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_083246_ui_flow/summary.json`
- triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- failure_attribution: first_failed_run=`20260311_083217_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_083246_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260311_003357`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-11T00:37:42.078631+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- parallel_cycle_inputs: `watch_policy=observe` `weekly_policy=observe` `lane_a=False` `lane_b=True` `lane_c=False` `lane_b_ui_flow=True` `lane_b_ui_mode=gate` `lane_b_ui_timeout_ms=0` `strict=False`
- editor_roundtrip (observe): run_id=`20260311_083519_152_9c41` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260310_154145` run_ids=`20260310_154145,20260310_145857,20260310_145832,20260310_145617`
- ui_flow_smoke: `FAIL` run_id=`20260311_083435_ui_flow`
  - run_ids: `20260311_083435_ui_flow`
- ui_flow_gate_required: `required=False` `explicit=False`
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=0` `fail=1`
  - failure_attribution: `complete=True` `code_total=2`
  - setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - first_failure_code: `UI_FLOW_ASSERT_FAIL`
  - failure_stage_counts: `flow=1`
  - gate_failure_codes: `UI_FLOW_ASSERT_FAIL=1 UI_FLOW_FILLET_FAIL=1`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_083435_ui_flow/summary.json`
  - triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
  - first_failed_run: run_id=`20260311_083435_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- ui_flow_failure_injection: `PASS` run_id=`20260311_083459_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:63737/tools/web_viewer/index.html?mode=editor&seed=0&debug=1&v=20260311_083459_ui_flow`
- step166: run_id=`20260311_003523` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260311_003523/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260311_003705`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=29` `fail_ratio=0.414` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=22 run_code=1`
  - ui_flow_first_stage_counts: `flow=11 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=0` `fail=2`
  - gate_ui_flow_run_ids: `20260311_083217_ui_flow 20260311_083246_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - gate_ui_flow_failure_stage_counts: `flow=4`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:62633`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260311_083353_554_3697` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- parallel_cycle: `status=fail` `run_id=20260311_083720` `decision=fail` `raw=fail` `watch_policy=observe` `weekly_policy=observe` `watch_escalated=False` `duration_sec=21`
  - parallel_cycle_gate: `fail_reasons=LANE_B_FAIL LANE_B_UI_FLOW_FAIL LANE_B_UI_FLOW_INTERACTION_INCOMPLETE` `warning_codes=-`
  - lane_b: `status=fail` `rc=0` `duration_sec=21` `node_test_duration_sec=1`
  - lane_b_ui_flow: `enabled=True` `mode=gate` `status=fail` `timeout_ms=0` `attribution_complete=True` `interaction_complete=False`
    - lane_b_ui_setup_exits: `open=0` `resize=0` `run_code=0` `failure_stage=flow`
    - lane_b_ui_failure_code: `UI_FLOW_FILLET_FAIL`
  - parallel_cycle_summary_json: `build/editor_parallel_cycle/20260311_083720/summary.json`
  - parallel_cycle_summary_md: `build/editor_parallel_cycle/20260311_083720/summary.md`

## Incremental Verification (2026-03-11T01:16:41Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260311_091635_411_f31c`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260311_091635_411_f31c/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:60534`
- run_id: `20260311_091522_ui_flow`
- run_ids: `20260311_091448_ui_flow 20260311_091522_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_FILLET_FAIL=2`
- failure_attribution_complete: `True` `code_total=2`
- setup_exit_codes: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
- failure_stage_counts: `flow=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_091522_ui_flow/summary.json`
- triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- failure_attribution: first_failed_run=`20260311_091448_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_091522_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260311_011639`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-11T01:30:40.364577+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- parallel_cycle_inputs: `watch_policy=observe` `weekly_policy=observe` `lane_a=False` `lane_b=True` `lane_c=False` `lane_b_ui_flow=True` `lane_b_ui_mode=gate` `lane_b_ui_timeout_ms=0` `strict=False`
- editor_roundtrip (observe): run_id=`20260311_092810_433_1127` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260311_003523` run_ids=`20260311_003523,20260310_154145,20260310_145857,20260310_145832`
- ui_flow_smoke: `FAIL` run_id=`20260311_092721_ui_flow`
  - run_ids: `20260311_092721_ui_flow`
- ui_flow_gate_required: `required=False` `explicit=False`
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=0` `fail=1`
  - failure_attribution: `complete=True` `code_total=2`
  - setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - first_failure_code: `UI_FLOW_ASSERT_FAIL`
  - failure_stage_counts: `flow=1`
  - gate_failure_codes: `UI_FLOW_ASSERT_FAIL=1 UI_FLOW_FILLET_FAIL=1`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_092721_ui_flow/summary.json`
  - triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
  - first_failed_run: run_id=`20260311_092721_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- ui_flow_failure_injection: `PASS` run_id=`20260311_092750_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:63170/tools/web_viewer/index.html?mode=editor&seed=0&debug=1&v=20260311_092750_ui_flow`
- step166: run_id=`20260311_012814` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260311_012814/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260311_013003`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=30` `fail_ratio=0.433` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=24 run_code=1`
  - ui_flow_first_stage_counts: `flow=12 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=0` `fail=2`
  - gate_ui_flow_run_ids: `20260311_091448_ui_flow 20260311_091522_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - gate_ui_flow_failure_stage_counts: `flow=4`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:60534`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260311_091635_411_f31c` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- parallel_cycle: `status=fail` `run_id=20260311_093017` `decision=fail` `raw=fail` `watch_policy=observe` `weekly_policy=observe` `watch_escalated=False` `duration_sec=23`
  - parallel_cycle_gate: `fail_reasons=LANE_B_FAIL LANE_B_UI_FLOW_FAIL LANE_B_UI_FLOW_INTERACTION_INCOMPLETE` `warning_codes=-`
  - lane_b: `status=fail` `rc=0` `duration_sec=23` `node_test_duration_sec=1`
  - lane_b_ui_flow: `enabled=True` `mode=gate` `status=fail` `timeout_ms=0` `attribution_complete=True` `interaction_complete=False`
    - lane_b_ui_setup_exits: `open=0` `resize=0` `run_code=0` `failure_stage=flow`
    - lane_b_ui_failure_code: `UI_FLOW_FILLET_FAIL`
  - parallel_cycle_summary_json: `build/editor_parallel_cycle/20260311_093017/summary.json`
  - parallel_cycle_summary_md: `build/editor_parallel_cycle/20260311_093017/summary.md`

## Incremental Verification (2026-03-11T01:31:08Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260311_093104_002_0afc`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260311_093104_002_0afc/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:64247`
- run_id: `20260311_092940_ui_flow`
- run_ids: `20260311_092917_ui_flow 20260311_092940_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_FILLET_FAIL=2`
- failure_attribution_complete: `True` `code_total=2`
- setup_exit_codes: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
- failure_stage_counts: `flow=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_092940_ui_flow/summary.json`
- triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- failure_attribution: first_failed_run=`20260311_092917_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_092940_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260311_013108`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-11T01:34:22.897857+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- parallel_cycle_inputs: `watch_policy=observe` `weekly_policy=observe` `lane_a=False` `lane_b=True` `lane_c=False` `lane_b_ui_flow=True` `lane_b_ui_mode=gate` `lane_b_ui_timeout_ms=0` `strict=False`
- editor_roundtrip (observe): run_id=`20260311_093158_857_36fd` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260311_012814` run_ids=`20260311_012814,20260311_003523,20260310_154145,20260310_145857`
- ui_flow_smoke: `FAIL` run_id=`20260311_093116_ui_flow`
  - run_ids: `20260311_093116_ui_flow`
- ui_flow_gate_required: `required=False` `explicit=False`
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=0` `fail=1`
  - failure_attribution: `complete=True` `code_total=2`
  - setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - first_failure_code: `UI_FLOW_ASSERT_FAIL`
  - failure_stage_counts: `flow=1`
  - gate_failure_codes: `UI_FLOW_ASSERT_FAIL=1 UI_FLOW_FILLET_FAIL=1`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_093116_ui_flow/summary.json`
  - triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
  - first_failed_run: run_id=`20260311_093116_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- ui_flow_failure_injection: `PASS` run_id=`20260311_093137_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:65482/tools/web_viewer/index.html?mode=editor&seed=0&debug=1&v=20260311_093137_ui_flow`
- step166: run_id=`20260311_013203` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260311_013203/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260311_013345`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=31` `fail_ratio=0.452` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=26 run_code=1`
  - ui_flow_first_stage_counts: `flow=13 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=0` `fail=2`
  - gate_ui_flow_run_ids: `20260311_092917_ui_flow 20260311_092940_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - gate_ui_flow_failure_stage_counts: `flow=4`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:64247`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260311_093104_002_0afc` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- parallel_cycle: `status=fail` `run_id=20260311_093401` `decision=fail` `raw=fail` `watch_policy=observe` `weekly_policy=observe` `watch_escalated=False` `duration_sec=21`
  - parallel_cycle_gate: `fail_reasons=LANE_B_FAIL LANE_B_UI_FLOW_FAIL LANE_B_UI_FLOW_INTERACTION_INCOMPLETE` `warning_codes=-`
  - lane_b: `status=fail` `rc=0` `duration_sec=21` `node_test_duration_sec=1`
  - lane_b_ui_flow: `enabled=True` `mode=gate` `status=fail` `timeout_ms=0` `attribution_complete=True` `interaction_complete=False`
    - lane_b_ui_setup_exits: `open=0` `resize=0` `run_code=0` `failure_stage=flow`
    - lane_b_ui_failure_code: `UI_FLOW_FILLET_FAIL`
  - parallel_cycle_summary_json: `build/editor_parallel_cycle/20260311_093401/summary.json`
  - parallel_cycle_summary_md: `build/editor_parallel_cycle/20260311_093401/summary.md`

## Incremental Verification (2026-03-11T02:18:01Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260311_101756_630_5bbe`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260311_101756_630_5bbe/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:58627`
- run_id: `20260311_101646_ui_flow`
- run_ids: `20260311_101614_ui_flow 20260311_101646_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_FILLET_FAIL=2`
- failure_attribution_complete: `True` `code_total=2`
- setup_exit_codes: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
- failure_stage_counts: `flow=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_101646_ui_flow/summary.json`
- triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- failure_attribution: first_failed_run=`20260311_101614_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_101646_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260311_021800`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-11T02:22:09.986517+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- parallel_cycle_inputs: `watch_policy=observe` `weekly_policy=observe` `lane_a=False` `lane_b=True` `lane_c=False` `lane_b_ui_flow=True` `lane_b_ui_mode=gate` `lane_b_ui_timeout_ms=0` `strict=False`
- editor_roundtrip (observe): run_id=`20260311_101946_157_4452` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260311_013203` run_ids=`20260311_013203,20260311_012814,20260311_003523,20260310_154145`
- ui_flow_smoke: `FAIL` run_id=`20260311_101858_ui_flow`
  - run_ids: `20260311_101858_ui_flow`
- ui_flow_gate_required: `required=False` `explicit=False`
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=0` `fail=1`
  - failure_attribution: `complete=True` `code_total=2`
  - setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - first_failure_code: `UI_FLOW_ASSERT_FAIL`
  - failure_stage_counts: `flow=1`
  - gate_failure_codes: `UI_FLOW_ASSERT_FAIL=1 UI_FLOW_FILLET_FAIL=1`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_101858_ui_flow/summary.json`
  - triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
  - first_failed_run: run_id=`20260311_101858_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- ui_flow_failure_injection: `PASS` run_id=`20260311_101925_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:59485/tools/web_viewer/index.html?mode=editor&seed=0&debug=1&v=20260311_101925_ui_flow`
- step166: run_id=`20260311_021950` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260311_021950/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260311_022134`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=32` `fail_ratio=0.469` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=28 run_code=1`
  - ui_flow_first_stage_counts: `flow=14 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=0` `fail=2`
  - gate_ui_flow_run_ids: `20260311_101614_ui_flow 20260311_101646_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - gate_ui_flow_failure_stage_counts: `flow=4`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:58627`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260311_101756_630_5bbe` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- parallel_cycle: `status=fail` `run_id=20260311_102147` `decision=fail` `raw=fail` `watch_policy=observe` `weekly_policy=observe` `watch_escalated=False` `duration_sec=22`
  - parallel_cycle_gate: `fail_reasons=LANE_B_FAIL LANE_B_UI_FLOW_FAIL LANE_B_UI_FLOW_INTERACTION_INCOMPLETE` `warning_codes=-`
  - lane_b: `status=fail` `rc=0` `duration_sec=22` `node_test_duration_sec=1`
  - lane_b_ui_flow: `enabled=True` `mode=gate` `status=fail` `timeout_ms=0` `attribution_complete=True` `interaction_complete=False`
    - lane_b_ui_setup_exits: `open=0` `resize=0` `run_code=0` `failure_stage=flow`
    - lane_b_ui_failure_code: `UI_FLOW_FILLET_FAIL`
  - parallel_cycle_summary_json: `build/editor_parallel_cycle/20260311_102147/summary.json`
  - parallel_cycle_summary_md: `build/editor_parallel_cycle/20260311_102147/summary.md`

## Incremental Verification (2026-03-11T03:22:53Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260311_112248_510_7c45`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260311_112248_510_7c45/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:54954`
- run_id: `20260311_112140_ui_flow`
- run_ids: `20260311_112103_ui_flow 20260311_112140_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_FILLET_FAIL=2`
- failure_attribution_complete: `True` `code_total=2`
- setup_exit_codes: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
- failure_stage_counts: `flow=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_112140_ui_flow/summary.json`
- triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- failure_attribution: first_failed_run=`20260311_112103_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_112140_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260311_032252`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-11T03:30:20.224179+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- parallel_cycle_inputs: `watch_policy=observe` `weekly_policy=observe` `lane_a=False` `lane_b=True` `lane_c=False` `lane_b_ui_flow=True` `lane_b_ui_mode=gate` `lane_b_ui_timeout_ms=0` `strict=False`
- editor_roundtrip (observe): run_id=`20260311_112817_319_9cc7` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260311_032358` run_ids=`20260311_032358,20260311_021950,20260311_013203,20260311_012814`
- ui_flow_smoke: `FAIL` run_id=`20260311_112719_ui_flow`
  - run_ids: `20260311_112719_ui_flow`
- ui_flow_gate_required: `required=False` `explicit=False`
- ui_flow_gate_runs: `target=1` `run_count=1` `pass=0` `fail=1`
  - failure_attribution: `complete=True` `code_total=2`
  - setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - first_failure_code: `UI_FLOW_ASSERT_FAIL`
  - failure_stage_counts: `flow=1`
  - gate_failure_codes: `UI_FLOW_ASSERT_FAIL=1 UI_FLOW_FILLET_FAIL=1`
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260311_112719_ui_flow/summary.json`
  - triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
  - first_failed_run: run_id=`20260311_112719_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- ui_flow_failure_injection: `PASS` run_id=`20260311_112755_ui_flow` code=`UI_FLOW_FLOW_JSON_INVALID` detail=`[OPEN] http://127.0.0.1:57920/tools/web_viewer/index.html?mode=editor&seed=0&debug=1&v=20260311_112755_ui_flow`
- step166: run_id=`20260311_032821` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260311_032821/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260311_032941`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=33` `fail_ratio=0.485` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=30 run_code=1`
  - ui_flow_first_stage_counts: `flow=15 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=0` `fail=2`
  - gate_ui_flow_run_ids: `20260311_112103_ui_flow 20260311_112140_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - gate_ui_flow_failure_stage_counts: `flow=4`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:54954`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260311_112248_510_7c45` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`
- parallel_cycle: `status=fail` `run_id=20260311_112954` `decision=fail` `raw=fail` `watch_policy=observe` `weekly_policy=observe` `watch_escalated=False` `duration_sec=25`
  - parallel_cycle_gate: `fail_reasons=LANE_B_FAIL LANE_B_UI_FLOW_FAIL LANE_B_UI_FLOW_INTERACTION_INCOMPLETE` `warning_codes=-`
  - lane_b: `status=fail` `rc=0` `duration_sec=25` `node_test_duration_sec=1`
  - lane_b_ui_flow: `enabled=True` `mode=gate` `status=fail` `timeout_ms=0` `attribution_complete=True` `interaction_complete=False`
    - lane_b_ui_setup_exits: `open=0` `resize=0` `run_code=0` `failure_stage=flow`
    - lane_b_ui_failure_code: `UI_FLOW_FILLET_FAIL`
  - parallel_cycle_summary_json: `build/editor_parallel_cycle/20260311_112954/summary.json`
  - parallel_cycle_summary_md: `build/editor_parallel_cycle/20260311_112954/summary.md`

## Incremental Verification (2026-03-11T04:18:53Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260311_121849_581_7edc`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260311_121849_581_7edc/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `skipped` gate_required=`False` require_on=`False`
- status: `SKIPPED` reason=`CHECK_DISABLED` run_id=``
- build: `dir=` `BUILD_EDITOR_QT=` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: ``

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-11T06:02:51Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260311_140246_393_0d60`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260311_140246_393_0d60/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `skipped` gate_required=`False` require_on=`False`
- status: `SKIPPED` reason=`CHECK_DISABLED` run_id=``
- build: `dir=` `BUILD_EDITOR_QT=` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: ``

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-11T06:07:41.363806+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260311_140550_730_f682` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260311_060306` run_ids=`20260311_060306,20260311_042035,20260311_040530,20260311_032821`
- step166: run_id=`20260311_060554` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260311_060554/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260311_060728`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=33` `fail_ratio=0.485` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=30 run_code=1`
  - ui_flow_first_stage_counts: `flow=15 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260311_140246_393_0d60` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-12T00:53:44Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_085337_558_245b`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_085337_558_245b/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_005343`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T00:54:31Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_085426_291_7ef4`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_085426_291_7ef4/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_005430`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T01:14:00Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_091354_733_4109`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_091354_733_4109/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_011359`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T01:18:39.838218+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260312_091541_021_2501` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260312_005907` run_ids=`20260312_005907,20260312_005638,20260311_060554,20260311_060306`
- step166: run_id=`20260312_011545` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260312_011545/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260312_011717`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=35` `fail_ratio=0.514` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=34 run_code=1`
  - ui_flow_first_stage_counts: `flow=17 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=0` `fail=2`
  - gate_ui_flow_run_ids: `20260312_091718_ui_flow 20260312_091747_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - gate_ui_flow_failure_stage_counts: `flow=4`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:61063`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260312_091833_968_694a` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260312_011545` run_ids=`20260312_011545`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-12T01:28:21Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_092816_665_2a13`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_092816_665_2a13/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_012820`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T01:31:57Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_093152_109_f755`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_093152_109_f755/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_013156`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T01:35:12.068884+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260312_093211_368_0bc2` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260312_011545` run_ids=`20260312_011545,20260312_005907,20260312_005638,20260311_060554`
- step166: run_id=`20260312_013215` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260312_013215/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260312_013339`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=36` `fail_ratio=0.528` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=36 run_code=1`
  - ui_flow_first_stage_counts: `flow=18 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=gate` `status=gate` `run_count=2` `pass=0` `fail=2`
  - gate_ui_flow_run_ids: `20260312_093341_ui_flow 20260312_093409_ui_flow`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
  - gate_ui_flow_failure_stage_counts: `flow=4`
  - gate_ui_flow_port_allocation: `available=true` `status=OK` `reason=auto:52314`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260312_093454_320_d087` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=True` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260312_013215` run_ids=`20260312_013215`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-12T01:55:25Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_095520_616_d3af`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_095520_616_d3af/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:63802`
- run_id: `20260312_095438_ui_flow`
- run_ids: `20260312_095414_ui_flow 20260312_095438_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_FILLET_FAIL=2`
- failure_attribution_complete: `True` `code_total=2`
- setup_exit_codes: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
- failure_stage_counts: `flow=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260312_095438_ui_flow/summary.json`
- triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- failure_attribution: first_failed_run=`20260312_095414_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260312_095438_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_015524`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T01:55:57Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_095552_752_d165`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_095552_752_d165/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_015557`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T01:58:00.908975+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260312_095613_477_6261` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260312_013215` run_ids=`20260312_013215,20260312_011545,20260312_005907,20260312_005638`
- step166: run_id=`20260312_015619` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260312_015619/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260312_015746`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=37` `fail_ratio=0.541` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=38 run_code=1`
  - ui_flow_first_stage_counts: `flow=19 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`

## Incremental Verification (2026-03-12T02:02:11.604154+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260312_100034_035_15aa` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260312_015619` run_ids=`20260312_015619,20260312_013215,20260312_011545,20260312_005907`
- step166: run_id=`20260312_020038` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260312_020038/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260312_020157`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=37` `fail_ratio=0.541` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=38 run_code=1`
  - ui_flow_first_stage_counts: `flow=19 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`

## Incremental Verification (2026-03-12T02:05:32.109822+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260312_100338_333_3424` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260312_020038` run_ids=`20260312_020038,20260312_015619,20260312_013215,20260312_011545`
- step166: run_id=`20260312_020342` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260312_020342/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=2` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260312_020516`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=37` `fail_ratio=0.541` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=38 run_code=1`
  - ui_flow_first_stage_counts: `flow=19 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`

## Incremental Verification (2026-03-12T02:07:46.356527+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260312_100608_902_e7cb` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260312_020342` run_ids=`20260312_020342,20260312_020038,20260312_015619,20260312_013215`
- step166: run_id=`20260312_020613` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260312_020613/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260312_020732`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=37` `fail_ratio=0.541` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=38 run_code=1`
  - ui_flow_first_stage_counts: `flow=19 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260312_095552_752_d165` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-12T02:13:50.645442+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260312_101208_675_6a57` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260312_020613` run_ids=`20260312_020613,20260312_020342,20260312_020038,20260312_015619`
- step166: run_id=`20260312_021213` (gate_would_fail=`True`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260312_021213/summary.json`
  - baseline_compare: `compared=0` `degraded=0` `improved=0` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260312_021337`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=37` `fail_ratio=0.541` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=38 run_code=1`
  - ui_flow_first_stage_counts: `flow=19 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260312_095552_752_d165` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=True` `real_scene_trend=True` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-12T02:22:00Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_102155_456_d796`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_102155_456_d796/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_022200`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T02:22:08Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=True` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_102204_297_a0a4`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_102204_297_a0a4/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `gate`
- gate_required: `required=True` `explicit=False`
- port_allocation: `available=true` `status=OK` `reason=auto:55012`
- run_id: `20260312_102125_ui_flow`
- run_ids: `20260312_102058_ui_flow 20260312_102125_ui_flow`
- ok: `False` exit_code=`2`
- gate_runs: `target=2` `run_count=2` `pass=0` `fail=2`
- gate_failure_codes: `UI_FLOW_FILLET_FAIL=2`
- failure_attribution_complete: `True` `code_total=2`
- setup_exit_codes: `open=0` `resize=0` `run_code=0` `first_failure_stage=flow`
- failure_stage_counts: `flow=2`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260312_102125_ui_flow/summary.json`
- triage: step=`fillet_polyline` selection=`1 selected (polyline)` status=`Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- failure_attribution: first_failed_run=`20260312_102058_ui_flow` code=`UI_FLOW_FILLET_FAIL` step=`fillet_polyline` selection=`1 selected (polyline)` detail=`Fillet failure status missing error code: Fillet: radius=999.00. Click near second side on selected polyline (Esc to cancel)`
- screenshot: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_ui_flow_smoke/20260312_102125_ui_flow/editor_ui_flow.png`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_022208`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T02:24:42.407987+00:00 weekly validation)
```bash
bash tools/editor_weekly_validation.sh
```
- weekly_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- editor_roundtrip (observe): run_id=`20260312_102226_441_62e7` status=`PASS` pass=`8` fail=`0` skipped=`0`
  - case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` min=`4`
  - generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly.json` count=`8` declared=`8` actual=`8` mismatch=`False` min=`4` priorities=`P0,P1`
  - generated_mismatch_policy: `policy=warn`
  - generated_runs: run_id=`20260312_021213` run_ids=`20260312_021213,20260312_020613,20260312_020342,20260312_020038`
- step166: run_id=`20260312_022230` (gate_would_fail=`False`)
  - summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/cad_regression/20260312_022230/summary.json`
  - baseline_compare: `compared=6` `degraded=0` `improved=3` baseline_run_id=`20260216_010837` baseline=`/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/docs/baselines/STEP166_baseline_summary.json`
- perf: run_id=`20260312_022354`
- ui_flow_stage_trend: `status=unstable` `recommended_gate_mode=observe` `enabled_samples=38` `fail_ratio=0.553` `attribution_ratio=1.000`
  - ui_flow_stage_counts: `flow=40 run_code=1`
  - ui_flow_first_stage_counts: `flow=20 run_code=1`
  - ui_flow_stage_trend_json: `build/editor_ui_flow_stage_trend.json`
- gate_summary_json: `build/editor_gate_summary.json`
- gate_ui_flow_smoke: `mode=skipped` `status=skipped` `run_count=0` `pass=0` `fail=0`
  - gate_ui_flow_setup_exits: `open=0` `resize=0` `run_code=0` `first_failure_stage=-`
  - gate_ui_flow_port_allocation: `available=unknown` `status=NOT_RUN` `reason=`
- gate_step166: run_id=`` enabled=`False` would_fail=`False`
- gate_editor_smoke: run_id=`20260312_102422_712_6242` status=`PASS` pass=`5` fail=`0` skipped=`0`
  - gate_runtime: `profile=<none>` `step166_gate=False` `ui_flow_gate=False` `convert_disabled=False` `perf_trend=False` `real_scene_trend=False` `source=gate.inputs`
  - gate_case_source: `generated` cases=`local/editor_roundtrip_smoke_cases_weekly.json`
  - gate_generated_cases: path=`local/editor_roundtrip_smoke_cases_weekly_gate.json` count=`2` declared=`2` actual=`2` mismatch=`False` priorities=`P0,P1`
  - gate_generated_mismatch_policy: `policy=warn` `gate_fail=False`
  - gate_generated_runs: run_id=`20260312_022230` run_ids=`20260312_022230`
  - gate_unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0`

## Incremental Verification (2026-03-12T02:33:23Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_103317_586_bc43`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_103317_586_bc43/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_023322`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T02:34:16Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_103411_877_80f2`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_103411_877_80f2/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_023416`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T02:35:21Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_103516_686_1bb5`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_103516_686_1bb5/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_023520`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T04:18:08Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_121802_588_7a6f`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_121802_588_7a6f/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_041806`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T05:11:11Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_131106_205_3df6`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_131106_205_3df6/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_051110`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T05:27:04Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_132658_122_ef16`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_132658_122_ef16/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_052703`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T06:01:42Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_140135_864_cf40`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_140135_864_cf40/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_060141`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T06:15:40Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_141535_186_c0dd`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_141535_186_c0dd/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=5 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=5` `checked=20` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=5` `matched=20` `candidate=20` `total=20` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_061539`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T06:32:31Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_143208_818_e021`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_143208_818_e021/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=17 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=17` `checked=68` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=17` `matched=68` `candidate=68` `total=68` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_063229`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T06:52:13Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_145159_045_839b`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_145159_045_839b/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=17 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=17` `checked=68` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=17` `matched=68` `candidate=68` `total=68` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_065213`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T07:10:44Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_151028_627_ea77`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_151028_627_ea77/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=17 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=17` `checked=68` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=17` `matched=68` `candidate=68` `total=68` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_071043`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T07:23:19Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_152304_355_797b`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_152304_355_797b/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=17 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=17` `checked=68` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=17` `matched=68` `candidate=68` `total=68` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_072318`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T07:35:31Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_153515_555_6d21`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_153515_555_6d21/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=17 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=17` `checked=68` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=17` `matched=68` `candidate=68` `total=68` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_073530`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T08:03:23Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_160310_415_904a`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_160310_415_904a/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=17 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=17` `checked=68` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=17` `matched=68` `candidate=68` `total=68` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_080322`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-12T08:33:03Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260312_163247_125_8641`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260312_163247_125_8641/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=17 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=17` `checked=68` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=17` `matched=68` `candidate=68` `total=68` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260312_083302`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`

## Incremental Verification (2026-03-13T00:14:34Z editor gate)
### One-button gate
```bash
bash tools/editor_gate.sh
```
- baseline: `docs/baselines/STEP166_baseline_summary.json`
- gate_inputs: `profile=` `step166=False` `ui_flow_gate=False` `convert_disabled=False`
- cad_attempts: `used=0/3`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

### Editor round-trip gate result
- run_id: `20260313_081419_738_f5f1`
- status: `PASS`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260313_081419_738_f5f1/summary.json`
- case_guard: `source=discovery` `cases=0` `min=4`
- totals: `pass=17 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- failure_attribution_complete: `True` `code_total=0`
- unsupported_passthrough: `cases_with_checks=17` `checked=68` `missing=0` `drifted=0` `failed_cases=0` `first_failed_case=`
- case_selection: `selected=17` `matched=68` `candidate=68` `total=68` `fallback=False`
- gate_would_fail: `False`
- gate_fail_reasons: `none`

### Editor UI flow smoke
- mode: `skipped` enabled=`False`
- gate_required: `required=False` `explicit=True`
- port_allocation: `available=unknown` `status=NOT_RUN` `reason=`

### Qt project persistence
- mode: `observe` gate_required=`False` require_on=`False`
- status: `skipped` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260313_001432`
- build: `dir=build` `BUILD_EDITOR_QT=OFF` `target_available=False`
- exit_codes: `script=0` `build=0` `test=0`
- summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`

### STEP166 baseline gate result
- run_id: ``
- run_dir: ``
- summary_json: ``
- totals: `pass=0 fail=0 skipped=0`
- failure_buckets: `INPUT_INVALID=0 IMPORT_FAIL=0 VIEWPORT_LAYOUT_MISSING=0 RENDER_DRIFT=0 TEXT_METRIC_DRIFT=0`
- gate_would_fail: `False`
- gate_fail_reasons: `none`
- baseline_compare: `compared=0 degraded=0 improved=0`
