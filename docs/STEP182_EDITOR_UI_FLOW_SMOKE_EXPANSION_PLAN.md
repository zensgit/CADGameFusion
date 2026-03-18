# STEP182 Editor UI Flow Smoke Expansion Plan (Level A Stabilization -> Level B Interaction)

## 背景
命令级 Node tests 能覆盖大部分几何/状态机逻辑，但覆盖不到 UI wiring（按钮绑定、工具激活/取消、属性面板联动、键盘修饰键等）。
`tools/web_viewer/scripts/editor_ui_flow_smoke.sh` 的目标是提供一条“真实交互路径”的可复现护栏，并支持 `observe -> gate` 门禁化。

## 成功标准（Definition of Done）
1. `editor_ui_flow_smoke.sh` 在默认 timeout（15000ms）下稳定通过（gate 模式 exit 0）。
2. Flow 覆盖 Level A 关键路径：绘制、选择、grips、修改命令、Undo/Redo、属性面板。
3. 断言只依赖稳定 DOM（selection summary / property inputs），不依赖易被覆盖的 status 文案。
4. 在 `tools/ci_editor_light.sh` / `tools/local_ci.sh` / `tools/editor_gate.sh` 中可选接入（默认 observe，不破坏已有流程）。

> 注：CI 里 `editor_ui_flow_smoke` 默认使用 `--timeout-ms 25000`，以降低 headless 环境下偶发的 UI 事件丢失/渲染延迟导致的 flaky。

