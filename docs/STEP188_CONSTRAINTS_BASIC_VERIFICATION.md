# STEP188 Constraints Basic Verification

## Goal
Verify that the current minimal solver still succeeds on the basic supported constraints after
recent diagnostics and structural-analysis work.

## Command
Run from:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion`

Commands:
```bash
cmake --build build --target core_tests_constraints_basic -j4
ctest --test-dir build -R 'core_tests_constraints_basic' --output-on-failure
```

## Result
- build: `PASS`
- ctest: `PASS`

Observed output:
- `core_tests_constraints_basic` rebuilt explicitly
- `1/1 tests passed`
- runtime: about `0.37 sec`

## Important Verification Note
An earlier broad ctest pass initially showed:
- `core_tests_constraints_basic: Subprocess aborted`

That failure was not reproduced after an explicit rebuild of the target.
The likely cause was a stale binary/ABI mismatch after the solver diagnostics structures changed.

After rebuilding the target directly, the test passed cleanly.

## Broad Regression Context
A follow-up broad ctest slice also passed:
```bash
ctest --test-dir build -R 'core_tests_constraints_basic|editor_assembly_roundtrip_smoke|editor_assembly_roundtrip_paperspace_smoke|editor_assembly_roundtrip_mixed_smoke|editor_assembly_roundtrip_dense_smoke' --output-on-failure
```

Result:
- `5/5 tests passed`

This confirms the constraints-basic lane is green alongside the existing assembly roundtrip lanes.

## Conclusion
Step188 verification is `PASS`.

The current minimal solver still supports and regresses:
- `horizontal`
- `vertical`
- `equal`
- `distance`
- `parallel`
- `perpendicular`

It also now regresses these paired success paths:
- `horizontal + distance`
- `vertical + distance`
- `parallel + distance`
- `equal + distance`
- `perpendicular + distance`

with the expected success-path structural analysis shape.

## 2026-03-12 Gate/Local Integration Verification
This follow-up verification promoted Step188 from a standalone ctest target into a continuously
reported lane.

Fresh gate run verified:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `constraints_basic_ctest.enabled = true`
- `constraints_basic_ctest.status = PASS`
- `constraints_basic_ctest.case_count = 1`
- `constraints_basic_ctest.pass_count = 1`
- `constraints_basic_ctest.test_name = core_tests_constraints_basic`

Fresh local run verified:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestConstraintsBasicStatus = ok`

Consumer replay from real gate/local summaries:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_dwg_constraints.md`
- observed lines:
  - `constraints_basic_ctest ... status=PASS`
  - `local_ctest_constraints_basic ... status=ok`

This confirms Step188 is now:
1. buildable and green as a direct ctest target;
2. green inside gate;
3. green inside local CI;
4. visible in the reporting layer.

Fresh weekly summary also now carries the lane:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- `gate_constraints_basic_ctest.status = PASS`
- `gate_constraints_basic_ctest.case_count = 1`

Observed consumer outputs:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.md`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260312_011839.md`
- lines include:
  - `gate_constraints_basic_ctest ... status=PASS`
  - `weekly_gate_constraints_basic_ctest ... status=PASS`

## 2026-03-12 Expanded Success-Path Verification
This pass thickened the basic lane without changing the solver contract surface.

Commands:
```bash
cmake --build build --target core_tests_constraints_basic -j4
ctest --test-dir build -R 'core_tests_constraints_basic' --output-on-failure
```

Observed runtime output now includes:
- `basic constraint case passed: horizontal+distance`
- `basic constraint case passed: vertical+distance`
- `basic constraint case passed: parallel+distance`
- `basic constraint case passed: equal+distance`
- `basic constraint case passed: perpendicular+distance`

This confirms Step188 is no longer only six isolated one-constraint checks. It now also
guards a small but meaningful set of composed success paths.

## 2026-03-12 Continuous Lane Refresh
This pass re-ran Step188 inside the live local/gate/weekly loops after thickening the success
path to eleven solver checks.

Fresh direct ctest output included:
- `basic constraint case passed: horizontal`
- `basic constraint case passed: vertical`
- `basic constraint case passed: equal`
- `basic constraint case passed: distance`
- `basic constraint case passed: parallel`
- `basic constraint case passed: perpendicular`
- `basic constraint case passed: horizontal+distance`
- `basic constraint case passed: vertical+distance`
- `basic constraint case passed: parallel+distance`
- `basic constraint case passed: equal+distance`
- `basic constraint case passed: perpendicular+distance`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestConstraintsBasicStatus = ok`

