# STEP187 DWG Open Business Path Design

## Goal
Provide the first business-usable `DWG open` path without turning the core into a DWG-native editor.

The path is:
- user selects a `.dwg`;
- external `dwg2dxf` converts it to a temporary `.dxf`;
- router uploads the converted file to `convert_cli` with the existing DXF importer plugin;
- router returns a `manifest.json` and `viewer_url`;
- preview/editor consumes the existing `document.json + mesh.gltf + mesh_metadata.json` contract.

This is the shortest path from today's codebase to "the application can open a real DWG file."

## Why This Is The Right Cut
Current code already establishes the correct architecture boundary:
- heavy DWG conversion is outside the core document model;
- router/desktop own file-open orchestration;
- core/editor keep operating on internal `Document` artifacts.

That boundary is already visible in:
- `/Users/huazhou/Downloads/Github/VemCAD/docs/ARCHITECTURE.md`
- `/Users/huazhou/Downloads/Github/VemCAD/services/router/README.md`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer_desktop/main.js`

The desktop wrapper already does this in production code:
- detect `.dwg`
- run `maybeConvertDwg(...)`
- then call `convertWithRouter(...)`

Step187 turns that path into a standalone, repeatable business smoke.

It now has two complementary entrypoints:
- `plm_dwg_open_smoke.py`: router-first business smoke for real DWG samples;
- `plm_dwg_open_desktop_smoke.py`: desktop-main-process smoke that drives the same
  `maybeConvertDwg(...) -> convertWithRouter(...)` path used by the Electron wrapper.

## Non-Goals
- no DWG-native core schema;
- no DWG write-back;
- no promise that every DWG entity becomes natively editable;
- no dependency on commercial SDKs in this step;
- no CI-hard requirement on external DWG tools.

Step187 is intentionally `preview-first`, not `DWG-native edit-first`.

## Implemented Smoke
New tool:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/plm_dwg_open_smoke.py`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py`

The smoke mirrors the real business path:
1. detect a real `.dwg` input;
2. detect `dwg2dxf`;
3. detect existing `libcadgf_dxf_importer_plugin` and `convert_cli`;
4. convert DWG to a temporary DXF;
5. start router locally;
6. POST the converted DXF to `/convert` with explicit `plugin` and `convert_cli`, matching desktop behavior;
7. validate:
   - router `/health`
   - `status=ok`
   - `manifest.json` exists
   - `viewer_url` loads
   - preview shell HTML contains expected status bar markers;
8. write a stable `summary.json`.

The desktop smoke adds one more cut:
1. start Electron main process with `--smoke-dwg`;
2. reuse the real desktop `main.js` code path;
3. write desktop-side `summary.json`;
4. run the existing manifest/artifact validators on the returned output directory.

## Why The Smoke Sends DXF To Router
`plm_router_service.py` does not currently embed DWG conversion logic. It accepts:
- uploaded file
- plugin path
- optional `convert_cli`

So the business path today is:
- DWG conversion outside router
- router owns conversion-to-artifacts and preview URL generation

That exactly matches current desktop code.

## Inputs And Defaults
The smoke auto-detects:
- `dwg2dxf`
- `convert_cli`
- `libcadgf_dxf_importer_plugin`
- a real local DWG sample when available

Current local default sample:
- `/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg`

Verified second real sample:
- `/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg`

Output root:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_smoke`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_desktop_smoke`

Per-run output:
- timestamped directory
- converted `.dxf`
- `dwg2dxf.log`
- `router.log`
- router output directory
- `summary.json`
- for desktop smoke:
  - `desktop_smoke.log`
  - `desktop_summary.json`
  - post-run validator results folded into wrapper `summary.json`

## Summary Contract
`summary.json` records:
- input and detected tool paths;
- `dwg2dxf` command, duration, warnings, errors, output size;
- router command, PID, `/health` payload;
- `/convert` HTTP result and returned payload;
- `viewer_url`;
- resolved manifest/output directory existence checks.

This makes the smoke suitable as:
- a business readiness proof;
- a local QA smoke;
- a future manual release-gate artifact.

## Desktop Smoke Design
Desktop smoke does not create a second implementation of DWG open.
Instead it adds a CLI mode to:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer_desktop/main.js`

The new CLI flag is:
- `--smoke-dwg /absolute/path/to/file.dwg`

