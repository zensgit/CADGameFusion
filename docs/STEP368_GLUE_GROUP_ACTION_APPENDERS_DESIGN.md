# Step368: Glue Group Action Appenders Extraction

## Goal

Extract the grouped action appenders from:

- `tools/web_viewer/ui/property_panel_glue_facade.js`

The purpose is to isolate the glue-layer wrappers around:

- `buildSourceGroupActions(...)`
- `buildInsertGroupActions(...)`
- `buildReleasedInsertArchiveActions(...)`
- `appendCommonSelectionActions(...)`

without changing add-action-row behavior, row ordering, or facade contract.

## Scope

In scope:

- Extract:
  - `appendSourceGroupActions(...)`
  - `appendInsertGroupActions(...)`
  - `appendReleasedInsertArchiveActions(...)`
  - `appendCommonSelectionActions(...)`
- Keep grouped action row ordering unchanged
- Keep `setStatus` and action handler threading unchanged

Out of scope:

- `appendStyleActions(...)`
- `appendLayerActions(...)`
- field descriptor routing helpers
- collaborator wiring
- branch context wiring

## Constraints

- Keep `createPropertyPanelGlueFacade(...)` public contract unchanged.
- Preserve exact row ordering for grouped action rows.
- Preserve exact deps threading into:
  - `buildSourceGroupActions(...)`
  - `buildInsertGroupActions(...)`
  - `buildReleasedInsertArchiveActions(...)`
- Preserve `addActionRow(...)` call count and sequencing.
- Only extract grouped action appenders into a dedicated helper module.
- Keep `property_panel_glue_facade.js` owning the public facade return shape.
- Do not import `selection_presenter.js` or unrelated entrypoints from the new helper.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_glue_group_actions.js`

Expected responsibility split:

- helper: grouped action appenders + shared grouped-action deps bag
- `property_panel_glue_facade.js`: style actions, layer actions, field routing, facade assembly

## Acceptance

Accept Step368 only if:

- `property_panel_glue_facade.js` no longer hand-builds grouped action appenders
- grouped action row order remains unchanged
- focused tests cover:
  - source / insert / released deps threading
  - common selection action sequencing
  - action row ordering
- existing glue facade tests stay green
- `git diff --check` stays clean