Fresh gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `constraints_basic_ctest.status = PASS`
- `constraints_basic_ctest.case_count = 1`
- `constraints_basic_ctest.pass_count = 1`

Fresh weekly summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- `gate_constraints_basic_ctest.status = PASS`
- `gate_constraints_basic_ctest.case_count = 1`

Fresh consumer outputs:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_dwg_constraints_round2.md`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_dwg_constraints_round2.md`

Observed rendered lines:
- `constraints_basic_ctest ... status=PASS`
- `local_ctest_constraints_basic ... status=ok`
- `gate_constraints_basic_ctest ... status=PASS`

Conclusion:
- Step188 remains `PASS`;
- the thicker eleven-check success-path lane stays green in direct ctest, local CI, gate, and
  weekly/report consumers.

## 2026-03-12 Gate And Weekly Contract Refresh
This pass kept the thicker basic-constraints lane green while the surrounding DWG-open
business-path gate became stricter.

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestConstraintsBasicStatus = ok`

Fresh gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `constraints_basic_ctest.status = PASS`
- `constraints_basic_ctest.test_name = core_tests_constraints_basic`
- `constraints_basic_ctest.pass_count = 1`
- `constraints_basic_ctest.fail_count = 0`

Fresh weekly summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- `gate_constraints_basic_ctest.enabled = true`
- `gate_constraints_basic_ctest.status = PASS`
- `gate_constraints_basic_ctest.pass_count = 1`

Fresh consumer outputs:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_dwg_constraints_round2.md`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_dwg_constraints_round2.md`

Observed rendered lines include:
- `constraints_basic_ctest ... status=PASS`
- `local_ctest_constraints_basic ... status=ok`
- `gate_constraints_basic_ctest ... status=PASS`

Conclusion:
- Step188 remains green in direct ctest, local CI, gate, weekly summary, and reporting
  consumers after the latest DWG gate tightening.

## 2026-03-12 Weekly Gate Status Consistency Refresh
This pass did not change the Step188 solver behavior. It verified that the weekly summary
consumer fix now reports the constraints-basic gate lane under a top-level `gate.status = ok`
instead of a stale `skipped`.

Fresh weekly summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- `gate.status = ok`
- `gate_constraints_basic_ctest.enabled = true`
- `gate_constraints_basic_ctest.status = PASS`
- `gate_constraints_basic_ctest.pass_count = 1`

Conclusion:
- Step188 remains green and is now reported consistently by the weekly top-level gate summary.

## 2026-03-12 Expanded Success-Path Matrix
This pass thickened the Step188 success-path lane from eleven checks to fourteen.

New direct ctest output:
- `basic constraint case passed: equal_x+distance`
- `basic constraint case passed: parallel_vertical+distance`
- `basic constraint case passed: perpendicular_horizontal+distance`

Fresh direct ctest result:
- `core_tests_constraints_basic = PASS`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `constraints_basic_ctest.status = PASS`
- `constraints_basic_ctest.pass_count = 1`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestConstraintsBasicStatus = ok`

Current conclusion:
- Step188 now guards fourteen success-path checks while staying green in direct ctest, local CI,
  and clean gate runs.

## 2026-03-12 Weekly Refresh After Fourteen Success-Path Checks
The latest narrow weekly run confirms that the expanded Step188 lane remains green after the
matrix increased from eleven to fourteen success-path checks.

Fresh weekly summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- `gate.status = ok`
- `gate_constraints_basic_ctest.enabled = true`
- `gate_constraints_basic_ctest.status = PASS`
- `gate_constraints_basic_ctest.pass_count = 1`

