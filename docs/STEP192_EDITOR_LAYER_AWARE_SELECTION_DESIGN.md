# STEP192 Editor Layer-Aware Selection Design

## Background

Step190 made imported provenance honest in editor data.

Step191 made single-selection provenance visible in the `Selection` panel.

What was still missing was the layer contract that real 2D drafting users actually reason about while editing:

- which layer is this entity on right now?
- what is the current layer color versus the entity's effective color?
- is the layer locked, frozen, non-printing, or construction-only?
- if the layer is locked, why is the property form still inviting edits?

That gap mattered more than another isolated geometry tool because it sat directly on the critical path of everyday editing.

## Benchmark Reading

Against `AutoCAD LT/Web`, `BricsCAD Lite`, `DraftSight`, and `nanoCAD`, the missing piece was not basic layer support. The repo already had that in `DocumentState`.

The missing piece was **operator-facing explainability**:

- benchmark tools show current layer identity and flags, but imported provenance is usually still implicit
- VemCAD already knows more than those UIs expose:
  - `colorSource`
  - `colorAci`
  - `space / layout`
  - `lineType / lineWeight / lineTypeScale`
  - per-layer `visible / locked / frozen / printable / construction`

The opportunity is therefore to surpass the benchmark in one very specific way:

- keep the familiar 2D drafting layer model
- expose it beside provenance and effective style
- make the UI and command contract agree on what "locked" actually means

## Product Goal

For a single selected entity, the user should be able to answer these without reading the whole property form:

- what is the selected entity?
- where did it come from?
- what color is actually being drawn?
- what layer is it on?
- what is that layer's own color?
- what layer state is active right now?
- are edits blocked because the layer is locked?

The answer must stay stable across:

- imported CADGF content
- `Layer ID` edits
- imported `BYLAYER -> TRUECOLOR` promotion
- live layer lock/unlock changes

## Non-goals

- do not infer new provenance fields for line type or line weight
- do not change import/export schema in this step
- do not invent merged layer provenance for multi-select
- do not broaden hidden/frozen selection semantics beyond the already shipped filtering behavior

## Design

### 1. Layer-aware quicklook

`tools/web_viewer/ui/selection_presenter.js` becomes the single formatter for:

- `layer`
- `layer-color`
- `layer-state`
- layer-state badges for:
  - `Locked`
  - `Frozen`
  - `NoPrint`
  - `Construction`

Single-select quicklook now pairs:

- effective entity color
- layer color
- full layer state string

This makes `BYLAYER -> TRUECOLOR` promotion legible: after moving an imported entity to `REDLINE`, the quicklook can show that the entity still draws `#808080` while the new layer is `#ff0000`.

### 2. Stable DOM/state surface

`#cad-selection-details` keeps the Step191 hook model and extends it with layer state on the root dataset:

- `data-layer-id`
- `data-layer-name`
- `data-layer-locked`
- `data-layer-frozen`
- `data-layer-printable`
- `data-layer-construction`

This gives browser smoke a stable contract without scraping visual order.

### 3. Property panel metadata and guardrails

`tools/web_viewer/ui/property_panel.js` mirrors the same layer facts in read-only metadata rows:

- `Layer`
- `Layer Color`
- `Layer State`

When every selected entity is on locked layers, the property form stops offering editable inputs and shows a clear note instead of letting the user perform a doomed edit attempt.

This is intentionally closer to commercial drafting UX than "let the user type and fail later".

### 4. Command-layer lock correctness

The deeper issue was not only UI messaging.

Before this step, `selection.propertyPatch` and `DocumentState.updateEntity()` only treated the **target** layer lock as authoritative. That created a semantic hole where an entity on a locked layer could still be moved off that layer by changing `Layer ID`.

Step192 closes that hole:

- current locked layer blocks the patch
- target locked layer also blocks the patch

That makes the command contract, property panel, and quicklook agree on the same editing truth.

## Files

- `tools/web_viewer/ui/selection_presenter.js`
- `tools/web_viewer/ui/property_panel.js`
- `tools/web_viewer/state/documentState.js`
- `tools/web_viewer/commands/command_registry.js`
- `tools/web_viewer/scripts/editor_selection_summary_smoke.js`
- `tools/web_viewer/tests/fixtures/editor_selection_summary_fixture.json`
- `tools/web_viewer/tests/editor_commands.test.js`
- `tools/web_viewer/README.md`

## Acceptance Criteria

- single-select quicklook shows `layer / layer color / layer state`
- quicklook badges surface non-default layer states without guessing
- property metadata mirrors the same layer facts
- locking the selected layer hides property inputs and shows a blocking note
- changing `Layer ID` updates quicklook and property metadata immediately
- imported `BYLAYER` color promotion remains explicit after layer change
- `selection.propertyPatch` cannot move entities off locked current layers
- dedicated browser smoke validates before/after/locked/unlocked states on the real editor path
