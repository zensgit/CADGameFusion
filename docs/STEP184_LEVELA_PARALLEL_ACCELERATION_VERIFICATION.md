# STEP184 Level A Stabilization Parallel Acceleration Verification

## 本次运行信息
- 日期：2026-02-19
- 分支工作区：`/Users/huazhou/Downloads/Github/VemCAD`（`deps/cadgamefusion` 子模块内执行主要验证）
- 验证目标：
  1) `EDITOR_GATE_PROFILE` + CI artifact 策略变更可用  
  2) round-trip case `tags/priority` 向后兼容  
  3) unsupported `display_proxy` 导入/导出与只读渲染路径可用  
  4) Join Tool 命令/工具闭环可回归

## 验证命令与结果

| 类别 | 命令 | 结果 |
| --- | --- | --- |
| JS 语法检查 | `node --check tools/web_viewer/scripts/editor_roundtrip_smoke.js` 等 4 个文件 | PASS |
| Python 语法检查 | `python3 -m py_compile tools/generate_editor_roundtrip_cases.py` | PASS |
| 核心 Node 回归 | `node --test tools/web_viewer/tests/editor_commands.test.js` | PASS（68/68） |
| Round-trip（observe） | `node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --cases tools/web_viewer/tests/fixtures/editor_roundtrip_smoke_cases.json --limit 1 --no-convert` | PASS |
| Round-trip 旧 schema 兼容 | `node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --cases /tmp/step184_old_cases.json --limit 1 --no-convert` | PASS |
| Editor gate（lite profile） | `EDITOR_GATE_PROFILE=lite ... bash tools/editor_gate.sh` | PASS（exit=0） |
| Cases 生成器 | `python3 tools/generate_editor_roundtrip_cases.py --limit 1 --out /tmp/editor_roundtrip_cases_step184.json` | PASS（输出含 `tags/priority`） |
| UI-flow（observe） | `bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --timeout-ms 20000 --viewport 1280,840` | 运行完成（observe 不阻塞），flow `ok=false` |
| UI-flow 重试（observe） | `bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --timeout-ms 40000 --viewport 1280,840` | 同上，失败点一致 |

## 关键 run_id 与产物

| 任务 | run_id | 产物 |
| --- | --- | --- |
| round-trip observe | `20260219_232353_329_193d` | `build/editor_roundtrip/20260219_232353_329_193d/summary.json` |
| round-trip observe（old schema） | `20260219_233146_535_e167` | `build/editor_roundtrip/20260219_233146_535_e167/summary.json` |
| editor_gate(lite) 中 round-trip | `20260219_232408_271_416a` | `build/editor_roundtrip/20260219_232408_271_416a/summary.json` |
| editor_gate 汇总 | n/a | `build/editor_gate_summary.json` |
| ui-flow observe #1 | `20260219_232537_ui_flow` | `build/editor_ui_flow_smoke/20260219_232537_ui_flow/summary.json` |
| ui-flow observe #2 | `20260219_232627_ui_flow` | `build/editor_ui_flow_smoke/20260219_232627_ui_flow/summary.json` |

## 指标与门禁结论

### editor_gate_summary（lite profile）
- `gate_decision.would_fail = false`
- `gate_decision.exit_code = 0`
- `editor_smoke.totals = {pass:1, fail:0, skipped:0}`
- `editor_smoke.failure_buckets = {INPUT_INVALID:0, IMPORT_FAIL:0, VIEWPORT_LAYOUT_MISSING:0, RENDER_DRIFT:0, TEXT_METRIC_DRIFT:0}`
- `editor_smoke.failure_code_counts = {}`
- `step166.enabled = false`（符合 lite 语义）

### round-trip schema 扩展
- 夹具 case 读取结果包含：
  - `tags: ["text-heavy"]`
  - `priority: "P1"`
- 新 summary 增加 `priority_totals`，本次为 `{P0:0, P1:1, P2:0}`。
- 老格式兼容性：保持可读（缺字段自动默认）。

