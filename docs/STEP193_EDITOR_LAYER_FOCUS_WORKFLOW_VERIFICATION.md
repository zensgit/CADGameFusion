# STEP193 Editor Layer Focus Workflow Verification

## Scope

This verification closes the layer-focus recovery workflow introduced in Step193:

- selection-driven layer focus in the layer panel
- property-context `Locate Layer`
- property-context `Unlock Layer`
- live recovery from locked-layer edit blocking

## Static Checks

Executed from repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer/ui/layer_panel.js
node --check deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
node --check deps/cadgamefusion/tools/web_viewer/ui/workspace.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
bash -n deps/cadgamefusion/tools/web_viewer/scripts/editor_ui_flow_smoke.sh
git -C deps/cadgamefusion diff --check
```

Result: PASS.

## Node Regression

Executed:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Result: `173 / 173 PASS`.

This step is mostly browser/UI wiring, so Node coverage is treated as non-regression validation rather than the primary acceptance mechanism.

## Browser Verification

Executed:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
```

Artifact:

- `build/editor_selection_summary_smoke/20260322_165259/summary.json`

Result: PASS.

Observed browser facts:

- before layer edit:
  - selection quicklook `layer = 1:PLOT`
  - layer panel `focusedLayerId = 1`
  - property actions: `locate-layer`
- after `Layer ID -> 2`:
  - selection quicklook `layer = 2:REDLINE`
  - selection quicklook `layer-state = Shown / Open / Live / NoPrint / Construction`
  - layer panel `focusedLayerId = 2`
  - property actions: `locate-layer`
- after debug-locking layer `2`:
  - quicklook badge `layer-locked = Locked`
  - property note appears
  - property actions: `locate-layer`, `unlock-layer`
  - property inputs disappear
- after clicking property `Unlock Layer`:
  - quicklook `layer-state` returns to `Shown / Open / Live / NoPrint / Construction`
  - property inputs return
  - `unlock-layer` action disappears
  - layer panel remains focused on layer `2`

Observed final status message:

- `Layer REDLINE lock: Off`

Browser diagnostics:

- `console_messages = []`
- `page_errors = []`
- `ok = true`

## Lightweight UI-flow Guard

`tools/web_viewer/scripts/editor_ui_flow_smoke.sh` was updated with a lightweight assertion:

- in the synthetic selection provenance step, the focused layer row must track the selected entity's layer before and after `Layer ID` edits

This keeps the long smoke protected without making it responsible for the full lock/unlock acceptance path.

## Notes

- The dedicated selection-summary smoke remains the primary acceptance path for this step because it directly exercises the new layer-focus workflow and avoids unrelated instability later in the long smoke chain.
