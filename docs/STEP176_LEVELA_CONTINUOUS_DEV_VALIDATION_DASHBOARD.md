# STEP176 Level A Dashboard

- generated_at: `2026-02-28T12:04:28.528834+00:00`
- gate_history_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_history`
- weekly_history_dir: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_weekly_validation_history`

## Latest Gate

- generated_at: `2026-02-28T12:02:24Z`
- gate_decision: would_fail=`False` exit_code=`0`
- editor_smoke_run_id: `20260228_200039_043_8ff7` status=`PASS` pass=`5` fail=`0` skipped=`0`
- editor_smoke_cases: `source=generated` `cases=8` `limit=5`
- editor_smoke_generated: `count=2` `declared=2` `actual=2` `mismatch=False` `min=4` `run_id=20260228_115858` `run_ids=20260228_115858`
- editor_smoke_case_selection: `selected=5` `matched=8` `candidate=8` `total=8` `fallback=False`
- ui_flow_smoke: mode=`skipped` enabled=`False` ok=`False`
- ui_flow_gate_required: required=`False` explicit=`True`
- ui_flow_port_allocation: available=`unknown` status=`NOT_RUN` reason=``
- qt_project_persistence: status=`skipped` mode=`gate` gate_required=`True` reason=`BUILD_EDITOR_QT_OFF` run_id=`20260228_120042`
- qt_project_persistence_build: dir=`build` BUILD_EDITOR_QT=`OFF` target_available=`False` script_rc=`0` build_rc=`0` test_rc=`0`
- step166_run_id: `20260228_120043` (gate_would_fail=`False`)
- perf_trend: `skipped` (mode=`observe` enabled=`False`) (coverage_days=0.00, selected=0)
- real_scene_trend: `skipped` (mode=`observe` enabled=`False`) (coverage_days=0.00, selected=0)

### Artifacts
- gate_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_gate_history/gate_20260228_120224_20260228_200039_043_8ff7_20260228_120043.json`
- editor_smoke_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_roundtrip/20260228_200039_043_8ff7/summary.json`
- qt_project_persistence_summary_json: `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/qt_project_persistence_check.json`
- step166_summary_json: `build/cad_regression/20260228_120043/summary.json`
- perf_trend_json: `build/editor_perf_trend.json`
- real_scene_trend_json: `build/editor_real_scene_perf_trend.json`

## Gate History (Recent)

