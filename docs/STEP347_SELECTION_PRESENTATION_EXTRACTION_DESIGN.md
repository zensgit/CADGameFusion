# Step347 Selection Presentation Extraction Design

## Goal

Extract `buildSelectionPresentation(...)` from
`tools/web_viewer/ui/selection_presenter.js` into a dedicated helper module while
keeping behavior unchanged.

Suggested new module:

- `tools/web_viewer/ui/selection_presentation.js`

## Why This Seam

After Step346, `selection_presenter.js` is already a thin facade. The only
substantial remaining entrypoint logic is:

- `buildSelectionPresentation(...)`

That function now acts as a narrow composition layer over:

- `formatSelectionSummary(...)`
- `formatSelectionStatus(...)`
- `buildSelectionBadges(...)`
- `buildSelectionDetailFacts(...)`
- `buildMultiSelectionDetailFacts(...)`

This is the cleanest next seam because:

- it completes the presenter thinning work without broadening scope
- it leaves `supportsInsertTextPositionEditing(...)` untouched
- it avoids changing downstream callers, since `selection_presenter.js` can keep
  re-exporting the extracted function

## Required Scope

Move only:

- `buildSelectionPresentation(...)`

into the new helper module.

`selection_presenter.js` must continue to re-export it so the public contract stays
stable.

## Allowed Private Helper Movement

If needed, the new helper may also own only the minimal private support it uses,
such as:

- presentation-only primary resolution
- presentation-only `getLayer` / `primaryLayer` resolution

If `resolveLayer(...)` is only needed by the extracted function after the move, it
should move with it or become private to the new helper.

## Explicit Non-Goals

Do not change:

- `supportsInsertTextPositionEditing(...)`
- any existing re-export besides rewiring `buildSelectionPresentation(...)`
- `selection_badges.js`
- `selection_overview.js`
- `selection_detail_facts.js`
- `selection_contract.js`
- `property_metadata_facts.js`
- `selection_action_context.js`
- `property_panel_note_helpers.js`
- `property_panel_note_plan.js`

Do not change:

- summary text
- status text
- badge order or badge content
- detail fact ordering or semantics
- `primary` selection fallback behavior
- `primaryLayer` resolution behavior
- `mode` / `entityCount` semantics

## Dependency Rules

The new module must not import `selection_presenter.js`.

Preferred dependency direction:

- `selection_presentation.js` imports from:
  - `selection_overview.js`
  - `selection_badges.js`
  - `selection_detail_facts.js`
  - any tiny private helper it needs for layer resolution
- `selection_presenter.js` imports/re-exports from `selection_presentation.js`

No new cycle back into `selection_presenter.js` is allowed.

## Testing Expectations

Add a focused test file for the new helper module, covering at least:

- empty selection returns `mode=empty`, `entityCount=0`, and `primary=null`
- single selection uses the requested primary and resolves `primaryLayer`
- single selection falls back to the first entity when `primaryId` misses
- multi selection returns `mode=multiple`
- single selection uses `buildSelectionDetailFacts(...)`
- multi selection uses `buildMultiSelectionDetailFacts(...)`

Keep existing integration assertions unchanged, especially:

- `tools/web_viewer/tests/editor_commands.test.js`

## Done Criteria

Step347 is done when:

1. `buildSelectionPresentation(...)` lives in its own helper module
2. `selection_presenter.js` only imports/re-exports it
3. no new dependency cycle exists
4. focused tests pass
5. existing integration tests continue to pass unchanged
