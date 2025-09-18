# CADGameFusion – Post‑Merge Verification Report (PR #5)

**Verification Time**: 2025-09-18  
**Target PR**: #5 (session/qt-export-dialog-enhancements → main)  
**CI Baseline Tag**: `ci-baseline-2025-09-18`

## 1. Summary
Status: ✅ All checks passed (build, exports, schema, structure, field-level, normalization).  
Risk Level: Low (no data drift; only additive, backward‑compatible metadata fields).  
Branch Protection: Required checks + code owner review enabled.

## 2. CI Workflow Status
```
Core Strict - Exports, Validation, Comparison: SUCCESS
Core CI: SUCCESS
Structure / Field Comparisons: SUCCESS
Normalization (Python + C++): SUCCESS
```

## 3. Scene Generation (8/8)
All expected scenes exported (JSON + glTF where applicable):
- sample
- holes
- multi (JSON only)
- units
- complex
- complex_spec
- concave_spec
- nested_holes_spec

## 4. Field-Level Validation
All `field_*.json` reports: `"status": "passed"` (rtol=1e-6). No numeric or structural deviations.

## 5. Consistency Statistics
`consistency_stats.txt` matches baseline 100%: group counts, ring counts, vertex totals, triangle counts stable.

## 6. Added / Changed JSON Fields
Added (or now consistently emitted) metadata keys:
- `meta.unitScale`
- `meta.useDocUnit`
- `meta.normalize.sortRings` (when normalization build flag active)
No unexpected or breaking field removals. Legacy consumers ignoring `meta.*` remain unaffected.

## 7. Branch Protection & Governance
Configured:
- Required status checks: Strict Exports + Core CI
- Code owner review: enabled
- Dismiss stale reviews: enabled
- Restricted merges: owner enforced

## 8. Baseline Tag
Created tag: `ci-baseline-2025-09-18` → commit `37f849d` (post‑merge stable point).

## 9. Compatibility & Rollback
Topology Mode: `--gltf-holes full` unified across local + CI.  
Backward Compatibility: New `meta.*` keys are optional informational fields.  
Rollback (if needed):
```bash
git checkout ci-baseline-2025-09-18     # Return to stable state
# or revert a problematic merge commit
git revert <merge-sha>
```
Re‑validate before re‑pushing:
```bash
bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full
```

## 10. Recommendations
1. Keep strict workflow required; optionally add second run with `use_vcpkg=true` if not already.
2. Refresh goldens only when exporter logic intentionally changes.
3. Tag each stable strict pass after structural or topology changes.
4. Add a lightweight unit test for presence of `meta.unitScale` in Qt export path if future refactors touch dialog logic.

## 11. Conclusion
The merged changes (Qt export dialog enhancements: holes toggle, document unit default, remembered last export path + documentation hardening) are fully validated. No regression indicators detected. Repository is ready for subsequent feature increments.

---  
Validator: Claude Code  
Report Version: v1.0 (EN)