Fresh weekly dashboard:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260312_022442.md`

Observed rendered lines continue to include:
- `constraints_basic_ctest ... status=PASS`
- `gate_constraints_basic_ctest ... status=PASS`

## 2026-03-12 Twenty-Six Success-Path Refresh
This pass thickened the Step188 success-path lane from twenty-four checks to twenty-six.

New direct runtime output now includes:
- `basic constraint case passed: vertical+equal_anchor_y`
- `basic constraint case passed: distance+equal_anchor_x`

Commands:
```bash
cmake --build build --target core_tests_constraints_basic -j4
./build/tests/core/core_tests_constraints_basic | rg -c '^basic constraint case passed:'
ctest --test-dir build -R 'core_tests_constraints_basic' --output-on-failure
```

Observed results:
- direct count output: `26`
- direct ctest result: `PASS`
- `core_tests_constraints_basic` remains the only selected test in this minimal verification

Conclusion:
- Step188 now covers twenty-six success-path checks;
- the two new anchor-driven composed cases stay green under the current minimal solver;
- the lane remains fast enough for iterative direct verification while other teams continue
  changing gate/router/UI files in parallel.


## 2026-03-12 Sixteen Success-Path Checks
This pass expanded Step188 from fourteen to sixteen success-path checks.

New direct ctest output:
- `basic constraint case passed: equal_x+horizontal`
- `basic constraint case passed: equal_y+vertical`

Fresh direct ctest result:
- `core_tests_constraints_basic = PASS`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestConstraintsBasicStatus = ok`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `constraints_basic_ctest.status = PASS`
- `constraints_basic_ctest.pass_count = 1`

Current conclusion:
- Step188 now guards sixteen success-path checks while remaining green in direct ctest, local CI,
  and clean gate.

## 2026-03-12 Eighteen Success-Path Checks
This pass expanded Step188 from sixteen to eighteen success-path checks.

New direct ctest output:
- `basic constraint case passed: parallel_horizontal+vertical`
- `basic constraint case passed: parallel_vertical+horizontal`

Fresh direct ctest result:
- `core_tests_constraints_basic = PASS`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestConstraintsBasicStatus = ok`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `constraints_basic_ctest.status = PASS`
- `constraints_basic_ctest.pass_count = 1`

Scope note:
- this pass did not rerun a fresh weekly lane;
- the claim here is based on direct ctest, local CI, and clean gate.

Current conclusion:
- Step188 now guards eighteen success-path checks while remaining green in direct ctest, local CI,
  and clean gate.

## 2026-03-12 Twenty Success-Path Checks
This pass expanded Step188 from eighteen to twenty success-path checks.

New direct ctest output:
- `basic constraint case passed: horizontal+vertical`
- `basic constraint case passed: equal_x+equal_y`

Fresh direct ctest result:
- `core_tests_constraints_basic = PASS`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestConstraintsBasicStatus = ok`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `constraints_basic_ctest.status = PASS`
- `constraints_basic_ctest.pass_count = 1`

Scope note:
- this pass did not rerun a fresh weekly lane;
- the claim here is based on direct ctest, local CI, and clean gate.

Current conclusion:
- Step188 now guards twenty success-path checks while remaining green in direct ctest, local CI,
  and clean gate.

## 2026-03-12 Twenty-Two Success-Path Checks
This pass expanded Step188 from twenty to twenty-two success-path checks.

New direct ctest output:
- `basic constraint case passed: equal_y+distance`
- `basic constraint case passed: horizontal+equal_anchor_x`

Fresh direct ctest result:
- `core_tests_constraints_basic = PASS`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestConstraintsBasicStatus = ok`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `constraints_basic_ctest.status = PASS`
- `constraints_basic_ctest.pass_count = 1`

Scope note:
- this pass reran direct ctest, local CI, and clean gate;
- it did not rerun a fresh weekly lane.

Current conclusion:
- Step188 now guards twenty-two success-path checks while remaining green in direct ctest, local
  CI, and clean gate, with the new coverage still limited to low-risk composed success paths.

## 2026-03-12 Twenty-Four Success-Path Checks
This pass expanded Step188 from twenty-two to twenty-four success-path checks.

New direct ctest output:
- `basic constraint case passed: vertical+equal_anchor_x`
- `basic constraint case passed: horizontal+equal_anchor_y`

Fresh direct ctest result:
- `core_tests_constraints_basic = PASS`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestConstraintsBasicStatus = ok`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `constraints_basic_ctest.status = PASS`
- `constraints_basic_ctest.pass_count = 1`

Scope note:
- this pass reran direct ctest, local CI, and clean gate;
- it did not rerun a fresh weekly lane.

Current conclusion:
- Step188 now guards twenty-four success-path checks while remaining green in direct ctest, local
  CI, and clean gate, with the newest coverage still limited to low-risk anchor-composition
  success paths.

## 2026-03-12 Twenty-Six Success-Path Checks
This pass expanded Step188 from twenty-four to twenty-six success-path checks.

New direct ctest output includes:
- `basic constraint case passed: vertical+equal_anchor_y`
- `basic constraint case passed: distance+equal_anchor_x`

