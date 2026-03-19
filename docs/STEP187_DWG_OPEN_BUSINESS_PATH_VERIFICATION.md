# STEP187 DWG Open Business Path Verification

## Goal
Verify that the application can open a real DWG file through the current business path:

`DWG -> dwg2dxf -> router /convert -> manifest -> viewer_url`

This verification is about real usability, not internal-only contract completeness.

## Preconditions
Confirmed locally:
- `dwg2dxf` exists at `/opt/homebrew/bin/dwg2dxf`
- real DWG sample exists at `/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg`
- converter and DXF plugin already built:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/tools/convert_cli`
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plugins/libcadgf_dxf_importer_plugin.dylib`

## Smoke Command
Run from:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion`

Command:
```bash
python3 tools/plm_dwg_open_smoke.py
```

## Fresh Run
Fresh output directory:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_smoke/20260311_213933`

Fresh summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_smoke/20260311_213933/summary.json`

## Fresh Result
- smoke status: `PASS`
- router `/health`: `ok`
- DWG conversion: `ok`
- router `/convert`: `200 / status=ok`
- viewer URL load: `200`
- manifest exists: `true`
- output directory exists: `true`

## Key Observations
### DWG -> DXF
- input:
  - `/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg`
- output:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_smoke/20260311_213933/ACAD-布局空白_布局1.dxf`
- `dwg2dxf` return code: `0`
- output size: `246192`
- warning count: `14`
- error count in log text: `1`

Important note:
- the log contains LibreDWG warnings and one `ERROR:` line from the converter log,
- but the converter still returned `0` and produced a valid DXF,
- and the downstream router/artifact validation succeeded.

Log:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_smoke/20260311_213933/dwg2dxf.log`

### Router
- router URL:
  - `http://127.0.0.1:9050`
- router `/health` returned:
  - `status=ok`
  - `version=1.0.0`
  - `commit=8e2d2b7`

Router log:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_smoke/20260311_213933/router.log`

### Convert Response
- HTTP status: `200`
- task state: `done`
- project id: `dwg-smoke`
- document label: `ACAD-布局空白_布局1`
- output dir:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_smoke/20260311_213933/router_runs/20260311T133934Z_51508/output`

Returned artifacts:
- `document.json`
- `mesh.gltf`
- `mesh.bin`
- `mesh_metadata.json`

Returned viewer URL:
- `http://127.0.0.1:9050/tools/web_viewer/index.html?manifest=build/plm_dwg_open_smoke/20260311_213933/router_runs/20260311T133934Z_51508/output/manifest.json&project_id=dwg-smoke&document_label=ACAD-%E5%B8%83%E5%B1%80%E7%A9%BA%E7%99%BD_%E5%B8%83%E5%B1%801&document_id=ZHdnLXNtb2tlCkFDQUQt5biD5bGA56m655m9X-W4g-WxgDE`

## Artifact Validation
Command:
```bash
python3 tools/validate_plm_preview_artifacts.py \
  build/plm_dwg_open_smoke/20260311_213933/router_runs/20260311T133934Z_51508/output
```

Result:
- `PASS`
- `document entities=1`
- `mesh metadata entities=1`
- `line_entities=1`
- `summary present`
- `layouts=1`
- `viewports=0`

Manifest validation:
```bash
python3 tools/validate_plm_manifest.py \
  build/plm_dwg_open_smoke/20260311_213933/router_runs/20260311T133934Z_51508/output/manifest.json \
  --schema schemas/plm_manifest.schema.json \
  --document-schema schemas/document.schema.json \
  --check-hashes --check-document
```

Result:
- manifest schema: `PASS`
- artifact hashes: `PASS`
- artifact sizes: `PASS`
- outputs verified: `PASS`
- `document.json` schema: `PASS`

## Browser-Level Verification
Static preview verification was run by serving the repo root and opening the returned `viewer_url` path against that root.

Observed requests:
- `/tools/web_viewer/index.html`
- `/build/.../manifest.json`
- `/build/.../document.json`
- `/build/.../mesh_metadata.json`
- `/build/.../mesh.gltf`
- `/build/.../mesh.bin`

This confirms the preview shell did not only render static HTML; it fetched the real generated artifacts.

