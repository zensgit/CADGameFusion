# Step369: Glue Field Appenders Extraction

## Goal

Extract the field appender wrappers from:

- `tools/web_viewer/ui/property_panel_glue_facade.js`

The purpose is to isolate the glue-layer routing around:

- `buildCommonPropertyFieldDescriptors(...)`
- `buildFullTextEditFieldDescriptors(...)`
- `buildInsertProxyTextFieldDescriptors(...)`
- `buildSingleEntityEditFieldDescriptors(...)`

without changing field batch ordering, descriptor contents, or facade contract.

## Scope

In scope:

- Extract:
  - `appendCommonPropertyFields(...)`
  - `appendSourceTextFields(...)`
  - `appendInsertProxyTextFields(...)`
  - `appendSingleEntityFields(...)`
- Keep `appendFieldDescriptors(...)` call sequencing unchanged
- Keep patch/buildPatch/layer collaborator threading unchanged

Out of scope:

- `appendStyleActions(...)`
- `appendLayerActions(...)`
- grouped action appenders
- branch context wiring
- render callback behavior

## Constraints

- Keep `createPropertyPanelGlueFacade(...)` public contract unchanged.
- Preserve exact field descriptor batch ordering for all four appenders.
- Preserve exact deps threading into:
  - `buildCommonPropertyFieldDescriptors(...)`
  - `buildFullTextEditFieldDescriptors(...)`
  - `buildInsertProxyTextFieldDescriptors(...)`
  - `buildSingleEntityEditFieldDescriptors(...)`
- Preserve `appendFieldDescriptors(...)` call count and sequencing.
- Only extract field appenders into a dedicated helper module.
- Keep `property_panel_glue_facade.js` owning the public facade return shape.
- Do not import `selection_presenter.js` or unrelated entrypoints from the new helper.
- Do not introduce a new dependency cycle.

## Expected Shape

Introduce a new helper, expected name:

- `tools/web_viewer/ui/property_panel_glue_field_appenders.js`

Expected responsibility split:

- helper: field appender wrappers + shared field deps bag
- `property_panel_glue_facade.js`: style actions, layer actions, grouped action appenders, facade assembly

## Acceptance

Accept Step369 only if:

- `property_panel_glue_facade.js` no longer hand-builds the four field appenders
- field descriptor routing remains unchanged
- focused tests cover:
  - common/source/insert/single field deps threading
  - field batch ordering
  - allow-position-editing passthrough
- existing glue facade tests stay green
- `git diff --check` stays clean
