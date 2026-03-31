# Step300 Property Panel Glue Facade Design

## Goal

Continue shrinking `property_panel.js` by extracting the remaining field/action glue into a local facade without changing selection policy, presenter contracts, or DOM ownership.

## Problem

After Steps 291-299, `property_panel.js` was already thinner, but it still directly owned one mixed-responsibility layer:

- binding field builders to `appendFieldDescriptors(...)`
- binding action builders to `addActionRow(...)`
- passing patch/update dependencies into those builders
- preserving the established order for source-group, insert-group, released-insert, style, and common property fields

Those routines were no longer policy-heavy, but they still made `property_panel.js` carry too much builder orchestration.

## Design

Introduce a dedicated local facade:

- `tools/web_viewer/ui/property_panel_glue_facade.js`

`createPropertyPanelGlueFacade(...)` receives the already-local UI glue dependencies:

- `addActionRow`
- `appendFieldDescriptors`
- `patchSelection`
- `buildPatch`
- layer lookup / ensure helpers
- action callbacks for layer, source-group, insert-group, and released-insert workflows

It returns a thin, stable API back to `property_panel.js`:

- `appendStyleActions(...)`
- `appendLayerActions(...)`
- `appendSourceGroupActions(...)`
- `appendInsertGroupActions(...)`
- `appendReleasedInsertArchiveActions(...)`
- `appendCommonSelectionActions(...)`
- `appendCommonPropertyFields(...)`
- `appendSourceTextFields(...)`
- `appendInsertProxyTextFields(...)`
- `appendSingleEntityFields(...)`

## Boundaries

`property_panel_glue_facade.js` is responsible for:

- wiring existing action builders to `addActionRow(...)`
- wiring existing field builders to `appendFieldDescriptors(...)`
- composing grouped selection actions in the established order
- passing `patchSelection/buildPatch` and callback dependencies through unchanged

`property_panel.js` remains responsible for:

- DOM primitives such as `addField`, `addToggle`, `addInfo`, `addNote`, `addReadonlyNote`
- selection loading and branch selection
- presenter-driven note and branch policy
- building `notePlan`, `actionContext`, and selection presentation

The extracted builders remain responsible for their own descriptor generation:

- `property_panel_common_fields.js`
- `property_panel_entity_fields.js`
- `property_panel_layer_actions.js`
- `property_panel_group_actions.js`

## Non-Goals

- no change to selection presentation or property metadata contracts
- no change to action ids, labels, or click behavior
- no change to editable/read-only/locked branch policy
- no new abstraction over DOM primitives beyond the local facade

## Expected Outcome

`property_panel.js` moves closer to a pure orchestration shell, while field/action glue becomes directly testable in isolation and easier to evolve without reopening branch logic.
