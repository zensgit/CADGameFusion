# Step345 Property Panel Note Plan Extraction Design

## Goal

Extract `buildPropertyPanelNotePlan(...)` from
`tools/web_viewer/ui/selection_presenter.js` into a dedicated helper module while
keeping behavior unchanged.

Suggested new module:

- `tools/web_viewer/ui/property_panel_note_plan.js`

## Why This Seam

After Step344, `selection_presenter.js` already delegates the three note builders to
`property_panel_note_helpers.js`.

What remains in `buildPropertyPanelNotePlan(...)` is now a narrow orchestration layer:

- normalize `entities`
- read `getLayer` and `actionContext`
- compute read-only / locked counts
- derive direct-edit allowances
- stitch the final note plan object

This is the cleanest next seam because:

- it continues to shrink `selection_presenter.js`
- it does not require touching `buildSelectionPresentation(...)`
- it builds directly on Step344 without broadening scope

## Required Scope

Move only:

- `buildPropertyPanelNotePlan(...)`

into the new helper module.

`selection_presenter.js` must continue to re-export it so the public contract stays stable.

## Allowed Private Helper Movement

If needed, the new helper may also own only the minimal private support it uses, such as:

- note-plan-only read-only / locked count helpers
- note-plan-only direct-edit gating helpers

Do not move broader presenter helpers unless they are strictly required.

## Explicit Non-Goals

Do not change:

- `buildPropertyPanelReadOnlyNote(...)`
- `buildPropertyPanelReleasedArchiveNote(...)`
- `buildPropertyPanelLockedLayerNote(...)`
- `buildSelectionPresentation(...)`
- `buildSelectionActionContext(...)`
- `buildPropertyMetadataFacts(...)`
- `buildSelectionContract(...)`
- `buildSelectionDetailFacts(...)`

Do not change:

- note wording
- note plan object shape
- `blocksFurtherEditing` semantics
- `allowDirectSourceTextEditing` semantics
- `allowDirectInsertTextEditing` semantics
- `allowInsertTextPositionEditing` semantics

## Dependency Rules

The new module must not import `selection_presenter.js`.

Preferred dependency direction:

- `property_panel_note_plan.js` imports from:
  - `property_panel_note_helpers.js`
  - `insert_group.js`
  - `selection_meta_helpers.js`
  - any tiny local private helpers needed for counting or gating
- `selection_presenter.js` imports/re-exports from `property_panel_note_plan.js`

No new cycle back into `selection_presenter.js` is allowed.

## Testing Expectations

Add a focused test file for the new helper module, covering at least:

- fully read-only single source-text proxy enables direct source-text edit
- fully read-only single insert text proxy enables direct insert-text edit
- fully read-only lock-positioned insert text proxy keeps position editing disabled
- fully locked selection sets locked `blocksFurtherEditing`
- mixed read-only / editable selection keeps read-only note text but does not block all editing

Keep existing integration assertions unchanged, especially:

- `tools/web_viewer/tests/property_panel_render_state.test.js`
- `tools/web_viewer/tests/editor_commands.test.js`

## Done Criteria

Step345 is done when:

1. `buildPropertyPanelNotePlan(...)` lives in its own helper module
2. `selection_presenter.js` only imports/re-exports it
3. no new dependency cycle exists
4. focused tests pass
5. existing integration tests continue to pass unchanged
