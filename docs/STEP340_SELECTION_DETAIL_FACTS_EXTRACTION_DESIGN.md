# Step340 Selection Detail Facts Extraction Design

## Goal

Extract selection detail-fact assembly out of `selection_presenter.js` into a dedicated helper module, so presenter keeps orchestration and public contract ownership while the large fact-building seam becomes isolated and testable.

## Why This Step

After Step339:

- shared selection meta helpers already live in `selection_meta_helpers.js`
- `selection_badges.js` and `selection_overview.js` no longer depend back on presenter internals
- `selection_presenter.js` still owns one large assembly seam: `buildSelectionDetailFacts(...)`

That function remains the highest-density formatting block in the presenter path. It mixes:

- entity/style formatting
- source-group and insert-group summaries
- released archive summaries
- source text guide facts
- layer/style/source provenance facts

This is now the cleanest remaining narrow seam in the selection presenter area.

## Problem

`selection_presenter.js` still directly owns:

- `buildSelectionDetailFacts(...)`
- `buildMultiSelectionDetailFacts(...)`

These functions are presentation assembly helpers, not presenter coordination logic. They are large enough that keeping them inline makes the presenter harder to review and increases the cost of later focused changes around property metadata and selection summaries.

## Design

Introduce a dedicated helper module:

- `tools/web_viewer/ui/selection_detail_facts.js`

Move the detail-fact assembly there:

- export `buildSelectionDetailFacts(entity, options = {})`
- export `buildMultiSelectionDetailFacts(entities, options = {})`

Then update:

- `selection_presenter.js`

to import these helpers and continue re-exporting `buildSelectionDetailFacts(...)` so the presenter public contract stays stable.

`buildSelectionPresentation(...)` should keep using the same behavior:

- single selection -> `buildSelectionDetailFacts(...)`
- multiple selection -> `buildMultiSelectionDetailFacts(...)`

## Boundaries

This step must not change:

- `buildSelectionPresentation(...)` public behavior
- `buildSelectionDetailFacts(...)` public behavior
- `buildPropertyMetadataFacts(...)` output ordering or semantics
- `selection_badges.js` behavior
- `selection_overview.js` behavior
- property panel rendering behavior

Do not:

- refactor `buildPropertyMetadataFacts(...)` in the same step
- refactor note-plan or action-context logic
- change fact ordering, labels, keys, values, or swatch behavior
- change `selection_meta_helpers.js`

## Test Plan

Add:

- `tools/web_viewer/tests/selection_detail_facts.test.js`

Cover at least:

- single-entity detail facts for origin/layer/effective-color/style facts
- source-group or insert-group aggregation facts
- source text guide / anchor facts
- multi-selection released archive facts

Keep existing integration assertions unchanged in:

- `editor_commands.test.js`
- property panel selection/presentation tests
- property panel shell renderer tests

## Expected Outcome

- `selection_presenter.js` becomes more focused on public selection contract assembly
- detail-fact assembly is isolated in a first-class helper module
- future property metadata extraction has a clearer seam