Playwright snapshot:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/.playwright-cli/page-2026-03-11T13-40-55-739Z.yml`

The only browser error observed was a missing favicon:
- `/favicon.ico` -> `404`

This is unrelated to the DWG-open path.

## Result
Step187 verification is `PASS`.

The repository can now open a real DWG file through the current business path:
- external DWG conversion,
- router conversion,
- manifest generation,
- preview shell load,
- artifact validation.

## Second Real DWG Sample
Fresh second-sample run:
- input:
  - `/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg`
- run dir:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_smoke_second_probe/20260311_215846`
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_smoke_second_probe/20260311_215846/summary.json`

Key result:
- smoke status: `PASS`
- router `/convert`: `200 / status=ok`
- viewer URL load: `200`
- manifest exists: `true`
- output directory exists: `true`

Second-sample validator result:
- `validate_plm_preview_artifacts.py`: `PASS`
- `validate_plm_manifest.py --check-hashes --check-document`: `PASS`

Observed artifact size/density:
- `document entities=1413`
- `mesh metadata entities=61`
- `line_entities=1243`

This confirms the business path is not only passing on the smallest layout-blank sample.

## Desktop Main-Process Smoke
Desktop smoke command:
```bash
python3 tools/plm_dwg_open_desktop_smoke.py
```

Fresh desktop run:
- run dir:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_desktop_smoke_fresh/20260311_220244`
- wrapper summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_desktop_smoke_fresh/20260311_220244/summary.json`
- desktop main-process summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_desktop_smoke_fresh/20260311_220244/desktop_summary.json`
- desktop log:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_desktop_smoke_fresh/20260311_220244/desktop_smoke.log`

Fresh desktop result:
- smoke status: `PASS`
- Electron main-process return code: `0`
- desktop `maybeConvertDwg(...)`: `PASS`
- desktop `convertWithRouter(...)`: `PASS`
- desktop `viewer_url` load: `200`
- viewer markers:
  - `contains_statusbar=true`
  - `contains_solver_panel=true`
- manifest validator: `PASS`
- artifact validator: `PASS`

Important note:
- this path is not a wrapper around the router smoke;
- it drives the real Electron desktop entrypoint via `main.js --smoke-dwg`,
- so it is the closest automated check to the actual desktop "Open CAD File" business flow.

## Limits Confirmed
- This does **not** prove DWG-native editing.
- This does **not** prove high-fidelity DWG roundtrip.
- This does prove business-usable DWG open/preview with the current architecture.

## Recommended Next Step
1. add more real DWG samples to the same smoke path;
2. optionally add a desktop open-button smoke on top of this path;
3. keep Step186 preview/assembly validations as the guardrail behind the new DWG entrypoint.

## Gate Integration Verification
Fresh narrow gate run used:
```bash
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion
RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=0 \
RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=0 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=0 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=0 \
RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=0 \
RUN_STEP166_GATE=0 \
RUN_DWG_OPEN_SMOKE=1 \
RUN_DWG_OPEN_SMOKE_GATE=1 \
RUN_DWG_OPEN_DESKTOP_SMOKE=1 \
RUN_DWG_OPEN_DESKTOP_SMOKE_GATE=1 \
bash tools/editor_gate.sh
```

Fresh gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`

Fresh gate result:
- `dwg_open_smoke`: `PASS`
- `dwg_open_desktop_smoke`: `PASS`

Observed gate payload:
- `dwg_open_smoke.run_id = 20260312_085850`
- `dwg_open_smoke.dwg_convert_ok = true`
- `dwg_open_smoke.router_ok = true`
- `dwg_open_smoke.convert_ok = true`
- `dwg_open_smoke.viewer_ok = true`
- `dwg_open_desktop_smoke.run_id = 20260312_085851`
- `dwg_open_desktop_smoke.desktop_ok = true`
- `dwg_open_desktop_smoke.manifest_ok = true`
- `dwg_open_desktop_smoke.preview_artifacts_ok = true`

Fresh gate lane summaries:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_smoke_gate/20260312_085420/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_desktop_smoke_gate/20260312_085421/summary.json`

## Local CI Integration Verification
Fresh narrow local CI run used:
```bash
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion
RUN_EDITOR_GATE=0 \
RUN_EDITOR_SMOKE=0 \
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE=0 \
RUN_DWG_OPEN_SMOKE=1 \
RUN_DWG_OPEN_SMOKE_GATE=1 \
RUN_DWG_OPEN_DESKTOP_SMOKE=1 \
RUN_DWG_OPEN_DESKTOP_SMOKE_GATE=1 \
RUN_SOLVER_ACTION_PANEL_SMOKE=0 \
RUN_STEP186_PREVIEW_ARTIFACT_PREP=0 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=0 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=0 \
RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=0 \
RUN_STEP166_GATE=0 \
bash tools/local_ci.sh --offline --skip-compare --quick
```

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`

Fresh local result:
- `dwgOpenSmokeStatus = ok`
- `dwgOpenSmokeDwgConvertOk = true`
- `dwgOpenSmokeRouterOk = true`
- `dwgOpenSmokeConvertOk = true`
- `dwgOpenSmokeViewerOk = true`
- `dwgOpenDesktopSmokeStatus = ok`
- `dwgOpenDesktopSmokeDesktopOk = true`
- `dwgOpenDesktopSmokeManifestOk = true`
- `dwgOpenDesktopSmokePreviewArtifactsOk = true`

This confirms the DWG entrypoint can now participate in the same quick local quality loop as
existing preview/export/editor lanes.

## Weekly Summary / Reporting Verification
Fresh narrow weekly run used:
```bash
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion
RUN_EDITOR_UI_FLOW_SMOKE=0 \
RUN_UI_FLOW_FAILURE_INJECTION=0 \
RUN_REAL_SCENE_PERF=0 \
RUN_GATE=1 \
RUN_EDITOR_PARALLEL_CYCLE=0 \
RUN_STEP166_GATE=0 \
RUN_PREVIEW_PROVENANCE_SMOKE_GATE=0 \
RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=0 \
RUN_PREVIEW_ARTIFACT_SMOKE_GATE=0 \
RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=0 \
RUN_ASSEMBLY_ROUNDTRIP_CTEST_GATE=0 \
RUN_SOLVER_ACTION_PANEL_SMOKE_GATE=0 \
RUN_DWG_OPEN_SMOKE=1 \
RUN_DWG_OPEN_SMOKE_GATE=1 \
RUN_DWG_OPEN_DESKTOP_SMOKE=1 \
RUN_DWG_OPEN_DESKTOP_SMOKE_GATE=1 \
RUN_CONSTRAINTS_BASIC_CTEST_GATE=1 \
GATE_RUN_QT_PROJECT_PERSISTENCE_CHECK=0 \
GATE_RUN_QT_PROJECT_PERSISTENCE_GATE=0 \
bash tools/editor_weekly_validation.sh
```

Fresh weekly summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`

Fresh weekly dashboard:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260312_011839.md`

Fresh weekly result:
- `gate_dwg_open_smoke.enabled = true`
- `gate_dwg_open_smoke.ok = true`
- `gate_dwg_open_smoke.validator_ok_count = 2`
- `gate_dwg_open_desktop_smoke.enabled = true`
- `gate_dwg_open_desktop_smoke.ok = true`
- `gate_constraints_basic_ctest.status = PASS`

