# STEP184 Level A Stabilization Parallel Acceleration Design

## 背景与目标
- 目标保持不变：Level A（Web 可编辑 + CADGF round-trip + STEP166 链路）稳定化优先。
- 执行策略：1 人 3 线并进（Lane A/B/C），通过同周分线切片 + 周五统一验证加速。
- 本轮实现重点：
  1) 门禁入口统一（`EDITOR_GATE_PROFILE=lite|full`）+ CI artifact 策略降噪  
  2) round-trip case schema 扩展（`tags`/`priority`）  
  3) unsupported 实体可见化代理（read-only display proxy）  
  4) Join Tool 从命令入口补齐到工具入口（含 Node/UI-flow 覆盖接入）

## 变更范围

### Lane A（稳定性与门禁）
1. `tools/editor_gate.sh`
   - 新增：`EDITOR_GATE_PROFILE=lite|full`。
   - 语义（锁定）：
     - `lite`：默认 `RUN_STEP166_GATE=0`、`EDITOR_SMOKE_NO_CONVERT=1`
     - `full`：默认 `RUN_STEP166_GATE=1`、`EDITOR_SMOKE_NO_CONVERT=0`
   - 兼容策略：若调用方显式设置了 `RUN_STEP166_GATE` 或 `EDITOR_SMOKE_NO_CONVERT`，profile 不覆盖显式值。
2. CI workflow artifact 策略
   - 文件：
     - `.github/workflows/cadgamefusion_editor_light.yml`
     - `.github/workflows/cadgamefusion_editor_nightly.yml`
   - 新增 job env：`UPLOAD_CI_ARTIFACTS=always|on_failure|off`（默认 `on_failure`）
   - 上传条件：`always` 或 `on_failure && failure()` 才上传 artifact。
3. nightly profile 接入
   - `cadgamefusion_editor_nightly.yml` 改为使用 `EDITOR_GATE_PROFILE=lite`，不再散落设置 `RUN_STEP166_GATE` 与 `EDITOR_SMOKE_NO_CONVERT`。
4. round-trip 过滤参数透传（gate）
   - 文件：`tools/editor_gate.sh`
   - 新增 env：
     - `EDITOR_SMOKE_PRIORITY_SET`（例如 `P0,P1`）
     - `EDITOR_SMOKE_TAG_ANY`（例如 `text-heavy,arc-heavy,polyline-heavy,import-stress`）
   - 行为：门禁脚本会把过滤参数透传给 `editor_roundtrip_smoke.js`，并写入 gate summary。

### Lane C（数据链路）
1. round-trip case schema 扩展
   - 文件：
     - `tools/generate_editor_roundtrip_cases.py`
     - `tools/web_viewer/scripts/editor_roundtrip_smoke.js`
   - 新字段：
     - `tags: string[]`
     - `priority: P0|P1|P2`（默认 `P1`）
   - 向后兼容：
     - 老格式 `["path"]` / `{name,path}` 继续可用，缺失字段自动补默认值。
   - 生成器新增轻量标签推断（`text-heavy/arc-heavy/polyline-heavy/import-stress`）与 `P0` 升级规则（import-stress）。
   - 生成器新增 `--priorities` 参数，支持直接输出 P0/P1 固定样本集。
2. round-trip 选择器（固定样本）
   - 文件：`tools/web_viewer/scripts/editor_roundtrip_smoke.js`
   - 新增参数：
     - `--priority-set <csv>`
     - `--tag-any <csv>`
   - 行为：
     - 按 `priority -> name/path` 稳定排序，先筛选再截断 `limit`。
     - 若筛选后为空且输入非空，回退到未筛选集合并标记 `used_fallback=true`（避免夜间任务因样本稀疏变成 0 case）。
     - summary 输出 `filters` 与 `case_selection`（含 `matched_count` / `used_fallback`）。
3. unsupported 实体 display proxy（只读）
   - 文件：
     - `tools/web_viewer/adapters/cadgf_document_adapter.js`
     - `tools/web_viewer/state/documentState.js`
     - `tools/web_viewer/ui/canvas_view.js`
   - 设计：
     - 内部类型仍为 `unsupported`，保留 `cadgf` passthrough。
     - 新增 `display_proxy`（point/ellipse/polyline）仅用于渲染，不参与编辑。
     - `DocumentState.listDisplayProxyEntities()` 专门输出可渲染代理。
     - Canvas 以虚线低透明样式绘制 read-only proxy。

### Lane B（编辑能力）
1. Join Tool 落地
   - 文件：
     - `tools/web_viewer/tools/join_tool.js`（新增）
     - `tools/web_viewer/tools/tool_registry.js`
     - `tools/web_viewer/index.html`
     - `tools/web_viewer/ui/workspace.js`
   - 行为：
     - 左键选中/累加，`Shift/Ctrl` toggle。
     - `Enter` 或右键执行 `selection.join`。
     - 命令行保留兼容：`join <tolerance>` 仍可直接执行命令；`join`（无参数）进入 Join Tool。
2. UI-flow 脚本接入 Join Tool 路径
   - 文件：`tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
   - join 步骤从“输入命令 join”改为“切换 Join Tool + 右键提交”。
3. Fillet/Chamfer 工具点击稳态收口
   - 文件：
     - `tools/web_viewer/tools/fillet_tool.js`
     - `tools/web_viewer/tools/chamfer_tool.js`
   - 行为：
     - pick 统一使用更宽命中容差（`pickEntityAt(..., 14)`）。
     - 当第一击未命中但当前仅有一个已选 line/polyline 时，允许回退使用该已选实体作为 first target。
     - second pick miss 不重置 stage，仅提示“继续选第二条”，降低误触导致的状态丢失。
4. layer visibility 命令级收口（UI-flow）
   - 文件：`tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
   - 行为：
     - `layer_visibility` 的 box-select 断言从指针拖拽切换为 `selection.box` 命令级校验。
     - 恢复硬断言：show 之后 `shownBox=2 selected` 必须成立。

