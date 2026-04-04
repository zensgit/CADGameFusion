# Step348 Selection Editability Helpers Design

## Goal

Extract the duplicated insert-text editability and layer lookup helpers into a
shared leaf module, while keeping behavior unchanged.

Suggested new module:

- `tools/web_viewer/ui/selection_editability_helpers.js`

## Why This Seam

After Step347:

- `selection_presenter.js` still owns `supportsInsertTextPositionEditing(...)`
- `property_panel_note_helpers.js` contains its own copy of:
  - `supportsInsertTextPositionEditing(...)`
  - `resolveLayer(...)`
- `property_panel_note_plan.js` contains its own copy of:
  - `supportsInsertTextPositionEditing(...)`
  - `resolveLayer(...)`

This is the cleanest next seam because:

- it removes repeated logic without broadening behavior scope
- it lets `selection_presenter.js` become a pure facade
- it reduces future drift risk between note helpers, note plan, and presenter exports

## Required Scope

Move only the duplicated helper behavior into the shared module:

- `supportsInsertTextPositionEditing(entity)`
- a layer lookup helper equivalent to current `resolveLayer(getLayer, layerId)`

Then update:

- `selection_presenter.js`
- `property_panel_note_helpers.js`
- `property_panel_note_plan.js`

to import from the shared helper.

`selection_presenter.js` must continue to export
`supportsInsertTextPositionEditing(...)` so the public contract remains stable.

## Explicit Non-Goals

Do not change:

- `buildSelectionPresentation(...)`
- `buildPropertyPanelReadOnlyNote(...)`
- `buildPropertyPanelReleasedArchiveNote(...)`
- `buildPropertyPanelLockedLayerNote(...)`
- `buildPropertyPanelNotePlan(...)`
- any note wording
- any locked-layer semantics
- any direct source-text / insert-text gating semantics

Do not change:

- `selection_badges.js`
- `selection_detail_facts.js`
- `selection_contract.js`
- `property_metadata_facts.js`
- `selection_action_context.js`

## Dependency Rules

The new module must be a leaf helper.

Allowed direction:

- `selection_editability_helpers.js` imports from:
  - `insert_group.js`

- `selection_presenter.js`, `property_panel_note_helpers.js`,
  `property_panel_note_plan.js` import from it

The new helper must not import:

- `selection_presenter.js`
- `property_panel_note_helpers.js`
- `property_panel_note_plan.js`

No new cycle is allowed.

## Testing Expectations

Add a focused helper test file covering at least:

- `supportsInsertTextPositionEditing(...)` returns true for unlocked editable insert text proxies
- it returns false for lock-positioned insert text proxies
- it returns false for non-insert-text entities
- the layer lookup helper returns null for invalid ids / missing getter
- the layer lookup helper returns a layer object for valid getter/id pairs

Keep these integration guards unchanged:

- `tools/web_viewer/tests/property_panel_note_plan.test.js`
- `tools/web_viewer/tests/property_panel_note_helpers.test.js`
- `tools/web_viewer/tests/editor_commands.test.js`

## Done Criteria

Step348 is done when:

1. duplicated helper logic lives in `selection_editability_helpers.js`
2. `selection_presenter.js` becomes a pure facade with re-exported `supportsInsertTextPositionEditing(...)`
3. note helpers and note plan import the shared helper instead of owning duplicates
4. no new dependency cycle exists
5. focused and integration tests pass unchanged
