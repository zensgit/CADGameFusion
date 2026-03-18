# STEP177 Level B 编辑能力验证记录

## 2026-02-12
- Offset（line/circle/arc）已落地：
  - 命令：`selection.offset`
  - 工具：`offset`（支持预览 + ESC 取消）
  - Node tests：`tools/web_viewer/tests/editor_commands.test.js` 增加 `selection.offset` 用例
- CI（light gate）已落地：
  - `tools/ci_editor_light.sh`
  - `.github/workflows/cadgamefusion_editor_light.yml`
- STEP176 dashboard 已落地：
  - `tools/write_step176_dashboard.py`
  - `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_DASHBOARD.md`

## 2026-02-13
- Offset 扩展：polyline（open + closed）已支持（miter join + miter limit 自动 bevel + 自交拒绝）
  - 代码：`tools/web_viewer/tools/geometry.js`（`computeOffsetEntity`）
  - 工具提示更新：`tools/web_viewer/tools/offset_tool.js`
- Node tests 增补：
  - `tools/web_viewer/tests/editor_commands.test.js` 增加 `selection.offset supports open polyline`
  - `tools/web_viewer/tests/editor_commands.test.js` 增加 `selection.offset supports closed polyline`
  - `tools/web_viewer/tests/editor_commands.test.js` 增加 `selection.offset rejects self-intersecting polyline`
- Break / Join（v1）已落地：
  - 命令：`selection.break`, `selection.join`
  - 工具：`break`
- 设计：`docs/STEP179_BREAK_JOIN_DESIGN.md`
- 设计：`docs/STEP180_FILLET_CHAMFER_DESIGN.md`
- 计划：`docs/STEP181_LEVELB_INTERACTION_AND_VERIFICATION_PLAN.md`
  - 范围：break 已支持 closed polyline；join 已支持 2+ entities 链式合并
- 验证（light gate）：
  - 命令：`bash tools/ci_editor_light.sh`
  - round-trip run_id：`20260213_101722_139_f71e`（`build/editor_roundtrip/20260213_101722_139_f71e`）
  - smoke 编辑覆盖增强：`tools/web_viewer/scripts/editor_roundtrip_smoke.js` 已包含 offset(line/polyline)

## 2026-02-13（增量）
- Break 两点模式与 Fillet/Chamfer starter：
  - break：line/open polyline 支持两点删除中段；closed 两点返回 `UNSUPPORTED_CLOSED_TWO_POINT`
  - fillet/chamfer：line-line 命令级 v0（含 undo/redo 单步）
- Node tests：
  - 命令：`node --test tools/web_viewer/tests/editor_commands.test.js`
  - 结果：PASS（tests=45）
- Light gate：
  - 命令：`bash tools/ci_editor_light.sh`
  - 结果：PASS
  - round-trip run_id：`20260213_115939_525_d928`（`build/editor_roundtrip/20260213_115939_525_d928`）
- STEP166 observe（预览链路兼容性复跑）：
  - 命令：`./scripts/cad_regression_run.py --mode observe`
  - run_id：`20260213_034752`（gate_would_fail=False）

### Editor round-trip smoke（真实预览产物采样，observe, --no-convert）
- 命令：`node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 5 --no-convert`
- run_id：`20260213_115827_016_a6be`（pass=5 fail=0 skipped=0）
- 产物：`build/editor_roundtrip/20260213_115827_016_a6be/summary.json`

## 2026-02-13（增量2）
- Break 两点模式收口：
  - closed polyline：两点 break 已支持（删除 pick1->pick2 中段，输出 1 条 open polyline）
  - open polyline：两点 break 在插入 pick2 顶点时修正 breakIndex，避免索引漂移导致删除范围错误
- Fillet/Chamfer 工具化：
  - 新增工具：`fillet` / `chamfer`（两次 pick 后触发命令；参数从 command input args 读取）
- Node tests：
  - 命令：`node --test tools/web_viewer/tests/editor_commands.test.js`
  - 结果：PASS（tests=54）
- Light gate：
  - 命令：`bash tools/ci_editor_light.sh`
  - 结果：PASS
  - round-trip run_id：`20260213_123901_563_61a9`（`build/editor_roundtrip/20260213_123901_563_61a9`）
- UI smoke（可选门禁，Playwright screenshot）：
  - 命令：`bash tools/web_viewer/scripts/editor_ui_smoke.sh --mode gate`
  - run_id：`20260213_124132_ui`（ok=true）
- STEP166 observe（预览链路兼容性复跑）：
  - 命令：`./scripts/cad_regression_run.py --mode observe`
  - run_id：`20260213_044226`（gate_would_fail=False）
