# STEP189 Assembly Roundtrip Verification

## Goal
Verify that assembly/instance provenance survives editor roundtrip across the current Step186
sample set.

## Command
Run from:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion`

Command:
```bash
ctest --test-dir build -R 'editor_assembly_roundtrip_smoke|editor_assembly_roundtrip_paperspace_smoke|editor_assembly_roundtrip_mixed_smoke|editor_assembly_roundtrip_dense_smoke' --output-on-failure
```

## Result
- `4/4 tests passed`

Per-lane results:
- model: `PASS`
- paperspace: `PASS`
- mixed: `PASS`
- dense: `PASS`

## Summary Metrics
From `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`:
- `ctestAssemblyRoundtripCaseCount = 4`
- `ctestAssemblyRoundtripPassCount = 4`
- `ctestAssemblyRoundtripFailCount = 0`
- `ctestAssemblyRoundtripImportAssemblyTrackedCount = 132`
- `ctestAssemblyRoundtripImportAssemblyGroupCount = 55`
- `ctestAssemblyRoundtripImportDerivedProxyCount = 61`
- `ctestAssemblyRoundtripImportExplodedCount = 39`
- `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
- `ctestAssemblyRoundtripExportGroupDriftCount = 0`

## Key Summary Artifacts
- model:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_smoke/20260312_085429_606_3170/summary.json`
- paperspace:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_paperspace_smoke/20260312_085429_870_75e6/summary.json`
- mixed:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_mixed_smoke/20260312_085430_155_fcf7/summary.json`
- dense:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260312_085430_567_6624/summary.json`

## Observed Semantics
The roundtrip matrix currently preserves:
- model-space insert groups
- paperspace insert + leader provenance
- mixed model/paperspace samples
- dense Step186 samples including:
  - annotation bundle
  - combo paperspace cases
  - insert dimension
  - insert dimension hatch
  - insert leader
  - insert styles
  - multi-layout
  - insert triad

## Conclusion
Step189 verification is `PASS`.

The current editor roundtrip path preserves the assembly/proxy provenance contract with:
- zero metadata drift;
- zero group drift;
- stable coverage across model, paperspace, mixed, and dense real-sample lanes.

## 2026-03-12 Combined Local-CI Verification
Step189 stayed green in the same narrow local-CI run that now carries:
- strict Step187 DWG-open validation;
- Step188 constraints-basic validation.

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`

Observed values:
- `ctestAssemblyRoundtripStatus = ok`
- `ctestAssemblyRoundtripCaseCount = 4`
- `ctestAssemblyRoundtripPassCount = 4`
- `ctestAssemblyRoundtripFailCount = 0`
- `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
- `ctestAssemblyRoundtripExportGroupDriftCount = 0`

This matters because it proves the assembly lane stays green while the surrounding product
quality loop gets stricter. Step189 is not isolated from the current delivery path.

## 2026-03-12 Gate And Weekly Verification Refresh
This pass re-ran the assembly lane together with live Step187 and Step188 lanes.

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestAssemblyRoundtripStatus = ok`
- `ctestAssemblyRoundtripCaseCount = 4`
- `ctestAssemblyRoundtripPassCount = 4`
- `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
- `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Fresh gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `assembly_roundtrip_ctest.status = PASS`
- `assembly_roundtrip_ctest.case_count = 4`
- `assembly_roundtrip_ctest.pass_count = 4`
- `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `assembly_roundtrip_ctest.export_group_drift_count = 0`