Fresh direct ctest result:
- `core_tests_constraints_basic = PASS`

Scope note:
- this pass reran direct `core_tests_constraints_basic`;
- it did not yet claim a fresh `local_ci`/`editor_gate` replay at twenty-six checks because this
  iteration focused on thickening the success-path lane itself.

Current conclusion:
- Step188 now guards twenty-six success-path checks while remaining green in direct ctest, with
  the newest additions still constrained to low-risk composed success paths.

## 2026-03-12 Twenty-Six Success-Path Integration Refresh
After the twenty-six-case expansion, the lane was replayed through fresh local CI and clean gate.

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestConstraintsBasicStatus = ok`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `constraints_basic_ctest.status = PASS`
- `constraints_basic_ctest.pass_count = 1`

Scope note:
- this refresh reran local CI and clean gate on top of the already-green direct ctest baseline;
- it still did not rerun a fresh weekly lane.

Current conclusion:
- Step188 now guards twenty-six success-path checks while remaining green in direct ctest, local
  CI, and clean gate.

## 2026-03-12 Twenty-Eight Success-Path Expansion
This pass expanded Step188 from twenty-six to twenty-eight success-path checks.

New direct ctest output includes:
- `basic constraint case passed: parallel_horizontal+equal_anchor_y`
- `basic constraint case passed: perpendicular_vertical+equal_anchor_x`

Fresh direct ctest result:
- `core_tests_constraints_basic = PASS`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestConstraintsBasicStatus = ok`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `constraints_basic_ctest.status = PASS`
- `constraints_basic_ctest.pass_count = 1`

Scope note:
- this pass reran direct ctest, local CI, and clean gate;
- it did not rerun a fresh weekly lane.

Current conclusion:
- Step188 now guards twenty-eight success-path checks while remaining green in direct ctest, local
  CI, and clean gate.

## 2026-03-12 Thirty Success-Path Expansion
This pass expanded Step188 from twenty-eight to thirty success-path checks.

New direct ctest output includes:
- `basic constraint case passed: parallel_vertical+equal_anchor_y`
- `basic constraint case passed: perpendicular_horizontal+equal_anchor_y`

Fresh direct ctest result:
- `core_tests_constraints_basic = PASS`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tests/core/test_constraints_basic.cpp`
- `run_single_count = 30`

Scope note:
- this pass reran direct `core_tests_constraints_basic`;
- it did not claim a fresh local CI or clean gate replay at thirty checks because the same run
  window was blocked by unrelated DWG router readiness restrictions in the current environment.

Current conclusion:
- Step188 now guards thirty success-path checks while remaining green in direct ctest.

## 2026-03-12 Thirty-Two Success-Path Expansion
This pass expanded Step188 from twenty-eight to thirty-two success-path checks.

New direct ctest output includes:
- `basic constraint case passed: parallel_vertical+equal_anchor_y`
- `basic constraint case passed: parallel_horizontal+equal_anchor_x`
- `basic constraint case passed: perpendicular_horizontal+equal_anchor_y`
- `basic constraint case passed: perpendicular_vertical+equal_anchor_y`

Fresh direct ctest result:
- `core_tests_constraints_basic = PASS`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestConstraintsBasicStatus = ok`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `constraints_basic_ctest.status = PASS`
- `constraints_basic_ctest.pass_count = 1`

Scope note:
- this pass reran direct ctest, local CI, and clean gate;
- it did not rerun a fresh weekly lane.

Current conclusion:
- Step188 now guards thirty-two success-path checks while remaining green in direct ctest, local
  CI, and clean gate.

## 2026-03-12 Thirty-Eight Success-Path Expansion

Fresh direct ctest result:
- `core_tests_constraints_basic = PASS`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tests/core/test_constraints_basic.cpp`
- `run_single_count = 38`

Newest success-path cases confirmed in this pass:
- `equal_x+equal_anchor_y`
- `equal_y+equal_anchor_x`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestConstraintsBasicStatus = ok`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `constraints_basic_ctest.status = PASS`
- `constraints_basic_ctest.pass_count = 1`

Scope note:
- this pass reran direct ctest, local CI, and clean gate;
- it did not rerun a fresh weekly lane.

Current conclusion:
- Step188 now guards thirty-eight success-path checks while remaining green in direct ctest, local
  CI, and clean gate.

## 2026-03-12 Forty-Two Success-Path Expansion