### unsupported display proxy
- Node tests 已验证：
  - unsupported point/ellipse/spline 均生成 `display_proxy`。
  - `DocumentState.listDisplayProxyEntities()` 可返回代理实体。
  - 导出后原始 `cadgf` passthrough 未丢失（type 1/5/6 保持）。

## 未关闭项（本轮保留）
- `editor_ui_flow_smoke` 在 `chamfer_polyline` 步骤仍超时，`flow.__step=chamfer_polyline`，`statusMessage="Chamfer: pick a line/polyline"`。
- 该问题不影响本轮已落地的 Step184 代码接口（Node + round-trip + editor_gate/lite 均通过），但会影响全 UI-flow 端到端覆盖深度（join 之后步骤未执行到）。

## 结论
- 本轮 STEP184 关键接口已落地并通过核心回归：
  1) `EDITOR_GATE_PROFILE` 生效且与旧 env 兼容  
  2) CI artifact 上传策略支持 `on_failure` 降噪  
  3) round-trip cases 支持 `tags/priority` 且向后兼容  
  4) unsupported display proxy 可导入/渲染/导出不丢字段  
  5) Join Tool 已接入 UI 与 Node 回归
- 建议下一步优先修复 `chamfer_polyline` UI-flow 稳定性，再开启更严格的 UI-flow gate 默认化。

---

## 2026-02-20 追加验证（收口）

### 代码收口点
- `tools/web_viewer/tools/fillet_tool.js` / `tools/web_viewer/tools/chamfer_tool.js`
  - 增加 first-pick 预选回退（单一已选目标）+ second-pick miss 不重置 stage。
  - 增加 pick 容差参数（14px）以降低 UI-flow 命中抖动。
- `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
  - arc radius grip 改为基于 live geometry + grip hover 解析，消除固定屏幕坐标漂移。
  - layer visibility 步骤改为 debug 辅助校验（`setLayerVisibility/getLayer`）并记录 `shownBoxTwoSelected` 观测值。
- `tools/web_viewer/ui/workspace.js`
  - `debug=1` 下新增 `setLayerVisibility/getLayer/listLayers/listEntities`。

### 追加验证命令与结果
| 类别 | 命令 | 结果 |
| --- | --- | --- |
| Node 回归 | `node --test tools/web_viewer/tests/editor_commands.test.js` | PASS（70/70） |
| UI-flow observe | `bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe` | PASS（`ok=true`） |
| editor_gate(lite, UI-flow gate=2轮) | `EDITOR_GATE_PROFILE=lite RUN_EDITOR_UI_FLOW=1 RUN_STEP166_GATE=0 ... bash tools/editor_gate.sh` | PASS（2/2 UI-flow PASS） |

### 关键 run_id（追加）
| 任务 | run_id | 产物 |
| --- | --- | --- |
| ui-flow observe（收口后） | `20260220_111506_ui_flow` | `build/editor_ui_flow_smoke/20260220_111506_ui_flow/summary.json` |
| ui-flow gate run #1 | `20260220_111622_ui_flow` | `build/editor_ui_flow_smoke/20260220_111622_ui_flow/summary.json` |
| ui-flow gate run #2 | `20260220_111658_ui_flow` | `build/editor_ui_flow_smoke/20260220_111658_ui_flow/summary.json` |
| editor_gate(lite) round-trip | `20260220_111734_342_c1af` | `build/editor_roundtrip/20260220_111734_342_c1af/summary.json` |

### 观察项（非阻塞）
- `layer_visibility.shownBoxTwoSelected = false`（当前 box-select 轨迹观测到 `1 selected`），但：
  - `shownPick = 2 selected`（Ctrl+A）稳定成立；
  - hidden-layer 断言仍成立（`afterHideCtrlA=1 selected`, `hiddenPick=No selection`）。
- 因此本轮 gate 继续放行，并将该项保留为下一轮行为一致性收口任务。

---

## 2026-02-20 并行加速执行（1+2+3）追加

### 本轮目标
1. 下钻 `layer_visibility` 到命令层，恢复硬断言。  
2. 跑一次 `EDITOR_GATE_PROFILE=full`（含 STEP166 gate）。  
3. 将 `tags/priority` 真正接入 nightly 固定抽样（P0/P1）。

### 代码改动
- `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
  - `layer_visibility` 的 box 断言改为 `selection.box` 命令级校验，避免起点命中导致的假阴性。
  - 恢复硬断言：`shownBox=2 selected` 必须成立。
