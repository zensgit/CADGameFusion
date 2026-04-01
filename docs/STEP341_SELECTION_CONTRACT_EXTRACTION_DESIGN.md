# Step341: Selection Contract Extraction

## Goal

Extract `buildSelectionContract(...)` from `tools/web_viewer/ui/selection_presenter.js`
into a dedicated helper module while keeping behavior and public exports unchanged.

## Why This Step

After Steps 337-340, `selection_presenter.js` still owns several distinct concerns:

- selection contract assembly
- property metadata facts
- selection action context
- property panel note planning
- final selection presentation assembly

`buildSelectionContract(...)` is now the narrowest remaining seam with a clear,
standalone contract and existing integration coverage.

## Scope

In scope:

- Create a new helper module for selection contract assembly
- Move the implementation of `buildSelectionContract(...)` into that module
- Keep `selection_presenter.js` importing and re-exporting `buildSelectionContract(...)`
- Add focused tests for the new helper module

Out of scope:

- `buildPropertyMetadataFacts(...)`
- `buildSelectionActionContext(...)`
- property panel note builders
- `buildSelectionPresentation(...)`
- any behavior change in summary text, note text, row ordering, or row semantics

## Target Files

Expected new file:

- `tools/web_viewer/ui/selection_contract.js`

Expected touched files:

- `tools/web_viewer/ui/selection_presenter.js`
- `tools/web_viewer/tests/selection_contract.test.js`

## Required Behavior

The extracted helper must preserve all current `buildSelectionContract(...)` behavior:

- same public return shape
- same `mode` classification
- same `summaryText`
- same `note` text
- same `readOnly` encoding
- same row keys, labels, values, and ordering
- same released insert archive handling for multi-selection
- same single-selection layer/color/style/origin behavior

`selection_presenter.js` must continue exporting `buildSelectionContract(...)`
so downstream imports do not change.

## Dependency Rules

The new helper may import from existing leaf/shared modules, but must not create
new cycles back into `selection_presenter.js`.

In particular:

- `selection_contract.js` must not import from `selection_presenter.js`
- if shared helpers are needed, import them from leaf modules directly

## Acceptance

Step341 is complete when:

1. `buildSelectionContract(...)` lives outside `selection_presenter.js`
2. `selection_presenter.js` re-exports it without behavior drift
3. focused helper tests cover empty / single / multi / released-archive cases
4. existing integration tests remain green