Optional companion flag:
- `--smoke-summary /absolute/path/to/desktop_summary.json`

When present, the Electron main process:
1. skips `createWindow()`;
2. calls `maybeConvertDwg(...)`;
3. calls `convertWithRouter(...)`;
4. fetches the returned `viewer_url`;
5. verifies expected preview markers;
6. writes a machine-readable summary and exits with a process status.

This matters because it keeps the verification path aligned with the actual desktop
business entrypoint instead of inventing a second Node-only implementation.

## Validation Boundary
Step187 does not invent a new artifact schema. It reuses:
- `manifest.json`
- `document.json`
- `mesh.gltf`
- `mesh.bin`
- `mesh_metadata.json`

After the business path succeeds, it reuses existing validators:
- `validate_plm_preview_artifacts.py`
- `validate_plm_manifest.py`

This is important: `DWG open` is treated as an entry-point problem, not a new core format problem.

## Why This Is Business-Usable
After Step187, a real DWG can be:
- opened through the same conversion boundary the desktop app already uses;
- converted into first-class preview artifacts;
- loaded in the actual preview shell via `viewer_url`;
- validated by the same artifact validators used for DXF/preview lanes.

That is enough to say:
- the application can open DWG in a usable preview pipeline now,
- even though native DWG editing is still out of scope.

## Recommended Next Work
Keep three lanes in parallel:
1. `DWG open lane`
   - more real DWG samples
   - more open-smoke coverage
   - desktop button/open-flow validation
2. `Step186 preview/assembly lane`
   - keep existing artifact and roundtrip guards green
3. `solver/editor lane`
   - continue improving product interaction without blocking DWG-open delivery

## Exit Criteria
Step187 is complete when:
- a real local DWG file converts successfully through the business path;
- router returns `status=ok`;
- `manifest.json` and preview artifacts validate;
- `viewer_url` loads the real preview shell.

## Gate And Reporting Integration
Step187 is no longer only a standalone smoke. The DWG-open business path is now wired into
existing quality/reporting layers without changing the core import architecture.

Integrated lanes:
- `tools/local_ci.sh`
  - `RUN_DWG_OPEN_SMOKE`
  - `RUN_DWG_OPEN_DESKTOP_SMOKE`
- `tools/editor_gate.sh`
  - `RUN_DWG_OPEN_SMOKE_GATE`
  - `RUN_DWG_OPEN_DESKTOP_SMOKE_GATE`
- `tools/editor_weekly_validation.sh`
  - consumes `gate_dwg_open_smoke`
  - consumes `gate_dwg_open_desktop_smoke`
- reporting consumers:
  - `tools/write_ci_artifact_summary.py`
  - `tools/write_step176_dashboard.py`
  - `tools/write_step176_weekly_report.py`
  - `tools/check_weekly_summary.sh`

This keeps the DWG entrypoint aligned with the same release/readiness surfaces already used by
preview, roundtrip, and weekly dashboard lanes.

## Lane Split
Two complementary lanes are now intentional:

1. `dwg_open_smoke`
- router-first business path;
- proves `dwg2dxf -> router /convert -> manifest -> viewer_url`;
- summary records:
  - `dwg_convert_ok`
  - `router_ok`
  - `convert_ok`
  - `viewer_ok`
  - `validator_ok_count`

2. `dwg_open_desktop_smoke`
- desktop main-process business path;
- proves the real Electron `maybeConvertDwg(...) -> convertWithRouter(...)` flow;
- summary records:
  - `desktop_ok`
  - `manifest_ok`
  - `preview_artifacts_ok`

The desktop lane stays stricter because it reuses the manifest/artifact validators directly.
The router-first lane remains the thinnest business-path readiness probe.

## Non-Goal Still Holds
Even after gate/local/weekly integration, Step187 still does not turn the core into a
DWG-native editor.

The boundary remains:
- `DWG -> external converter/service -> DXF -> existing DXF importer -> manifest/document/viewer`

That is the correct cut for the current codebase.

## Strict Validator Symmetry
The router-first DWG lane is now intentionally stricter than the earlier business-path probe.

Previous shape:
- prove `dwg2dxf -> router -> viewer_url`;
- stop once the router returned `status=ok` and the preview shell loaded.

Current shape:
- keep the same business-path boundary;
- additionally run the same artifact validators already used by the desktop lane:
  - `tools/validate_plm_preview_artifacts.py`
  - `tools/validate_plm_manifest.py --check-hashes --check-document`

