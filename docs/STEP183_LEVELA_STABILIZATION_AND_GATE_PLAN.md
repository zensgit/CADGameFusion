# STEP183 Level A Stabilization + Gate Rollout Plan (Web Editor)

本计划把“Web editor 可编辑（Level A）”从一次性功能达成推进到可长期维护的工程状态：可回归、可观测、可门禁。

## 目标（Definition of Done）
1. **可编辑护栏固定**：`tools/ci_editor_light.sh` 默认包含 UI-flow gate + round-trip smoke + Node tests，且在常见开发机上稳定通过。
2. **observe -> gate**：一周内先 observe（记录趋势/失败归因），两周内满足稳定性门槛后把 gate 作为默认阻塞标准（可通过开关降级）。
3. **可解释失败**：失败必须能定位到：
   - 几何/命令逻辑（Node tests）
   - UI wiring / 状态机（UI flow smoke）
   - 输入与导入链路（STEP166）
   - 性能退化（perf trend）

## 非目标（明确不做）
- paper space/layout/viewport 交互编辑、dimension/dimstyle、blocks/xref、打印出图一致性（这些属于 Level C 方向）。
- GUI 自动化复刻 AutoCAD 全部命令（只做 Level A 核心闭环稳定化）。

## 验证金字塔（强制执行顺序）
1. **Node 命令级单测（最稳）**
   - 命令/几何/状态机：`node --test tools/web_viewer/tests/editor_commands.test.js`
2. **Round-trip smoke（真实样例闭环，轻量）**
   - CADGF `document.json` 导入 -> 编辑 -> 导出 -> schema 校验（可选 convert）
   - `node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit N`
3. **UI flow smoke（真实交互 wiring，门禁核心）**
   - `bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe|gate --timeout-ms 25000`
4. **STEP166（预览链路不回退，按周跑）**
   - `./scripts/cad_regression_run.py --mode observe ...`

## 门禁策略（observe -> gate）
### 阶段 0：默认 gate（当前策略）
`tools/ci_editor_light.sh` 默认 gate UI-flow（可用 `SKIP_EDITOR_UI_FLOW_SMOKE=1` 暂时跳过）。
`tools/editor_gate.sh` 默认 gate UI-flow（可用 `RUN_EDITOR_UI_FLOW_SMOKE_GATE=0` 禁用）。

### 阶段 1：稳定性门槛（连续两周）
以下条件连续两周满足，视为“Level A 可长期用”：
1. `ci_editor_light` 连续 10 次本地/CI 执行无 flaky（同 commit 重跑不随机失败）。
2. `editor_roundtrip_smoke` 对最近 20 个真实样例（`--limit 20`）PASS。
3. UI-flow smoke 的关键步骤对几何断言为主（避免依赖易变 status 文案）。

### 阶段 2：回退策略
出现以下情况允许临时降级为 observe（但必须在报告中记录原因与期限）：
- Playwright/浏览器升级导致系统性不稳定（需要先修复工具链）
- 交互重大改造期（例如 grips 大改/性能架构调整）

## 两周迭代计划（可直接落地执行）
### Week 1（稳定化 + 覆盖补齐）
1. **UI flow smoke 覆盖扩展**
   - 目标：覆盖“最常见的编辑路径”而不是堆命令数量
   - 优先项：
     - Extend/Trim：polyline 中段段级行为（已覆盖 split/endpoint；补齐更多边界组合）
     - Break：Shift 两点模式 + closed polyline keep override（确保不会破坏 undo/redo）
     - Layer：hide/lock 与 pick/boxSelect 的组合（避免“能看但选不到/能选但不该选”）
2. **失败信息收口**
   - 目标：任何失败都能看到 `__step`/截图/console
   - 输出：`build/editor_ui_flow_smoke/<run_id>/summary.json`
3. **端口/环境稳定性**
   - 默认 free-port（避免并发/残留 server 占用）
   - 统一 `--timeout-ms 25000` 作为 CI 默认

### Week 2（门禁化 + 趋势报告）
1. **把 gate 结果写入周报**
   - `bash tools/editor_weekly_validation.sh` 作为统一入口（包含：tests + roundtrip + ui-flow + perf trend）
   - 用 `tools/write_editor_gate_report.py` 输出可读报告（Markdown）
2. **性能趋势基线**
   - `python3 tools/editor_perf_trend.py` 记录关键指标（pick/boxSelect/snap）
   - 明确阈值：例如 p50/p95 不超过基线 + 20%

