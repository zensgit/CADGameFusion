# Step342: Property Metadata Facts Extraction

## Goal

Extract `buildPropertyMetadataFacts(...)` from
`tools/web_viewer/ui/selection_presenter.js` into a dedicated helper module
while keeping behavior and public exports unchanged.

## Why This Step

After Step341, `selection_presenter.js` still owns several separate concerns:

- property metadata fact assembly
- selection action context assembly
- property panel note planning
- final selection presentation assembly

`buildPropertyMetadataFacts(...)` is the narrowest next seam because it already
layers on top of `buildSelectionDetailFacts(...)` and only appends
property-panel-specific fact groups.

## Scope

In scope:

- create a new helper module for property metadata facts
- move the implementation of `buildPropertyMetadataFacts(...)` into that module
- keep `selection_presenter.js` importing and re-exporting
  `buildPropertyMetadataFacts(...)`
- add focused tests for the new helper module

Out of scope:

- `buildSelectionActionContext(...)`
- `buildPropertyPanelReadOnlyNote(...)`
- `buildPropertyPanelNotePlan(...)`
- `buildSelectionPresentation(...)`
- any property panel rendering code

## Target Files

Expected new file:

- `tools/web_viewer/ui/property_metadata_facts.js`

Expected touched files:

- `tools/web_viewer/ui/selection_presenter.js`
- `tools/web_viewer/tests/property_metadata_facts.test.js`

## Required Behavior

The extraction must preserve all current `buildPropertyMetadataFacts(...)`
behavior:

- same public return shape
- same base facts from `buildSelectionDetailFacts(...)`
- same inserted provenance facts:
  - `source-type`
  - `edit-mode`
  - `proxy-kind`
- same inserted hatch facts:
  - `hatch-id`
  - `hatch-pattern`
- same inserted dim facts:
  - `dim-type`
  - `dim-style`
- same inserted dim text facts:
  - `dim-text-pos`
  - `dim-text-rotation`
- same insertion anchors and ordering

`selection_presenter.js` must continue exporting
`buildPropertyMetadataFacts(...)` so downstream imports do not change.

## Dependency Rules

The new helper may import from leaf/shared modules and from
`selection_detail_facts.js`, but it must not import from `selection_presenter.js`.

No new cycle back into `selection_presenter.js` is allowed.

## Acceptance

Step342 is complete when:

1. `buildPropertyMetadataFacts(...)` lives outside `selection_presenter.js`
2. `selection_presenter.js` re-exports it without behavior drift
3. focused tests cover base-fact passthrough and property-only fact insertion
4. existing integration tests remain green
