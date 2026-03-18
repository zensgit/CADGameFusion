# STEP180 Fillet / Chamfer 验证记录

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