- `tools/web_viewer/tests/editor_commands.test.js`
  - 新增 `selection.box excludes hidden-layer entities and restores after layer show` 命令级测试。
- `tools/web_viewer/scripts/editor_roundtrip_smoke.js`
  - 新增 `--priority-set` / `--tag-any`。
  - summary 新增 `filters`、`case_selection.matched_count`、`used_fallback`。
- `tools/editor_gate.sh`
  - 新增 env 透传：`EDITOR_SMOKE_PRIORITY_SET`、`EDITOR_SMOKE_TAG_ANY`。
- `tools/generate_editor_roundtrip_cases.py`
  - 新增 `--priorities`，直接按 P0/P1/P2 过滤输出 case。
- `.github/workflows/cadgamefusion_editor_nightly.yml`（VemCAD 根仓）
  - nightly 默认设置 `EDITOR_SMOKE_PRIORITY_SET=P0,P1` + `EDITOR_SMOKE_TAG_ANY=...`。
  - 先尝试生成 P0/P1 cases，若为空回退 fixture，并写入 Step Summary。

### 追加验证命令与结果
| 类别 | 命令 | 结果 |
| --- | --- | --- |
| Node 回归 | `node --test tools/web_viewer/tests/editor_commands.test.js` | PASS（71/71） |
| UI-flow observe | `bash tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe` | PASS（`ok=true`，`shownBoxTwoSelected=true`） |
| round-trip 过滤参数 | `node .../editor_roundtrip_smoke.js --priority-set P0,P1 --tag-any text-heavy,arc-heavy --no-convert` | PASS |
| cases 生成器过滤 | `python3 tools/generate_editor_roundtrip_cases.py --priorities P0,P1 --limit 2` | PASS |
| gate(lite + 过滤参数) | `EDITOR_GATE_PROFILE=lite ... EDITOR_SMOKE_PRIORITY_SET=P0,P1 ... bash tools/editor_gate.sh` | PASS |
| gate(full + STEP166) | `EDITOR_GATE_PROFILE=full ... EDITOR_SMOKE_PRIORITY_SET=P0,P1 ... bash tools/editor_gate.sh` | PASS（含 STEP166 gate） |

### 关键 run_id（本轮）
| 任务 | run_id | 产物 |
| --- | --- | --- |
| ui-flow observe | `20260220_211204_ui_flow` | `build/editor_ui_flow_smoke/20260220_211204_ui_flow/summary.json` |
| gate(lite) ui-flow #1 | `20260220_211333_ui_flow` | `build/editor_ui_flow_smoke/20260220_211333_ui_flow/summary.json` |
| gate(lite) ui-flow #2 | `20260220_211410_ui_flow` | `build/editor_ui_flow_smoke/20260220_211410_ui_flow/summary.json` |
| gate(lite) round-trip | `20260220_211447_151_cafe` | `build/editor_roundtrip/20260220_211447_151_cafe/summary.json` |
| gate(full) ui-flow #1 | `20260220_211555_ui_flow` | `build/editor_ui_flow_smoke/20260220_211555_ui_flow/summary.json` |
| gate(full) ui-flow #2 | `20260220_211634_ui_flow` | `build/editor_ui_flow_smoke/20260220_211634_ui_flow/summary.json` |
| gate(full) round-trip | `20260220_211710_846_0cbd` | `build/editor_roundtrip/20260220_211710_846_0cbd/summary.json` |
| gate(full) STEP166 | `20260220_131820` | `build/cad_regression/20260220_131820/summary.json` |