## 开发期固定检查清单（每天/每周）
### 每次提交前（5-10 分钟）
```bash
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 3 --no-convert
bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --timeout-ms 25000
```

### 每天（observe，趋势积累）
```bash
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion
bash tools/editor_daily_validation.sh
```

### 每周（gate + 报告）
```bash
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion
bash tools/editor_weekly_validation.sh
```

## 风险与控制
1. UI flow flaky：优先用 debug hook + 几何不变量断言替代像素/文案断言。
2. Undo/Redo 污染：验证逻辑禁止创建额外实体（会污染历史栈），优先读 debug state/entity。
3. 并发端口冲突：默认 free-port；保留显式 `--port` 覆盖用于排障。
4. 报告缺失/难追溯：weekly/gate 脚本默认自动 append 到 STEP170（可通过 `STEP170_APPEND_REPORT=0` / `EDITOR_GATE_APPEND_REPORT=0` 关闭）。

## 关联文档
- UI flow 扩展与约束：`docs/STEP182_EDITOR_UI_FLOW_SMOKE_EXPANSION_PLAN.md`
- 综合验证记录：`docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md`

## 后续开发与验证计划（更细，按优先级）
> 目标：把 Level A 从“能用”推进到“长期可用（稳定 + 不回退）”，并把验证从 observe 平滑升级到 gate。

### P0（本周内，门禁可靠性）
1. UI-flow smoke：把剩余的 entityCount-only 断言升级为几何断言
   - Trim/Extend：polyline 段级 + 多边界组合（优先用端点/交点坐标不变量）
   - Join：merge 后 polyline points 数量/端点连续性断言
   - Offset：offset 距离一致性（平行线间距/闭合 polyline 外扩）
2. debug hook：只在 `?debug=1` 暴露最小必要信息
   - `getSelectionIds()` / `getEntity()` / `getOverlays()` 作为 UI-flow 断言输入
3. Flaky 控制
   - 所有 UI-flow step 必须满足：可重复（同 commit 运行 5 次不随机失败）

当前进度（2026-02-16）：
- `tools/web_viewer/scripts/editor_ui_flow_smoke.sh` 已把 `offset_line` 与 `join` 从弱 UI 文案/计数断言升级为几何断言：
  - offset：校验 `entityCount=2`、长度保持、并行偏移距离与命令距离（5）一致；
  - join：校验 merge 后 `entityCount=1`、polyline 点数=3、共享端点与两端点几何连续性；
  - undo/redo 分别校验 `2 -> 1` 的拓扑回退/重做。
- 同步把 `move/copy/rotate` 收口为几何门禁（不依赖 status 文案）：
  - move：校验 rigid translation（start/end 平移一致、长度不变、非零位移）+ undo/redo 几何回退；
  - copy：校验复制后 `entityCount=2`、新旧线段平移一致 + undo/redo 拓扑/几何回退；
  - rotate：校验中心点保持、长度不变、角度变化约 90° + undo/redo 几何回退。
  - gate 验证：`build/editor_ui_flow_smoke/20260216_190742_ui_flow/summary.json`。
- gate 验证通过：`build/editor_ui_flow_smoke/20260216_124408_ui_flow/summary.json`。
- Flaky 快速回归（同 commit 连跑 5 次）全通过：
  - `build/editor_ui_flow_smoke/20260216_124803_ui_flow/summary.json`
  - `build/editor_ui_flow_smoke/20260216_124831_ui_flow/summary.json`
  - `build/editor_ui_flow_smoke/20260216_124857_ui_flow/summary.json`
  - `build/editor_ui_flow_smoke/20260216_124923_ui_flow/summary.json`
  - `build/editor_ui_flow_smoke/20260216_124949_ui_flow/summary.json`
- 本地 strict CI 已接入 UI-flow gate 连续跑（默认 strict+gate=3，可覆盖）：
  - 新增变量：`EDITOR_UI_FLOW_SMOKE_GATE_RUNS`；
  - `tools/local_ci.sh` 汇总 `editorUiFlowSmokeGateRunsTarget/RunCount/PassCount/FailCount`；
  - `tools/check_local_summary.sh` 对 UI-flow gate 跑数不足/有失败作为硬失败；
  - 实跑（2 连跑）通过：`build/editor_ui_flow_smoke/20260216_224736_ui_flow_r1/summary.json`、`build/editor_ui_flow_smoke/20260216_224810_ui_flow_r2/summary.json`。
