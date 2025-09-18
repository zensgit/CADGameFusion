# CADGameFusion Release Announcement – v0.2.0 (2025-09-18)

## 1. English Summary
This release hardens the export + validation pipeline, enhances the Qt export dialog, and establishes a strict CI baseline fully aligned between local and remote environments. A post‑merge verification (EN & ZH) confirms 100% pass across schema, structure, field-level, and normalization gates. A baseline tag `ci-baseline-2025-09-18` has been created for rollback and differential analysis.

## 2. Highlights
- Qt Export Dialog: holes inclusion toggle (outer-only vs full), document unit scale default, persistent last export path.
- Export Metadata: additive, backward‑compatible keys (`meta.unitScale`, `meta.useDocUnit`, `meta.normalize.sortRings`).
- Strict CI: unified full-hole topology (`--gltf-holes full`) across 8 canonical scenes (sample, holes, multi, units, complex + 3 spec scenes).
- Verification: bilingual reports (`verification_report.md`, `verification_report_en.md`).
- Developer Experience: Strict CI Quick Guide (README), dual-language contribution quick checklists.
- Governance: PR template tightened (strict validation + golden refresh conditions), branch protection enforced.
- Baseline Tag: `ci-baseline-2025-09-18` for stable reference.

## 3. Changelog (Functional / Docs)
Added
- Qt exporter options: hole topology toggle, document unit default, last export path persistence.
- Strict CI Quick Guide (README).
- Dual-language contribution quick checklists (CONTRIBUTING).
- Post-merge verification reports (EN + ZH).
- Compatibility & rollback guidance.

Changed
- PR template: stricter required validation gates.
- Release notes: linked verification reports.

Unchanged
- Golden sample assets (no drift).
- Core computational logic (triangulation / boolean / offset).

## 4. Verification Summary
All gates passed:
```
Build: SUCCESS
Schema validation: PASS (all scenes)
Structure comparison: PASS
Field-level comparison (rtol=1e-6): PASS (all field_*.json)
Normalization (Python + C++): PASS
Scenes exported: 8/8 (JSON + glTF where applicable)
```
No unexpected JSON fields; only additive `meta.*` entries.

## 5. Compatibility & Rollback
Backward Compatibility:
- Existing consumers ignoring `meta.*` unaffected.
- Full hole topology now standard in strict path; legacy outer-only mode still available if needed for ad-hoc tests.

Rollback Procedure:
```bash
git checkout ci-baseline-2025-09-18            # stable baseline
# or revert specific merge
git revert <merge-sha>

# Revalidate strictly
bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full
```

When to Refresh Goldens:
- Only after intentional exporter logic changes (format / topology / numeric normalization). Tag a new baseline first.

## 6. Post‑Merge Recommended Actions
1. Keep required checks: “Core Strict - Exports, Validation, Comparison” (+ optional full vcpkg variant).
2. For exporter evolution: refresh golden samples → re-run dual strict workflows → tag new baseline.
3. Document any future meta extensions in RELEASE_NOTES and verification report.
4. (Optional) Add a targeted unit test for JSON meta emission in Qt exporter.

## 7. Suggested Squash Commit Message
```
chore: qt export options + strict validation baseline (v0.2.0)
- Qt: holes toggle, doc unit default, last export path
- Strict CI: full holes topology, 8-scene alignment local/remote
- Docs: verification reports (EN/ZH), quick guide, dual checklists
- Governance: tightened PR template; baseline tag ci-baseline-2025-09-18
```

## 8. Chinese Summary (中文摘要)
本次版本强化导出与验证链路，增强 Qt 导出对话框，并建立严格校验基线。中英文验证报告确认：结构 / 字段 / 规范化 / 场景全量校验 100% 通过。已创建基线标签 `ci-baseline-2025-09-18` 便于回滚与后续对比。

### 亮点
- Qt 导出对话框：洞包含开关、默认使用文档单位、记忆最近导出路径
- 导出元数据：新增 `meta.unitScale` / `meta.useDocUnit` / `meta.normalize.sortRings`（向后兼容）
- 严格 CI：统一 full 拓扑模式校验 8 个核心场景
- 验证：中英文合并验证报告
- 开发体验：严格校验快速指南 + 中英文贡献快速清单
- 治理：PR 模板强化 + 分支保护
- 基线：标签 `ci-baseline-2025-09-18`

### 变更概览
新增：导出选项、严格校验指南、双语清单、验证报告、兼容性/回滚指引  
变更：PR 模板、发布说明引用  
不变：金样文件、几何核心逻辑  

### 验证摘要
```
构建：成功
场景：8/8
Schema：全部通过
结构对比：通过
字段级 (1e-6)：通过
规范化(Python/C++)：通过
```

### 兼容性与回滚
- 仅新增可选元数据字段；旧消费者可忽略
- 严格路径统一 full 拓扑；outer-only 仍可测试时手动指定
- 回滚：`git checkout ci-baseline-2025-09-18` 或 `git revert <merge-sha>` 后重新运行本地严格校验

### 后续建议
1. 继续保持严格工作流为必需检查
2. 导出逻辑变更前先打新基线标签
3. 金样刷新需双重严格校验（use_vcpkg=false/true）
4. 后续可补充针对 Qt 导出元数据的轻量单元测试

## 9. Acknowledgements
Thanks to contributors and reviewers enforcing consistent high validation standards.

---
Version: v0.2.0  
Date: 2025-09-18  
Baseline Tag: ci-baseline-2025-09-18  
Reports: `verification_report.md`, `verification_report_en.md`

