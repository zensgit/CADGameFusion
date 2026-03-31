# STEP194 Editor Current Layer Verification

## Scope

This verification closes the current-layer workflow introduced in Step194:

- explicit current layer surface in the editor
- focused layer vs current layer separation
- native creation tools honoring current layer
- safe fallback when the current layer becomes unavailable

## Static Checks

Executed commands:

```bash
node --check deps/cadgamefusion/tools/web_viewer/ui/layer_panel.js
node --check deps/cadgamefusion/tools/web_viewer/ui/layer_session_policy.js
node --check deps/cadgamefusion/tools/web_viewer/ui/statusbar.js
node --check deps/cadgamefusion/tools/web_viewer/ui/workspace.js
node --check deps/cadgamefusion/tools/web_viewer/tools/line_tool.js
node --check deps/cadgamefusion/tools/web_viewer/tools/polyline_tool.js
node --check deps/cadgamefusion/tools/web_viewer/tools/circle_tool.js
node --check deps/cadgamefusion/tools/web_viewer/tools/arc_tool.js
node --check deps/cadgamefusion/tools/web_viewer/tools/text_tool.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
bash -n deps/cadgamefusion/tools/web_viewer/scripts/editor_ui_flow_smoke.sh
git -C deps/cadgamefusion diff --check
```

Result: PASS.

## Node Regression

Executed command:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Result:

- `175/175 PASS`

Observed acceptance points:

- `create` tools use the active current layer in their payloads
- `resolveCurrentLayerId` prefers an editable populated layer and falls back safely
- focus/current separation does not break existing selection or property tests

## Browser Verification

Primary browser acceptance path:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js
```

Artifact:

- `build/editor_current_layer_smoke/20260322_171044/summary.json`

Observed facts:

- imported layer `1:PLOT` becomes the initial current layer
- layer panel switches current context to `2:REDLINE` without hijacking focused layer
- selecting entity `7` keeps focus on layer `1` while current layer remains on `2`
- property panel exposes `Use Layer` when focused layer differs from current layer
- first browser-created line lands on current layer `2`
- locking layer `2` falls current layer back to `1`, and the next created line lands on `1`

Focused-layer regression path:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
```

Artifact:

- `build/editor_selection_summary_smoke/20260322_171058/summary.json`

Observed facts:

- imported selection provenance/effective-style contract still matches Step193 expectations
- focused layer remains stable through `Layer ID` edits and locked-layer recovery
- property panel actions now include the new current-layer bridge without breaking `Locate Layer` / `Unlock Layer`

Secondary long-smoke guard:

```bash
bash deps/cadgamefusion/tools/web_viewer/scripts/editor_ui_flow_smoke.sh
```

Artifacts:

- `build/editor_ui_flow_smoke/20260322_171152_ui_flow/summary.json`
- `build/editor_ui_flow_smoke/20260322_171600_ui_flow/summary.json`

Observed result:

- current-layer guard for the new layer row is wired into the long smoke
- polyline `fillet/chamfer` smoke picks were hardened to use actual geometry instead of brittle screen guesses
- the long smoke still fails later on an unrelated historical `join` timeout, so it remains a secondary regression signal rather than the Step194 acceptance gate

## Notes

- The dedicated current-layer smoke is the clearest Step194 acceptance path because it directly inspects focused/current separation and browser-created entity layers.
- `ci_editor_light.sh` is not yet green at the end of this step because its embedded long UI-flow smoke still hits the unrelated `join` timeout after the new current-layer checks have already passed.
- The goal of this step is to make current-layer behavior explicit and stable, not to expand the broader layer-management feature set.
