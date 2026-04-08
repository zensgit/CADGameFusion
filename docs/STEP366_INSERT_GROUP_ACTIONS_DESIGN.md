# Step366: Insert Group Actions Extraction

## Goal

Extract the insert-group action builder from:

- `tools/web_viewer/ui/property_panel_group_actions.js`

The purpose is to isolate insert peer navigation, insert-group selection, editable-member selection, fit, edit, and release actions without changing labels, ids, invoke wiring, failure messages, or action ordering.

## Scope

In scope:

- Extract `buildInsertGroupActions(...)`
- Keep insert peer navigation action assembly unchanged
- Keep insert text / editable text / editable member selection action assembly unchanged
- Keep fit / release-and-edit / release actions unchanged

Out of scope:

- `buildSourceGroupActions(...)`
- `buildReleasedInsertArchiveActions(...)`
- `pushAction(...)`
- property panel branch wiring
- property panel glue wiring

## Constraints

- Keep `buildInsertGroupActions(...)` public contract unchanged.
- Preserve exact action ids, labels, invoke arguments, failure messages, and action ordering.
- Preserve current gating for:
  - missing entity
  - missing insert summary
  - peer target count
  - `peerNavigableSelection`
  - selectionMatches* flags
  - editable vs read-only member counts
- Only extract insert-group action assembly into a dedicated helper module.
- Keep `property_panel_group_actions.js` forwarding or re-exporting `buildInsertGroupActions(...)`.
- Do not import `selection_presenter.js` or unrelated property-panel entrypoints from the new helper.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_insert_group_actions.js`

Expected responsibility split:

- helper: insert peer navigation + insert group actions
- `property_panel_group_actions.js`: source-group actions, shared `pushAction(...)`, and re-exports/forwarding

## Acceptance

Accept Step366 only if:

- `property_panel_group_actions.js` no longer hand-builds insert-group actions
- insert-group action output remains behaviorally identical
- focused tests cover peer navigation, editable-member gating, missing-summary behavior, and failure status behavior
- existing property panel group action tests stay green
- `git diff --check` stays clean