That means the two Step187 lanes are now complementary but symmetric on artifact quality:
1. `dwg_open_smoke`
   - router-first
   - records business-path phase booleans
   - records `validator_ok_count`
2. `dwg_open_desktop_smoke`
   - real desktop main-process path
   - records desktop/open success plus validator booleans

This does not change the architecture. It raises the acceptance bar for the existing
business-path entrypoint.

## Continuous Quality Integration
Step187 is now wired into the same continuous quality surfaces as other product lanes:
- `tools/local_ci.sh`
- `tools/editor_gate.sh`
- `tools/editor_weekly_validation.sh`
- `tools/write_ci_artifact_summary.py`
- `tools/write_step176_dashboard.py`
- `tools/write_step176_weekly_report.py`
- `tools/check_weekly_summary.sh`

The intent is explicit:
- DWG-open is no longer only a standalone smoke script;
- it is now a continuously reportable product capability.

## DWG Matrix Lane
Step187 now has a third business-path lane:

3. `dwg_open_matrix_smoke`
- router-first batch verification over a small real-DWG matrix;
- currently driven by:
  - `tools/plm_dwg_open_matrix_cases.json`
  - `tools/plm_dwg_open_matrix_smoke.py`
- reuses the existing `dwg_open_smoke` runner per case, then aggregates:
  - `case_count`
  - `pass_count`
  - `fail_count`
  - `validator_ok_count`
  - `dwg_convert_ok_count`
  - `router_ok_count`
  - `convert_ok_count`
  - `viewer_ok_count`
  - `first_failed_case`

This lane exists for one reason: Step187 should not rely on a single lucky DWG. The current
codebase still uses the same architecture boundary:
- `DWG -> external converter/service -> DXF -> DXF importer -> manifest/document/viewer`

but now guards that boundary across more than one real drawing.

## Reporting Position
The matrix lane is intentionally wired into the same reporting surfaces as the single-sample
lanes:
- `tools/local_ci.sh`
- `tools/editor_gate.sh`
- `tools/editor_weekly_validation.sh`
- `tools/write_ci_artifact_summary.py`
- `tools/write_step176_dashboard.py`
- `tools/write_step176_weekly_report.py`
- `tools/check_weekly_summary.sh`

That keeps Step187 aligned with the broader product-quality loop instead of treating DWG-open
as a standalone script-only feature.

## Current Matrix Scope
The default Step187 matrix is no longer a two-sample probe. It now uses four real DWG files:
1. `ACAD-布局空白_布局1.dwg`
2. `BTJ02230301120-03保护罩组件v1.dwg`
3. `BTJ02230301120-03保护罩组件v2.dwg`
4. `J0225001-09-04旋转组件v1.dwg`

The design intent is pragmatic:
- keep the matrix small enough for local/gate cadence;
- cover both layout-oriented and heavier assembly-style drawings;
- raise confidence beyond a single lucky DWG without turning Step187 into a slow full-corpus job.

## Expanded Matrix Scope
The current default Step187 matrix now uses six real DWG files:
1. `ACAD-布局空白_布局1.dwg`
2. `BTJ02230301120-03保护罩组件v1.dwg`
3. `BTJ02230301120-03保护罩组件v2.dwg`
4. `J0225001-09-04旋转组件v1.dwg`
5. `BTJ01230901522-00汽水分离器v1.dwg`
6. `BTJ01239601522-03扭转弹簧v1.dwg`

This keeps the lane small enough for gate cadence while broadening beyond a single family of
assembly drawings.

## Matrix Retry Policy
The matrix runner now permits one bounded retry per case.

That is not a standards relaxation. It is a transport-hardening measure for the business-path
chain:
- `DWG -> dwg2dxf -> router /convert -> manifest/viewer`

The retry exists to absorb transient router-side connection drops such as:
- `Remote end closed connection without response`

The contract remains strict:
- a case is still red if all attempts fail;
- validator counts still reflect only successful artifact validations;
- the runner records the winning `attempt_count` per case in `summary.json`.