## 接口与兼容性约束
- `editor_gate.sh`：新增 profile 不破坏旧 env 用法。
- `editor_roundtrip_smoke.js`：case 输入对旧 JSON 100% 兼容。
- `cadgf_document_adapter.js`：unsupported passthrough 不变，`display_proxy` 仅新增、非破坏。
- `workspace.js`：typed command 优先级调整仅影响 `join`（实现“有参命令优先，无参进工具”）。
- `workspace.js`（debug=1）：新增 `setLayerVisibility/getLayer/listLayers/listEntities` 调试接口，仅用于 smoke 稳定化，不影响默认用户路径。

## 风险与控制
- 风险：P0/P1 + tag 过滤在部分本地 case 清单上可能匹配为 0。
  - 控制：`editor_roundtrip_smoke` 提供 `used_fallback` 回退标记，门禁不因样本稀疏退化为“无覆盖”。
- 风险：display proxy 渲染增量可能引入大图绘制负担。
  - 控制：仅渲染 `unsupported && display_proxy`，且保持只读、无命中检测路径。

## 下一步（STEP184 后续）
1. 优化 `P0/P1` 样本池质量，降低 `used_fallback=true` 频次（补充 tags 覆盖）。
2. 在 nightly summary 增加 `matched_count/used_fallback` 趋势线。
3. 在 weekly 报告中统一输出 `run_id/failure_code_counts/gate_decision`，与 STEP176 对齐。

## 2026-02-20 追加收口（按建议执行）

### 1) 过滤稳定性：旧 cases 自动推断 tags/priority
- 文件：`tools/web_viewer/scripts/editor_roundtrip_smoke.js`
- 调整：
  - 对未显式提供 `tags` / `priority` 的 case，按 CADGF `entities` 统计自动推断：
    - `text-heavy` / `arc-heavy` / `polyline-heavy` / `import-stress`
    - `import-stress -> P0`，其余默认 `P1`
  - 目的：兼容历史 `local/editor_roundtrip_smoke_cases.json`（仅 name/path），在启用 `--priority-set/--tag-any` 时不再频繁回退到 unfiltered。

### 2) gate summary 补全过滤观测字段
- 文件：`tools/editor_gate.sh`
- 调整：
  - `editor_smoke` 增加透传字段：
    - `filters`（priority_set/tag_any）
    - `case_selection`（selected/matched/candidate/total/used_fallback）
  - 目的：为 nightly/weekly 趋势统计提供单一数据源（无需再解析 roundtrip 原始日志）。

### 3) nightly/CI 报告可见化
- 文件：
  - `tools/write_ci_artifact_summary.py`
  - `.github/workflows/cadgamefusion_editor_nightly.yml`
- 调整：
  - CI 摘要新增：
    - `editor_smoke_filters`
    - `editor_smoke_case_selection`
  - nightly Step Summary 追加：
    - `selected/matched/candidate/total/fallback`
  - 目的：将“样本匹配质量”纳入每晚可见信号，支撑 observe->gate 决策。

### 4) STEP176 周报接入 case_selection 趋势字段
- 文件：
  - `tools/editor_weekly_validation.sh`
  - `tools/write_step176_weekly_report.py`
- 调整：
  - weekly summary 的 `editor_smoke` 新增：
    - `filters`
    - `case_selection`（`selected/matched/candidate/total/used_fallback`）
  - STEP176 周报追加脚本新增输出：
    - `editor_smoke_filters`
    - `editor_smoke_case_selection`
    - `gate_editor_smoke_filters`
    - `gate_editor_smoke_case_selection`
- 目的：让 weekly 报告能持续观察样本过滤质量，避免“门禁通过但覆盖退化”。
- 补充（本轮）：
  - `tools/editor_weekly_validation.sh` 新增参数透传：
    - `EDITOR_SMOKE_PRIORITY_SET` / `EDITOR_SMOKE_TAG_ANY`（weekly round-trip）
    - `GATE_SMOKE_PRIORITY_SET` / `GATE_SMOKE_TAG_ANY`（weekly 内 gate）
  - weekly 真跑可直接使用与 nightly 一致的固定抽样策略（P0/P1 + tags）。

### 5) Nightly Step Summary 与 weekly 字段对齐
- 文件：`.github/workflows/cadgamefusion_editor_nightly.yml`
- 调整：
  - 从 `build/editor_gate_summary_nightly.json` 读取 `editor_smoke.filters/case_selection`。
  - 在 GitHub Step Summary 追加：
    - `gate_editor_smoke_filters`
    - `gate_editor_smoke_case_selection`
  - `fallback` 输出统一为 `true|false`（与 weekly 报告一致）。

### 6) case_selection 7/14 天趋势化
- 文件：
  - `tools/editor_case_selection_trend.py`
  - `tools/editor_weekly_validation.sh`
  - `tools/write_step176_weekly_report.py`
- 调整：
  - 新增趋势脚本：从 `build/editor_gate_history/*.json` 聚合 `editor_smoke.case_selection`。
  - 默认窗口：`7,14` 天，输出：
    - `build/editor_case_selection_trend.json`
    - `build/editor_case_selection_trend.md`
  - weekly 增加 step 10 执行趋势脚本，并将结果写入 weekly summary + STEP176 周报：
    - `case_selection_trend`
    - `case_selection_trend_windows`
    - `case_selection_trend_json`