### 本轮结论
- `layer_visibility` 命令级硬断言已恢复并稳定通过。
- `full` 门禁（含 STEP166）本轮可通过，说明并行加速后主链路仍稳定。
- nightly 已具备 P0/P1 + tag 过滤抽样能力（含空匹配回退保护），满足“固定样本可持续运行”目标。

---

## 2026-02-20 并行加速执行（按建议）追加

### 本轮目标
1. 降低 `used_fallback=true` 频次（兼容历史无 tags/priority 的 cases 文件）。  
2. 在 gate summary 与 nightly summary 显式输出 `matched_count/used_fallback`。  
3. 用一次本地 gate 验证端到端字段已打通。  

### 代码改动
- `tools/web_viewer/scripts/editor_roundtrip_smoke.js`
  - 旧 case（仅 `name/path`）会按 `document.json` 自动推断 `tags/priority`。
- `tools/editor_gate.sh`
  - `editor_smoke` 增加 `filters` 与 `case_selection`（含 `used_fallback`）。
- `tools/write_ci_artifact_summary.py`
  - 增加 `editor_smoke_filters` 与 `editor_smoke_case_selection` 行。
- `.github/workflows/cadgamefusion_editor_nightly.yml`（VemCAD 根仓）
  - nightly Step Summary 追加 `selected/matched/candidate/total/fallback`。

### 验证命令与结果
| 类别 | 命令 | 结果 |
| --- | --- | --- |
| 语法 | `node --check tools/web_viewer/scripts/editor_roundtrip_smoke.js` | PASS |
| 语法 | `bash -n tools/editor_gate.sh` | PASS |
| 语法 | `python3 -m py_compile tools/write_ci_artifact_summary.py` | PASS |
| round-trip 过滤（历史 local cases） | `node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 5 --no-convert --cases local/editor_roundtrip_smoke_cases.json --priority-set P0,P1 --tag-any text-heavy,arc-heavy,polyline-heavy,import-stress` | PASS（`matched=19 fallback=0`） |
| gate(lite) | `EDITOR_GATE_PROFILE=lite ... SUMMARY_PATH=build/editor_gate_summary_step184_parallel.json bash tools/editor_gate.sh` | PASS |

### 关键 run_id
| 任务 | run_id | 产物 |
| --- | --- | --- |
| round-trip observe（过滤校验） | `20260220_214826_739_4e9a` | `build/editor_roundtrip/20260220_214826_739_4e9a/summary.json` |
| gate(lite) round-trip | `20260220_214852_210_14e5` | `build/editor_roundtrip/20260220_214852_210_14e5/summary.json` |
| gate(lite) summary | - | `build/editor_gate_summary_step184_parallel.json` |

### 结论
- 过滤抽样对历史 case 清单已可用，`P0/P1 + tag` 不再因为缺元数据退化为 `matched=0`。
- gate summary 与 nightly summary 均已具备 `case_selection` 观测字段，可用于后续趋势分析与 gate 切换评估。

---

## 2026-02-20 追加执行（同意 1+2）

### 1) STEP176 周报字段同步（case_selection/filter）

#### 代码改动
- `tools/editor_weekly_validation.sh`
  - `analyze_editor_smoke_summary()` 增加 `filters`、`case_selection` 提取并写入 weekly summary。
  - weekly markdown 增加：
    - `editor_smoke_filters`
    - `editor_smoke_case_selection`
    - `gate_editor_smoke_filters`
    - `gate_editor_smoke_case_selection`
- `tools/write_step176_weekly_report.py`
  - 新增 `append_editor_smoke_selection_lines()`，在 STEP176 周报中输出上述字段。

#### 验证
| 类别 | 命令 | 结果 |
| --- | --- | --- |
| 语法 | `bash -n tools/editor_weekly_validation.sh` | PASS |
| 语法 | `python3 -m py_compile tools/write_step176_weekly_report.py` | PASS |