- `tools/editor_weekly_validation.sh` 已接入 UI-flow gate 连续跑统计并写入 weekly summary：
  - 新增输入参数：`EDITOR_UI_FLOW_SMOKE_GATE_RUNS`（`EDITOR_UI_FLOW_MODE=gate` 时默认 3）；
  - 周报结构新增：`ui_flow_smoke.gate_runs_target/gate_run_count/gate_pass_count/gate_fail_count/runs[]`；
  - 实跑（2 连跑）通过：`build/editor_ui_flow_smoke/20260217_114510_ui_flow/summary.json`、`build/editor_ui_flow_smoke/20260217_114610_ui_flow/summary.json`。
- `tools/editor_gate.sh` 已接入 UI-flow gate 连续跑并门禁化：
  - 新增输入参数：`EDITOR_UI_FLOW_SMOKE_GATE_RUNS`（默认本地 2 / CI 3，可按需覆盖）；
  - gate summary 新增：`ui_flow_smoke.gate_runs_target/gate_run_count/gate_pass_count/gate_fail_count/runs[]`；
  - `tools/write_editor_gate_report.py` / `tools/write_step176_gate_report.py` 已输出 UI-flow 连跑统计与失败归因；
  - 实跑（2 连跑）通过：`build/editor_ui_flow_smoke/20260217_131804_ui_flow/summary.json`、`build/editor_ui_flow_smoke/20260217_131856_ui_flow/summary.json`。
- 已完成负样例注入验证（timeout=1ms）：
  - 命令：`RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 EDITOR_UI_FLOW_SMOKE_GATE_RUNS=2 EDITOR_UI_FLOW_TIMEOUT_MS=1 bash tools/editor_gate.sh`
  - 结果：gate 预期失败（`exit_code=2`），`ui_flow_smoke.ok=false`，`gate_fail_count=2`；
  - 报告可定位首个失败 run 与错误片段（`first_failed_run` / `failure_attribution`）。
- `tools/editor_gate.sh` 默认 UI-flow 连跑已切换为“本地 2 / CI 3”（不设 `EDITOR_UI_FLOW_SMOKE_GATE_RUNS` 时自动生效）：
  - 本地默认值验证：`RUN_EDITOR_UI_FLOW_SMOKE_GATE=1` 下日志显示 `gate_runs=2`，并成功跑通 2 轮（`20260217_200709_ui_flow`、`20260217_200806_ui_flow`）。
- `tools/editor_gate.sh` 已补齐 UI-flow 失败分类并写入 gate summary：
  - `ui_flow_smoke.failure_code_counts` / `ui_flow_smoke.first_failure_code` / `ui_flow_smoke.runs[].failure_code|failure_detail`；
  - gate 失败原因追加分类计数（例如 `UI_FLOW_FLOW_JSON_INVALID:1`），便于稳定归因。
- `tools/write_editor_gate_report.py`、`tools/write_step176_gate_report.py`、`tools/write_step176_weekly_report.py`、`tools/write_step170_weekly_report.py` 已统一输出：
  - `ui_flow_gate_runs` 连跑计数；
  - 首个失败 run 的 `code + step + selection + detail`（而非仅 status 文案）。
- 负样例复验（timeout=1ms，单轮）：
  - 命令：`EDITOR_UI_FLOW_TIMEOUT_MS=1 EDITOR_UI_FLOW_SMOKE_GATE_RUNS=1 SUMMARY_PATH=build/editor_gate_summary_failcheck.json EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 bash tools/editor_gate.sh`
  - 结果：预期 gate fail（`exit_code=2`），`failure_code_counts={"UI_FLOW_FLOW_JSON_INVALID":1}`，`gate_fail_reasons` 含 `UI_FLOW_FLOW_JSON_INVALID:1`。
- `tools/local_ci.sh` + `tools/check_local_summary.sh` 已补齐“UI-flow 失败必须有归因码”约束：
  - `local_ci_summary.json` 新增：`editorUiFlowSmokeFailureCodeCounts` / `editorUiFlowSmokeFailureCodeCount` / `editorUiFlowSmokeFirstFailureCode`；
  - 当 `runEditorUiFlowSmokeGate=true` 且 gate fail 时，若 failure_code_counts 为空则 `check_local_summary.sh` 硬失败。
- `tools/editor_weekly_validation.sh` 已新增固定失败注入健康检查（默认开启）：
  - `RUN_UI_FLOW_FAILURE_INJECTION=1`（默认）；
  - `UI_FLOW_FAILURE_INJECTION_TIMEOUT_MS=1`（默认）；
  - 周报结构新增 `ui_flow_failure_injection`（status/run_id/code/detail/summary_json）。
