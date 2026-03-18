# STEP176 Level A 持续开发与验证详细计划（1+2+3 扩展版）

## 1. 目标
- 在已完成 `1+2+3`（stability soak、TEXT_METRIC_DRIFT 二次确认、box_query 热点优化）的基础上，继续把 Level A 变成“默认稳定可持续开发态”。
- 输出可执行的周节奏与门禁制度，保证每次迭代都具备可回归、可解释、可追溯能力。

## 2. 当前基线（2026-02-12）
- weekly summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- latest runs:
  - editor observe: `20260212_140559_799_7fb0`
  - STEP166 observe: `20260212_060602`
  - synthetic perf: `20260212_060630`
  - real-scene perf: `20260212_060630` (`PASS`)
  - gate: editor `20260212_140630_268_8425` + step166 `20260212_060632`
- trend:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_trend.json`
  - `status=stable`, `recommended_gate_limit=8`, `samples_in_window=31`

## 3. 执行范围
### In Scope
- Web editor Level A 稳定性与交互可维护性收口。
- STEP166/round-trip/perf/trend 的自动化验证链路强化。
- 观测数据到 gate 决策的制度化流程。

### Out of Scope
- layout/paper space/viewport 可编辑。
- dimension/hatch/blocks/xref 的生产级实现。
- Qt 全量跟进（仅同步关键语义）。

## 4. 工作分解（WBS）
### WBS-A: 交互收口（开发）
- A1. Arc/Grip 交互回归用例补全（异常输入、锁层、Undo/Redo 边界）。
- A2. Hover 与 Snap 共存行为的视觉一致性检查（不改变核心命令语义）。
- A3. Trim/Extend 连续操作稳定性验证（多 boundary + ESC 退出）。

### WBS-B: 验证链路（开发）
- B1. 保持 `cad_regression_run.py` 的 `drift_confirmation` 默认开启。
- B2. 将 `editor_stability_soak.py` 纳入周度固定任务（至少 3 rounds）。
- B3. 固化 `auto-trend -> gate_limit` 策略并持续记录 policy 输出。
- B4. editor round-trip smoke 具备 clean env fallback：
  - 当 `build/cad_regression` 未生成 previews 时，`editor_roundtrip_smoke.js` 自动回退到非专有的 fixture cases（CI 可复用）。
- B5. 固定真实样例 cases（本地私有，不进仓库）：
  - `tools/generate_editor_roundtrip_cases.py` 从最新 STEP166 previews 生成 `local/editor_roundtrip_smoke_cases.json`（gitignored）。
  - `tools/editor_weekly_validation.sh` / `tools/editor_gate.sh` 若发现该文件存在且未显式指定 `EDITOR_SMOKE_CASES`，则自动使用它（稳定样本集，减少样本漂移）。
  - 若 DXF 很多但缺少配套 PDF（导致 STEP166 覆盖不足），可用 DXF-only 预览生成 round-trip cases：
    - `python3 tools/generate_editor_roundtrip_previews.py --limit 20 --out-cases local/editor_roundtrip_smoke_cases.json`
    - 该路径不依赖 PDF，仅用于 editor round-trip；不替代 STEP166 的 PDF 对比回归。

### WBS-C: 性能守卫（开发）
- C1. 固定 synthetic（10k）采样：每周至少 2 次。
- C2. 固定 real-scene profile 采样：每周至少 3 次，按中位数评估。
- C3. 若 `box_query p95` 3-run median > `0.05ms`，触发热点剖析任务。
- C4. synthetic perf trend（14d）：
  - 生成 `build/editor_perf_trend.{json,md}`，按 “box_query/drag/hotspot”为 status 信号（pick 仅信息提示，避免噪声误判）。
  - 趋势采样优先使用 `PERF_REPEAT>=3` 的 batch median（更稳），单次 perf 仅作为 fallback（更容易受机器/负载波动影响）。
  - 默认策略为 `observe -> auto -> gate`（与 real-scene trend 一致）：
    - `tools/editor_gate.sh` 默认 `PERF_TREND_POLICY=auto`，会在 `coverage_days >= PERF_TREND_DAYS(默认14)` 且 `selected_samples_in_window >= PERF_TREND_MIN_SELECTED(默认5)` 且 `selection_mode=batch_only` 后，自动把 synthetic perf trend 作为 gate（否则仅 observe 记录，不阻塞）。
    - 需要强制立刻阻塞时可用 `RUN_PERF_TREND_GATE=1` 覆盖策略（立即按 gate 执行）。
    - 如需永久关闭 synthetic perf trend 门禁，显式设置 `PERF_TREND_POLICY=observe`。
- C5. real-scene perf trend（14d）：
  - 生成 `build/editor_real_scene_perf_trend.{json,md}`，按 “box_query/drag/hotspot”为 status 信号（pick 仅信息提示）。
  - 默认策略为 `observe -> auto -> gate`：
    - `tools/editor_gate.sh` 默认 `REAL_SCENE_TREND_POLICY=auto`，会在 `coverage_days >= REAL_SCENE_TREND_DAYS(默认14)` 且 `selected_samples_in_window >= REAL_SCENE_TREND_MIN_SELECTED(默认5)` 且 `selection_mode=batch_only` 后，自动把 real-scene trend 作为 gate（否则仅 observe 记录，不阻塞）。
    - 需要强制立刻阻塞时可用 `RUN_REAL_SCENE_TREND_GATE=1` 覆盖策略（立即按 gate 执行）。
    - 如需永久关闭 real-scene trend 门禁，显式设置 `REAL_SCENE_TREND_POLICY=observe`。

### WBS-D: 文档与报告（交付）
- D1. 每周追加 `STEP173`（性能）、`STEP174`（稳定性）、`STEP170`（总验证）。
- D2. 每次策略变化必须同步 `STEP175/STEP176` 计划文档。
- D3. 报告必须带 run_id、命令、结论，不允许只写主观判断。
- D4. 报告自动追加工具（可选）：
  - `tools/write_step176_weekly_report.py`：把 `build/editor_weekly_validation_summary.json` 快照追加到 STEP176 报告尾部（默认不自动触发）。
  - `tools/write_step176_dashboard.py`：从 `build/*_history/*.json` 生成一个可读 dashboard（不依赖网络，适合日常快速查看状态）。

## 5. 周节奏与门禁策略
### 每日（工作日）
```bash
RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=3 EDITOR_GATE_APPEND_REPORT=0 bash tools/editor_weekly_validation.sh
```
推荐：使用封装脚本（默认会把快照追加到 STEP176 报告）：
```bash
bash tools/editor_daily_validation.sh
```
可选：自动把 weekly summary 快照追加到 STEP176 报告（默认关闭）：
```bash
STEP176_APPEND_REPORT=1 STEP176_REPORT=docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md \
  RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=3 EDITOR_GATE_APPEND_REPORT=0 \
  bash tools/editor_weekly_validation.sh
```

### 每周（至少 1 次）
#### real-scene 3-run median（推荐）
```bash
REAL_SCENE_REPEAT=3 REAL_SCENE_INTERVAL_SEC=1 \
  RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=3 EDITOR_GATE_APPEND_REPORT=0 \
  bash tools/editor_weekly_validation.sh
```

#### synthetic perf 3-run median（推荐）
```bash
PERF_REPEAT=3 PERF_INTERVAL_SEC=1 \
  RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=3 EDITOR_GATE_APPEND_REPORT=0 \
  bash tools/editor_weekly_validation.sh
```

#### 一次性跑齐（synthetic + real-scene 都用 3-run median）
```bash
PERF_REPEAT=3 PERF_INTERVAL_SEC=1 \
REAL_SCENE_REPEAT=3 REAL_SCENE_INTERVAL_SEC=1 \
  RUN_GATE=1 CAD_MAX_WORKERS=2 GATE_CAD_ATTEMPTS=3 EDITOR_GATE_APPEND_REPORT=0 \
  bash tools/editor_weekly_validation.sh
```
推荐：使用封装脚本（weekly stable sampling，一次跑齐）：
```bash
bash tools/editor_weekly_median_validation.sh
```

#### stability soak（至少 3 rounds）
```bash
python3 tools/editor_stability_soak.py --rounds 3 --run-gate 1 --append-report 0
```

### 可选门禁：real-scene trend（建议稳定两周后再开）
```bash
# 默认：observe 2 周（coverage>=14d 且样本>=5 后自动启 gate）
bash tools/editor_gate.sh

# 强制立即 gate（会阻塞）
RUN_REAL_SCENE_TREND_GATE=1 bash tools/editor_gate.sh

# 显式保持 observe（永不因 real-scene trend 阻塞）
REAL_SCENE_TREND_POLICY=observe bash tools/editor_gate.sh
```

### 可选门禁：synthetic perf trend（建议稳定两周后再开）
```bash
# 默认：observe 2 周（coverage>=14d 且样本>=5 且 selection_mode=batch_only 后自动启 gate）
bash tools/editor_gate.sh

# 强制立即 gate（会阻塞）
RUN_PERF_TREND_GATE=1 bash tools/editor_gate.sh

# 显式保持 observe（永不因 synthetic perf trend 阻塞）
PERF_TREND_POLICY=observe bash tools/editor_gate.sh
```

### 本地 CI 可选门禁：Editor + STEP166 一键 gate
> 适用于 `--build-dir` 不是 `build/` 的情况（例如 `build_vcpkg/`），会把 gate 产物写入同一个 build dir 以便复现。

```bash
RUN_EDITOR_GATE=1 bash tools/local_ci.sh --build-dir build_vcpkg --quick
```

### GitHub Actions（light gate，跨平台）
> 用于 PR 上的快速回归：只跑 Web editor 的命令级测试 + round-trip smoke（schema only，`--no-convert`），不依赖 C++ 插件构建。

- workflow: `.github/workflows/cadgamefusion_editor_light.yml`
- runner script: `tools/ci_editor_light.sh`

### 提交前（快速）
```bash
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 3
```
可选：刷新本地稳定样本集（会写入 gitignored 的 local 文件）：
```bash
python3 tools/generate_editor_roundtrip_cases.py --limit 8
```

### Dashboard（随时可生成）
```bash
python3 tools/write_step176_dashboard.py
```
输出：
- `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_DASHBOARD.md`

### 磁盘空间保护（可选，推荐开启为 apply）
> 背景：持续回归会在 `build/cad_regression` 与 `build/editor_roundtrip` 落盘大量截图与中间产物，磁盘满会导致回归随机失败（`Errno 28`）。

Dry-run（只打印将删除哪些 run，不删除）：
```bash
PRUNE_BUILDS=dry PRUNE_CAD_KEEP=20 PRUNE_ROUNDTRIP_KEEP=20 \
  bash tools/editor_weekly_validation.sh
```

Apply（实际删除旧 runs，仅保留最近 N 个）：
```bash
PRUNE_BUILDS=apply PRUNE_CAD_KEEP=20 PRUNE_ROUNDTRIP_KEEP=20 \
  bash tools/editor_weekly_validation.sh
```

同样适用于一键门禁：
```bash
PRUNE_BUILDS=apply PRUNE_CAD_KEEP=20 PRUNE_ROUNDTRIP_KEEP=20 \
  bash tools/editor_gate.sh
```

## 6. 验收标准（DoD）
- 功能稳定：
  - `editor_commands.test.js` 全绿（当前 `30/30`）。
- 回归稳定：
  - editor observe/gate 均 `fail=0`。
  - STEP166 observe/gate 均 `gate_would_fail=false`。
- 性能稳定：
  - real-scene `pick/box/drag` 均低于阈值。
  - synthetic 无连续 3 次明显恶化（>20%）。
  - `build/editor_perf_trend.json` 的 `status` 维持 `stable|observe`（出现 `watch` 则先排查再收紧门禁）。
- 趋势稳定：
  - `trend.status=stable` 且失败桶无持续增长。
- soak 稳定：
  - 每周 `overall_status=stable`。

## 7. 风险与应对
- 风险1：单点 `TEXT_METRIC_DRIFT` 抖动误判。
  - 应对：启用并保留二次确认，确认后再 fail。
- 风险2：真实图纸 `box_query` 再次抬升。
  - 应对：使用 3-run median，而非单次值判定。
- 风险3：门禁样本升高导致偶发超时。
  - 应对：quick gate 维持 `limit=3`，标准 gate `limit=8`，并保留 `CAD_ATTEMPTS` 重试。

## 8. 预计工时（单人）
- 开发补强（A+B+C）：`3~4 天`
- 验证与周报沉淀（D）：`1~1.5 天`
- 合计：`4~5.5 天`

## 9. 本阶段交付物
- 计划文档：
  - `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_PLAN.md`
- 验证文档：
  - `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md`
- 运行产物：
  - `build/editor_weekly_validation_summary.{json,md}`
  - `build/editor_weekly_validation_history/weekly_*.json`（每次 weekly 的不可变快照，用于追溯）
  - `build/editor_stability_soak/<run_id>/{summary.json,summary.md}`
  - `build/editor_gate_trend.{json,md}`