Observed weekly dashboard lines:
- `weekly_gate_dwg_open_smoke: mode=gate ok=True dwg_convert=True router=True convert=True viewer=True validators_ok=2`
- `weekly_gate_dwg_open_desktop_smoke: mode=gate ok=True desktop=True manifest=True preview_artifacts=True`
- `weekly_gate_constraints_basic_ctest: status=PASS cases=1 pass=1 fail=0 missing=0 test=core_tests_constraints_basic`

## Weekly Checker Follow-Up
While validating the fresh weekly summary, `check_weekly_summary.sh` exposed an existing
boundary bug:
- `step186_preview_artifact_prep` was `enabled=true` and `status=SKIPPED`,
- but the checker still required a non-empty `summary_json`.

This was not a DWG-open failure. It was a checker false-positive on skipped preview prep lanes.

Fix:
- `tools/check_weekly_summary.sh` now allows missing `summary_json` for
  `step186_preview_artifact_prep` when `status=skipped`.

Fresh checker result after the fix:
```bash
bash tools/check_weekly_summary.sh \
  --summary build/editor_weekly_validation_summary.json \
  --dashboard build/step176_dashboard_weekly_20260312_011839.md \
  --require-dashboard
```

Result:
- `PASS`

## Final Result
Step187 is now verified at four levels:
1. standalone router-first business smoke;
2. standalone desktop main-process smoke;
3. gate/local quality lanes;
4. weekly summary/dashboard/checker consumers.

That is enough to say the repository does not only "have a DWG open script" anymore.
It now has a continuously reportable DWG-open business path.

## 2026-03-12 Strict Validator Integration
This follow-up verification tightened the router-first lane so it now runs the same strict
artifact validators as the desktop lane.

Updated standalone command:
```bash
cd /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion
python3 tools/plm_dwg_open_smoke.py --outdir build/plm_dwg_open_smoke_manual_strict
```

Fresh standalone result:
- summary:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_smoke_manual_strict/20260312_091329/summary.json`
- result:
  - `ok = true`
  - `validators.preview_artifacts.ok = true`
  - `validators.manifest.ok = true`

Fresh gate result:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `dwg_open_smoke.ok = true`
- `dwg_open_smoke.validator_ok_count = 2`
- `dwg_open_desktop_smoke.ok = true`
- `constraints_basic_ctest.status = PASS`

Gate lane summaries:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_smoke_gate/20260312_091344/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_desktop_smoke_gate/20260312_091346/summary.json`

Fresh local result:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `dwgOpenSmokeStatus = ok`
- `dwgOpenSmokeValidatorOkCount = 2`
- `dwgOpenDesktopSmokeStatus = ok`

Fresh local smoke summaries:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_smoke/20260312_091520/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_desktop_smoke/20260312_091521/summary.json`

Consumer replay from real gate/local summaries:
- CI artifact markdown:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_dwg_constraints.md`
- observed lines:
  - `dwg_open_smoke ... validators_ok=2`
  - `local_dwg_open_smoke ... validators_ok=2`
  - `dwg_open_desktop_smoke ... preview_artifacts_ok=true`

Conclusion:
- router-first DWG-open is now validated to the same artifact standard as the desktop lane;
- gate/local consumers both report the stricter result;
- Step187 remains `PASS`.

## 2026-03-12 Continuous Lane Verification Refresh
This pass re-ran the live DWG lanes after:
- propagating desktop `validator_ok_count` through gate/local/report consumers;
- tightening the router-first lane to the same strict validator standard;
- keeping the desktop lane symmetric with the router-first lane.

Fresh standalone router-first summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_smoke_manual_strict/20260312_091329/summary.json`
- `validators.preview_artifacts.ok = true`
- `validators.manifest.ok = true`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `dwgOpenSmokeStatus = ok`
- `dwgOpenSmokeValidatorOkCount = 2`
- `dwgOpenDesktopSmokeStatus = ok`
- `dwgOpenDesktopSmokeValidatorOkCount = 2`

Fresh gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `dwg_open_smoke.ok = true`
- `dwg_open_smoke.validator_ok_count = 2`
- `dwg_open_desktop_smoke.ok = true`
- `dwg_open_desktop_smoke.validator_ok_count = 2`

Fresh weekly summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- `gate_dwg_open_smoke.ok = true`
- `gate_dwg_open_smoke.validator_ok_count = 2`
- `gate_dwg_open_desktop_smoke.ok = true`
- `gate_dwg_open_desktop_smoke.validator_ok_count = 2`

Fresh consumer outputs:
- CI markdown:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/ci_artifact_summary_dwg_constraints_round2.md`
- weekly dashboard:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260312_013512.md`
- weekly report replay:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_weekly_dwg_constraints_round2.md`

Observed rendered lines:
- `dwg_open_smoke ... validators_ok=2`
- `dwg_open_desktop_smoke ... validators_ok=2`
- `gate_dwg_open_smoke ... validators_ok=2`
- `gate_dwg_open_desktop_smoke ... validators_ok=2`

Checker result:
```bash
bash tools/check_weekly_summary.sh \
  --summary build/editor_weekly_validation_summary.json \
  --dashboard build/step176_dashboard_weekly_20260312_013512.md \
  --require-dashboard
```

Result:
- `PASS`

Important note:
- the fresh weekly summary still reports overall `status=unstable`;
- that instability comes from pre-existing weekly UI-flow lanes;
- the Step187 DWG lanes themselves are green in standalone, local, gate, and weekly consumers.

## 2026-03-12 DWG Matrix Lane Verification
This pass promoted the business-path DWG-open coverage from two single-sample lanes to a
third router-first matrix lane over multiple real DWG files.