Fresh weekly summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- `gate_assembly_roundtrip_ctest.status = PASS`
- `gate_assembly_roundtrip_ctest.case_count = 4`
- `gate_assembly_roundtrip_ctest.pass_count = 4`
- `gate_assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `gate_assembly_roundtrip_ctest.export_group_drift_count = 0`

Fresh consumer outputs:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_dwg_constraints_round2.md`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_dwg_constraints_round2.md`

Observed rendered lines include:
- `assembly_roundtrip_ctest ... status=PASS`
- `local_ctest_assembly_roundtrip ... status=ok`
- `gate_assembly_roundtrip_ctest ... status=PASS`

Observed dense-case coverage remains:
- `paperspace_case_name = assembly_paperspace_insert_leader`
- `dense_case_name = assembly_dense_insert_triad,assembly_dense_mixed_origin,assembly_dense_multi_layout,assembly_dense_paperspace_annotation_bundle,assembly_dense_paperspace_combo,assembly_dense_paperspace_insert_dimension,assembly_dense_paperspace_insert_dimension_hatch,assembly_dense_paperspace_insert_leader,assembly_dense_paperspace_insert_styles`

Conclusion:
- Step189 remains `PASS`;
- the assembly roundtrip lane stays green in local CI, gate, weekly summary, and reporting
  consumers without metadata drift or group drift.

## 2026-03-12 Dense-Matrix Stability Refresh
This pass kept the assembly roundtrip lane green while Step187 gained a real DWG matrix lane
and Step188 stayed on the thicker eleven-check basic-constraint lane.

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestAssemblyRoundtripStatus = ok`
- `ctestAssemblyRoundtripCaseCount = 4`
- `ctestAssemblyRoundtripPassCount = 4`
- `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
- `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Fresh gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `assembly_roundtrip_ctest.status = PASS`
- `assembly_roundtrip_ctest.pass_count = 4`
- `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `assembly_roundtrip_ctest.export_group_drift_count = 0`

Fresh weekly summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- `gate_assembly_roundtrip_ctest.enabled = true`
- `gate_assembly_roundtrip_ctest.status = PASS`
- `gate_assembly_roundtrip_ctest.pass_count = 4`
- `gate_assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `gate_assembly_roundtrip_ctest.export_group_drift_count = 0`

Fresh consumer outputs:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_dwg_constraints_round2.md`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_dwg_constraints_round2.md`

Observed rendered lines include:
- `assembly_roundtrip_ctest ... status=PASS`
- `local_ctest_assembly_roundtrip ... status=ok`
- `gate_assembly_roundtrip_ctest ... status=PASS`

Current conclusion:
- Step189 remains stable under the current stricter product loop:
  - zero metadata drift;
  - zero group drift;
  - four roundtrip cases still green in local, gate, and weekly consumers.

## 2026-03-12 Weekly Gate Status Consistency Refresh
This pass verified that the weekly summary consumer fix now reports the assembly roundtrip lane
under a top-level `gate.status = ok` instead of leaving the overall gate block in `skipped`.

Fresh weekly summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- `gate.status = ok`
- `gate_assembly_roundtrip_ctest.enabled = true`
- `gate_assembly_roundtrip_ctest.status = PASS`
- `gate_assembly_roundtrip_ctest.pass_count = 4`
- `gate_assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `gate_assembly_roundtrip_ctest.export_group_drift_count = 0`

Conclusion:
- Step189 remains green and is now reported consistently by the weekly top-level gate summary.

## 2026-03-12 Dense Text-Only Coverage Expansion
This pass expanded the dense assembly roundtrip lane with two real text-only Step186 samples:
- `assembly_dense_mleader_textonly`
- `assembly_dense_table_textonly`

Targeted probe before integrating into CTest:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip_textonly_probe/20260312_101841_761_182a/summary.json`
- `pass = 2`
- `fail = 0`
- `assembly_dense_mleader_textonly.text_kind_counts = {\"mleader\": 1}`
- `assembly_dense_table_textonly.text_kind_counts = {\"table\": 1}`

Fresh dense ctest after integration:
- `editor_assembly_roundtrip_dense_smoke = PASS`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `assembly_roundtrip_ctest.status = PASS`
- `assembly_roundtrip_ctest.pass_count = 4`
- `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `assembly_roundtrip_ctest.export_group_drift_count = 0`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestAssemblyRoundtripStatus = ok`
- `ctestAssemblyRoundtripPassCount = 4`

Dense-lane runtime effect:
- the dense matrix now validates eleven cases instead of nine;
- the added text-only cases do not introduce metadata drift or group drift.

Current conclusion:
- Step189 remains green while covering a broader provenance surface than the earlier
  assembly/proxy-only dense matrix.

## 2026-03-12 Weekly Refresh After Dense Text-Only Expansion
The latest narrow weekly run confirms that the denser Step189 matrix still reports cleanly
through the top-level gate and weekly consumer chain.

