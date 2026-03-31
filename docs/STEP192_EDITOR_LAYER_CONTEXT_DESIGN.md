# STEP192 Editor Layer Context Design

## Background

Step190 and Step191 already made editor-side provenance and quicklook honest for:

- origin
- effective color
- color source / color ACI
- space / layout
- line style

The remaining UX gap was layer context.

Compared with `AutoCAD LT / BricsCAD / DraftSight`, VemCAD already knew more about an entity than the UI exposed:

- exact `layerId`
- layer `name`
- layer flags: `locked / printable / frozen / construction`

But the editor still forced the user to infer layer semantics indirectly from the separate layer panel or from failed property edits.

## Product Goal

For a single selected entity, the user should immediately see:

- which layer the entity belongs to
- whether the layer is in a non-default state
- whether the current selection is editable right now

The property panel should stop offering futile edits when the selected entity is on a locked layer.

## Benchmark Direction

This step intentionally does not mimic benchmark products pixel-for-pixel.

- `AutoCAD`-class products are strong on layer workflows, but layer state often has to be inferred from dispersed UI panels.
- `LibreCAD` keeps layer editing simple, but selection explainability remains relatively thin.

VemCAD can surpass them in one narrow but high-value place: make selection quicklook and property editing layer-aware without inventing any new DWG semantics.

## Non-goals

- No new importer/exporter schema.
- No inferred provenance for line type or line weight sources.
- No merged multi-select layer contract beyond the already safe summary.
- No change to command-layer lock semantics; `selection.propertyPatch` remains the authority.

## Design

### 1. Shared layer-aware presentation

Extend `tools/web_viewer/ui/selection_presenter.js` so the shared selection contract can accept a `getLayer(layerId)` resolver.

This resolver is used to derive:

- `Layer` identity as `id:name`
- `Layer Color`
- `Layer State` as a normalized current-state string
- badge chips for:
  - layer identity
  - `Locked`
  - `NoPrint`
  - `Construction`

Quicklook facts intentionally expose the full current layer state, while badges stay selective and only call out exceptional states.

### 2. Quicklook additions

The single-selection quicklook under `#cad-selection-details` now includes:

- fact row: `layer`
- fact row: `layer-color`
- fact row: `layer-state`
- badge: `layer`
- state badges for exceptional layer states

This keeps provenance, effective style, and operational editability in one place.

### 3. Property guardrails

`tools/web_viewer/ui/property_panel.js` now joins selected entities to `DocumentState.getLayer()`.

Behavior:

- if all selected entities are on locked layers, show an explicit note and do not render editable inputs
- if selection is mixed, show a note that locked-layer entities will be skipped
- single-select metadata continues to render, so the panel stays informative even when editing is blocked

This aligns the UI with the already-existing `selection.propertyPatch` lock behavior instead of waiting for the user to discover it via a failed command.

### 4. Browser contract

The stable DOM contract from Step191 remains the authority:

- `#cad-selection-details`
- `data-selection-field="layer"`
- `data-selection-field="layer-color"`
- `data-selection-field="layer-state"`
- `data-selection-badge="layer"`
- `data-selection-badge="layer-locked"`
- `data-selection-badge="layer-noprint"`
- `data-selection-badge="layer-construction"`

The property panel continues to expose stable metadata rows through `data-property-info`.

## Files

- `tools/web_viewer/ui/selection_presenter.js`
- `tools/web_viewer/ui/property_panel.js`
- `tools/web_viewer/style.css`
- `tools/web_viewer/scripts/editor_selection_summary_smoke.js`
- `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- `tools/web_viewer/tests/fixtures/editor_selection_summary_fixture.json`
- `tools/web_viewer/tests/editor_commands.test.js`
- `tools/web_viewer/README.md`

## Acceptance Criteria

- single-select quicklook shows `Layer` identity
- quicklook shows `Layer Color` and normalized `Layer State`
- changing `Layer ID` updates quicklook layer identity, color, and state immediately
- locking the selected layer updates quicklook and blocks property inputs without changing command semantics
- browser smoke verifies imported path, layer change, and locked-layer guardrail in a real browser