## Eight-Sample Matrix Scope
The default Step187 matrix now covers eight real DWG files:
1. `ACAD-布局空白_布局1.dwg`
2. `BTJ02230301120-03保护罩组件v1.dwg`
3. `BTJ02230301120-03保护罩组件v2.dwg`
4. `J0225001-09-04旋转组件v1.dwg`
5. `BTJ01230901522-00汽水分离器v1.dwg`
6. `BTJ01239601522-03扭转弹簧v1.dwg`
7. `LTJ012303106-0001超声波法兰v1.dwg`
8. `J3025001-12轴承座v1.dwg`

This broadens Step187 beyond a single layout sample and a single assembly family while still
keeping the lane small enough for routine local/gate execution.

## Twelve-Sample Matrix Scope
The default Step187 matrix now covers twelve real DWG files:
1. `ACAD-布局空白_布局1.dwg`
2. `BTJ02230301120-03保护罩组件v1.dwg`
3. `BTJ02230301120-03保护罩组件v2.dwg`
4. `J0225001-09-04旋转组件v1.dwg`
5. `J0225001-09-04旋转组件v2.dwg`
6. `BTJ01230901522-00汽水分离器v1.dwg`
7. `BTJ01230901522-00汽水分离器v2.dwg`
8. `BTJ01239601522-03扭转弹簧v1.dwg`
9. `BTJ01239601522-03扭转弹簧v2.dwg`
10. `LTJ012303106-0001超声波法兰v1.dwg`
11. `LTJ012303106-0001超声波法兰v2.dwg`
12. `J3025001-12轴承座v1.dwg`

This is the current practical Step187 guardrail:
- it broadens coverage by extending two already-proven families to `v2` real drawings instead of
  gambling on completely new unknown families;
- it keeps the lane explainable, because every added case still maps to the same router-first
  `DWG -> DXF -> importer -> manifest/viewer` business path;
- it remains strict because each passing case still requires two downstream validator passes,
  so the twelve-sample matrix implies twenty-four successful artifact validations.

## Fourteen-Sample Matrix Scope
The default Step187 matrix now covers fourteen real DWG files.

New additions beyond the twelve-sample scope:
13. `J3025001-12轴承座v2.dwg`
14. `BTJ01239601522-03扭转弹簧v3.dwg`

Why these two were promoted:
- they extend families that were already green in the business path instead of introducing
  completely unrelated outliers;
- they increase revision-depth coverage for two separate drawing families;
- they keep the matrix routine enough for fresh local CI and clean gate cadence.

The strictness contract does not change:
- every green case still requires two validator passes;
- the fourteen-sample matrix therefore implies twenty-eight successful downstream validations
  when fully green.

## Sixteen-Sample Matrix Scope
The default Step187 matrix now covers sixteen real DWG files.

New additions beyond the fourteen-sample scope:
15. `J0224025-06-01-03出料凸缘v1.dwg`
16. `J0224025-06-01-03出料凸缘v2.dwg`

Why these two were promoted:
- they add one more real family with two green revisions instead of widening the matrix with
  unrelated one-off outliers;
- they keep the matrix aligned with the same router-first business path already proven by the
  earlier families;
- they raise routine gate/local coverage without changing the product claim from business-path DWG
  open to native DWG import.

The strictness contract still does not change:
- every green case still requires two downstream validator passes;
- the sixteen-sample matrix therefore implies thirty-two successful downstream validations when
  fully green.

## Eighteen-Sample Matrix Scope
The default Step187 matrix now covers eighteen real DWG files.

New additions beyond the sixteen-sample scope:
17. `J1424042-51-01-08对接法兰v1.dwg`
18. `J1424042-51-01-08对接法兰v2.dwg`

Why these two were promoted:
- they add another stable `v1/v2` family instead of widening the matrix with isolated one-off
  drawings;
- they keep the matrix revision-oriented, which has been the most reliable way to grow business-path
  DWG coverage without destabilizing local/gate cadence;
- they raise the target strictness to thirty-six downstream validator passes when the full matrix is
  green.

## Twenty-Sample Matrix Scope
The default Step187 matrix now covers twenty real DWG files.

New additions beyond the eighteen-sample scope:
19. `BTJ01231101522-00自动进料装置v1.dwg`
20. `BTJ01231101522-00自动进料装置v2.dwg`

Why these two were promoted:
- they bring in another revision pair from the same training family instead of widening coverage with
  one-off outliers;
- they extend the router-first business path with a feeding subsystem that already has stable
  revisions in the training set;
- they keep the strict, explainable cadence because the new cases continue to go through the same
  `DWG -> DXF -> importer -> manifest/viewer` chain guarded by Step187.