New matrix runner:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/plm_dwg_open_matrix_smoke.py`

Matrix case list:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/plm_dwg_open_matrix_cases.json`

Standalone matrix result:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke_manual2/20260312_015149/summary.json`
- `case_count = 2`
- `pass_count = 2`
- `fail_count = 0`
- `validator_ok_count = 4`
- `dwg_convert_ok_count = 2`
- `router_ok_count = 2`
- `convert_ok_count = 2`
- `viewer_ok_count = 2`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `dwgOpenSmokeStatus = ok`
- `dwgOpenSmokeValidatorOkCount = 2`
- `dwgOpenDesktopSmokeStatus = ok`
- `dwgOpenDesktopSmokeValidatorOkCount = 2`
- `dwgOpenMatrixSmokeStatus = ok`
- `dwgOpenMatrixSmokeCaseCount = 2`
- `dwgOpenMatrixSmokePassCount = 2`
- `dwgOpenMatrixSmokeValidatorOkCount = 4`

Fresh gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `dwg_open_smoke.ok = true`
- `dwg_open_smoke.validator_ok_count = 2`
- `dwg_open_desktop_smoke.ok = true`
- `dwg_open_desktop_smoke.validator_ok_count = 2`
- `dwg_open_matrix_smoke.ok = true`
- `dwg_open_matrix_smoke.case_count = 2`
- `dwg_open_matrix_smoke.pass_count = 2`
- `dwg_open_matrix_smoke.validator_ok_count = 4`

Fresh weekly summary and dashboard replay:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260312_020746.md`
- `gate_dwg_open_smoke.validator_ok_count = 2`
- `gate_dwg_open_desktop_smoke.validator_ok_count = 2`
- `gate_dwg_open_matrix_smoke.case_count = 2`
- `gate_dwg_open_matrix_smoke.pass_count = 2`
- `gate_dwg_open_matrix_smoke.validator_ok_count = 4`
- dashboard line renders:
  - `weekly_gate_dwg_open_matrix_smoke: mode=gate ok=True cases=2 pass=2 fail=0 dwg_convert_ok=2 router_ok=2 convert_ok=2 viewer_ok=2 validators_ok=4`

Checker command:
```bash
bash tools/check_weekly_summary.sh \
  --summary build/editor_weekly_validation_summary.json \
  --dashboard build/step176_dashboard_weekly_20260312_020746.md \
  --require-dashboard
```

Result:
- `PASS`

Current conclusion:
- Step187 can now be claimed as three continuously validated business-path lanes:
  1. router-first single-sample DWG open;
  2. desktop single-sample DWG open;
  3. router-first multi-sample DWG matrix open.

## 2026-03-12 Weekly Gate Status Propagation Fix
This pass fixed the remaining reporting inconsistency where the weekly summary carried the gate
lane payloads but still reported top-level `gate.status = skipped`.

Root cause:
- shell defaults pre-populated `GATE_STATUS=skipped`;
- the weekly summary Python only inferred `ok/fail` when `GATE_STATUS` was empty;
- `skipped` was therefore treated as final even when `editor_gate_summary.json` and all Step187
  lanes were green.

Fix location:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/editor_weekly_validation.sh`

Fresh weekly summary after the fix:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- `gate.status = ok`
- `gate.summary_json = /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `gate_dwg_open_smoke.validator_ok_count = 2`
- `gate_dwg_open_desktop_smoke.validator_ok_count = 2`
- `gate_dwg_open_matrix_smoke.case_count = 2`
- `gate_dwg_open_matrix_smoke.pass_count = 2`
- `gate_dwg_open_matrix_smoke.validator_ok_count = 4`

Checker command:
```bash
bash tools/check_weekly_summary.sh \
  --summary build/editor_weekly_validation_summary.json \
  --dashboard build/step176_dashboard_weekly_20260312_021350.md \
  --require-dashboard
```

Result:
- `[weekly-summary] OK`

Conclusion:
- Step187 is now consistent across standalone, local CI, gate, weekly summary, dashboard, and
  checker consumers.

## 2026-03-12 Expanded DWG Matrix Verification
This pass expanded the default Step187 matrix from two real DWGs to four.

Updated default matrix cases:
1. `ACAD-布局空白_布局1.dwg`
2. `BTJ02230301120-03保护罩组件v1.dwg`
3. `BTJ02230301120-03保护罩组件v2.dwg`
4. `J0225001-09-04旋转组件v1.dwg`

Fresh standalone matrix result:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke_default_v2/20260312_021956/summary.json`
- `case_count = 4`
- `pass_count = 4`
- `fail_count = 0`
- `validator_ok_count = 8`
- `dwg_convert_ok_count = 4`
- `router_ok_count = 4`
- `convert_ok_count = 4`
- `viewer_ok_count = 4`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `dwgOpenMatrixSmokeStatus = ok`
- `dwgOpenMatrixSmokeCaseCount = 4`
- `dwgOpenMatrixSmokePassCount = 4`
- `dwgOpenMatrixSmokeValidatorOkCount = 8`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `dwg_open_matrix_smoke.ok = true`
- `dwg_open_matrix_smoke.case_count = 4`
- `dwg_open_matrix_smoke.pass_count = 4`
- `dwg_open_matrix_smoke.validator_ok_count = 8`

Current conclusion:
- Step187 now has a stable four-sample DWG matrix in addition to the existing single-sample
  router-first and desktop lanes.

## 2026-03-12 Weekly Refresh After Four-Sample Matrix Expansion
The latest narrow weekly run now reflects the expanded four-sample DWG matrix inside the gate
summary instead of only in standalone/local runs.

Fresh weekly summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_summary.json`
- `gate.status = ok`
- `gate.summary_json = build/editor_gate_summary.json`
- `gate_dwg_open_smoke.validator_ok_count = 2`
- `gate_dwg_open_desktop_smoke.validator_ok_count = 2`
- `gate_dwg_open_matrix_smoke.case_count = 4`
- `gate_dwg_open_matrix_smoke.pass_count = 4`
- `gate_dwg_open_matrix_smoke.validator_ok_count = 8`

