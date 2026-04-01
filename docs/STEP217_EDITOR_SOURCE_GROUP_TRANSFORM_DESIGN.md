# Step217 Editor Source Group Transform Design

## Goal

Extend the grouped non-`INSERT` source workflow from:

- inspect
- select whole group
- fit to bounds

to a real full-bundle transform contract:

- `move`
- `rotate`
- `scale`

for imported grouped source/proxy bundles such as:

- `DIMENSION`
- `HATCH`
- `LEADER`

without weakening the existing read-only safety rules for single proxy fragments.

## Why This Slice

Step216 made grouped source provenance visible and actionable, but it still left a major benchmark gap.

In mature 2D CAD tools, compound annotation/proxy bundles are not useful if the editor can only inspect them. Even when the underlying members are proxy/read-only, users still expect whole-object transforms to work.

The right next step was therefore not more metadata. It was to let the editor treat a full grouped source bundle as one transformable unit while preserving the stricter behavior for partial or fragment-only selections.

## Contract

### 1. Full grouped-source selection unlocks transform

If the current selection is exactly the full same-layout grouped source bundle, the editor now allows:

- `selection.move`
- `selection.rotate`
- `selection.scale`

to carry every transform-safe proxy member together.

This applies to grouped non-`INSERT` sources only when the full bundle is selected.

### 2. Single read-only proxies remain blocked

A read-only source/proxy fragment selected by itself is still not directly movable.

This is an intentional safety boundary. The editor is not reclassifying proxy fragments as editable geometry. It is only allowing a full grouped source bundle to move as one imported object-like unit.

### 3. Only transform-safe member types participate

The grouped-source transform path only applies to members already supported by the editor transform pipeline:

- `line`
- `polyline`
- `circle`
- `arc`
- `text`

Unsupported proxy payloads do not gain hidden editability here.

### 4. Insert workflow stays richer and distinct

`INSERT` still keeps its own richer instance contract:

- peer navigation
- editable-member narrowing
- release
- instance wording in status text

Step217 deliberately generalizes only the transform part of the workflow to generic grouped sources. It does not flatten `INSERT` into the lowest common denominator.

### 5. Property messaging must explain the boundary

When the user selects a full read-only grouped source bundle, the property panel now explicitly says that:

- property edits remain disabled
- full-group `move/rotate/scale` stay bundle-level

This avoids the earlier ambiguity where the UI only said “read-only” even though whole-bundle transform had become legal.

## Implementation

### Command layer

`tools/web_viewer/commands/command_registry.js`

Adds a generic grouped-source transform resolution path:

- resolve whether the selection is the full same-layout source group
- preserve `INSERT` wording for insert groups
- emit grouped-source wording for non-`INSERT` bundles

This logic intentionally requires:

- exact membership match
- multi-member bundle

so a lone grouped proxy does not accidentally become movable.

### Property layer

`tools/web_viewer/ui/property_panel.js`

Updates the read-only note so full grouped-source selections are described correctly:

- bundle-level transform is allowed
- property edits are not

### Browser smoke

`tools/web_viewer/scripts/editor_source_group_smoke.js`

Extends the grouped-source browser path to verify:

- grouped `DIMENSION` move
- grouped `DIMENSION` rotate
- grouped `DIMENSION` scale
- undo after each transform

against the real imported editor flow rather than a synthetic helper-only path.

## Out Of Scope

Step217 does not yet add:

- grouped-source `copy`
- grouped-source `delete`
- grouped-source `release`
- peer navigation for non-`INSERT` bundles
- source-type-specific authoring workflows

Those remain later slices built on top of the Step217 full-bundle transform contract.
