# STEP192 Editor Layer-Aware Selection Verification

## Scope

This verification closes the layer-aware selection/property contract introduced in Step192:

- shared selection presentation becomes layer-aware
- single-select quicklook shows `layer / layer color / layer state`
- property metadata mirrors the same layer facts
- imported `BYLAYER -> TRUECOLOR` promotion stays visible after `Layer ID` edit
- locked-layer quicklook and property guardrails update live
- `selection.propertyPatch` rejects attempts to move entities off locked current layers

## Static checks

Executed from `deps/cadgamefusion`:

```bash
node --check tools/web_viewer/ui/selection_presenter.js
node --check tools/web_viewer/ui/property_panel.js
node --check tools/web_viewer/scripts/editor_selection_summary_smoke.js
bash -n tools/web_viewer/scripts/editor_ui_flow_smoke.sh
git diff --check
```

Result: PASS.

## Node regression

Executed:

```bash
node --test tools/web_viewer/tests/editor_commands.test.js
```

Result: `173 / 173 PASS`.

Newly protected areas include:

- compact selection contract now includes `layer color / layer state`
- single-select quicklook badges/facts expose `NoPrint / Construction / Locked`
- `selection.propertyPatch` rejects moving an entity off a locked current layer

## Browser verification

Executed:

```bash
node tools/web_viewer/scripts/editor_selection_summary_smoke.js
```

Artifact:

- `build/editor_selection_summary_smoke/20260322_164431/summary.json`

Result: PASS.

Observed states:

- before edit:
  - `layer = 1:PLOT`
  - `layer-color = #808080`
  - `layer-state = Shown / Open / Live / Print / Normal`
  - `effective-color = #808080`
  - `color-source = BYLAYER`
- after `Layer ID -> 2`:
  - `layer = 2:REDLINE`
  - `layer-color = #ff0000`
  - `layer-state = Shown / Open / Live / NoPrint / Construction`
  - `effective-color = #808080`
  - `color-source = TRUECOLOR`
- after locking layer `2` via debug API:
  - quicklook badge `layer-locked = Locked`
  - quicklook `layer-state = Shown / Locked / Live / NoPrint / Construction`
  - property note: `Selected entity is on locked layer 2:REDLINE; editing disabled until the layer is unlocked.`
  - property inputs disappear
- after unlocking layer `2`:
  - property inputs return

Observed property metadata:

- before edit:
  - `layer = 1:PLOT`
  - `layer-color = #808080`
  - `layer-state = Shown / Open / Live / Print / Normal`
- after edit:
  - `layer = 2:REDLINE`
  - `layer-color = #ff0000`
  - `layer-state = Shown / Open / Live / NoPrint / Construction`
- locked:
  - `layer-state = Shown / Locked / Live / NoPrint / Construction`

Browser diagnostics:

- `console_messages = []`
- `page_errors = []`
- `ok = true`

## Notes

- `editor_ui_flow_smoke.sh` syntax remained valid and its synthetic provenance step was extended to assert the new `layer` quicklook field.
- This step uses the dedicated imported-fixture smoke as the primary browser verification path because it directly exercises the changed selection/property surface and lock/unlock transitions.
