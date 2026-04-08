# Step367: Source Group Actions Extraction

## Goal

Extract the source-group action builder from:

- `tools/web_viewer/ui/property_panel_group_actions.js`

The purpose is to isolate source group selection, anchor-driver selection, side flip, placement reset, fit, edit, and release actions without changing labels, ids, invoke wiring, failure messages, or action ordering.

## Scope

In scope:

- Extract `buildSourceGroupActions(...)`
- Keep source-group selection / source-text selection action assembly unchanged
- Keep anchor-driver / side-flip / placement-reset action assembly unchanged
- Keep fit / release-and-edit / release action assembly unchanged

Out of scope:

- `buildInsertGroupActions(...)`
- `buildReleasedInsertArchiveActions(...)`
- `pushAction(...)`
- property panel branch wiring
- property panel glue wiring

## Constraints

- Keep `buildSourceGroupActions(...)` public contract unchanged.
- Preserve exact action ids, labels, invoke arguments, failure messages, and action ordering.
- Preserve current gating for:
  - missing entity
  - missing source group summary
  - insert-group entity exclusion
  - `selectionMatchesGroup`
  - `selectionMatchesText`
  - anchor-driver presence
  - dimension vs leader source guide branches
  - resettable text count
  - source group member count
- Only extract source-group action assembly into a dedicated helper module.
- Keep `property_panel_group_actions.js` forwarding or re-exporting `buildSourceGroupActions(...)`.
- Do not import `selection_presenter.js` or unrelated property-panel entrypoints from the new helper.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_source_group_actions.js`

Expected responsibility split:

- helper: source-group actions
- `property_panel_group_actions.js`: shared `pushAction(...)` and re-exports/forwarding only

## Acceptance

Accept Step367 only if:

- `property_panel_group_actions.js` no longer hand-builds source-group actions
- source-group action output remains behaviorally identical
- focused tests cover missing-summary behavior, insert-group exclusion, dimension/leader branches, and failure status behavior
- existing property panel group action tests stay green
- `git diff --check` stays clean