The strictness contract still does not change:
- every green case still requires two downstream validator passes;
- the twenty-sample matrix therefore implies forty successful downstream validations when fully
  green.

## Twenty-Four-Sample Matrix Scope
The default Step187 matrix now covers twenty-four real DWG files.

New additions beyond the twenty-sample scope:
21. `J0225004-08搅拌轴组件v1.dwg`
22. `J0225004-08搅拌轴组件v2.dwg`
23. `J0225034-05罐体部分v1.dwg`
24. `J0225034-05罐体部分v2.dwg`

Why these four were promoted:
- they extend the existing revision-pair pattern instead of widening the matrix with isolated
  one-off files;
- they add one rotating-shaft family and one vessel/tank family, which broadens the business-path
  coverage without changing the architecture;
- they continue to exercise the same strict chain:
  `DWG -> external conversion/service -> DXF -> importer -> manifest/viewer`.

The strictness contract still does not change:
- every green case still requires two downstream validator passes;
- the twenty-four-sample matrix therefore implies forty-eight successful downstream validations when
  fully green.

## Twenty-Six-Sample Matrix Scope
The default Step187 matrix now covers twenty-six real DWG files.

New additions beyond the twenty-four-sample scope:
25. `J0225048-02-07侧推料组件v1.dwg`
26. `J0225048-02-07侧推料组件v2.dwg`

Why these two were promoted:
- they extend the same revision-pair growth pattern already used throughout the matrix instead of
  widening coverage with isolated one-off files;
- they add another stable feeding-side mechanical family while preserving the exact same
  router-first business path and validator contract;
- they raise the strictness target to fifty-two downstream validator passes without changing the
  product claim from business-path DWG open to native DWG import.

## Twenty-Eight-Sample Matrix Scope
The default Step187 matrix now covers twenty-eight real DWG files.

New additions beyond the twenty-six-sample scope:
27. `J0724006-02搅拌器组件v1.dwg`
28. `J0724006-02搅拌器组件v2.dwg`

Why these two were promoted:
- they add one more revision-oriented family instead of broadening the matrix with unrelated
  outliers;
- they keep the matrix aligned with the same explainable chain:
  `DWG -> external conversion/service -> DXF -> importer -> manifest/viewer`;
- they raise routine gate/local coverage to fifty-six downstream validator passes when the full
  matrix is green.

The strictness contract still does not change:
- every green case still requires two downstream validator passes;
- the twenty-eight-sample matrix therefore implies fifty-six successful downstream validations when
  fully green.

## Thirty-Sample Matrix Scope
The default Step187 matrix now covers thirty real DWG files.

New additions beyond the twenty-eight-sample scope:
29. `J0724006-01下锥体组件v1.dwg`
30. `J0724006-01下锥体组件v2.dwg`

Why these two were promoted:
- they extend the already-green `J0724006` revision family with another stable pair instead of
  widening the matrix with unrelated outliers;
- they keep the matrix grounded in the same router-first business path and validator contract that
  already guards the rest of Step187;
- they raise the strictness target to sixty downstream validator passes without changing the
  product claim from business-path DWG open to native DWG import.

The strictness contract still does not change:
- every green case still requires two downstream validator passes;
- the thirty-sample matrix therefore implies sixty successful downstream validations when fully
  green.

## Thirty-Two-Sample Matrix Scope
The default Step187 matrix now covers thirty-two real DWG files.

New additions beyond the thirty-sample scope:
31. `J0724006-05上封头组件v1.dwg`
32. `J0724006-05上封头组件v2.dwg`

Why these two were promoted:
- they continue the already-stable `J0724006` family with a matched revision pair instead of
  widening the matrix with unrelated outliers;
- they exercise the same business-path contract already used by every green Step187 lane:
  `DWG -> external conversion/service -> DXF -> importer -> manifest/viewer`;
- they raise the strictness target to sixty-four downstream validator passes without changing the
  product claim from business-path DWG open to native DWG import.

The strictness contract still does not change:
- every green case still requires two downstream validator passes;
- the thirty-two-sample matrix therefore implies sixty-four successful downstream validations when
  fully green.

## Thirty-Four-Sample Matrix Scope
The default Step187 matrix now covers thirty-four real DWG files.

