# Step287 Selection Property Fact Consolidation Design

## Goal

Consolidate provenance/style metadata fact generation so:

- selection details and property metadata stop drifting apart
- [property_panel.js](../tools/web_viewer/ui/property_panel.js) consumes shared facts instead of recomputing them
- the property panel still keeps its panel-only metadata rows without bloating the selection summary UI

## Problem

After Step280-Step286, the import boundary was cleaner, but the presentation layer still had a duplication seam:

- [selection_presenter.js](../tools/web_viewer/ui/selection_presenter.js) already produced stable `detailFacts` for provenance and effective style
- [property_panel.js](../tools/web_viewer/ui/property_panel.js) still rebuilt a second metadata set by recomputing:
  - layer summary
  - effective color
  - effective line style
  - released insert archive facts
  - source-text guide rows
  - group context rows

That duplication was risky because presenter and property panel could diverge on:

- formatting
- source precedence
- which rows appear for imported proxy entities

## Design

### 1. Add a property-metadata fact builder next to selection detail facts

Extend [selection_presenter.js](../tools/web_viewer/ui/selection_presenter.js) with:

- `buildPropertyMetadataFacts(entity, options)`

This builder starts from:

- `buildSelectionDetailFacts(entity, options)`

and then appends only the metadata rows that are property-panel specific:

- `source-type`
- `edit-mode`
- `proxy-kind`
- `hatch-id`
- `hatch-pattern`
- `dim-type`
- `dim-style`
- `dim-text-pos`
- `dim-text-rotation`

The selection summary stays intentionally smaller; the property panel gets the richer fact set.

### 2. Keep insertion order stable with key-based placement

The property panel should not suddenly reorder everything.

To preserve the current reading flow, the new builder inserts property-only facts after stable anchor keys:

- source/edit/proxy rows after `entity-visibility`
- hatch rows after `line-type-scale-source`
- dimension rows after `attribute-modes` or `released-attribute-modes`
- dimension text rows after the source-text placement block

This keeps the panel visually familiar while still using one fact-generation path.

### 3. Make property_panel a consumer, not a second fact author

[property_panel.js](../tools/web_viewer/ui/property_panel.js) now calls:

- `buildPropertyMetadataFacts(entity, { getLayer, listEntities })`

and renders the returned facts directly.

Editing behavior is intentionally unchanged:

- layer/color/line-type/line-weight/line-type-scale patching stays local to property panel
- action rows and read-only notes stay local
- multi-selection group/release action logic stays local

## Files

- [selection_presenter.js](../tools/web_viewer/ui/selection_presenter.js)
- [property_panel.js](../tools/web_viewer/ui/property_panel.js)
- [editor_commands.test.js](../tools/web_viewer/tests/editor_commands.test.js)

## Why This Is The Right Cut

This step removes the most obvious presentation-layer duplication without dragging the session into a full panel/presenter architecture rewrite.

It is intentionally narrow:

1. unify metadata facts
2. keep panel actions local
3. keep multi-select action flows local

That gives one stable fact contract now, and leaves broader presenter/panel restructuring for a later session if needed.