Fresh weekly dashboard:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step176_dashboard_weekly_20260312_022442.md`

Checker command:
```bash
bash tools/check_weekly_summary.sh \
  --summary build/editor_weekly_validation_summary.json \
  --dashboard build/step176_dashboard_weekly_20260312_022442.md \
  --require-dashboard
```

Result:
- `[weekly-summary] OK`

Conclusion:
- Step187 is now green in standalone smoke, local CI, clean gate, and the latest weekly
  consumer path with a four-sample DWG matrix and eight successful validator passes.

## 2026-03-12 Six-Sample Matrix Expansion
This pass expanded the default Step187 matrix from four real DWGs to six and added one bounded
retry in the matrix runner to absorb transient router-side connection drops.

Fresh standalone matrix result:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke_default_v4/20260312_023430/summary.json`
- `case_count = 6`
- `pass_count = 6`
- `fail_count = 0`
- `validator_ok_count = 12`
- all six cases completed with `attempt_count = 1`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `dwgOpenMatrixSmokeStatus = ok`
- `dwgOpenMatrixSmokeCaseCount = 6`
- `dwgOpenMatrixSmokePassCount = 6`
- `dwgOpenMatrixSmokeValidatorOkCount = 12`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `dwg_open_matrix_smoke.ok = true`
- `dwg_open_matrix_smoke.case_count = 6`
- `dwg_open_matrix_smoke.pass_count = 6`
- `dwg_open_matrix_smoke.validator_ok_count = 12`

Current conclusion:
- Step187 now has a stable six-sample real-DWG matrix in standalone, local CI, and clean gate.
- The product-facing statement does not change:
  - DWG open is supported through the business path;
  - it is still not a native DWG importer in core.

## 2026-03-12 Eight-Sample Matrix Expansion
This pass expanded the default Step187 matrix from six real DWGs to eight.

New default matrix members:
7. `LTJ012303106-0001超声波法兰v1.dwg`
8. `J3025001-12轴承座v1.dwg`

Fresh standalone matrix result:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke_default_v5/20260312_041547/summary.json`
- `case_count = 8`
- `pass_count = 8`
- `fail_count = 0`
- `validator_ok_count = 16`
- all eight cases completed with `attempt_count = 1`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `dwgOpenMatrixSmokeStatus = ok`
- `dwgOpenMatrixSmokeCaseCount = 8`
- `dwgOpenMatrixSmokePassCount = 8`
- `dwgOpenMatrixSmokeValidatorOkCount = 16`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `dwg_open_matrix_smoke.case_count = 8`
- `dwg_open_matrix_smoke.pass_count = 8`
- `dwg_open_matrix_smoke.validator_ok_count = 16`

Scope note:
- this pass did not rerun a fresh weekly lane;
- the claim here is based on standalone, local CI, and clean gate.

Current conclusion:
- Step187 now has a stable eight-sample real-DWG matrix in standalone, local CI, and clean gate.
- The product-facing statement still remains:
  - DWG open is supported through the business path;
  - it is still not a native DWG importer in core.

## 2026-03-12 Ten-Sample Matrix Expansion
This pass expanded the default Step187 matrix from eight real DWGs to ten.

New default matrix members:
5. `J0225001-09-04旋转组件v2.dwg`
7. `BTJ01230901522-00汽水分离器v2.dwg`

Fresh standalone matrix result:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke/20260312_052521/summary.json`
- `case_count = 10`
- `pass_count = 10`
- `fail_count = 0`
- `validator_ok_count = 20`
- all ten cases completed with `attempt_count = 1`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `dwgOpenSmokeValidatorOkCount = 2`
- `dwgOpenDesktopSmokeValidatorOkCount = 2`
- `dwgOpenMatrixSmokeCaseCount = 10`
- `dwgOpenMatrixSmokePassCount = 10`
- `dwgOpenMatrixSmokeValidatorOkCount = 20`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `dwg_open_smoke.validator_ok_count = 2`
- `dwg_open_desktop_smoke.validator_ok_count = 2`
- `dwg_open_matrix_smoke.case_count = 10`
- `dwg_open_matrix_smoke.pass_count = 10`
- `dwg_open_matrix_smoke.validator_ok_count = 20`

Scope note:
- this pass did not rerun a fresh weekly lane;
- the claim here is based on standalone, local CI, and clean gate.

Current conclusion:
- Step187 now has a stable ten-sample real-DWG matrix in standalone, local CI, and clean gate.
- The product-facing statement still remains:
  - DWG open is supported through the business path;
  - it is still not a native DWG importer in core.

## 2026-03-12 Twelve-Sample Matrix Scope
This pass expanded the standalone Step187 DWG matrix from ten to twelve real samples by adding:
- `BTJ01239601522-03扭转弹簧v2.dwg`
- `LTJ012303106-0001超声波法兰v2.dwg`

