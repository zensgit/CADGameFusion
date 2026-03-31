# Step298 Property Panel Section Shells Design

## Goal

Reduce the last remaining section-level orchestration weight in `property_panel.js` by extracting the `no-selection`, `single-selection`, and `grouped-selection` shells.

## Problem

After Steps 291-297, `property_panel.js` had already offloaded:

- action builders
- field builders
- info row builders
- branch orchestration

But it still directly owned three section shells:

- current-layer defaults for no selection
- single-selection info section
- grouped-selection info section

These are not policy or descriptor-generation responsibilities. They are section-level sequencing glue.

## Design

Extract those shells into a new local module:

- `tools/web_viewer/ui/property_panel_section_shells.js`

The module exports:

- `renderNoSelectionSection(...)`
- `renderSingleSelectionSection(...)`
- `renderGroupedSelectionSection(...)`

Each helper stays pure with respect to DOM construction and works through handler callbacks.

## Boundaries

`property_panel_section_shells.js` is responsible for:

- sequencing current-layer default note, info rows, space actions, and current-layer fields
- sequencing single-selection info rows and layer actions
- sequencing grouped-selection source/insert/released info rows

`property_panel.js` remains responsible for:

- top-level selection resolution
- branch wiring
- DOM helper primitives
- patch command execution
- common property/style/source-text/single-entity field wiring

## Non-Goals

- no change to note policy
- no change to action or field contracts
- no change to info-row contracts
- no change to selection presenter boundaries

## Expected Outcome

`property_panel.js` gets closer to pure wiring, while section sequencing becomes directly unit-testable and reusable.