- `tools/editor_gate.sh` 已新增可选失败注入健康检查（默认关闭）：
  - 默认策略：本地 `0` / CI `1`（仅在 `RUN_EDITOR_UI_FLOW_SMOKE_GATE=1` 且未显式设置该变量时自动生效）；
  - `RUN_UI_FLOW_FAILURE_INJECTION_GATE=1` 可手动启用；
  - `UI_FLOW_FAILURE_INJECTION_TIMEOUT_MS=1` 控制注入强度；
  - `UI_FLOW_FAILURE_INJECTION_STRICT=1` 时若注入未按预期失败则 gate 直接失败（用于 CI 阶段）。
- `tools/write_step176_gate_report.py` 与 `tools/write_editor_gate_report.py` 已支持输出 gate 注入结果（status/code/detail/summary）。
- `tools/write_step176_dashboard.py` 已同步 UI-flow 失败码可视化：
  - Gate History 追加 `ui_flow` 列（含 `first_failure_code`）；
  - Gate History 追加 `ui_flow_inject` 列；
  - Weekly History 追加 `ui_flow_inject` 列（注入结果与失败码）。
- `tools/ci_editor_light.sh` 已补齐跨环境行为（2026-02-19）：
  - 当 Codex Playwright wrapper 缺失（`$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh` 不存在）时，默认 UI-flow gate 自动 `skip`，避免无意义红灯；
  - 若显式启用 `RUN_EDITOR_UI_FLOW_SMOKE=1` / `RUN_EDITOR_UI_FLOW_SMOKE_GATE=1`，仍会在缺依赖时快速失败（防止误判为通过）。
- 新增 GitHub Actions light gate：`.github/workflows/cadgamefusion_editor_light.yml`（2026-02-19）：
  - PR 触发 `bash deps/cadgamefusion/tools/ci_editor_light.sh`（Node tests + round-trip smoke）；
  - 固定 `SKIP_EDITOR_UI_FLOW_SMOKE=1`（runner 无 Codex wrapper）；
  - 自动上传 `build/editor_roundtrip/*/summary.{json,md}` 作为排障产物。
- 新增 nightly gate workflow：`.github/workflows/cadgamefusion_editor_nightly.yml`（2026-02-19）：
  - 定时执行 `tools/editor_gate.sh` 的 lightweight 组合（`RUN_STEP166_GATE=0` + `EDITOR_SMOKE_NO_CONVERT=1`）；
  - `workflow_dispatch` 支持 `mode=observe|gate` 切换（observe 不阻塞、gate 按 gate 结果阻塞）；
  - 产物上传 `editor_gate_summary_nightly.json` + `editor_roundtrip/*/summary.*`。
  - 说明：未 push 到远端默认分支前，`gh workflow run` 会返回 404（workflow not found）。
- 新增 CI 汇总脚本：`tools/write_ci_artifact_summary.py`（2026-02-19）：
  - 固定输出 `run_id + failure_code_counts + first_failure_code`；
  - 已接入 `cadgamefusion_editor_light.yml` 与 nightly workflow 的 GitHub Step Summary + artifact md。

验收（P0 必须通过）：
- `node --test tools/web_viewer/tests/editor_commands.test.js`
- `bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode gate --timeout-ms 25000`

### P1（1-2 周，Round-trip gate 收口）
1. `editor_roundtrip_smoke.js` cases 扩充到 20+ 真实样例（按 tags 分类：text-heavy / arc-heavy / polyline-heavy）
2. observe -> gate 条件（硬指标）
   - 连续 5 天 `--limit 20` 全 PASS（convert 可选；建议默认 `--no-convert`，按周再跑 convert）
3. 报告
   - weekly 自动追加：PASS/FAIL buckets + 最近退化样例列表

当前进度（2026-02-14）：
- 已接入 `tools/generate_editor_roundtrip_cases.py` 生成 gitignored 的 `local/editor_roundtrip_smoke_cases.json`。
- 已用该 cases 文件跑通 observe+gate（--limit 20 请求，当前可发现 previews=2）：
  - observe: `build/editor_roundtrip/20260214_174211_968_7252/summary.json`
  - gate: `build/editor_roundtrip/20260214_174219_413_d8af/summary.json`
- 已补齐 DXF-only 真实样例生成能力（不依赖 PDF）：`tools/generate_editor_roundtrip_previews.py`
  - 生成 20 个 DXF previews：`build/editor_roundtrip_previews/20260214_095014`
  - round-trip gate (20 cases, --no-convert): `build/editor_roundtrip/20260214_175346_308_2474/summary.json`
