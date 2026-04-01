# Step339 Selection Meta Helpers Design

## Goal

Extract the shared selection meta helpers out of `selection_presenter.js` into a dedicated helper module, so that `selection_badges.js`, `selection_overview.js`, and `property_panel_selection_shell_renderers.js` no longer import presenter internals.

## Why This Step

After Step337 and Step338:

- badge assembly already lives in `selection_badges.js`
- overview text already lives in `selection_overview.js`
- selection shell rendering already consumes some presenter helpers

But these extracted modules still depend back on `selection_presenter.js` for shared helper behavior, which leaves an avoidable cycle in the presenter graph.

Today the dependency shape is effectively:

- `selection_presenter.js` -> `selection_badges.js`
- `selection_presenter.js` -> `selection_overview.js`
- `selection_badges.js` -> `selection_presenter.js`
- `selection_overview.js` -> `selection_presenter.js`

That is the cleanest remaining architectural debt in this area, and it is more valuable to remove than continuing to micro-split presenter entrypoints.

## Problem

`selection_presenter.js` still owns helper behavior that has become shared infrastructure:

- `isReadOnlySelectionEntity(...)`
- `describeReadOnlySelectionEntity(...)`
- `describeSelectionOrigin(...)`
- `formatSelectionLayer(...)`
- `formatSelectionLayerColor(...)`
- `listSelectionLayerFlags(...)`
- `formatSelectionLayerFlags(...)`
- `formatSelectionLayerState(...)`

These are no longer presenter-only concerns. They are cross-cutting formatting/selection-meta helpers.

## Design

Introduce a dedicated helper module:

- `tools/web_viewer/ui/selection_meta_helpers.js`

Move the shared helper implementations there.

Then update:

- `selection_presenter.js`
- `selection_badges.js`
- `selection_overview.js`
- `property_panel_selection_shell_renderers.js`
- any other direct helper consumers in this area

to import from `selection_meta_helpers.js` instead of back-importing through `selection_presenter.js`.

`selection_presenter.js` should continue to re-export the moved helpers so its public surface remains stable.

## Boundaries

This step must not change:

- helper behavior
- helper export names
- `selection_presenter.js` public contract
- badge behavior
- overview text behavior
- detail fact generation
- property panel rendering behavior

This step is explicitly about dependency cleanup, not semantics.

## Test Plan

Add:

- `tools/web_viewer/tests/selection_meta_helpers.test.js`

Cover at least:

- read-only detection
- origin formatting with and without read-only suffix
- layer formatting with named and unnamed layers
- layer state flag collection and combined state formatting

Keep existing integration assertions unchanged in:

- `editor_commands.test.js`
- selection overview tests
- selection badges tests
- property panel selection shell tests

## Expected Outcome

- helper cycles around `selection_presenter.js` are removed
- extracted presenter-side helpers become first-class shared infrastructure
- `selection_presenter.js` becomes more clearly centered on contract/detail-fact/note assembly rather than generic formatting helpers
