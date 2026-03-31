# Step301 Property Panel DOM Adapter Design

## Goal

Continue thinning `property_panel.js` by extracting the remaining DOM primitive glue into a local adapter while keeping selection policy, presenter contracts, branch decisions, and field/action builders unchanged.

## Problem

After Step300, `property_panel.js` still owned one low-level rendering layer:

- creating form labels and inputs
- creating toggle rows
- creating info, note, and read-only note rows
- creating action-button rows
- translating field/info descriptors into DOM append operations

These functions were no longer about CAD behavior. They were pure DOM assembly, but they still made the main file heavier than necessary.

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_dom_adapter.js`

`createPropertyPanelDomAdapter({ form })` resolves the correct document from the form and returns the local DOM helpers:

- `addActionRow(...)`
- `addField(...)`
- `addInfo(...)`
- `addNote(...)`
- `addReadonlyNote(...)`
- `addToggle(...)`
- `appendFieldDescriptors(...)`
- `appendInfoRows(...)`

## Boundaries

`property_panel_dom_adapter.js` is responsible for:

- DOM element creation for property form rows
- attaching event listeners for field/toggle/action controls
- assigning stable CSS classes and `data-property-*` attributes
- translating descriptors to concrete DOM rows

`property_panel.js` remains responsible for:

- patch building and patch execution
- selection and branch orchestration
- wiring presenter outputs into section/branch renderers
- composing the glue facade and branch context

`property_panel_glue_facade.js` remains responsible for:

- field/action builder wiring
- grouped action ordering
- dependency pass-through for field/action builders

## Non-Goals

- no change to action ids, labels, or button ordering
- no change to field names, labels, or patch semantics
- no change to no-selection / read-only / locked / editable branch behavior
- no change to selection summary/details rendering

## Expected Outcome

`property_panel.js` moves closer to a pure orchestration shell, while DOM primitive behavior becomes separately testable and less likely to regress during later shell extractions.
