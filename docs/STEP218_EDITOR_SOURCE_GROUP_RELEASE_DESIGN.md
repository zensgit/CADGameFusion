# Step218 Editor Source Group Release Design

## Goal

Complete the grouped non-`INSERT` source workflow so imported annotation/proxy bundles are not trapped in a read-only dead end after Step217.

Step218 adds the missing operations that make grouped source bundles behave like real CAD objects:

- full-group `copy`
- full-group `delete`
- in-place `release` to editable native geometry

This applies to grouped imported non-`INSERT` sources such as:

- `DIMENSION`
- `HATCH`
- `LEADER`

while keeping the richer `INSERT` instance workflow separate.

## Why This Slice

After Step217, grouped source bundles could be moved, rotated, and scaled, but they were still missing the actions that let a user actually break out of the imported proxy state:

- duplicate the bundle as editable geometry
- remove the bundle cleanly
- detach the bundle in place to continue editing it natively

That gap is exactly where lightweight/reference implementations usually stop. Closing it is higher value than adding more metadata rows because it upgrades grouped source bundles from “well-described imported proxies” to “operational CAD objects”.

## Contract

### 1. Full source-group delete removes the entire bundle

If the selection is the full same-layout grouped source bundle, `selection.delete` now deletes every member, including read-only proxy members.

This avoids the old behavior where delete only worked for editable fragments and left imported annotation bundles stuck.

### 2. Full source-group copy creates detached editable geometry

If the selection is the full same-layout grouped source bundle, `selection.copy` now creates a detached editable clone of the bundle.

The copied entities:

- keep geometry
- keep layer and space/layout context
- preserve valid style facts
- drop grouped imported-source provenance

Specifically, copied source-group members no longer carry:

- `groupId`
- `sourceType`
- `editMode`
- `proxyKind`
- dimension/hatch source metadata fields

### 3. Release detaches the original bundle in place

New command:

- `selection.sourceReleaseGroup`

New command-line entry:

- `srcrel`

New property action:

- `Release Source Group`

Release updates the existing grouped source members in place so they become editable native geometry while keeping their current geometry, layer, and layout placement.

### 4. Unsupported source members still block release/copy

Release/copy only applies to source-group members already representable as editable native entities:

- `line`
- `polyline`
- `circle`
- `arc`
- `text`

If a grouped source bundle contains unsupported proxy payloads, Step218 does not fake editability. Instead it returns a clear command error.

### 5. Read-only messaging must explain the new exit path

Full read-only source-group selections now surface a stronger property-panel note:

- full-group `move/rotate/scale/copy/delete` stay bundle-level
- `source-group` selection/fit/release remain available
- property edits stay disabled until release

This tells the user there is now a real, explicit path from imported bundle to editable geometry.

### 6. Insert stays a separate workflow

Step218 does not collapse grouped source release into insert instance release semantics.

`INSERT` still owns:

- peer navigation
- editable-member narrowing
- instance wording
- insert-specific release wording

Grouped non-`INSERT` release is intentionally simpler: it is closer to an explode/detach operation for imported annotation bundles.

## Implementation

### Command layer

`tools/web_viewer/commands/command_registry.js`

Adds:

- grouped-source delete special-case
- grouped-source copy special-case
- `runReleaseSourceGroup()`
- `selection.sourceReleaseGroup`

The copy/release path uses a detached “released” entity shape that strips imported grouped-source metadata while preserving valid style/layer/layout facts.

### Workspace layer

`tools/web_viewer/ui/workspace.js`

Adds:

- command-line `srcrel`
- property-panel callback wiring for grouped-source release

### Property layer

`tools/web_viewer/ui/property_panel.js`

Adds:

- `Release Source Group`

and updates the grouped-source read-only note to reflect the new copy/delete/release contract.

### Browser smoke

`tools/web_viewer/scripts/editor_source_group_smoke.js`

Extends the real browser grouped-source flow to verify:

- full source-group copy
- in-place source-group release
- full source-group delete

in addition to the Step217 transform coverage.

## Out Of Scope

Step218 does not yet add:

- source-group peer navigation
- source-type-specific authoring UIs for dimensions/leaders/hatches
- source-group definition editing
- block-definition/refedit workflows

This slice is about finishing the operational lifecycle of imported grouped-source bundles, not turning every annotation source type into its own editor subsystem.