| generated_at | editor_smoke | editor_smoke_inject | ui_flow | ui_flow_inject | qt_persistence | step166 | gate_would_fail | perf_trend | real_scene_trend | would_fail | reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-02-28T12:02:24Z | `20260228_200039_043_8ff7:ok(0):src=generated:gen=2` | `skipped` | `skipped:NOT_RUN` | `skipped` | `gate:skipped:BUILD_EDITOR_QT_OFF` | `20260228_120043` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |
| 2026-02-28T11:12:15Z | `20260228_191213_804_5190:ok(0):src=discovery` | `skipped` | `gate:ok(2/2)` | `skipped` | `observe:skipped:BUILD_EDITOR_QT_OFF` | `` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |
| 2026-02-28T11:10:20Z | `20260228_191018_671_f1cc:ok(0):src=discovery:gdec=5:gact=0` | `skipped` | `skipped:NOT_RUN` | `skipped` | `observe:skipped:BUILD_EDITOR_QT_OFF` | `` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |
| 2026-02-28T11:06:47Z | `20260228_190645_096_eb19:ok(0):src=discovery:gen=5` | `skipped` | `skipped:NOT_RUN` | `skipped` | `observe:skipped:BUILD_EDITOR_QT_OFF` | `` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |
| 2026-02-28T06:55:44Z | `20260228_145542_075_0efd:ok(0):src=generated:gen=4` | `skipped` | `skipped:NOT_RUN` | `skipped` | `observe:skipped:BUILD_EDITOR_QT_OFF` | `` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |
| 2026-02-28T06:53:28Z | `20260228_145326_069_b808:ok(0):src=generated:gen=4` | `skipped` | `skipped:NOT_RUN` | `skipped` | `observe:skipped:BUILD_EDITOR_QT_OFF` | `` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |
| 2026-02-28T06:40:08Z | `20260228_143825_419_88ae:ok(0):src=generated:gen=2` | `skipped` | `gate:ok(2/2)` | `skipped` | `gate:skipped:BUILD_EDITOR_QT_OFF` | `20260228_063829` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |
| 2026-02-28T06:34:55Z | `20260228_143452_681_3920:ok(0):src=generated:gen=4` | `skipped` | `skipped:NOT_RUN` | `skipped` | `observe:skipped:BUILD_EDITOR_QT_OFF` | `` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |
| 2026-02-28T06:16:40Z | `20260228_141638_427_8954:ok(0):src=discovery` | `skipped` | `skipped:NOT_RUN` | `skipped` | `observe:skipped:BUILD_EDITOR_QT_OFF` | `` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |
| 2026-02-28T06:13:39Z | `20260228_141117_651_bd89:ok(0):src=generated` | `skipped` | `skipped:NOT_RUN` | `skipped` | `gate:skipped:BUILD_EDITOR_QT_OFF` | `20260228_061121` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |
| 2026-02-28T05:56:52Z | `20260228_135508_362_203d:ok(0):src=explicit` | `skipped` | `skipped:NOT_RUN` | `skipped` | `gate:skipped:BUILD_EDITOR_QT_OFF` | `20260228_055511` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |
| 2026-02-28T05:39:14Z | `20260228_133910_993_961d:ok(0):src=explicit` | `skipped` | `skipped:NOT_RUN` | `skipped` | `observe:skipped:BUILD_EDITOR_QT_OFF` | `` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |
| 2026-02-28T04:25:37Z | `20260228_122347_744_8b5a:ok(0):src=discovery` | `skipped` | `skipped:NOT_RUN` | `skipped` | `gate:skipped:BUILD_EDITOR_QT_OFF` | `20260228_042350` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |
| 2026-02-28T04:10:09Z | `20260228_120825_769_32b4:ok(0):src=discovery` | `skipped` | `skipped:NOT_RUN` | `skipped` | `gate:skipped:BUILD_EDITOR_QT_OFF` | `20260228_040828` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |
| 2026-02-28T04:06:36Z | `20260228_120452_470_151c:ok(0):src=discovery` | `skipped` | `gate:ok(2/2)` | `skipped` | `observe:skipped:BUILD_EDITOR_QT_OFF` | `20260228_040455` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |
| 2026-02-28T03:53:10Z | `20260228_115149_237_bbb8:ok(0):src=discovery` | `skipped` | `gate:ok(2/2)` | `skipped` | `observe:skipped:BUILD_EDITOR_QT_OFF` | `20260228_035151` | `True` | `observe:skipped` | `observe:skipped` | `True` | `STEP166:RC_2` |
| 2026-02-28T03:45:56Z | `20260228_114433_042_1874:ok(0):src=discovery` | `skipped` | `gate:ok(2/2)` | `skipped` | `gate:skipped:BUILD_EDITOR_QT_OFF` | `20260228_034436` | `True` | `observe:skipped` | `observe:skipped` | `True` | `STEP166:RC_2` |
| 2026-02-27T14:19:45Z | `20260227_221818_596_7670:ok(0):src=discovery` | `skipped` | `gate:ok(2/2)` | `skipped` | `observe:skipped:BUILD_EDITOR_QT_OFF` | `20260227_141822` | `True` | `observe:skipped` | `observe:skipped` | `True` | `STEP166:RC_2` |
| 2026-02-27T14:01:58Z | `20260227_220156_004_7f31:ok(0):src=discovery` | `skipped` | `gate:ok(2/2)` | `skipped` | `observe:skipped:BUILD_EDITOR_QT_OFF` | `` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |
| 2026-02-27T12:40:51Z | `20260227_204048_012_83dd:ok(0):src=discovery` | `skipped` | `gate:ok(2/2)` | `skipped` | `observe:skipped:BUILD_EDITOR_QT_OFF` | `` | `False` | `observe:skipped` | `observe:skipped` | `False` |  |