New additions beyond the thirty-two-sample scope:
33. `J0224014-09液压开盖组件v1.dwg`
34. `J0224014-09液压开盖组件v2.dwg`

Why these two were promoted:
- they add another matched revision pair from the same real drawing corpus instead of padding the
  matrix with one-off files;
- they stay on the exact same business path already guarded elsewhere:
  `DWG -> external conversion/service -> DXF -> importer -> manifest/viewer`;
- they raise the strictness target to sixty-eight downstream validator passes without changing the
  product claim from business-path DWG open to native DWG import.

The strictness contract still does not change:
- every green case still requires two downstream validator passes;
- the thirty-four-sample matrix therefore implies sixty-eight successful downstream validations when
  fully green.

## Thirty-Six-Sample Matrix Scope
The default Step187 matrix now covers thirty-six real DWG files.

New additions beyond the thirty-four-sample scope:
35. `BTJ02230101102-12手轮组件v1.dwg`
36. `BTJ02230101102-12手轮组件v2.dwg`

Why these two were promoted:
- they were first probed as an isolated two-case matrix and promoted only after both passed the
  full router-first business path with strict downstream validation;
- they add another matched revision pair from a different mechanical family, which broadens the
  matrix more credibly than duplicating nearby `J0724006` variants;
- they raise the strictness target to seventy-two downstream validator passes while keeping the
  product statement precise: DWG open is supported through the business path, not via a native core
  DWG importer.

The strictness contract still does not change:
- every green case still requires two downstream validator passes;
- the thirty-six-sample matrix therefore implies seventy-two successful downstream validations when
  fully green.

## Thirty-Eight-Sample Matrix Scope
The default Step187 matrix now covers thirty-eight real DWG files.

New additions beyond the thirty-six-sample scope:
37. `J0225047-04罐体部分v1.dwg`
38. `J0225047-04罐体部分v2.dwg`

Why these two were promoted:
- they add another matched `v1/v2` revision pair from the same real drawing corpus instead of
  padding the matrix with unrelated one-off files;
- the first member of the pair is materially heavier than the recent handwheel additions, which
  makes it a better stress check for the router-first business path without changing the product
  claim;
- they raise the strictness target to seventy-six downstream validator passes while keeping the
  architecture statement exact: DWG open is supported through the business path, not through a
  native core DWG importer.

The strictness contract still does not change:
- every green case still requires two downstream validator passes;
- the thirty-eight-sample matrix therefore implies seventy-six successful downstream validations
  when fully green.

## Forty-Sample Matrix Scope
The default Step187 matrix now covers forty real DWG files.

New additions beyond the thirty-eight-sample scope:
39. `J0224036-12真空组件v1.dwg`
40. `J0224036-12真空组件v2.dwg`

Why these two were promoted:
- they add another matched `v1/v2` revision pair from the same real drawing corpus instead of
  widening the matrix with unrelated one-off files;
- together with the already-added `J0225047-04罐体部分v1/v2` pair, they push the matrix beyond a
  narrow family cluster and make the router-first DWG path defend a broader set of large,
  production-style drawings;
- they raise the strictness target to eighty downstream validator passes while keeping the product
  claim exact: DWG open is supported through the business path, not through a native core DWG
  importer.

The strictness contract still does not change:
- every green case still requires two downstream validator passes;
- the forty-sample matrix therefore implies eighty successful downstream validations when fully
  green.

## Forty-Four-Sample Matrix Scope
The default Step187 matrix now covers forty-four real DWG files.

New additions beyond the forty-sample scope:
41. `BTJ01231201522-00拖车DN1500v1.dwg`
42. `BTJ01231201522-00拖车DN1500v2.dwg`
43. `BTJ01239901522-00拖轮组件v1.dwg`
44. `BTJ01239901522-00拖轮组件v2.dwg`

Why these four were promoted:
- they add one trailer family (`BTJ01231201522-00拖车DN1500`) and one carrier-wheel family
  (`BTJ01239901522-00拖轮组件`), each with a matched `v1/v2` revision pair;
- they continue the revision-pair growth pattern instead of widening the matrix with isolated
  one-off files;
- they exercise the same strict chain:
  `DWG -> external conversion/service -> DXF -> importer -> manifest/viewer`.

The strictness contract still does not change:
- every green case still requires two downstream validator passes;
- the forty-four-sample matrix therefore implies eighty-eight successful downstream validations
  when fully green.
