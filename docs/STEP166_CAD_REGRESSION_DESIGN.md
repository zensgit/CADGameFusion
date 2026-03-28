# STEP166 CAD Regression Pipeline Design

## 背景与目标
- 目标是将 DXF + 布局 PDF 的验证流程从手工 CAD 客户端操作切换为可重复、可批量的自动化链路。
- 现有脚本 `tools/plm_preview.py` 和 `scripts/compare_autocad_pdf.py` 已具备核心能力，本次新增统一编排和输入体检层，不替换原有手工命令。

## 架构与数据流
1. 输入源：`docs/STEP166_CAD_REGRESSION_CASES.json`
2. 体检：`scripts/cad_input_sanity_check.py`
   - 字段和文件校验
   - 使用 `plm_preview.py` 读取 document/viewport 信息
3. 编排：`scripts/cad_regression_run.py`
   - `sanity -> plm_preview -> compare_autocad_pdf`
   - 多 filter 并发执行（独立端口）
4. 汇总：输出 `summary.json`、`failures.json`、`trend_input.json`
5. 报告：输出到 `docs/STEP166_CAD_REGRESSION_VERIFICATION.md`

## 接口与 Schema

### 案例清单 `STEP166_CAD_REGRESSION_CASES.json`
- `name`: case 名称
- `dxf`: 绝对路径
- `pdf`: 绝对路径
- `layout`: 布局名
- `space`: `paper | model`
- `filters`: `all | text | dimension` 数组
- `expected.has_viewport`: 是否期望当前 case 相关的 viewport 存在
  - `space=paper` 且 `layout` 非空：按布局统计 viewport（`dxf.viewport.*.layout == layout`）
  - `space=paper` 且 `layout` 为空：使用总 viewport 数（`dxf.viewport.count`）
  - `space=model`：viewport 不相关（按 0 处理）
- `expected.has_entities`: 是否期望有实体
- `compare`: 对比参数覆盖（overlay/style/ui/line-weight/component-size）
- `tags`: 可选标签
  - `negative`: 负样例（允许 `INPUT_INVALID`，在 totals 中计入 `skipped`，且不触发 gate）

### sanity 输出 `build/cad_regression/<run_id>/sanity.json`
- `run_id`
- `cases_total`
- `cases_valid`
- `cases_invalid`
- `cases_warned`
- `results[]`
  - `name`
  - `status: PASS | FAIL`
  - `checks`: `dxf_exists`、`pdf_exists`、`layout_non_empty`、`filters_valid`
  - `meta`: `entity_count`、`viewport_count`、`viewport_count_all`、`viewport_layouts`、preview stderr/stdout
    - `import_meta`（可选，归因/预警字段）：从 `document.json.metadata.meta` 摘要提取（不参与 PASS/FAIL）
      - `hatch_pattern_clamped`
      - `hatch_pattern_emitted_lines`
      - `hatch_pattern_edge_budget_exhausted_hatches`
      - `hatch_pattern_boundary_points_clamped_hatches`
      - `text_align_partial`
      - `text_nonfinite_values`
      - `text_skipped_missing_xy`
  - `reason_codes`
  - `warning_codes`（不参与 PASS/FAIL）：例如 `WARN_HATCH_PATTERN_CLAMPED`、`WARN_TEXT_ALIGN_PARTIAL`

### summary 输出 `build/cad_regression/<run_id>/summary.json`
- `run_id`, `started_at`, `finished_at`, `mode`
- `totals.pass/fail/skipped`
- `metrics_by_case[]`
  - `name`, `layout`, `filter`, `space`, `status`
  - `metrics`: `jaccard`, `jaccard_aligned`, `shift_dx`, `shift_dy`, `pdf_edges`, `viewer_edges`
  - `import_meta`（归因字段，可选）：从 `document.json.metadata.meta` 摘要提取
    - `hatch_pattern_emitted_lines`
    - `hatch_pattern_clamped`
    - `hatch_pattern_clamped_hatches`
    - `hatch_pattern_stride_max`
    - `hatch_pattern_ksteps_limit`
    - `hatch_pattern_edge_checks`
    - `hatch_pattern_edge_budget_exhausted_hatches`
    - `hatch_pattern_boundary_points_clamped_hatches`
    - `hatch_pattern_boundary_points_max`
    - `text_entities_seen`
    - `text_entities_emitted`
    - `text_skipped_missing_xy`
    - `text_align_complete`
    - `text_align_partial`
    - `text_align_partial_x_only`
    - `text_align_partial_y_only`
    - `text_align_used`
    - `text_nonfinite_values`
  - `delta_vs_baseline`
- `failure_buckets`
  - `INPUT_INVALID`, `IMPORT_FAIL`, `VIEWPORT_LAYOUT_MISSING`, `RENDER_DRIFT`, `TEXT_METRIC_DRIFT`