## 当前状态（2026-02-13）
- 脚本：`tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- 已覆盖（脚本内 flow）：
  - Line draw + Undo/Redo
  - Polyline + Fillet（同一 polyline 相邻拐角 pick）
  - Polyline + Chamfer（同一 polyline 相邻拐角 pick）
  - Break Keep toggle + closed polyline two-point break（Shift+click）并断言 Closed 变为 unchecked
  - Arc create + Arc radius grip drag + Undo/Redo（断言 Radius 输入值变化）
  - Offset（line）+ Undo/Redo（断言 Start/End 数值变化）
  - Join（two lines）+ Undo/Redo（断言 selection 变为 polyline）
  - Text edit（property panel）+ Undo/Redo（断言 `input[name=value]` 回退/重做）
  - Trim（line-line）+ Undo/Redo（断言端点数值变化）
  - Extend（line-line）+ Undo/Redo（断言端点数值变化）
  - Trim（polyline split）：两条 boundary + 点击 polyline 中段（断言 selection 变为 `2 selected (polyline, polyline)`）
  - Extend（polyline endpoint）：延伸 polyline 端点到 boundary，并通过 END snap 验证延伸后的端点位置
  - Move/Copy/Rotate（基点 -> 目标点）+ Undo/Redo（断言 dx/dy/角度变化与选择集变化）
  - Box select（window/crossing）+ Shift add/remove（断言 selection summary）
  - Layer visibility（Hidden layer 不可 pick/hit-test；重新显示后可被 Ctrl+A 选中）
  - Layer visibility + box select（hidden layer 不参与 crossing box；显示后可被 box 选中）
  - Snap kinds（MID/CEN/INT + QUA/NEA/TAN 最小覆盖；通过几何期望点/切线不变量断言落点）
  - Layer lock（锁层阻止编辑/解锁允许编辑）+ Undo/Redo（通过属性面板 `end.x` patch 验证）
  - Statusbar toggles + snap hit（Grid/Ortho/Snap wiring；endpoint snap 命中断言）
  - Failure triage：flow JSON 包含 `__step`/`__error`（含 selection/status 快照）
- 接入：
  - `tools/ci_editor_light.sh`：`RUN_EDITOR_UI_FLOW_SMOKE(_GATE)=1`
  - `tools/local_ci.sh`：`RUN_EDITOR_UI_FLOW_SMOKE(_GATE)=1` + `--strict-exit`
  - `tools/editor_gate.sh` / `tools/editor_weekly_validation.sh`：可选启用 UI flow smoke（observe/gate）
  - 约定（2026-02-14 起）：`tools/ci_editor_light.sh` 默认执行 `editor_ui_flow_smoke` 的 `gate`（并使用 `--timeout-ms ${EDITOR_UI_FLOW_SMOKE_TIMEOUT_MS:-25000}`；可用 `SKIP_EDITOR_UI_FLOW_SMOKE=1` 关闭）
- 已验证 run_id：
  - observe: `build/editor_ui_flow_smoke/20260213_205647_ui_flow/summary.json`
  - gate: `build/editor_ui_flow_smoke/20260213_205736_ui_flow/summary.json`
  - gate (snap kinds QUA/NEA): `build/editor_ui_flow_smoke/20260213_214119_ui_flow/summary.json`
  - gate (trim/extend polyline + layer box select): `build/editor_ui_flow_smoke/20260213_230843_ui_flow/summary.json`
  - gate (snap kinds TAN): `build/editor_ui_flow_smoke/20260214_000500_ui_flow/summary.json`
  - CI light gate: editor_roundtrip=`build/editor_roundtrip/20260213_214212_075_a3b6/summary.json`, ui_flow=`build/editor_ui_flow_smoke/20260213_214212_ui_flow/summary.json`
  - CI light gate (latest): editor_roundtrip=`build/editor_roundtrip/20260213_231140_660_d8ca/summary.json`, ui_flow=`build/editor_ui_flow_smoke/20260213_231140_ui_flow/summary.json`

## 下一步扩展（按优先级）
### P0：Snap kinds 扩展（TAN）
目标：补齐 `TAN` 的 UI wiring 覆盖（`tangentFrom` 参考点 + 切点落点），`QUA/NEA` 已在 UI flow smoke 覆盖。

建议实现：
1. clearDoc
2. 开启 Tangent（仅 tangent=true，其余 snap kinds 关闭）
3. 画 circle + line：line 第一个点作为 reference（tangentFrom），第二个点 near-circle，断言 end 落在切点（允许一定误差）
4. 若 UI flow 仍不稳定：保留 TAN 在 Node tests 覆盖（`resolveSnappedPoint supports tangent...`），UI flow 暂不门禁化

状态：
- 已落地并通过 gate：`build/editor_ui_flow_smoke/20260214_000500_ui_flow/summary.json`

### P0：Overlay 不变量（gripHover vs snapHint）
目标：把 “grip hover 高亮不影响 snapHint” 从 Node tests 扩展为 UI-flow gate 覆盖（真实 wiring）。

实现约束：
- 仅在 `?debug=1` 时暴露 `window.__cadDebug.getOverlays()`（不影响默认 editor 行为）。

状态：
- 已落地并通过 gate：`build/editor_ui_flow_smoke/20260214_012135_ui_flow/summary.json`

### P0：Break(two-point) Esc 恢复性（不中断目标）
目标：把 break(two-point) 中途 Esc 的恢复性也变成 UI-flow gate（真实 wiring），防止“Esc 后丢 target / 工具状态错乱”。

验收断言：
1. Break 选中 polyline target
2. Shift+click 进入 two-point（等待第二点）
3. Esc 退出 two-point 子状态但保留 target
4. 直接点击 break 点（不重新 pick target）能完成 single-point break（Closed=false）

状态：
- 已落地并通过 gate：`build/editor_ui_flow_smoke/20260214_120459_ui_flow/summary.json`

### P1：Trim/Extend 对 polyline 中段 UI flow（段级行为）
目标：覆盖“真实用户”会遇到的 polyline 中段 trim/extend 行为，而不仅仅是 line-line。

建议实现：
1. clearDoc
2. 画一条折线 polyline + 一条边界线
3. Trim：点击 polyline 中段，断言 polyline 被拆分/截断符合 pick-side 语义；Undo/Redo
4. Extend：对 polyline endpoint 延伸，断言只延伸 endpoint 不误缩短；Undo/Redo

状态（补充落地）：
- `trim_polyline_split` 已扩展为连续 split 2 条 polyline，并通过 `debug=1` 的 entityCount delta 断言（更稳定，不依赖 status 文案）：
  - `build/editor_ui_flow_smoke/20260214_013109_ui_flow/summary.json`
- `trim_polyline_split` 已收口为几何门禁：对两条 polyline split 后读取两段 polyline 的端点，断言端点落在 {baseMinX,boundaryX1} 与 {boundaryX2,baseMaxX}，并保持 y 不漂移：
  - `build/editor_ui_flow_smoke/20260214_162452_ui_flow/summary.json`
- `trim_polyline_split` 的 undo/redo 已从 entityCount 升级为几何回滚断言：undo 后显式 pick Q 行恢复原端点；redo 后 box-select 断言重新 split 且端点 pinned：
  - `build/editor_ui_flow_smoke/20260214_173948_ui_flow/summary.json`
- `trim_polyline_continue_after_failure` 已落地：先对 no-intersection polyline 点击（no-op），不重新 pick boundaries 直接对下一条 polyline split 成功，并断言 undo/redo：
  - `build/editor_ui_flow_smoke/20260214_160839_ui_flow/summary.json`
- `trim_polyline_continue_after_failure` 已收口为几何门禁：split 后读取两段 polyline 的端点，断言端点落在 {baseMinX,boundaryX1} 与 {boundaryX2,baseMaxX}，并保持 y 不漂移：
  - `build/editor_ui_flow_smoke/20260214_161932_ui_flow/summary.json`
- `trim_polyline_continue_after_failure` 的 undo/redo 已从 entityCount 升级为几何回滚断言：undo 恢复原 polyline 端点；redo 重新 split 且两段端点仍 pinned：
  - `build/editor_ui_flow_smoke/20260214_163919_ui_flow/summary.json`
- `trim_continue_after_failure` 已落地：先对 no-intersection 目标执行 trim（不改变几何），随后不重新选 boundary 直接 trim 第二目标并成功（断言目标触边 + 发生变化）：
  - `build/editor_ui_flow_smoke/20260214_110034_ui_flow/summary.json`
- `extend_continue_after_failure` 已落地：先对 no-intersection 目标执行 extend（不改变几何），随后不重新选 boundary 直接 extend 第二目标并成功（断言 target2 的 endpoint 落在 boundary 上）：
  - `build/editor_ui_flow_smoke/20260214_111202_ui_flow/summary.json`
- 补充（门禁收口）：两者均已加入 Undo/Redo 断言（保证失败后连续操作不会污染历史栈）：
  - `build/editor_ui_flow_smoke/20260214_132028_ui_flow/summary.json`

### P1：Extend(polyline) undo/redo
目标：把 polyline endpoint extend 的回退/重做也变成门禁级覆盖（避免“看起来延伸了但历史不对”）。

实现策略：
- 用 `debug=1` 暴露 `window.__cadDebug.getEntity(id)`，读取 polyline 的 `points[-1].x` 作为 endpoint x。
- 断言：
  - extend 后 endpoint x ~= boundaryX
  - undo 后 poly2 endpoint x 回到 before（poly1 不回退）
  - redo 后 poly2 endpoint x ~= boundaryX

状态：
- 已落地并通过 gate：`build/editor_ui_flow_smoke/20260214_013537_ui_flow/summary.json`
  - 补充：覆盖 failure->continue 的连续行为（先对 no-intersection polyline 点击，再不重新 pick boundary 直接对下一 polyline extend 成功，并断言 undo/redo）：
    - `build/editor_ui_flow_smoke/20260214_160525_ui_flow/summary.json`

### P1：Layer visibility + box select 组合场景
目标：确保 hidden layer 不参与 box select（window/crossing），避免只覆盖 click pick。

建议实现：
1. clearDoc
2. layer0/layer1 各画 1 条线
3. hide layer0 -> crossing box：只能选中 layer1 的线
4. show layer0 -> crossing box：能选中两条线

> 备注：以上两个 P1 项已在 `build/editor_ui_flow_smoke/20260213_230843_ui_flow/summary.json` 覆盖并通过 gate。

## 脚本实现约束（避免 UI flow 变脆）
1. 禁止在 run-code 中使用 JS 模板字符串（反引号）与 bash 变量混用（bash 会做 command substitution / set -u 触发）。
2. `page.waitForFunction` 只传一个 arg（对象），避免误用导致回退到默认 5000ms timeout。
3. 需要修饰键（Shift/Ctrl/Alt）时使用：
   - `await page.keyboard.down('Shift'); ...; await page.keyboard.up('Shift');`
4. Break tool：激活前清选择，避免 `preselectPrimary()` 直接进入 pickPoint 阶段。
5. UI 断言优先：
   - `#cad-selection-summary`
   - `#cad-property-form input[name=...]`
   - checkbox 状态（如 Closed）

## 持续验证节奏（建议）
- 每次提交前（快速）：
  - `node --test tools/web_viewer/tests/editor_commands.test.js`
  - `node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 3`
- 每周（observe）：
  - `bash tools/editor_weekly_validation.sh`
- 门禁（gate，按需开启阻塞）：
  - `RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 bash tools/ci_editor_light.sh`
  - 或 `RUN_EDITOR_UI_FLOW_SMOKE_GATE=1 --strict-exit bash tools/local_ci.sh`

## 报告更新规范
- 每次 UI flow smoke 扩展后，在以下文档追加 run_id + 结论：
  - `docs/STEP170_AUTOCAD_UI_OPS_VERIFICATION.md`
  - 相关功能 STEP 的 verification（例如 fillet/chamfer/break/join）
