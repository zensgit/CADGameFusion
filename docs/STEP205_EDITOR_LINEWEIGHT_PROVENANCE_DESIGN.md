# STEP205 Editor Lineweight Provenance Design

## Scope

This step closes the next style-contract gap after Step204:

- `lineWeight` now carries explicit `BYLAYER/EXPLICIT` provenance in editor state
- selection/property UI keeps explicit `lineWeight=0` visible instead of collapsing it into the inherited layer value
- property editing and command input make lineweight authorship explicit
- CADGF export omits `line_weight` only for true `BYLAYER` state, while preserving explicit `0`

The intended behavior is closer to benchmark editors than a heuristic "non-zero means explicit" rule.

## Problem

Before this step:

- the editor inferred lineweight source mostly from the numeric value
- `lineWeight=0` was ambiguous:
  - it could mean "inherit from layer"
  - or it could mean "explicitly authored zero"
- selection/property UI hid `line-weight` when the effective value resolved to zero unless another non-zero clue kept it visible
- export could accidentally erase an explicit zero or preserve stale explicit data after a restore-to-layer action

That was weaker than the benchmark expectation. AutoCAD-like tools distinguish object-authored lineweight from layer-derived lineweight even when the authored value is zero-equivalent.

## Design

### 1. Add an internal `BYLAYER/EXPLICIT` lineweight source contract

- `tools/web_viewer/state/documentState.js`
  - entity style normalization now tracks `lineWeightSource`
- `tools/web_viewer/line_style.js`
  - `resolveEntityStyleSources(...)` now normalizes and returns `lineWeightSource`
  - `resolveEffectiveEntityStyle(...)` now resolves lineweight using source first, not magnitude heuristics

Normalization rules:

- imported or restored entities with raw `line_weight` become `EXPLICIT`
- tool-created entities default to `lineWeight = 0` and `lineWeightSource = BYLAYER`
- property/command edits that touch `lineWeight` become `EXPLICIT` unless the caller explicitly resets the source to `BYLAYER`

This keeps the contract editor-internal and additive. No new CADGF schema field is invented.

### 2. Drafting and editing paths keep authored intent

- `tools/web_viewer/tools/tool_context.js`
  - draft entities now default to `lineWeightSource = BYLAYER`
- `tools/web_viewer/ui/property_panel.js`
  - editing `lineWeight` emits `lineWeightSource = EXPLICIT`
  - `Use Layer Line Weight` resets the source to `BYLAYER`
- `tools/web_viewer/ui/workspace.js`
  - `lineweight` command input also emits `lineWeightSource = EXPLICIT`

The important design choice is:

- raw drafted `lineWeight = 0` is not treated as an authored zero override
- explicit authorship is carried by source, not guessed from the numeric payload

That is stricter and more explainable than continuing to overload the sentinel value.

### 3. Selection/property UI must expose explicit zero honestly

- `tools/web_viewer/ui/selection_presenter.js`
  - keeps `line-weight` visible when `lineWeightSource = EXPLICIT`, even if the value is `0`
- `tools/web_viewer/ui/property_panel.js`
  - mirrors the same rule in metadata rows
  - keeps `Line Weight Source` visible

This is the benchmark-quality detail that matters most in real use:

- `BYLAYER + effective 0.35` should read as inherited
- `EXPLICIT + 0` should still read as a real override

Without that distinction, the UI looks stable until a user tries to reason about why a line prints differently after layer edits.

### 4. Export follows authored intent, not normalized runtime values

- `tools/web_viewer/adapters/cadgf_document_adapter.js`
  - import marks raw `line_weight` presence as `EXPLICIT`
  - export omits `line_weight` when the source is `BYLAYER`
  - export preserves `line_weight: 0` when the source is `EXPLICIT`

This is the core persistence rule for Step205:

- runtime raw value may still be `0`
- export must look at source, not just at the numeric value

That prevents both classes of bug:

- accidentally dropping explicit zero
- accidentally preserving stale lineweight after `Use Layer Line Weight`

### 5. Browser smokes must force a real explicit-zero transition

- `tools/web_viewer/scripts/editor_selection_summary_smoke.js`
  - now drives `0.1 -> 0` when testing explicit zero
- `tools/web_viewer/scripts/editor_current_layer_smoke.js`
- `tools/web_viewer/scripts/editor_layer_session_smoke.js`
  - both assert drafted/fallback entities stay `BYLAYER`

The `0.1 -> 0` transition is intentional. After a restore-to-layer action the form value is already `0`, so typing `0` again is a UI no-op. The smoke now verifies authored intent instead of depending on a fragile same-value blur path.

## Behavior Contract

- imported explicit lineweight:
  - `lineWeightSource = EXPLICIT`
  - `line_weight` survives export, including `0`
- drafted default lineweight:
  - `lineWeight = 0`
  - `lineWeightSource = BYLAYER`
  - `line_weight` is omitted on export
- property/command editing:
  - changing lineweight makes the source `EXPLICIT`
  - `Use Layer Line Weight` resets source to `BYLAYER`
- selection/property inspection:
  - show both lineweight value and source
  - keep explicit `0` visible as an authored override

## Scope Limits

This step intentionally does not do the following:

- no `BYBLOCK` lineweight provenance
- no DXF sentinel remapping beyond the current editor contract
- no separate plot-style or CTB/STB simulation

So Step205 closes lineweight authorship honestly without claiming full DWG plotting parity.

## Benchmark Intent

Step205 improves the editor in a way benchmark users will actually notice:

- closer to AutoCAD/BricsCAD object-vs-layer lineweight reasoning
- stronger than lightweight viewers that only show effective thickness
- more trustworthy in import/edit/export loops because explicit zero now survives as authored data

The key improvement is that the editor now treats lineweight as authored state plus effective value, not as a naked number with heuristic meaning.