- `sanity`（体检预警聚合，非门禁）
  - `cases_total`, `cases_valid`, `cases_invalid`, `cases_warned`
  - `warning_code_counts`（例如 `WARN_HATCH_PATTERN_CLAMPED`、`WARN_TEXT_ALIGN_PARTIAL`）
- `import_meta_summary`（归因聚合，可选）
  - `hatch_pattern_clamped_cases`
  - `hatch_pattern_clamped_hatches_total`
  - `hatch_pattern_emitted_lines_total`
  - `hatch_pattern_stride_max_max`
  - `hatch_pattern_ksteps_limit_max`
  - `hatch_pattern_edge_checks_total`
  - `hatch_pattern_edge_budget_exhausted_cases`
  - `hatch_pattern_edge_budget_exhausted_hatches_total`
  - `hatch_pattern_boundary_points_clamped_cases`
  - `hatch_pattern_boundary_points_clamped_hatches_total`
  - `hatch_pattern_boundary_points_max_max`
  - `text_align_partial_cases`
  - `text_align_partial_total`
  - `text_align_used_total`
  - `text_nonfinite_values_total`
  - `text_skipped_missing_xy_total`
  - `text_entities_seen_total`
  - `text_entities_emitted_total`
- `baseline_compare`
  - `baseline_file`, `baseline_run_id`, `compared_cases`, `degraded_cases`, `improved_cases`
- `gate_decision`
  - `would_fail`, `fail_reasons`

## 失败归因规则
- `INPUT_INVALID`: 输入体检失败（字段、文件、expected 约束不满足）
  - 若 case 含 `tags: ["negative", ...]`，则该失败标记为 expected 并计入 `skipped`（不计入 gate failure_buckets）
- `IMPORT_FAIL`: `plm_preview.py` 失败或产物缺失
- `VIEWPORT_LAYOUT_MISSING`: 期望有 viewport，但 viewport_count=0 或布局过滤后无匹配
- `RENDER_DRIFT`: filter=`all` 的 `jaccard_aligned` 相对 baseline 降幅 >20%
- `TEXT_METRIC_DRIFT`: filter=`text`/`dimension` 的 `jaccard_aligned` 相对 baseline 降幅 >20%

## 门禁策略（observe -> gate）
- `observe`
  - 总是退出码 0
  - 用 `gate_decision.would_fail` 提前给出门禁结果
- `gate`
  - 触发任意规则时退出码 2
  - 默认规则：
    - `INPUT_INVALID > 0`（仅非 negative case）
    - `IMPORT_FAIL > 0`
    - `VIEWPORT_LAYOUT_MISSING > 0`
    - `RENDER_DRIFT > 0`
    - `TEXT_METRIC_DRIFT > 0`
    - 有 `jaccard_aligned` 相对 baseline 降幅 >20%

## Baseline 刷新策略（可选）
Baseline 文件：`docs/baselines/STEP166_baseline_summary.json`
- 目的：当连续一段时间无结构性退化时，用最新稳定 run 的 `summary.json` 更新 baseline。
- 工具：`tools/refresh_step166_baseline.py`
  - 默认策略：按 UTC 日取每一天的最新 run，要求连续 `N=5` 天稳定：
    - `totals.fail==0` 且 `gate_decision.would_fail=false`
    - **当 baseline 已存在时**，要求 run 必须实际做过 baseline 对比（`baseline_compare.baseline_file` 非空且 `baseline_compare.compared_cases>0`），避免“未对比 baseline 也被误判稳定”。
    - **当 baseline 已存在时**，baseline 刷新只会统计“对齐当前 baseline 路径 + baseline_run_id”的 run（避免同一天的临时 no-baseline run 覆盖掉正式对比 run，导致无法 eligible）。
  - 默认 dry-run；需要显式 `--apply` 才会覆盖 baseline，并将旧 baseline 备份到 `docs/baselines/archive/`。
  - 默认避免同一 UTC 日内重复 apply 导致 churn；如确有需要可加 `--allow-same-day-apply`。
  - 周验证脚本 `tools/editor_weekly_validation.sh` 默认开启 refresh 检查（dry-run），便于持续观察 eligible 状态。
  - 工具会输出 `window_report_json`（最近 N 天窗口的每日明细：present/stable/reason/baseline_compare），用于快速归因为什么不 eligible。

## 风险与回滚
- 风险：
  - PDF 输入质量不足会导致误报
  - 本地截图工具异常会导致 compare 失败
- 控制：
  - 保留原手工脚本，新增编排层不替换旧流程
  - 先 `observe` 收集趋势，再启 `gate`
  - 负样例与正样例同时维护，避免单侧偏差
