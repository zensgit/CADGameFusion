# Step362: Selection Detail Pipeline Extraction

## Goal

Extract the remaining row-append sequencing from:

- `tools/web_viewer/ui/selection_detail_facts.js`

The purpose is to isolate the final single-selection detail pipeline so `selection_detail_facts.js` becomes a thin wrapper around:

- null guard
- context resolution
- pipeline execution

without changing any row keys, values, swatches, or ordering.

## Scope

In scope:

- Extract the single-selection append sequence for:
  - base facts
  - released archive identity rows
  - released archive attribute rows
  - source/insert group rows
  - released peer summary rows
  - line-style rows
  - source-text guide rows
- Keep the extracted helper cycle-safe.

Out of scope:

- `buildSelectionDetailContext(...)` behavior
- `buildMultiSelectionDetailFacts(...)` behavior
- any row helper behavior
- released archive selection rows
- line-style resolution
- source-text guide resolution

## Constraints

- Keep `buildSelectionDetailFacts(...)` public contract unchanged.
- Keep `buildSelectionDetailContext(...)` behavior unchanged.
- Preserve exact row order and omission behavior.
- Do not change group-vs-insert branching semantics.
- Do not change released peer summary semantics.
- Do not import `selection_presenter.js` from the new helper.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/selection_detail_pipeline.js`

Expected responsibility split:

- helper: append the final single-selection detail rows in the current order
- `selection_detail_facts.js`: null guard + context resolution + pipeline call

## Acceptance

Accept Step362 only if:

- `selection_detail_facts.js` no longer hand-assembles the single-selection row sequence
- output remains fact-for-fact compatible
- focused tests cover append order, insert/source branching, released peer passthrough, and source guide passthrough
- `editor_commands.test.js` stays green
- `git diff --check` stays clean
