# STEP195 Editor LAYMCUR Verification

## Scope

This step verifies the benchmark-aligned selection-to-current workflow added on top of Step194:

- `laymcur` command input
- property-panel `Make Current` action label
- current-layer promotion from selected entity layer
- refusal on locked target layers

## Static Checks

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer/ui/layer_session_policy.js
node --check deps/cadgamefusion/tools/web_viewer/ui/workspace.js
node --check deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js
```

Expected result:

- all commands exit successfully

## Node Contract Tests

From repo root:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Expected coverage:

- `resolveSelectionCurrentLayer` rejects `NO_SELECTION`
- multi-select promotion uses `primaryId`
- locked target layer is rejected with `LAYER_UNAVAILABLE`
- join tool default fuzz path remains covered after the same round of UI work

Observed result on this step:

- `178/178 PASS`

## Browser Smoke

From repo root:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js
```

Observed artifact:

- `build/editor_current_layer_smoke/20260322_173441/summary.json`

Observed assertions from the artifact:

- initial current layer = `1:PLOT`
- after explicit switch, current layer = `2:REDLINE`
- selecting entity `7` focuses layer `1` while current stays on `2`
- property panel shows `Make Current`
- `laymcur` switches current layer from `2` to `1`
- new line created after `laymcur` lands on layer `1`
- `laymcur` against locked layer `1` keeps current layer on `2`
- locked refusal status = `Layer unavailable for drawing: PLOT`
- locking current layer `2` still falls back safely to `1`

## Outcome

Step195 is verified when:

- the editor keeps focus/current separated
- the operator can promote a selected entity layer into current without opening the layer list manually
- invalid target layers are refused before they become creation context
