# STEP193 Editor Layer Focus Workflow Design

## Background

Step192 made layer context visible:

- `layer`
- `layer color`
- `layer state`
- locked-layer edit blocking

But the workflow still had a practical gap.

When the user selected an entity on a locked layer, the UI explained the problem but still required a manual hunt through the layer list to recover. That is weaker than real 2D drafting products, where the operative question is not just "can the system describe the layer?" but "can the user repair the layer state immediately from the current editing context?"

## Benchmark Reading

Compared with `AutoCAD`, `BricsCAD`, and `LibreCAD`, the missing piece was operational continuity:

- layer state exists
- selection knows the current layer
- property panel knows the current layer
- layer panel can already toggle lock state

What was missing was the wiring between those surfaces.

VemCAD can surpass the benchmark in one narrow but high-value place:

- selected entity automatically drives layer focus
- the matching layer row is visually located for the user
- a locked-layer dead end becomes a one-click recovery path

That is a better editing loop than forcing the user to manually cross-reference separate panes.

## Product Goal

For single selection, the editor should support this flow:

1. Select an entity.
2. See its current layer immediately highlighted in the layer panel.
3. If that layer is locked, use `Locate Layer` or `Unlock Layer` directly from the property context.
4. Recover property editing without leaving the current object context.

## Non-goals

- no schema expansion
- no new layer semantics
- no synthetic multi-layer merge model for mixed selection
- no separate UI-only lock model; layer actions must reuse the real `documentState.updateLayer()` path

## Design

### 1. Selection-driven layer focus

`tools/web_viewer/ui/workspace.js` derives a focused layer from the current primary selection:

- no selection: no focused layer
- single selection: selected entity layer
- multi-select same layer: that layer
- multi-select mixed layers: primary entity layer

This focus is derived live from selection/document state, not cached separately.

### 2. Layer panel focus surface

`tools/web_viewer/ui/layer_panel.js` now exposes a stable focused-row surface:

- `.cad-layer-item.is-focused`
- `data-layer-id`
- `data-focused`

Focused rows auto-scroll into view only when the focused layer changes, avoiding panel jitter during ordinary rerenders.

### 3. Property-context recovery actions

`tools/web_viewer/ui/property_panel.js` adds contextual actions:

- `Locate Layer`
- `Unlock Layer` when the focused layer is locked

These actions live alongside the locked-layer explanation and metadata. They do not invent new behavior; they route into the same workspace handlers used by the rest of the editor.

### 4. Single source of mutation

`Unlock Layer` does not locally mutate UI state. It calls the same layer update path as the layer panel:

- `documentState.updateLayer(layerId, { locked: false })`

This keeps:

- quicklook badges
- property metadata
- layer panel button labels
- property form availability

in sync via existing render flows.

## Files

- `tools/web_viewer/ui/layer_panel.js`
- `tools/web_viewer/ui/property_panel.js`
- `tools/web_viewer/ui/workspace.js`
- `tools/web_viewer/style.css`
- `tools/web_viewer/scripts/editor_selection_summary_smoke.js`
- `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- `tools/web_viewer/README.md`

## Acceptance Criteria

- selecting an entity highlights its layer row in the layer panel
- changing `Layer ID` moves focus to the new layer row
- locked-layer property context exposes `Locate Layer` and `Unlock Layer`
- clicking `Unlock Layer` restores property inputs without page reload
- quicklook `layer-state` and badges update immediately after unlock
- dedicated browser smoke verifies the full before/after/locked/unlocked flow