Fresh standalone matrix summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke_default_v6/20260312_055132/summary.json`
- `case_count = 12`
- `pass_count = 12`
- `fail_count = 0`
- `validator_ok_count = 24`

Current environment note:
- this pass also reproduced a separate single-sample DWG smoke instability where fresh
  `plm_dwg_open_smoke.py` router launches can fail with
  `PermissionError: [Errno 1] Operation not permitted` while binding `ThreadingHTTPServer`;
- that issue affects the single-sample router-first lane and desktop auto-start lane in the
  current environment, but it does not invalidate the green twelve-sample matrix summary above.

Scope note:
- this pass validates the twelve-sample matrix directly;
- it does not claim a fresh full `local_ci`/`editor_gate` rerun at twelve samples because the
  single-sample DWG lanes are being stabilized separately.

Current conclusion:
- Step187 now has a stable twelve-sample standalone real-DWG matrix with twenty-four successful
  artifact-validator passes;
- the product-facing statement is unchanged:
  - DWG open is supported through the business path;
  - it is still not a native DWG importer in core.

## 2026-03-12 Twelve-Sample Matrix Expansion
This pass expanded the default Step187 matrix from ten real DWGs to twelve.

New default matrix members:
11. `BTJ01239601522-03扭转弹簧v2.dwg`
12. `LTJ012303106-0001超声波法兰v2.dwg`

Fresh standalone matrix result:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke_default_v6/20260312_055132/summary.json`
- `case_count = 12`
- `pass_count = 12`
- `fail_count = 0`
- `validator_ok_count = 24`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `dwgOpenSmokeStatus = ok`
- `dwgOpenDesktopSmokeStatus = ok`
- `dwgOpenMatrixSmokeStatus = ok`
- `dwgOpenMatrixSmokeCaseCount = 12`
- `dwgOpenMatrixSmokePassCount = 12`
- `dwgOpenMatrixSmokeValidatorOkCount = 24`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `dwg_open_smoke.validator_ok_count = 2`
- `dwg_open_desktop_smoke.validator_ok_count = 2`
- `dwg_open_matrix_smoke.case_count = 12`
- `dwg_open_matrix_smoke.pass_count = 12`
- `dwg_open_matrix_smoke.validator_ok_count = 24`

Scope note:
- this pass reran standalone, local CI, and clean gate;
- it still documents the business-path DWG chain, not a native DWG importer.

Current conclusion:
- Step187 now has a stable twelve-sample real-DWG matrix in standalone, local CI, and clean gate.
- The product-facing statement remains unchanged:
  - DWG open is supported through the business path;
  - it is still not a native DWG importer in core.

## 2026-03-12 Fourteen-Sample Matrix Expansion
This pass expanded the default Step187 matrix from twelve real DWGs to fourteen.

New default matrix members:
13. `J3025001-12轴承座v2.dwg`
14. `BTJ01239601522-03扭转弹簧v3.dwg`

Fresh standalone matrix result:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke/20260312_061328/summary.json`
- `case_count = 14`
- `pass_count = 14`
- `fail_count = 0`
- `validator_ok_count = 28`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `dwgOpenSmokeValidatorOkCount = 2`
- `dwgOpenDesktopSmokeValidatorOkCount = 2`
- `dwgOpenMatrixSmokeCaseCount = 14`
- `dwgOpenMatrixSmokePassCount = 14`
- `dwgOpenMatrixSmokeValidatorOkCount = 28`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `dwg_open_smoke.validator_ok_count = 2`
- `dwg_open_desktop_smoke.validator_ok_count = 2`
- `dwg_open_matrix_smoke.case_count = 14`
- `dwg_open_matrix_smoke.pass_count = 14`
- `dwg_open_matrix_smoke.validator_ok_count = 28`

Scope note:
- this pass reran standalone, local CI, and clean gate;
- it still documents the business-path DWG chain, not a native DWG importer.

Current conclusion:
- Step187 now has a stable fourteen-sample real-DWG matrix in standalone, local CI, and clean gate.
- The product-facing statement remains unchanged:
  - DWG open is supported through the business path;
  - it is still not a native DWG importer in core.

## 2026-03-12 Sixteen-Sample Matrix Expansion
This pass expanded the default Step187 matrix from fourteen real DWGs to sixteen.

New default matrix members:
15. `J0224025-06-01-03出料凸缘v1.dwg`
16. `J0224025-06-01-03出料凸缘v2.dwg`

Fresh standalone matrix result:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke/20260312_063636/summary.json`
- `case_count = 16`
- `pass_count = 16`
- `fail_count = 0`
- `validator_ok_count = 32`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `dwgOpenSmokeValidatorOkCount = 2`
- `dwgOpenDesktopSmokeValidatorOkCount = 2`
- `dwgOpenMatrixSmokeCaseCount = 16`
- `dwgOpenMatrixSmokePassCount = 16`
- `dwgOpenMatrixSmokeValidatorOkCount = 32`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `dwg_open_smoke.validator_ok_count = 2`
- `dwg_open_desktop_smoke.validator_ok_count = 2`
- `dwg_open_matrix_smoke.case_count = 16`
- `dwg_open_matrix_smoke.pass_count = 16`
- `dwg_open_matrix_smoke.validator_ok_count = 32`

Local summary note:
- an earlier stale `local_ci_summary.json` was traced to concurrent overlapping runs rather than a
  persistent `local_ci.sh` summary bug;
- a clean narrow local CI rerun produced the same sixteen-sample counts as the standalone matrix
  and fresh clean gate summary.

Scope note:
- this pass reran standalone, local CI, and clean gate;
- it still documents the business-path DWG chain, not a native DWG importer.

Current conclusion:
- Step187 now has a stable sixteen-sample real-DWG matrix in standalone, local CI, and clean gate.
- The product-facing statement remains unchanged:
  - DWG open is supported through the business path;
  - it is still not a native DWG importer in core.

## 2026-03-12 Eighteen-Sample Matrix Expansion
This pass expanded the default Step187 matrix from sixteen real DWGs to eighteen.

New default matrix members:
17. `J1424042-51-01-08对接法兰v1.dwg`
18. `J1424042-51-01-08对接法兰v2.dwg`