Fresh weekly summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- `gate.status = ok`
- `gate_assembly_roundtrip_ctest.enabled = true`
- `gate_assembly_roundtrip_ctest.status = PASS`
- `gate_assembly_roundtrip_ctest.pass_count = 4`
- `gate_assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `gate_assembly_roundtrip_ctest.export_group_drift_count = 0`

Fresh weekly dashboard:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260312_022442.md`

Conclusion:
- Step189 remains green in direct dense smoke, local CI, clean gate, and the latest weekly
  consumer path after adding the real `mleader` and `table` text-only roundtrip cases.

## 2026-03-12 Dense Text-Kinds Expansion
This pass expanded the dense Step189 matrix from eleven to twelve cases by adding:
- `assembly_dense_text_kinds_textonly`

Targeted dense ctest:
- `editor_assembly_roundtrip_dense_smoke = PASS`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestAssemblyRoundtripStatus = ok`
- `ctestAssemblyRoundtripPassCount = 4`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `assembly_roundtrip_ctest.status = PASS`
- `assembly_roundtrip_ctest.pass_count = 4`
- `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `assembly_roundtrip_ctest.export_group_drift_count = 0`

Local CI dense-lane metrics now include:
- `text_kinds = {"attdef":1,"attrib":1,"dimension":9,"mleader":1,"mtext":7,"table":1,"text":20}`
- `text_kind_cases = 14`
- `tracked = 132`
- `groups = 55`
- `metadata_drift = 0`
- `group_drift = 0`

Current conclusion:
- Step189 remains green after adding the `text_kinds` real sample, and the dense roundtrip lane
  now covers a broader text/provenance surface than the earlier eleven-case matrix.

## 2026-03-12 Dense Leader Proxy Expansion
This pass expanded the dense Step189 matrix from twelve to thirteen cases by adding:
- `assembly_dense_leader_proxy`

Fresh dense ctest summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260312_121758_600_cf92/summary.json`
- `case_selection.selected_count = 13`
- `totals.pass = 13`
- `totals.fail = 0`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestAssemblyRoundtripStatus = ok`
- `ctestAssemblyRoundtripPassCount = 4`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `assembly_roundtrip_ctest.status = PASS`
- `assembly_roundtrip_ctest.pass_count = 4`
- `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `assembly_roundtrip_ctest.export_group_drift_count = 0`

Scope note:
- this pass did not rerun a fresh weekly lane;
- the claim here is based on direct dense ctest, local CI, and clean gate.

Current conclusion:
- Step189 remains green after adding the real `leader` proxy sample, and the dense roundtrip
  lane now covers thirteen cases with zero metadata drift and zero group drift at the gate level.

## 2026-03-12 Dense Viewport Sample Expansion
This pass expanded the dense Step189 matrix from thirteen to fourteen cases by adding:
- `assembly_dense_viewport_sample`

Fresh dense ctest summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260312_131101_849_5a5f/summary.json`
- `case_selection.selected_count = 14`
- `totals.pass = 14`
- `totals.fail = 0`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestAssemblyRoundtripStatus = ok`
- `ctestAssemblyRoundtripPassCount = 4`
- `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
- `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `assembly_roundtrip_ctest.status = PASS`
- `assembly_roundtrip_ctest.pass_count = 4`
- `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `assembly_roundtrip_ctest.export_group_drift_count = 0`

Scope note:
- this pass did not rerun a fresh weekly lane;
- the claim here is based on direct dense ctest, local CI, and clean gate.

Current conclusion:
- Step189 remains green after adding the real `viewport` paperspace sample, and the dense
  roundtrip lane now covers fourteen cases with zero metadata drift and zero group drift at the
  gate level.

## 2026-03-12 Dense Hatch Proxy Expansion
This pass expanded the dense Step189 matrix from fourteen to fifteen cases by adding:
- `assembly_dense_hatch_proxy`