Fresh direct ctest result:
- `core_tests_constraints_basic = PASS`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tests/core/test_constraints_basic.cpp`
- `run_single invocations = 42`

Newest success-path cases confirmed in this pass:
- `horizontal+distance+equal_anchor_x`
- `vertical+distance+equal_anchor_y`
- `parallel_horizontal+distance+equal_anchor_x`
- `parallel_vertical+distance+equal_anchor_y`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestConstraintsBasicStatus = ok`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `constraints_basic_ctest.status = PASS`
- `constraints_basic_ctest.pass_count = 1`

Scope note:
- this pass reran direct ctest, local CI, and clean gate;
- it still did not rerun a fresh weekly lane.

Current conclusion:
- Step188 now guards forty-two success-path checks while remaining green in direct ctest, local
  CI, and clean gate.

## 2026-03-12 Forty-Four Success-Path Expansion

Fresh direct ctest result:
- `core_tests_constraints_basic = PASS`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tests/core/test_constraints_basic.cpp`
- `run_single invocations = 44`

Newest success-path cases confirmed in this pass:
- `perpendicular_horizontal+distance+equal_anchor_x`
- `perpendicular_vertical+distance+equal_anchor_y`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestConstraintsBasicStatus = ok`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `constraints_basic_ctest.status = PASS`
- `constraints_basic_ctest.pass_count = 1`

Scope note:
- this pass reran direct ctest, local CI, and clean gate;
- it still did not rerun a fresh weekly lane.

Current conclusion:
- Step188 now guards forty-four success-path checks while remaining green in direct ctest, local
  CI, and clean gate.

## 2026-03-13 Forty-Six Success-Path Expansion

Fresh direct ctest result:
- `core_tests_constraints_basic = PASS`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tests/core/test_constraints_basic.cpp`
- `run_single invocations = 46`

Newest success-path cases confirmed in this pass:
- `equal_x+distance+equal_anchor_y`
- `equal_y+distance+equal_anchor_x`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `ctestConstraintsBasicStatus = ok`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `constraints_basic_ctest.status = PASS`
- `constraints_basic_ctest.pass_count = 1`

Scope note:
- this pass reran direct ctest, local CI, and clean gate;
- it still did not rerun a fresh weekly lane.

Current conclusion:
- Step188 now guards forty-six success-path checks while remaining green in direct ctest, local
  CI, and clean gate.

## 2026-03-13 Sixty Success-Path Expansion

Fresh direct ctest result:
- `core_tests_constraints_basic = PASS`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tests/core/test_constraints_basic.cpp`
- `run_single invocations = 60`

Newest success-path cases confirmed in this pass:
- `horizontal+distance+equal_anchor_y`
- `vertical+distance+equal_anchor_x`
- `equal_x+vertical+distance`
- `equal_y+horizontal+distance`
- `parallel_horizontal+distance+equal_anchor_y`
- `parallel_vertical+distance+equal_anchor_x`
- `perpendicular_horizontal+distance+equal_anchor_y`
- `perpendicular_vertical+distance+equal_anchor_x`

Scope note:
- this pass reran fresh direct ctest only and used that as the authoritative evidence;
- it did not reuse stale local CI or gate summaries while the shared summary-producing lanes were
  intentionally left untouched.

Current conclusion:
- Step188 now guards sixty success-path checks while remaining green in fresh direct ctest.

## 2026-03-19 Seventy-Two Success-Path Expansion

Fresh direct ctest result:
- `core_tests_constraints_basic = PASS`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tests/core/test_constraints_basic.cpp`
- `run_single invocations = 72`

Newest success-path cases confirmed in this pass (densification of coincident/concentric/angle):
- `coincident_two_line_endpoints`
- `coincident_arc_center_to_point`
- `concentric_circle_and_arc`
- `concentric_two_arcs`
- `angle_right_angle_two_lines`
- `angle_45_deg`

These six new cases add two densification tests per newly enabled constraint type, pushing the
total from sixty-six (after coincident/concentric/angle base enablement) to seventy-two.

Scope note:
- this pass reran fresh direct ctest only and used that as the authoritative evidence;
- it did not rerun local CI or gate since only test cases changed, not solver behavior;
- the design doc now documents all nine constraint kinds as fully implemented and tested.

Current conclusion:
- Step188 now guards seventy-two success-path checks while remaining green in fresh direct ctest.
- All nine ConstraintKind values (horizontal, vertical, equal, distance, parallel, perpendicular,
  coincident, concentric, angle) are exercised end-to-end.
