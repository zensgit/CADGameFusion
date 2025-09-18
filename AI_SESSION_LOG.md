# AI Collaboration Session Log

Date: 2025-09-16

Purpose: Capture current context, changes, and next steps so this work can be resumed seamlessly later.

## Summary
- Formal spec parsing via nlohmann/json enabled (CADGF_USE_NLOHMANN_JSON).
- Export normalization: orientation (outer CCW / holes CW), lexicographic start, optional ring sorting (CADGF_SORT_RINGS).
- Added glTF holes emission switch: `--gltf-holes <outer|full>` (default outer for golden compatibility; CI uses full for non-golden scenes).
- New C++ normalization test integrated into CI.
- CI split/strengthened (schema + structure + field-level), spec schema supports `rings` and `flat_pts` formats, and meta.normalize.
- Fixed field-level mismatches by aligning sample/holes/multi scenes and glTF indices.

## Files Touched (key)
- tools/export_cli.cpp (spec parsing, normalization, `--gltf-holes`, scene definitions, glTF writer)
- .github/workflows/strict-exports.yml (mappings, normalization checks, build tests, `--gltf-holes` usage)
- tests/tools/test_normalization_cpp.cpp (new)
- tests/tools/CMakeLists.txt (build new test)
- docs/schemas/export_group.schema.json (meta.normalize)
- sample_exports/scene_sample/mesh_group_0.gltf (indices count fix 9->6; sizes adjusted)

## What’s Pending
- Refresh golden samples via maintenance workflow to align glTF/bin bytes with latest exporter.
- Run strict exports workflows in both modes and verify reports:
  - Quick: use_vcpkg=false (rtol=1e-6)
  - Full: use_vcpkg=true (rtol=1e-6)
- Decide if strict-exports becomes a required PR check.

## How to Resume
1) Trigger workflows from GitHub Actions UI or CLI:
   - Core Strict - Exports, Validation, Comparison
     - Inputs: `use_vcpkg=false`, `rtol=1e-6`
     - Repeat with `use_vcpkg=true`
   - Maintenance - Refresh Golden Samples
2) Inspect artifacts:
   - strict-exports-reports-<OS>: field_*.json, test_report.md, consistency_stats.txt
   - golden-samples-<run_id>
3) If goldens updated, commit refreshed sample_exports back to repo.

## Handy Commands (local)
```
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_EDITOR_QT=OFF -DCADGF_USE_NLOHMANN_JSON=ON -DCADGF_SORT_RINGS=ON -G Ninja
cmake --build build --target export_cli test_normalization_cpp -j

# Generate scenes
build/tools/export_cli --out build/exports --scene sample
build/tools/export_cli --out build/exports --scene holes --gltf-holes outer
build/tools/export_cli --out build/exports --scene complex --gltf-holes full
build/tools/export_cli --out build/exports --spec tools/specs/scene_nested_holes_spec.json --gltf-holes full

# Validate
python3 tools/validate_export.py build/exports/scene_cli_complex --schema
python3 tools/test_normalization.py build/exports
build/tests/tools/test_normalization_cpp

# Compare with goldens
python3 tools/compare_fields.py build/exports/scene_cli_sample sample_exports/scene_sample --mode full --meta-mode on --rtol 1e-6
```

## Run Local CI without GitHub Actions
- One command (default holes=full):
```
bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full
```
- Outputs:
  - Scenes: `build/exports/scene_cli_*`
  - Stats: `build/consistency_stats.txt`
  - Field reports: `build/field_*.json`

## Notes
- Default exporter now uses `--gltf-holes full` (unified topology).
- CI generates all scenes with `--gltf-holes full`; goldens refreshed; holes comparison is now strict.
- See `RELEASE_NOTES.md` for a high-level summary and migration notes.

## Key Discussion Snippets
- 需求澄清与总体目标
  - 用户：要求硬化导出/验证流水线，正式 JSON 解析、规范化（方向/起点/环排序）、结构与字段级 CI 门禁、vcpkg 可选、增加凹多边形与套孔场景金样等。
  - 助手：确认实现范围，规划 CI 拆分与试验/维护工作流，增加 jsonschema 与 pip 缓存。
- 规范化与 JSON 解析
  - 决策：以 nlohmann/json 为唯一正式解析路径（CADGF_USE_NLOHMANN_JSON），在 CI 加入头文件硬门禁。
  - 决策：导出阶段强制规范化：外环 CCW、孔 CW；环内起点为字典序最小；可选环排序宏 CADGF_SORT_RINGS。
  - 产出：tools/test_normalization.py 与 C++ 版 test_normalization_cpp 接入 CI。
- 金样与字段级对比问题
  - 发现：字段级失败，包含坐标缩放（100→1）与 glTF 索引计数（9 vs 6）。
  - 修复：对齐 sample/holes/multi 的点集；修正 sample glTF 的 indices 与字节长度；CI 字段级映射修正 concave/nested_holes 到对应金样文件夹。
- glTF 孔洞策略讨论与决策
  - 背景：当前金样 holes 的 glTF 仅含外环顶点并扇形三角化。
  - 决策：新增 CLI 开关 `--gltf-holes <outer|full>`；默认 outer 兼容金样；CI 中除 holes 场景外，其他场景与所有 spec 使用 full 以贴近真实拓扑。
  - 后续：如需完全切换到 full，先刷新金样再收紧门禁。
- CI 与工作流
  - 决策：先跑两轮严格验证（use_vcpkg=false/true），再运行“刷新金样”工作流并复验。
  - 建议：将 strict-exports 设为必需检查；vcpkg 固定提交与 x‑gha 缓存启用；保留试验工作流验证环排序宏。
- 追踪与可复现
  - 需求：用户希望会话可保存以便下次继续。
  - 产出：本 AI_SESSION_LOG.md 记录当前状态、关键变更、执行步骤与讨论要点。

## Session 2025-09-17 — Continuation Snapshot
- Decisions/Changes captured today
  - Unify glTF holes to full topology by default (exporter, CI, local CI).
  - Strict exports CI: always upload artifacts; add failure guidance with local reproduction steps.
  - Refresh workflow now regenerates sample/holes/complex (CLI) and concave/nested_holes (spec) and validates all five scenes.
  - Added PR template with strict checklist; README Contributing section; Troubleshooting guidance; Release Notes.
  - Local CI script defaults to `--gltf-holes full` and mirrors strict gates.

- What to do next when resuming
  1) Build + refresh goldens (full topology): `bash tools/refresh_golden_samples.sh`
  2) Run local CI: `bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full`
  3) Commit updated `sample_exports/` if diffs exist
  4) Run strict exports CI (use_vcpkg=false, then true)
  5) If all green, set strict-exports as a required PR check

- Where to drop local reports for sharing
  - Place your local report as `CADGameFusion/LOCAL_CI_VERIFICATION_REPORT.md`
  - Optionally add CI artifacts under `CADGameFusion/ci_artifacts/<run_id>/`

### Local CI — Equivalence to Last CI
- Command: `bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full`
- Outcome: PASSED (schema, structure, field-level, normalization Python+C++)
- Scenes: 8/8 validated (sample/holes/multi/units/complex/specs)
- Conclusion: Fully equivalent to last GitHub Actions run (SUCCESS), safe baseline for continued development.
