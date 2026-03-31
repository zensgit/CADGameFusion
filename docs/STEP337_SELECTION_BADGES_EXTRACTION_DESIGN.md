# Step337 Selection Badges Extraction Design

## Goal

Extract selection badge assembly from `selection_presenter.js` into a dedicated helper module, without changing `buildSelectionPresentation(...)`, badge order, badge keys, or badge text.

## Why This Step

After Step336:

- `property_panel_selection_context.js` is already a thin wrapper
- `property_panel_render.js` is already a thin entrypoint
- the remaining heavy selection-oriented monolith is `selection_presenter.js`

Within that file, `buildSelectionBadges(...)` is now the narrowest clean seam:

- it is self-contained
- it already has a stable public output contract
- it is consumed by `buildSelectionPresentation(...)`
- it does not require touching `detailFacts` generation

That makes it a better next step than forcing more micro-splits inside `property_panel_selection_context.js`.

## Problem

`selection_presenter.js` still directly owns badge assembly for both:

- single selection badge composition
- multiple selection read-only badge composition

This keeps `buildSelectionPresentation(...)` coupled to one more presentation subdomain than necessary, and keeps badge-specific behavior embedded in the large presenter file.

## Design

Introduce a dedicated helper module:

- `tools/web_viewer/ui/selection_badges.js`

Move badge assembly there, including the existing single/multiple branching behavior.

The extracted helper should continue to expose the same behavioral contract as today:

- empty selection returns `[]`
- single selection emits:
  - `type`
  - `layer`
  - `space`
  - `layout` when present
  - `color-source`
  - layer state flags
  - `read-only` when needed
- multi-selection emits only the read-only aggregate badge when applicable

`selection_presenter.js` should then:

1. import the badge helper
2. keep exporting `buildSelectionBadges(...)` from the same public module surface
3. keep `buildSelectionPresentation(...)` behavior unchanged

## Boundaries

This step must not change:

- `buildSelectionPresentation(...)` public contract
- `buildSelectionBadges(...)` public behavior
- badge order
- badge key names
- badge labels, values, or tones
- `buildSelectionDetailFacts(...)`
- `formatSelectionSummary(...)`
- `formatSelectionStatus(...)`
- property panel selection context / shell / render wiring

This step should not introduce new presenter semantics. It is an extraction only.

## Test Plan

Add:

- `tools/web_viewer/tests/selection_badges.test.js`

Cover at least:

- empty selection returns no badges
- single selection preserves badge order and layer-state badges
- single read-only selection emits the `read-only` badge
- multi-selection preserves aggregated read-only badge behavior

Keep existing integration assertions in `editor_commands.test.js` unchanged.

## Expected Outcome

- `selection_presenter.js` gets thinner at a real semantic seam
- badge behavior becomes unit-testable without depending on the whole presenter file
- the next presenter cleanup can target summary/status or detail-fact orchestration separately, without reopening badge logic