Fresh dense ctest summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260312_132654_618_95f4/summary.json`
- `case_selection.selected_count = 15`
- `totals.pass = 15`
- `totals.fail = 0`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestAssemblyRoundtripStatus = ok`
- `ctestAssemblyRoundtripPassCount = 4`
- `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
- `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `assembly_roundtrip_ctest.status = PASS`
- `assembly_roundtrip_ctest.pass_count = 4`
- `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `assembly_roundtrip_ctest.export_group_drift_count = 0`

Scope note:
- this pass reran direct dense ctest, local CI, and clean gate;
- it did not rerun a fresh weekly lane.

Current conclusion:
- Step189 remains green after adding the standalone real `hatch` proxy sample, and the dense
  roundtrip lane now covers fifteen cases with zero metadata drift and zero group drift at the
  gate level.

## 2026-03-12 Dense Hatch-Dense Expansion
This pass expanded the dense Step189 matrix from fifteen to sixteen cases by adding:
- `assembly_dense_hatch_dense_proxy`

Fresh dense ctest summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260312_140221_735_d556/summary.json`
- `case_selection.selected_count = 16`
- `totals.pass = 16`
- `totals.fail = 0`

Key roundtrip observation for the new case:
- the new `hatch_dense_sample.dxf` roundtrip stayed green while exporting `4761` derived proxy
  entities with zero metadata drift and zero group drift.

Scope note:
- this pass reran direct dense ctest;
- it did not claim a fresh full `local_ci`/`editor_gate` rerun at sixteen cases because the
  broader iteration also exposed a separate DWG single-sample smoke bind issue unrelated to
  Step189 roundtrip semantics.

Current conclusion:
- Step189 remains green after adding the larger real `hatch_dense` proxy sample, and the dense
  roundtrip lane now covers sixteen cases with zero metadata drift and zero group drift in the
  direct dense ctest path.

## 2026-03-12 Dense Text-Alignment Expansion
This pass expanded the dense Step189 matrix from fifteen to sixteen cases by adding:
- `assembly_dense_text_align_extended`

Fresh dense ctest summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260312_135901_907_1acc/summary.json`
- `case_selection.selected_count = 16`
- `totals.pass = 16`
- `totals.fail = 0`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestAssemblyRoundtripStatus = ok`
- `ctestAssemblyRoundtripPassCount = 4`
- `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
- `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `assembly_roundtrip_ctest.status = PASS`
- `assembly_roundtrip_ctest.pass_count = 4`
- `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `assembly_roundtrip_ctest.export_group_drift_count = 0`

Known non-promoted gap:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260312_135424_955_a6cf/summary.json`
- `assembly_dense_hatch_dense_proxy` failed with `Unexpected end of JSON input`
- that failure came from a real roundtrip/export gap in `hatch_dense_sample.dxf`, so the sample
  is documented here but intentionally not promoted into the default dense matrix.

Scope note:
- this pass reran direct dense ctest, local CI, and clean gate;
- it did not rerun a fresh weekly lane.

Current conclusion:
- Step189 remains green with a stable sixteen-case dense matrix, zero metadata drift, and zero
  group drift at the gate level.
- `hatch_dense_sample.dxf` remains a tracked real gap rather than a promoted green case.

## 2026-03-12 Sixteen-Case Dense Refresh
This refresh reran the current sixteen-case dense matrix inside fresh local CI and clean gate
without changing the promoted case set.

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestAssemblyRoundtripStatus = ok`
- `ctestAssemblyRoundtripPassCount = 4`
- `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
- `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `assembly_roundtrip_ctest.status = PASS`
- `assembly_roundtrip_ctest.pass_count = 4`
- `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `assembly_roundtrip_ctest.export_group_drift_count = 0`

Scope note:
- this refresh reran local CI and clean gate;
- it did not rerun a fresh weekly lane;
- the promoted dense matrix remains the stable sixteen-case set rather than the known-red
  `hatch_dense_sample.dxf` probe.

Current conclusion:
- Step189 remains green with a stable sixteen-case dense matrix and zero export drift in fresh
  local CI and clean gate.

## 2026-03-12 Seventeen-Case Dense Refresh
This pass expanded the promoted dense Step189 matrix from sixteen to seventeen cases by promoting:
- `assembly_dense_hatch_large_boundary`