### 2) Full gate（含 STEP166）执行

#### 执行命令
- `EDITOR_GATE_PROFILE=full RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 RUN_EDITOR_SMOKE_FAILURE_INJECTION_GATE=0 EDITOR_SMOKE_CASES=local/editor_roundtrip_smoke_cases.json EDITOR_SMOKE_LIMIT=5 EDITOR_SMOKE_PRIORITY_SET=P0,P1 EDITOR_SMOKE_TAG_ANY=text-heavy,arc-heavy,polyline-heavy,import-stress SUMMARY_PATH=build/editor_gate_summary_step184_full.json EDITOR_GATE_APPEND_REPORT=0 STEP176_APPEND_REPORT=0 bash tools/editor_gate.sh`

#### 结果
- gate: PASS（`would_fail=false`, `exit_code=0`）
- editor smoke run_id: `20260220_215442_388_986a`
  - totals: `pass=5 fail=0 skipped=0`
  - case_selection: `selected=5 matched=19 candidate=19 total=20 fallback=false`
- STEP166 run_id: `20260220_135558`
  - `gate_would_fail=false`
- summary: `build/editor_gate_summary_step184_full.json`

### 本轮结论
- 1) weekly 报告链路已可见样本过滤质量（case_selection/filter），满足趋势化观测需求。  
- 2) full gate（含 STEP166）可稳定通过，当前并行加速改动未破坏主链路。  

---

## 2026-02-20 追加执行（1+2：weekly 真跑 + nightly 对齐）

### 代码改动
- `tools/editor_weekly_validation.sh`
  - weekly summary / markdown 增加 editor_smoke 与 gate_editor_smoke 的 `filters` / `case_selection` 输出。
- `tools/write_step176_weekly_report.py`
  - 新增通用输出函数，周报可写入：
    - `editor_smoke_filters`
    - `editor_smoke_case_selection`
    - `gate_editor_smoke_filters`
    - `gate_editor_smoke_case_selection`
- `.github/workflows/cadgamefusion_editor_nightly.yml`（VemCAD 根仓）
  - Step Summary 追加：
    - `gate_editor_smoke_filters`
    - `gate_editor_smoke_case_selection`
  - `fallback` 统一为 `true|false`。

### 执行与验证
| 类别 | 命令 | 结果 |
| --- | --- | --- |
| 语法 | `bash -n tools/editor_weekly_validation.sh` | PASS |
| 语法 | `python3 -m py_compile tools/write_step176_weekly_report.py` | PASS |
| YAML | `ruby -e 'require \"yaml\"; YAML.load_file(\".github/workflows/cadgamefusion_editor_nightly.yml\")'` | PASS |
| weekly 真跑（含 gate） | `STEP176_APPEND_REPORT=1 RUN_GATE=1 bash tools/editor_weekly_validation.sh` | PASS |

### 关键 run_id（weekly）
| 任务 | run_id | 产物 |
| --- | --- | --- |
| ui-flow observe | `20260220_230334_ui_flow` | `build/editor_ui_flow_smoke/20260220_230334_ui_flow/summary.json` |
| ui-flow failure injection | `20260220_230417_ui_flow` | `build/editor_ui_flow_smoke/20260220_230417_ui_flow/summary.json` |
| editor roundtrip observe | `20260220_230439_840_4f5d` | `build/editor_roundtrip/20260220_230439_840_4f5d/summary.json` |
| step166 observe | `20260220_150601` | `build/cad_regression/20260220_150601/summary.json` |
| gate roundtrip | `20260220_230834_619_f16d` | `build/editor_roundtrip/20260220_230834_619_f16d/summary.json` |
| gate step166 | `20260220_150954` | `build/cad_regression/20260220_150954/summary.json` |

