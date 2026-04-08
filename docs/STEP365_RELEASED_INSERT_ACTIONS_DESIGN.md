# Step365: Released Insert Actions Extraction

## Goal

Extract the released-insert action builder from:

- `tools/web_viewer/ui/property_panel_group_actions.js`

The purpose is to isolate released peer navigation and released-group actions without changing action labels, ids, invoke wiring, failure messages, or action ordering.

## Scope

In scope:

- Extract `buildReleasedInsertArchiveActions(...)`
- Keep released peer navigation action assembly unchanged
- Keep released group selection / fit action assembly unchanged

Out of scope:

- `buildSourceGroupActions(...)`
- `buildInsertGroupActions(...)`
- `pushAction(...)`
- property panel branch wiring
- property panel glue wiring

## Constraints

- Keep `buildReleasedInsertArchiveActions(...)` public contract unchanged.
- Preserve exact action ids, labels, invoke arguments, failure messages, and action ordering.
- Preserve current gating for:
  - missing entity
  - missing released archive
  - peer target count
  - `selectionMatchesGroup`
  - group member count
- Only extract released insert archive action assembly into a dedicated helper module.
- Keep `property_panel_group_actions.js` re-exporting or forwarding `buildReleasedInsertArchiveActions(...)`.
- Do not import `selection_presenter.js` or unrelated property-panel entrypoints from the new helper.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_released_insert_actions.js`

Expected responsibility split:

- helper: released peer navigation + released insert group actions
- `property_panel_group_actions.js`: source-group actions, insert-group actions, shared `pushAction(...)`, and released-action re-export/forwarding

## Acceptance

Accept Step365 only if:

- `property_panel_group_actions.js` no longer hand-builds released insert archive actions
- released action output remains behaviorally identical
- focused tests cover peer navigation, group gating, and missing-archive behavior
- existing property panel group action tests stay green
- `git diff --check` stays clean