Fresh dense ctest summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260312_142647_794_fad5/summary.json`
- `case_selection.selected_count = 17`
- `totals.pass = 17`
- `totals.fail = 0`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestAssemblyRoundtripStatus = ok`
- `ctestAssemblyRoundtripPassCount = 4`
- `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
- `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `assembly_roundtrip_ctest.status = PASS`
- `assembly_roundtrip_ctest.pass_count = 4`
- `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `assembly_roundtrip_ctest.export_group_drift_count = 0`

Known non-promoted gap:
- `hatch_dense_sample.dxf` remains a tracked real roundtrip/export gap and is still intentionally
  not part of the promoted default matrix.

Scope note:
- this pass reran direct dense ctest, local CI, and clean gate;
- it did not rerun a fresh weekly lane.

Current conclusion:
- Step189 remains green with a stable seventeen-case dense matrix and zero export drift in fresh
  local CI and clean gate.

## 2026-03-12 Eighteen-Case Dense Refresh
This pass expanded the promoted dense Step189 matrix from seventeen to eighteen cases by promoting:
- `assembly_dense_blocks_importer`

Fresh dense ctest summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260312_144616_156_2094/summary.json`
- `case_selection.selected_count = 18`
- `totals.pass = 18`
- `totals.fail = 0`
- `assembly_dense_blocks_importer = PASS`

Scope note:
- this pass reran direct dense ctest only;
- it did not claim a fresh local CI or clean gate replay at eighteen dense cases because the same
  runtime window was blocked by unrelated DWG router-readiness failures in the current environment.

Known non-promoted gap:
- `hatch_dense_sample.dxf` remains a tracked real roundtrip/export gap and is still intentionally
  not part of the promoted default matrix.

Current conclusion:
- Step189 now has a green eighteen-case dense roundtrip matrix in direct ctest;
- the promoted matrix remains strict about excluding the known-red `hatch_dense_sample.dxf` gap.

## 2026-03-12 Eighteen-Case Dense Refresh
This pass expanded the promoted dense Step189 matrix from seventeen to eighteen cases by promoting:
- `assembly_dense_blocks_importer`

Fresh dense ctest summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260312_145133_309_8061/summary.json`
- `case_selection.selected_count = 18`
- `totals.pass = 18`
- `totals.fail = 0`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestAssemblyRoundtripStatus = ok`
- `ctestAssemblyRoundtripPassCount = 4`
- `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
- `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `assembly_roundtrip_ctest.status = PASS`
- `assembly_roundtrip_ctest.pass_count = 4`
- `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `assembly_roundtrip_ctest.export_group_drift_count = 0`

Known non-promoted gap:
- `hatch_dense_sample.dxf` remains a tracked real roundtrip/export gap and is still intentionally
  not part of the promoted default matrix.

Scope note:
- this pass reran direct dense ctest, local CI, and clean gate;
- it did not rerun a fresh weekly lane.

Current conclusion:
- Step189 remains green with a stable eighteen-case dense matrix and zero export drift in fresh
  local CI and clean gate.

## 2026-03-12 Nineteen-Case Dense Refresh
This pass expanded the promoted dense Step189 matrix from eighteen to nineteen cases by promoting:
- `assembly_dense_importer_entities`

Fresh dense ctest summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260312_150604_513_6eff/summary.json`
- `case_selection.selected_count = 19`
- `totals.pass = 19`
- `totals.fail = 0`
- `assembly_dense_importer_entities = PASS`

Scope note:
- this pass reran direct dense ctest only;
- it did not claim a fresh local CI or clean gate replay at nineteen dense cases.

Known non-promoted gap:
- `hatch_dense_sample.dxf` remains a tracked real roundtrip/export gap and is still intentionally
  not part of the promoted default matrix.

Current conclusion:
- Step189 now has a green nineteen-case dense roundtrip matrix in direct ctest;
- the promoted matrix remains strict about excluding the known-red `hatch_dense_sample.dxf` gap.

## 2026-03-12 Twenty-One-Case Dense Integration Refresh

Fresh dense ctest summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260312_153450_608_97e0/summary.json`
- `case_selection.selected_count = 21`
- `totals.pass = 21`
- `totals.fail = 0`
- `assembly_dense_importer_text_metadata = PASS`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestAssemblyRoundtripStatus = ok`
- `ctestAssemblyRoundtripPassCount = 4`
- `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
- `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `assembly_roundtrip_ctest.status = PASS`
- `assembly_roundtrip_ctest.pass_count = 4`
- `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `assembly_roundtrip_ctest.export_group_drift_count = 0`

Scope note:
- this pass reran direct dense ctest, local CI, and clean gate;
- `hatch_dense_sample.dxf` remains a tracked real export gap and is still intentionally excluded
  from the promoted default matrix.

Current conclusion:
- Step189 now has a green twenty-one-case dense roundtrip matrix in direct ctest, and its promoted
  local/gate assembly roundtrip lane remains green with zero export metadata/group drift.

## 2026-03-12 Twenty-Three-Case Dense Refresh

Fresh dense ctest summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260312_155538_059_8510/summary.json`
- `case_selection.selected_count = 23`
- `totals.pass = 23`
- `totals.fail = 0`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestAssemblyRoundtripStatus = ok`
- `ctestAssemblyRoundtripPassCount = 4`
- `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
- `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `assembly_roundtrip_ctest.status = PASS`
- `assembly_roundtrip_ctest.pass_count = 4`
- `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `assembly_roundtrip_ctest.export_group_drift_count = 0`

