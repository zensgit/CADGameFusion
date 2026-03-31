# STEP192 Editor Layer Context Verification

## Scope

This verification closes the layer-aware selection/property contract introduced in Step192:

- shared selection presentation becomes layer-aware
- single-selection quicklook exposes `layer / layer color / layer state`
- property panel blocks futile edits on locked layers
- browser smoke verifies live updates after `Layer ID` edits and layer lock toggles

## Static Checks

Executed from `deps/cadgamefusion`:

```bash
node --check tools/web_viewer/ui/selection_presenter.js
node --check tools/web_viewer/ui/property_panel.js
node --check tools/web_viewer/scripts/editor_selection_summary_smoke.js
bash -n tools/web_viewer/scripts/editor_ui_flow_smoke.sh
git diff --check
```

Expected result: PASS.

## Node Regression

Executed:

```bash
node --test tools/web_viewer/tests/editor_commands.test.js
```

Expected protected areas:

- compact selection contract includes layer identity
- single-selection presentation exposes layer badge and exceptional flags
- locked layer state is reflected in shared presentation output

## Browser Verification

Executed:

```bash
node tools/web_viewer/scripts/editor_selection_summary_smoke.js
```

Expected artifact:

- `build/editor_selection_summary_smoke/<run_id>/summary.json`

Expected browser assertions:

- before edit:
  - `layer = 1:PLOT`
  - `layer-color = #808080`
  - `layer-state = Shown / Open / Live / Print / Normal`
  - `color-source = BYLAYER`
- after changing `Layer ID` to `2`:
  - `layer = 2:REDLINE`
  - `layer-color = #ff0000`
  - `layer-state = Shown / Open / Live / NoPrint / Construction`
  - `color-source = TRUECOLOR`
- after debug-locking layer `2`:
  - quicklook badge `layer-locked = Locked`
  - quicklook `layer-state = Shown / Locked / Live / NoPrint / Construction`
  - property panel shows locked-layer note
  - editable inputs are absent
- after unlocking layer `2`:
  - editable inputs return

Expected diagnostics:

- `console_messages = []`
- `page_errors = []`

## Notes

- `editor_ui_flow_smoke.sh` was updated to assert the new `layer` quicklook field inside its synthetic provenance step.
- This step continues to reuse existing command-layer lock semantics rather than inventing a separate UI-only lock model.
