# Step216 Editor Source Group Affordance Design

## Goal

Extend editor group affordances from imported `INSERT` only to generic grouped source/proxy workflows.

Before Step216, the editor already preserved grouped provenance fields:

- `groupId`
- `sourceType`
- `editMode`
- `proxyKind`

but only `INSERT` got first-class editor affordances:

- `Select Insert Group`
- `Fit Insert Group`
- peer navigation
- release workflow
- instance overlay

That left real grouped `DIMENSION` / `HATCH` proxy bundles in an awkward middle state:

- provenance was visible
- group bounds were not editor-first
- selection stayed fragment-oriented
- viewport fit stayed manual

Step216 closes that gap without collapsing the richer `INSERT` workflow into a lowest common denominator.

## Why This Slice

This is a better benchmark move than continuing to stack insert-specific actions because benchmark CAD workflows are not block-only.

Real DWG sessions regularly include grouped source-derived bundles such as:

- dimensions
- hatches
- leaders
- other imported annotation/proxy groups

If the editor only treats `INSERT` as a first-class grouped object, then the product still feels uneven compared with mature 2D tools. Step216 makes grouped source provenance actionable across multiple DWG-derived source types while preserving the extra behavior that is truly insert-specific.

## Contract

### 1. Generic source group identity

A generic source group is now defined by:

- finite `groupId`
- non-empty `sourceType`
- same `space / layout`

The editor does not rely on `blockName` for generic grouped source selection.

This matches the broader preview/metadata contract where group focus already resolves from `groupId + sourceType` rather than from block semantics alone.

### 2. Shared group metadata

Single-select grouped source entities now expose:

- `Group ID`
- `Group Source`
- `Source Group Members`
- `Editable Members`
- `Read-only Members`
- `Group Center`
- `Group Size`
- `Group Bounds`

For grouped non-`INSERT` proxies, these are the primary group affordance rows.

For grouped `INSERT` fragments, these shared facts coexist with insert-specific rows:

- `Block Name`
- `Insert Group Members`
- peer metadata

This keeps the editor contract layered:

- generic source-group facts for all grouped imported sources
- insert-only facts for block/reference workflows

### 3. Generic source-group actions

Grouped non-`INSERT` selections now expose:

- `Select Source Group`
- `Fit Source Group`

Command line adds:

- `srcgrp`
- `srcfit`

These actions deliberately do not add insert-only semantics such as:

- peer browsing
- editable-member narrowing
- release

That keeps the generic contract small and correct instead of pretending every grouped source behaves like an imported block reference.

### 4. Group overlay

The canvas overlay system is now layered the same way:

- `insertGroupFrame` remains for imported `INSERT`
- `sourceGroupFrame` is added for grouped non-`INSERT` sources

Both use the same bounds contract:

- min/max
- center
- view-fit extents

but remain visually distinct, so the user can tell whether they are looking at an imported instance or a grouped proxy bundle.

### 5. Layout isolation remains strict

Generic source-group selection is still scoped to the active `space / layout`.

Same-`groupId` members in another layout are not pulled into:

- `Select Source Group`
- `srcgrp`
- `Fit Source Group`
- source-group overlay bounds

This matches the existing editor session model and avoids the ambiguity of cross-layout accidental selection.

## Implementation

### Shared helper layer

`tools/web_viewer/insert_group.js`

The helper module now also owns generic source-group logic:

- `isSourceGroupEntity`
- `listSourceGroupMembers`
- `summarizeSourceGroupMembers`
- `computeSourceGroupBounds`

The existing insert helpers stay intact and now build on the same group-summary foundation.

### Command layer

`tools/web_viewer/commands/command_registry.js`

Adds:

- `selection.sourceGroup`

This selects all same-source same-layout members for the chosen grouped source entity.

### Presenter/property layer

`tools/web_viewer/ui/selection_presenter.js`
`tools/web_viewer/ui/property_panel.js`

Adds generic grouped-source facts and property actions while keeping insert-specific actions on the insert path only.

### Workspace layer

`tools/web_viewer/ui/workspace.js`

Adds:

- command-line `srcgrp`
- command-line `srcfit`
- generic property callbacks
- `sourceGroupFrame` overlay routing

### Browser verification fixture

`tools/web_viewer/tests/fixtures/editor_source_group_fixture.json`

The fixture contains real grouped non-`INSERT` cases:

- `DIMENSION` proxy bundle
- `HATCH` proxy bundle

and includes same-`groupId` members in another layout so the smoke can prove layout scoping instead of only happy-path grouping.

## Out Of Scope

Step216 does not yet add:

- peer navigation for non-`INSERT` groups
- release/edit conversion for non-`INSERT` grouped proxies
- grouped leader-specific actions
- full refedit/block-definition authoring

This slice is intentionally about a reliable generic grouped-source affordance baseline, not about making every source type behave like a block reference.
