# STEP204 Editor Linetype Scale Provenance Design

## Scope

This step closes the next style-contract gap after Step203:

- `lineTypeScale` now carries explicit/default provenance instead of existing as a bare number
- property/selection UI shows that provenance directly
- property editing can restore `lineTypeScale` to the default state
- CADGF export omits `line_type_scale` when the editor state is default, even if the runtime value is `1`

The intended behavior matches the benchmark expectation for object/default linetype scale more closely than a naive “always write 1.0” exporter.

## Problem

Before this step:

- the editor tracked `lineTypeScale` only as a numeric value
- import normalized missing `line_type_scale` to `1`
- export always wrote `line_type_scale`, even when the user had not explicitly authored it
- property/selection UI could show the scale value, but not whether it came from imported explicit data or from the default drafting state

That left two quality gaps:

- the editor could not distinguish “default 1” from “explicit 1”
- users could not clear an imported explicit scale back to the default authored state

This is weaker than the benchmark workflow. AutoCAD-like tools treat object linetype scale as a state that can be default or explicitly authored; they do not needlessly persist default scale as if it were an override.

## Design

### 1. Add an internal explicit/default source contract

- `tools/web_viewer/state/documentState.js`
  - entity style normalization now tracks:
    - `lineTypeScale`
    - `lineTypeScaleSource`
  - supported source values are:
    - `DEFAULT`
    - `EXPLICIT`
- `tools/web_viewer/line_style.js`
  - `resolveEntityStyleSources(...)` now includes `lineTypeScaleSource`

Normalization rules:

- imported or restored entities with raw `line_type_scale` become `EXPLICIT`
- tool-created entities default to `lineTypeScale = 1` and `lineTypeScaleSource = DEFAULT`
- property/command edits that touch `lineTypeScale` become `EXPLICIT` unless the caller explicitly resets the source to `DEFAULT`

This keeps the contract additive and editor-internal. No new public CADGF schema field is invented.

### 2. Property/UI exposes and recovers scale provenance

- `tools/web_viewer/ui/selection_presenter.js`
  - adds `line-type-scale-source`
- `tools/web_viewer/ui/property_panel.js`
  - mirrors `Line Type Scale Source`
  - renames the editable field to `Line Type Scale Override`
  - adds `Use Default Line Type Scale`
- `tools/web_viewer/ui/workspace.js`
  - `ltscale` / `linetypescale` command input now marks the edited value as `EXPLICIT`

The important design choice is:

- `lineTypeScale` is not treated as `BYLAYER`
- recovery is to `DEFAULT`, not to a layer-derived state

That matches the benchmark/reference understanding better than inventing a layer-scale inheritance model that the product does not actually support.

### 3. Export follows authored intent, not normalized runtime defaults

- `tools/web_viewer/adapters/cadgf_document_adapter.js`
  - import marks raw `line_type_scale` presence as `EXPLICIT`
  - export writes `line_type_scale` only when the source is `EXPLICIT`
  - export omits `line_type_scale` when the source is `DEFAULT`
  - base-entity finalize logic was already tightened in Step203, so omission now survives roundtrip cleanup cleanly

This is the core persistence rule for Step204:

- runtime effective value can still be `1`
- export should only persist `line_type_scale: 1` when the user explicitly authored it

### 4. Debug/browser fallback paths stay aligned

- `tools/web_viewer/tools/tool_context.js`
- `tools/web_viewer/scripts/editor_current_layer_smoke.js`
- `tools/web_viewer/scripts/editor_layer_session_smoke.js`

All draft-entity creation paths now emit `lineTypeScaleSource = DEFAULT`.

That matters because the browser smokes use both:

- real UI creation
- debug fallback creation when a click does not materialize quickly enough

If those paths diverged, the gate would again test two different contracts.

## Behavior Contract

- imported explicit scale:
  - `lineTypeScaleSource = EXPLICIT`
  - `line_type_scale` survives export
- drafted default scale:
  - `lineTypeScale = 1`
  - `lineTypeScaleSource = DEFAULT`
  - `line_type_scale` is omitted on export
- property editing:
  - changing `Line Type Scale Override` makes the source `EXPLICIT`
  - `Use Default Line Type Scale` resets source to `DEFAULT`
- selection/property inspection:
  - show both value and source

## Scope Limits

This step intentionally does not do the following:

- no `BYLAYER` linetype-scale inheritance
- no `BYBLOCK` scale engine
- no attempt to solve the harder `lineWeight` sentinel/provenance ambiguity beyond the existing editor rule

So Step204 closes linetype-scale provenance honestly without claiming broader style-inheritance parity than the code actually implements.

## Benchmark Intent

Step204 improves the editor in a way benchmark users will actually feel:

- closer to AutoCAD/BricsCAD object/default scale behavior
- cleaner than always serializing `line_type_scale = 1`
- easier to inspect and recover than code/reference paths that only expose the numeric value

The key improvement is that the editor now distinguishes authored scale from normalized default scale, and preserves that distinction through UI, runtime state, and export.
