# Step225 Editor Source Anchor Driver Navigation Design

## Goal

Make imported annotation anchoring navigable, not just visible.

After Step224, imported `DIMENSION` / `LEADER` text proxies could already show:

- `Source Anchor`
- `Source Offset`
- `Current Offset`
- a source-anchor overlay

But the user still had to manually infer which grouped-source geometry member was currently driving that anchor.

Step225 closes that gap.

## Why This Slice

This is a better next move than adding another generic annotation field because it turns the guide into an actual workflow.

Reference paths usually make users do one of these:

- inspect the text, then manually click around the bundle to find the relevant driver geometry
- release/explode the annotation before attachment becomes navigable
- show an anchor marker without any way to jump to the geometry behind it

Step225 moves beyond that. Imported text can now jump straight to its current anchor driver while preserving grouped-source provenance.

## Contract

### 1. Imported source text exposes a selectable anchor driver

When imported `DIMENSION` / `LEADER` text has a resolvable source guide, the editor now exposes:

- `Source Anchor Driver`
- property action `Select Anchor Driver`
- command line `srcdriver`

### 2. Driver resolution reuses Step224 guide truth

This slice does not create a second attachment model.

Driver navigation reuses the same guide resolution already used for:

- `Source Anchor`
- `Source Offset`
- `Current Offset`
- `Fit Source Anchor`

That means the selected driver remains consistent with the visible anchor guide.

### 3. Source-type-specific driver semantics stay explicit

For imported `DIMENSION` text:

- the selected driver is the non-text grouped member that currently determines the anchor midpoint

For imported `LEADER` text:

- the selected driver is the grouped leader geometry that contributes the nearest landing endpoint

This keeps the contract truthful to the underlying grouped-source geometry instead of pretending all annotation types have the same driver model.

### 4. Navigation stays non-destructive

`Select Anchor Driver` and `srcdriver`:

- do not release the source group
- do not strip `sourceType / editMode / proxyKind`
- only change selection

The user can jump from text to driver geometry and back through the existing grouped-source workflow.

### 5. Transform-aware driver navigation remains intact

Step225 builds on Step223 and Step224.

After grouped-source `move / rotate / scale`, the selected driver still matches the transformed source instance rather than stale import-space geometry.

## Implementation

### Guide layer

`tools/web_viewer/insert_group.js`

The Step224 guide already carried:

- `anchorDriverId`
- `anchorDriverType`
- `anchorDriverKind`
- `anchorDriverLabel`

Step225 formalizes those fields as a navigable contract instead of leaving them as internal guide metadata.

### Command layer

`tools/web_viewer/commands/command_registry.js`

Formalizes `selection.sourceSelectAnchorDriver`:

- resolves source text guide from current selection
- selects the current guide driver entity
- keeps selection scoped to the current `space / layout`

### Property / command UX

`tools/web_viewer/ui/property_panel.js`

Adds:

- `Source Anchor Driver`
- `Select Anchor Driver`

`tools/web_viewer/ui/workspace.js`

Adds command-line:

- `srcdriver`

### Browser coverage

`tools/web_viewer/scripts/editor_source_group_smoke.js`

Verifies:

- imported `DIMENSION` text reports driver `21:line midpoint`
- property action jumps to that driver geometry
- imported `LEADER` text reports driver `41:line endpoint`
- command `srcdriver` jumps to that driver geometry

## Out Of Scope

Step225 does not yet add:

- direct editing of the anchor-driving geometry through annotation-specific handles
- multiple candidate drivers shown simultaneously
- generic attachment taxonomies across all grouped-source types

This slice is about driver navigation, not full annotation refedit.