- 本地 strict CI 已接入“连续 gate + 20 case”收口：
  - `tools/local_ci.sh` 在 `RUN_EDITOR_SMOKE_GATE=1` 时默认使用 `EDITOR_SMOKE_GATE_LIMIT=20`；
  - strict 下默认连续 `EDITOR_SMOKE_GATE_RUNS=3`（可覆盖）；
  - 结果写入 `build/local_ci_summary.json`：`editorSmokeGateRunsTarget/RunCount/PassCount/FailCount`；
  - `tools/check_local_summary.sh` 已把 smoke gate 连续失败/跑数不足视为硬失败；
  - 实跑验证（2 连跑样例）：`build/editor_roundtrip/20260216_191335_665_915b/summary.json`，`build/editor_roundtrip/20260216_191341_957_72e1/summary.json`。
- 已补齐 weekly round-trip 失败归因输出（2026-02-18）：
  - `tools/editor_weekly_validation.sh` 的 weekly summary 新增 `editor_smoke.status/totals/failure_buckets/failure_code_counts/failed_cases`；
  - `tools/write_step170_weekly_report.py` 与 `tools/write_step176_weekly_report.py` 追加 round-trip 失败 buckets/codes 与最近失败样例；
  - `tools/write_step176_dashboard.py` 的 Gate/Weekly History `editor_smoke` 列改为 `run_id:status(fail_count)`，便于趋势识别。
- 已补齐本地 CI 与 gate round-trip 失败归因闭环（2026-02-18）：
  - `tools/local_ci.sh` 新增 `editorSmokeFailureCodeCounts/editorSmokeFailureCodeCount/editorSmokeFirstFailureCode/editorSmokeRecentFailures`；
  - `tools/check_local_summary.sh` 在 `runEditorSmokeGate=true && editorSmokeGateFailCount>0` 时强制 `editorSmokeFailureCodeCount>0`；
  - `tools/editor_gate.sh` 的 gate summary 新增 `editor_smoke.status/failure_code_counts/failed_cases`，`tools/write_editor_gate_report.py` 与 `tools/write_step176_gate_report.py` 已输出这些字段；
  - `tools/editor_gate.sh` 修复了 round-trip fail 时的早退：即使 editor smoke 失败也继续生成 `editor_gate_summary.json` 并写入 `EDITOR_SMOKE_*` 归因原因，便于 gate 复盘。
- 已新增 round-trip 失败注入健康检查（2026-02-18）：
  - `tools/editor_gate.sh` 新增 `RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE`（默认本地 `0` / CI `1`）；
  - 注入结果写入 `editor_smoke_failure_injection`（status/run_id/code/detail/summary_json）；
  - `tools/write_editor_gate_report.py`、`tools/write_step176_gate_report.py`、`tools/write_step176_dashboard.py` 已输出注入结果。
- 已把 weekly 的 gate 分支摘要对齐到 round-trip 归因口径（2026-02-18）：
  - `tools/editor_weekly_validation.sh` 在 `gate` 字段新增 `editor_smoke` 与 `editor_smoke_failure_injection` 镜像；
  - `tools/write_step170_weekly_report.py` 与 `tools/write_step176_weekly_report.py` 已追加 gate round-trip 归因输出。

验收：
- `node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode gate --limit 20 --no-convert`
- `bash tools/editor_weekly_validation.sh`（append STEP170）

### P2（2-4 周，性能与交互体验）
1. Hit-test/box-select/snap 的 p50/p95 性能趋势
2. 大图（1e4 entities）可用性：交互无明显卡顿（鼠标移动 snap/pick）
3. grips 体验细化
   - hover 强化/命中优先级可预期
   - 禁止锁层编辑（已覆盖，持续门禁）

验收：
- `python3 tools/editor_perf_trend.py` 生成趋势并与基线对比（默认阈值 +20%）

当前进度（2026-02-16）：
- `tools/editor_weekly_validation.sh` 已把 perf/real-scene trend policy 阈值写入 weekly summary。
- `tools/write_step176_weekly_report.py` 已追加 trend 门禁阈值到周报：
  - `perf_trend_thresholds` + `perf_trend_hotspot`
  - `real_scene_trend_thresholds` + `real_scene_trend_hotspot`

### P3（4-8 周，Level B 入口准备）
1. 更多实体类型 import 为 read-only（ellipse/spline），并保证 export passthrough 不丢
2. 属性面板补齐（lineType/lineWeight/textStyle 等）
3. 新增命令：break/join/offset 的更多 CAD-like 细节（插点/删点、连续操作）