## Weekly History (Recent)

| generated_at | editor_smoke | case_sel | ui_flow | ui_flow_inject | step166 | perf_run | gate | qt_policy | trend | perf_trend | real_scene_trend | real_scene_perf |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-02-28T12:02:26.553433+00:00 | `20260228_195854_116_f495:PASS(0)` | `generated:8/8/8:mm=2` | `skipped` | `skipped` | `obs=20260228_115858|gate=20260228_120043:False` | `20260228_120038` | `ok` | `observe:r0->e0` | `watch` | `stable(observe)` | `stable(observe)` | `skipped` |
| 2026-02-28T06:40:08.969083+00:00 | `20260228_143516_791_13e6:PASS(0)` | `generated:8/8/8` | `skipped` | `skipped` | `obs=20260228_063519|gate=20260228_063829:False` | `20260228_063657` | `ok` | `observe:r0->e0` | `watch` | `stable(observe)` | `stable(observe)` | `skipped` |
| 2026-02-28T06:13:39.716979+00:00 | `20260228_140937_170_a494:PASS(0)` | `generated:4/4/4` | `skipped` | `skipped` | `obs=20260228_060938|gate=20260228_061121:False` | `20260228_061117` | `ok` | `observe:r0->e0` | `watch` | `stable(observe)` | `stable(observe)` | `skipped` |
| 2026-02-28T05:56:53.118869+00:00 | `20260228_135333_291_a136:PASS(0)` | `generated:4/4/4` | `skipped` | `skipped` | `obs=20260228_055334|gate=20260228_055511:False` | `20260228_055507` | `ok` | `observe:r0->e0` | `watch` | `stable(observe)` | `stable(observe)` | `skipped` |
| 2026-02-28T05:50:00.860620+00:00 | `20260228_134749_339_99ff:PASS(0)` | `generated:4/4/4` | `skipped` | `skipped` | `20260228_054752` | `20260228_054958` | `skipped` | `observe:r0->e0` | `watch` | `stable(observe)` | `stable(observe)` | `skipped` |
| 2026-02-28T04:25:39.531088+00:00 | `20260228_122206_778_ca66:PASS(0)` | `discovery:4/16/16` | `skipped` | `skipped` | `obs=20260228_042208|gate=20260228_042350:False` | `20260228_042347` | `ok` | `observe:r0->e0` | `watch` | `stable(observe)` | `stable(observe)` | `skipped` |
| 2026-02-28T04:10:09.845545+00:00 | `20260228_120644_514_aab9:PASS(0)` | `discovery:4/16/16` | `skipped` | `skipped` | `20260228_040645` | `20260228_040825` | `ok` | `observe:r0->e0` | `watch` | `watch(observe)` | `stable(observe)` | `skipped` |
| 2026-02-28T03:45:57.285680+00:00 | `20260228_114144_006_4214:PASS(0)` | `discovery:4/16/16` | `skipped` | `PASS:UI_FLOW_FLOW_JSON_INVALID` | `20260228_034147` | `20260228_034309` | `fail` | `observe:r0->e0` | `watch` | `stable(observe)` | `stable(observe)` | `skipped` |
| 2026-02-26T03:39:11.299857+00:00 | `20260226_113640_059_8902:PASS(0)` | `discovery:4/16/16` | `skipped` | `PASS:UI_FLOW_FLOW_JSON_INVALID` | `20260226_033642` | `20260226_033714` | `ok` | `observe:r0->e0` | `watch` | `observe(observe)` | `observe(observe)` | `skipped` |
| 2026-02-21T14:36:59.621280+00:00 | `20260221_223547_598_f4b3:PASS(0)` | `discovery:8/32/32` | `skipped` | `skipped` | `20260221_143550` | `20260221_143659` | `skipped` | `n/a` | `stable` | `observe(observe)` | `observe(observe)` | `skipped` |
| 2026-02-21T14:22:03.406350+00:00 | `20260221_222110_957_efd3:PASS(0)` | `discovery:8/32/32` | `skipped` | `skipped` | `20260221_142114` | `20260221_142202` | `skipped` | `n/a` | `stable` | `observe(observe)` | `observe(observe)` | `skipped` |
| 2026-02-21T14:18:17.009349+00:00 | `20260221_221728_274_5e5c:PASS(0)` | `discovery:2/2/2` | `skipped` | `skipped` | `20260221_141729` | `20260221_141816` | `skipped` | `n/a` | `stable` | `observe(observe)` | `observe(observe)` | `skipped` |
| 2026-02-21T14:16:58.016688+00:00 | `20260221_221546_502_3bcb:PASS(0)` | `discovery:1/1/1` | `skipped` | `skipped` | `20260221_141547` | `20260221_141656` | `skipped` | `n/a` | `stable` | `observe(observe)` | `observe(observe)` | `skipped` |
| 2026-02-21T12:41:05.746827+00:00 | `20260221_203647_315_4eaf:PASS(0)` | `discovery:8/19/20` | `skipped` | `skipped` | `20260221_123812` | `20260221_123859` | `ok` | `n/a` | `stable` | `observe(observe)` | `observe(observe)` | `PASS` |
| 2026-02-21T12:34:41.555019+00:00 | `20260221_203028_387_a888:PASS(0)` | `discovery:8/19/20` | `skipped` | `skipped` | `20260221_123153` | `20260221_123232` | `ok` | `n/a` | `stable` | `observe(observe)` | `observe(observe)` | `PASS` |
| 2026-02-21T12:33:20.738333+00:00 | `20260221_202902_518_1e02:PASS(0)` | `discovery:5/19/20` | `skipped` | `skipped` | `20260221_123016` | `20260221_123125` | `ok` | `n/a` | `stable` | `observe(observe)` | `observe(observe)` | `PASS` |
| 2026-02-21T03:04:01.363576+00:00 | `20260221_105924_743_0b2f:PASS(0)` | `discovery:8/19/20` | `skipped` | `skipped` | `20260221_030052` | `20260221_030200` | `ok` | `n/a` | `stable` | `observe(observe)` | `observe(observe)` | `PASS` |
| 2026-02-20T16:48:53.111907+00:00 | `20260221_004402_188_5b6a:PASS(0)` | `discovery:8/19/20` | `skipped` | `skipped` | `20260220_164526` | `20260220_164631` | `ok` | `n/a` | `stable` | `observe(observe)` | `observe(observe)` | `PASS` |
| 2026-02-20T15:10:53.320332+00:00 | `20260220_230439_840_4f5d:PASS(0)` | `discovery:8/20/20` | `observe:PASS(1/1)` | `PASS:UI_FLOW_FLOW_JSON_INVALID` | `20260220_150601` | `20260220_150706` | `ok` | `n/a` | `stable` | `observe(observe)` | `observe(observe)` | `PASS` |
| 2026-02-19T04:22:53.333312+00:00 | `20260219_122029_007_8a7e:PASS(0)` | `discovery:0/0/0` | `skipped` | `skipped` | `20260219_042141` | `20260219_042217` | `ok` | `n/a` | `stable` | `observe(observe)` | `observe(observe)` | `skipped` |

### Latest Weekly Artifact
- weekly_summary_json: `build/editor_weekly_validation_history/weekly_20260228_120226_20260228_195854_116_f495_20260228_115858.json`

## Auto-Gate Readiness Notes

- perf_trend auto-gate requires: `coverage_days >= PERF_TREND_DAYS` and `selected >= PERF_TREND_MIN_SELECTED` and `selection_mode=batch_only`
- real_scene_trend auto-gate requires: `coverage_days >= REAL_SCENE_TREND_DAYS` and `selected >= REAL_SCENE_TREND_MIN_SELECTED` and `selection_mode=batch_only`
- qt_persistence require_on auto-policy: enough recent samples + zero fail + consecutive target-available pass runs >= threshold
- use `bash tools/editor_weekly_median_validation.sh` weekly to produce repeat=3 batch median samples

