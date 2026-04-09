# Step370: Glue Style/Layer Action Appenders Extraction

## Goal

Extract the remaining action appender wrappers from:

- `tools/web_viewer/ui/property_panel_glue_facade.js`

The purpose is to isolate the glue-layer routing around:

- `buildStyleActionDescriptors(...)`
- `buildLayerActions(...)`

without changing action row ordering, descriptor contents, or facade contract.

## Scope

In scope:

- Extract:
  - `appendStyleActions(...)`
  - `appendLayerActions(...)`
- Keep `addActionRow(...)` call sequencing unchanged
- Keep style/layer collaborator threading unchanged

Out of scope:

- grouped action appenders
- field appenders
- facade return shape changes
- render callback behavior

## Constraints

- Keep `createPropertyPanelGlueFacade(...)` public contract unchanged.
- Preserve exact row ordering and action ids for style/layer rows.
- Preserve exact deps threading into:
  - `buildStyleActionDescriptors(...)`
  - `buildLayerActions(...)`
- Preserve `addActionRow(...)` call count and sequencing.
- Only extract style/layer action appenders into a dedicated helper module.
- Keep `property_panel_glue_facade.js` owning the public facade return shape.
- Do not import `selection_presenter.js` or unrelated entrypoints from the new helper.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_glue_style_layer_actions.js`

Expected responsibility split:

- helper: style/layer action appenders + shared action deps bag
- `property_panel_glue_facade.js`: grouped action appenders, field appenders, facade assembly

## Acceptance

Accept Step370 only if:

- `property_panel_glue_facade.js` no longer hand-builds style/layer action appenders
- style/layer action row ordering remains unchanged
- focused tests cover:
  - style action deps threading
  - layer action deps threading
  - style/layer row ordering
- existing glue facade tests stay green
- `git diff --check` stays clean