Fresh code-state confirmation:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/plm_dwg_open_matrix_cases.json`
- `case_count = 18`
- trailing ids now include `docking_flange_v1` and `docking_flange_v2`

Fresh standalone attempt in the current environment:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke_manual_v7`
- the rerun did not complete green because router readiness checks failed with
  `router not ready: <urlopen error [Errno 1] Operation not permitted>`
- representative failing attempt:
  `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke_manual_v7/20260312_064434/cases/layout_blank/attempt_02/20260312_144605/summary.json`

Scope note:
- this pass confirmed the matrix expansion in code but did not claim a fresh green standalone/local
  CI/gate replay at eighteen samples because the current runtime blocked localhost router readiness;
- the previously verified sixteen-sample matrix remains the last fully green Step187 baseline.

Current conclusion:
- Step187 code now carries an eighteen-sample real-DWG matrix;
- fresh verification of the new eighteen-sample scope is currently blocked by the environment, not
  by a newly proven product regression;
- DWG open remains supported through the business path, not as a native DWG importer in core.

## 2026-03-12 Eighteen-Sample Matrix Expansion
This pass expanded the default Step187 matrix from sixteen real DWGs to eighteen.

New default matrix members:
17. `J1424042-51-01-08对接法兰v1.dwg`
18. `J1424042-51-01-08对接法兰v2.dwg`

Fresh standalone matrix result:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke_manual_current2/20260312_064606/summary.json`
- `case_count = 18`
- `pass_count = 18`
- `fail_count = 0`
- `validator_ok_count = 36`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `dwgOpenSmokeValidatorOkCount = 2`
- `dwgOpenDesktopSmokeValidatorOkCount = 2`
- `dwgOpenMatrixSmokeCaseCount = 18`
- `dwgOpenMatrixSmokePassCount = 18`
- `dwgOpenMatrixSmokeValidatorOkCount = 36`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `dwg_open_smoke.validator_ok_count = 2`
- `dwg_open_desktop_smoke.validator_ok_count = 2`
- `dwg_open_matrix_smoke.case_count = 18`
- `dwg_open_matrix_smoke.pass_count = 18`
- `dwg_open_matrix_smoke.validator_ok_count = 36`

Scope note:
- this pass reran standalone, local CI, and clean gate;
- it still documents the business-path DWG chain, not a native DWG importer.

Current conclusion:
- Step187 now has a stable eighteen-sample real-DWG matrix in standalone, local CI, and clean gate.
- The product-facing statement remains unchanged:
  - DWG open is supported through the business path;
  - it is still not a native DWG importer in core.

## 2026-03-12 Twenty-Four-Sample Matrix Expansion

Fresh standalone matrix summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke_manual_current5/20260312_072808/summary.json`
- `case_count = 24`
- `pass_count = 24`
- `validator_ok_count = 48`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `dwgOpenMatrixSmokeCaseCount = 24`
- `dwgOpenMatrixSmokePassCount = 24`
- `dwgOpenMatrixSmokeValidatorOkCount = 48`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `dwg_open_matrix_smoke.case_count = 24`
- `dwg_open_matrix_smoke.pass_count = 24`
- `dwg_open_matrix_smoke.validator_ok_count = 48`

Scope note:
- this pass reran standalone, local CI, and clean gate with the twenty-four-case matrix;
- the product-facing statement still stays precise:
  - DWG open is supported through the business path;
  - it is still not a native DWG importer in core.

Current conclusion:
- Step187 now has a stable twenty-four-sample real-DWG matrix in standalone, local CI, and clean
  gate.

## 2026-03-12 Twenty-Eight-Sample Matrix Expansion

Fresh standalone matrix summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke_manual_current6/20260312_075530/summary.json`
- `case_count = 28`
- `pass_count = 28`
- `validator_ok_count = 56`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `dwgOpenMatrixSmokeCaseCount = 28`
- `dwgOpenMatrixSmokePassCount = 28`
- `dwgOpenMatrixSmokeValidatorOkCount = 56`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `dwg_open_smoke.validator_ok_count = 2`
- `dwg_open_desktop_smoke.validator_ok_count = 2`
- `dwg_open_matrix_smoke.case_count = 28`
- `dwg_open_matrix_smoke.pass_count = 28`
- `dwg_open_matrix_smoke.validator_ok_count = 56`

Scope note:
- this pass reran standalone, local CI, and clean gate on the twenty-eight-case matrix;
- the product-facing statement still stays precise:
  - DWG open is supported through the business path;
  - it is still not a native DWG importer in core.

Current conclusion:
- Step187 now has a stable twenty-eight-sample real-DWG matrix in standalone, local CI, and clean
  gate.

## 2026-03-12 Thirty-Sample Matrix Expansion

Fresh standalone matrix summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke_manual_current7/20260312_082441/summary.json`
- `case_count = 30`
- `pass_count = 30`
- `validator_ok_count = 60`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `dwgOpenMatrixSmokeCaseCount = 30`
- `dwgOpenMatrixSmokePassCount = 30`
- `dwgOpenMatrixSmokeValidatorOkCount = 60`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `dwg_open_smoke.validator_ok_count = 2`
- `dwg_open_desktop_smoke.validator_ok_count = 2`
- `dwg_open_matrix_smoke.case_count = 30`
- `dwg_open_matrix_smoke.pass_count = 30`
- `dwg_open_matrix_smoke.validator_ok_count = 60`

Scope note:
- this pass reran standalone, local CI, and clean gate on the thirty-case matrix;
- the product-facing statement still stays precise:
  - DWG open is supported through the business path;
  - it is still not a native DWG importer in core.

Current conclusion:
- Step187 now has a stable thirty-sample real-DWG matrix in standalone, local CI, and clean gate.

## 2026-03-13 Thirty-Two-Sample Matrix Expansion