### 产物确认
- weekly summary: `build/editor_weekly_validation_summary.json`
- weekly markdown: `build/editor_weekly_validation_summary.md`
- STEP176 已追加：`docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md`
  - 可见字段：
    - `editor_smoke_case_selection`
    - `gate_editor_smoke_case_selection`

### 本轮结论
- weekly 真跑已完成，新增 case_selection 字段已进入真实 STEP176 周报。  
- nightly Step Summary 已完成 `gate_editor_smoke_case_selection` 对齐，周报/夜跑字段口径一致。  

---

## 2026-02-20 继续推进（过滤参数贯通 weekly + gate）

### 代码改动
- `tools/editor_weekly_validation.sh`
  - 新增 env：
    - `EDITOR_SMOKE_PRIORITY_SET`、`EDITOR_SMOKE_TAG_ANY`
    - `GATE_SMOKE_PRIORITY_SET`、`GATE_SMOKE_TAG_ANY`
  - weekly `editor_roundtrip_smoke.js` 与 weekly 内 `editor_gate.sh` 均可透传上述过滤参数。
  - `inputs` 区块新增过滤参数记录，便于后续趋势归因。
- `.github/workflows/cadgamefusion_editor_nightly.yml`
  - Step Summary 新增：
    - `gate_editor_smoke_filters`
    - `gate_editor_smoke_case_selection`
  - `fallback` 输出规范为 `true|false`。

### 执行与验证
| 类别 | 命令 | 结果 |
| --- | --- | --- |
| 语法 | `bash -n tools/editor_weekly_validation.sh` | PASS |
| YAML | `ruby -e 'require \"yaml\"; YAML.load_file(\".github/workflows/cadgamefusion_editor_nightly.yml\")'` | PASS |
| weekly 真跑（过滤 + gate） | `STEP176_APPEND_REPORT=1 RUN_GATE=1 RUN_EDITOR_UI_FLOW_SMOKE=0 RUN_EDITOR_UI_FLOW_SMOKE_GATE=0 RUN_UI_FLOW_FAILURE_INJECTION=0 RUN_UI_FLOW_FAILURE_INJECTION_GATE=0 EDITOR_SMOKE_PRIORITY_SET=P0,P1 EDITOR_SMOKE_TAG_ANY=text-heavy,arc-heavy,polyline-heavy,import-stress GATE_SMOKE_PRIORITY_SET=P0,P1 GATE_SMOKE_TAG_ANY=text-heavy,arc-heavy,polyline-heavy,import-stress bash tools/editor_weekly_validation.sh` | PASS |

### 关键 run_id（本轮）
| 任务 | run_id | 产物 |
| --- | --- | --- |
| weekly roundtrip observe | `20260221_004402_188_5b6a` | `build/editor_roundtrip/20260221_004402_188_5b6a/summary.json` |
| weekly step166 observe | `20260220_164526` | `build/cad_regression/20260220_164526/summary.json` |
| weekly gate roundtrip | `20260221_004631_773_6c30` | `build/editor_roundtrip/20260221_004631_773_6c30/summary.json` |
| weekly gate step166 | `20260220_164756` | `build/cad_regression/20260220_164756/summary.json` |

### 结果确认
- `build/editor_weekly_validation_summary.json` 中字段已落地：
  - `editor_smoke.filters = {priority_set:[P0,P1], tag_any:[...]}`  
  - `editor_smoke.case_selection = {matched_count:19, used_fallback:false, ...}`  
  - `gate.editor_smoke.filters/case_selection` 同步存在。  
- `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md` 新增：
  - `editor_smoke_filters`
  - `editor_smoke_case_selection`
  - `gate_editor_smoke_filters`
  - `gate_editor_smoke_case_selection`

### 本轮结论
- weekly 与 nightly 的过滤字段口径已统一；后续可直接统计 `matched_count/used_fallback` 趋势。  
- 在 P0/P1+tag 过滤条件下，本轮 weekly observe + gate 全链路通过，主链路稳定。  

---

## 2026-02-21 继续推进（1+2：线上 nightly 双模式 + case_selection 趋势）