Scope note:
- this pass reran direct dense ctest, local CI, and clean gate;
- `hatch_dense_sample.dxf` remains a tracked real export gap and is still intentionally excluded
  from the promoted default matrix.

Current conclusion:
- Step189 now has a green twenty-three-case dense roundtrip matrix in direct ctest, and its
  promoted local/gate assembly roundtrip lane remains green with zero export metadata/group drift.

## 2026-03-12 Twenty-Three-Case Dense Stability Refresh

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestAssemblyRoundtripStatus = ok`
- `ctestAssemblyRoundtripPassCount = 4`
- `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
- `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `assembly_roundtrip_ctest.status = PASS`
- `assembly_roundtrip_ctest.pass_count = 4`
- `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `assembly_roundtrip_ctest.export_group_drift_count = 0`

Scope note:
- this pass did not widen the dense matrix beyond twenty-three cases;
- it reran local CI and clean gate to confirm the promoted twenty-three-case baseline remains green
  while Step187 and Step188 continue to grow.

Current conclusion:
- Step189 remains green with a stable twenty-three-case dense roundtrip matrix and zero export
  metadata/group drift in fresh local CI and clean gate.

## 2026-03-13 Twenty-Four-Case Dense Expansion

Fresh direct dense summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260313_080631_255_a254/summary.json`
- `case_selection.selected_count = 24`
- `totals.pass = 24`
- `totals.fail = 0`

Newest dense case confirmed in this pass:
- `assembly_dense_insert_text_bundle`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestAssemblyRoundtripStatus = ok`
- `ctestAssemblyRoundtripPassCount = 4`
- `ctestAssemblyRoundtripExportMetadataDriftCount = 0`
- `ctestAssemblyRoundtripExportGroupDriftCount = 0`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `assembly_roundtrip_ctest.status = PASS`
- `assembly_roundtrip_ctest.pass_count = 4`
- `assembly_roundtrip_ctest.export_metadata_drift_count = 0`
- `assembly_roundtrip_ctest.export_group_drift_count = 0`

Scope note:
- this pass widened the dense matrix from twenty-three to twenty-four cases and reran direct dense
  ctest, local CI, and clean gate;
- `hatch_dense_sample.dxf` remains a tracked real export gap and is still intentionally excluded
  from the promoted default matrix.

Current conclusion:
- Step189 now has a green twenty-four-case dense roundtrip matrix in direct ctest, and its
  promoted local/gate assembly roundtrip lane remains green with zero export metadata/group drift.

## 2026-03-13 Twenty-Six-Case Dense Expansion

Fresh direct dense summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_assembly_roundtrip_dense_smoke/20260313_101924_195_47a5/summary.json`
- `case_selection.selected_count = 26`
- `totals.pass = 26`
- `totals.fail = 0`

Newest dense case confirmed in this promoted baseline:
- `assembly_dense_text_kinds_textonly`

Scope note:
- this pass reran fresh direct dense ctest only and used that as the authoritative evidence;
- it did not reuse stale local CI or gate summaries while the shared summary-producing lanes were
  intentionally left untouched.

Current conclusion:
- Step189 now has a green twenty-six-case dense roundtrip matrix in fresh direct dense ctest.

### Scope note

- Designed dense matrix scope: 27 cases (see STEP189_ASSEMBLY_ROUNDTRIP_DESIGN.md).
- Fresh verified baseline: 26/26 pass with zero metadata and group drift.
- Case 27 (`assembly_dense_hatch_dense_proxy`) is designed but has not yet been promoted into the
  fresh verified baseline.