Fresh standalone matrix summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke_manual_current8/20260313_000508/summary.json`
- `case_count = 32`
- `pass_count = 32`
- `validator_ok_count = 64`

Fresh local summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `dwgOpenMatrixSmokeCaseCount = 32`
- `dwgOpenMatrixSmokePassCount = 32`
- `dwgOpenMatrixSmokeValidatorOkCount = 64`

Fresh clean gate summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_summary.json`
- `dwg_open_smoke.validator_ok_count = 2`
- `dwg_open_desktop_smoke.validator_ok_count = 2`
- `dwg_open_matrix_smoke.case_count = 32`
- `dwg_open_matrix_smoke.pass_count = 32`
- `dwg_open_matrix_smoke.validator_ok_count = 64`

Newest DWG matrix cases confirmed in this pass:
31. `J0724006-05上封头组件v1.dwg`
32. `J0724006-05上封头组件v2.dwg`

Scope note:
- this pass reran standalone, local CI, and clean gate on the thirty-two-case matrix;
- the product-facing statement still stays precise:
  - DWG open is supported through the business path;
  - it is still not a native DWG importer in core.

Current conclusion:
- Step187 now has a stable thirty-two-sample real-DWG matrix in standalone, local CI, and clean
  gate.

## 2026-03-13 Thirty-Four-Sample Matrix Expansion

Fresh standalone matrix summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke_manual_current9/20260313_013839/summary.json`
- `case_count = 34`
- `pass_count = 34`
- `validator_ok_count = 68`

Fresh local summary from the same promotion pass:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/local_ci_summary.json`
- `dwgOpenMatrixSmokeCaseCount = 34`
- `dwgOpenMatrixSmokePassCount = 34`
- `dwgOpenMatrixSmokeValidatorOkCount = 68`

Newest DWG matrix cases confirmed in this pass:
33. `J0224014-09液压开盖组件v1.dwg`
34. `J0224014-09液压开盖组件v2.dwg`

Current conclusion:
- Step187 reached a stable thirty-four-sample real-DWG matrix in standalone and fresh local CI,
  while still keeping the product statement precise: DWG open is supported through the business
  path, not through a native core DWG importer.

## 2026-03-13 Thirty-Six-Sample Matrix Expansion

Fresh isolated probe for the promoted pair:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_probe_handwheel/20260313_015923/summary.json`
- `case_count = 2`
- `pass_count = 2`
- `validator_ok_count = 4`

Fresh standalone matrix summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke_manual_current10/20260313_020230/summary.json`
- `case_count = 36`
- `pass_count = 36`
- `validator_ok_count = 72`

Fresh standalone desktop summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_desktop_smoke_manual_current/20260313_100847/summary.json`
- `ok = true`
- `validator_ok_count = 2`
- `desktop_summary.ok = true`

Newest DWG matrix cases confirmed in this pass:
35. `BTJ02230101102-12手轮组件v1.dwg`
36. `BTJ02230101102-12手轮组件v2.dwg`

Scope note:
- this pass promoted the pair only after an isolated two-case probe and a fresh thirty-six-case
  standalone matrix both passed;
- fresh local CI and clean gate reruns were attempted in the same turn, but their shared summary
  handoff remained stale because the shell wrappers did not cleanly exit, so they are not used as
  authoritative evidence for the thirty-six-case conclusion.

Current conclusion:
- Step187 now has a stable thirty-six-sample real-DWG matrix in fresh standalone validation, and
  the desktop business path still opens DWG successfully with strict manifest/artifact validation.

## 2026-03-13 Forty-Sample Matrix Expansion

Fresh isolated probe for the promoted `J0225047-04` pair:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_probe_tank_section/20260313_021257/cases/tank_section_alt_v1/attempt_01/20260313_101257/summary.json`
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_probe_tank_section_v2/20260313_021422/summary.json`
- both summaries are `ok = true`
- combined `validator_ok_count = 4`

Fresh standalone forty-sample matrix summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_matrix_smoke_manual_current11_clean/20260313_021644/summary.json`
- `case_count = 40`
- `pass_count = 40`
- `fail_count = 0`
- `validator_ok_count = 80`

Fresh standalone desktop summary:
- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/plm_dwg_open_desktop_smoke_manual_current2/20260313_101250/summary.json`
- `ok = true`
- `validator_ok_count = 2`
- `desktop_summary.ok = true`

Newest DWG matrix cases confirmed in this pass:
37. `J0225047-04罐体部分v1.dwg`
38. `J0225047-04罐体部分v2.dwg`
39. `J0224036-12真空组件v1.dwg`
40. `J0224036-12真空组件v2.dwg`

Scope note:
- this pass promoted the `J0225047-04` pair only after isolated per-case probes and then reran a
  clean forty-sample standalone matrix on a fresh router port to avoid stale probe wrappers;
- it also reran the desktop business-path smoke and both downstream validators as fresh evidence;
- it did not use local CI or gate as authoritative evidence in this pass because shared summary
  handoff was intentionally avoided while the standalone matrix was being expanded.

Current conclusion:
- Step187 now has a stable forty-sample real-DWG matrix in fresh standalone validation, and the
  desktop business path still opens DWG successfully with strict manifest/artifact validation.

### Scope note

- Designed matrix scope: 44 real DWG files (see STEP187_DWG_OPEN_BUSINESS_PATH_DESIGN.md).
- Fresh verified baseline: 40/40 pass with 80 downstream validator passes.
- The four newest designed cases (41-44: `BTJ01231201522-00拖车DN1500` and
  `BTJ01239901522-00拖轮组件` pairs) have not yet been promoted into the fresh verified baseline.
- Import architecture: plugin-first with dwg2dxf fallback on desktop; router path uses external
  dwg2dxf + DXF importer plugin.