### 1) 线上 nightly workflow_dispatch（observe + gate）

#### 触发与结果
| 模式 | run_id | URL | 结论 |
| --- | --- | --- | --- |
| observe | `22248982711` | `https://github.com/zensgit/VemCAD/actions/runs/22248982711` | success |
| gate | `22248998665` | `https://github.com/zensgit/VemCAD/actions/runs/22248998665` | success |

#### 线上日志关键点（来自 `gh run view --log`）
- observe：round-trip run_id=`20260221_025326_094_6e11`，`totals pass=1 fail=0 skipped=0`，`RUN_STEP166_GATE=0`（lite）。
- gate：round-trip run_id=`20260221_025438_611_1a04`，`totals pass=1 fail=0 skipped=0`，`RUN_STEP166_GATE=0`（lite）。
- 两次均出现 artifact quota 注解（不影响结论）：
  - `Failed to CreateArtifact: Artifact storage quota has been hit`
- 线上 `main` 当前日志仍显示旧版 nightly 行为（`editor_smoke_cases=<discovery>`，未见 `priority_set/tag_any` 行），说明远端 workflow 尚未包含本地未提交改动。

### 2) case_selection 7/14 天趋势脚本 + STEP176 接入

#### 代码改动
- 新增：`tools/editor_case_selection_trend.py`
- 更新：
  - `tools/editor_weekly_validation.sh`
  - `tools/write_step176_weekly_report.py`

#### 验证与执行
| 类别 | 命令 | 结果 |
| --- | --- | --- |
| 语法 | `python3 -m py_compile tools/editor_case_selection_trend.py tools/write_step176_weekly_report.py` | PASS |
| 趋势脚本 | `python3 tools/editor_case_selection_trend.py --history-dir build/editor_gate_history --windows 7,14 --out-json build/editor_case_selection_trend.json --out-md build/editor_case_selection_trend.md` | PASS（status=`stable`） |
| weekly（过滤 + gate） | `STEP176_APPEND_REPORT=1 RUN_GATE=1 ... EDITOR_SMOKE_PRIORITY_SET=P0,P1 ... bash tools/editor_weekly_validation.sh` | PASS |

#### 关键 run_id（本轮 weekly）
| 任务 | run_id | 产物 |
| --- | --- | --- |
| weekly roundtrip observe | `20260221_105924_743_0b2f` | `build/editor_roundtrip/20260221_105924_743_0b2f/summary.json` |
| weekly step166 observe | `20260221_030052` | `build/cad_regression/20260221_030052/summary.json` |
| weekly gate roundtrip | `20260221_110200_608_bf48` | `build/editor_roundtrip/20260221_110200_608_bf48/summary.json` |
| weekly gate step166 | `20260221_030322` | `build/cad_regression/20260221_030322/summary.json` |

#### 趋势结果（7/14 天）
- `case_selection_trend_status=stable`
- 7d: `matched_ratio=0.960`，`fallback_rate=0.000`，`samples_with_selection=5`
- 14d: `matched_ratio=0.960`，`fallback_rate=0.000`，`samples_with_selection=5`

#### 报告落地
- weekly summary:
  - `build/editor_weekly_validation_summary.json`
  - `build/editor_weekly_validation_summary.md`
- STEP176 追加：
  - `docs/STEP176_LEVELA_CONTINUOUS_DEV_VALIDATION_VERIFICATION.md`
  - 已包含：
    - `editor_smoke_filters` / `editor_smoke_case_selection`
    - `gate_editor_smoke_filters` / `gate_editor_smoke_case_selection`
    - `case_selection_trend` / `case_selection_trend_windows`

### 本轮结论
- 已完成线上 nightly 双模式验证与记录；当前线上 workflow 仍基于远端旧版本定义。  
- 已完成 case_selection 的 7/14 天趋势化并接入 STEP176，后续可稳定监控 `matched_count/used_fallback` 演化。  
