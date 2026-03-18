# STEP179 Break / Join 验证记录

## 2026-02-13

### 变更摘要
- 新增命令：
  - `selection.break`（line/polyline，含 closed polyline 打开）
  - `selection.join`（v1：2+ entities 链式合并）
- 新增工具：
  - `break`（pick target -> pick point）
- UI：
  - 左侧工具栏增加 Break
  - 命令输入支持 `br` 与 `join`
- Node tests 增补：
  - break：line/open/closed
  - join：2 entities + 3 entities(primary 在中间) + disjoint `NO_MATCH`

### 验证命令
- Node tests：
  - `node --test tools/web_viewer/tests/editor_commands.test.js`
  - 结果：PASS
- Light gate：
  - `bash tools/ci_editor_light.sh`
  - 结果：PASS
  - round-trip run_id：`20260213_101722_139_f71e`
  - 产物：`build/editor_roundtrip/20260213_101722_139_f71e/summary.json`

### 增量验证（2026-02-13：两点 Break + Fillet/Chamfer starter）
- 变更摘要：
  - break：open polyline 的两点模式修正为“第二点在插入后的 points 上重新寻段投影”，避免索引偏移
  - tests：新增两点 break（line/open/closed reject）与 fillet/chamfer（line-line）覆盖
- Node tests：
  - `node --test tools/web_viewer/tests/editor_commands.test.js`
  - 结果：PASS（tests=45, fail=0）
- Light gate：
  - `bash tools/ci_editor_light.sh`
  - 结果：PASS
  - round-trip run_id：`20260213_113752_881_a5bc`
  - 产物：`build/editor_roundtrip/20260213_113752_881_a5bc/summary.json`

### 增量验证（2026-02-13：Break tool 交互收口）
- 变更摘要：
  - break tool：Esc 在两点模式下回退到单点模式（不丢失 target），降低误操作成本
  - tests：新增 `break tool supports two-point mode and Esc backs out without losing target`
- Node tests：
  - `node --test tools/web_viewer/tests/editor_commands.test.js`
  - 结果：PASS（tests=50, fail=0）
- Light gate：
  - `bash tools/ci_editor_light.sh`
  - 结果：PASS
  - round-trip run_id：`20260213_115939_525_d928`
  - 产物：`build/editor_roundtrip/20260213_115939_525_d928/summary.json`

### 增量验证（2026-02-13：closed polyline 两点 Break + open polyline 索引漂移修正）
- 变更摘要：
  - break：closed polyline 支持两点模式（删除 pick1->pick2 中段，输出 1 条 open polyline）
  - break：open polyline 两点模式在插入 pick2 时若发生数组 splice（insertIndex2 <= breakIndex），同步修正 breakIndex，避免删除范围错误
  - tests：新增 open polyline “pick2 插入在 pick1 之前”覆盖；closed polyline 两点 break 从 reject 改为 success
- Node tests：
  - `node --test tools/web_viewer/tests/editor_commands.test.js`
  - 结果：PASS（tests=54, fail=0）
- Light gate：
  - `bash tools/ci_editor_light.sh`
  - 结果：PASS
  - round-trip run_id：`20260213_123901_563_61a9`
  - 产物：`build/editor_roundtrip/20260213_123901_563_61a9/summary.json`

### 增量验证（2026-02-13：closed polyline 两点 Break 显式 keep short/long）
- 变更摘要：
  - `selection.break`：closed polyline 两点模式新增 `keep:"short"|"long"`（默认行为保持不变）
  - `break` tool：两点模式第二点支持修饰键：
    - `Ctrl/Cmd` -> `keep:"short"`
    - `Alt` -> `keep:"long"`
  - tests：新增 closed polyline 两点 break 的 keep=short/keep=long 覆盖
- Node tests：
  - `node --test tools/web_viewer/tests/editor_commands.test.js`
  - 结果：PASS（tests=58, fail=0）
- Light gate：
  - `bash tools/ci_editor_light.sh`
  - 结果：PASS
- round-trip run_id：`20260213_140538_284_9819`
  - 产物：`build/editor_roundtrip/20260213_140538_284_9819/summary.json`

### 增量验证（2026-02-13：Break Keep 状态栏显式选择 + UI flow smoke 门禁化）
- 变更摘要：
  - UI：状态栏新增 `Break Keep: Auto|Short|Long`
  - break tool：两点模式对 closed polyline 时，优先使用 `toolOptions.breakKeep`（Short/Long 覆盖修饰键）
  - local_ci：新增可选 UI flow smoke 步骤（observe/gate），并写入 `local_ci_summary.json`
- Node tests：
  - `node --test tools/web_viewer/tests/editor_commands.test.js`
  - 结果：PASS（tests=63, fail=0）
- Editor light gate：
  - `bash tools/ci_editor_light.sh`
  - 结果：PASS
  - round-trip run_id：`20260213_144748_984_2636`
  - 产物：`build/editor_roundtrip/20260213_144748_984_2636/summary.json`
- UI flow smoke（gate）：
  - `bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --port 18081`
  - 结果：PASS
  - run_id：`20260213_144830_ui_flow`
  - 产物：`build/editor_ui_flow_smoke/20260213_144830_ui_flow/summary.json`
