# STEP178 Offset(polyline) 验证记录

## 2026-02-13

### 变更摘要
- Offset 支持 polyline（open + closed）：
  - `tools/web_viewer/tools/geometry.js` 增加 polyline 分支（miter join + miter limit 自动 bevel + 自交拒绝）
  - `tools/web_viewer/tools/offset_tool.js` 更新提示文案
- Node tests 增补：
  - `tools/web_viewer/tests/editor_commands.test.js` 增加 `selection.offset supports open polyline`
  - `tools/web_viewer/tests/editor_commands.test.js` 增加 `selection.offset supports closed polyline`
  - `tools/web_viewer/tests/editor_commands.test.js` 增加 `selection.offset rejects self-intersecting polyline`
- Round-trip smoke 覆盖增强：
  - `tools/web_viewer/scripts/editor_roundtrip_smoke.js` 额外执行 `selection.offset`（line + polyline），用于轻门禁覆盖

### 验证命令与结果
- Node tests：
  - `node --test tools/web_viewer/tests/editor_commands.test.js`
  - 结果：PASS
- Light gate：
  - `bash tools/ci_editor_light.sh`
  - 结果：PASS
  - round-trip run_id：`20260213_014506_797_0206`
  - 产物：`build/editor_roundtrip/20260213_014506_797_0206/summary.json`
