# Step225 Editor Source Anchor Driver Workflow Design

## Goal

Turn imported annotation anchor semantics into a navigable workflow.

After Step224, imported `DIMENSION` / `LEADER` text proxies could already show:

- `Source Anchor`
- `Source Offset`
- `Current Offset`
- `Fit Source Anchor`

But users still could not jump from the proxy text to the geometry member that actually drives that anchor.

Step225 closes that gap.

## Why This Slice

This is the next high-value move because visibility alone is not enough.

When imported annotation text looks wrong, users need to answer two separate questions:

1. should I move the text
2. or is the anchor-driving geometry itself wrong

Without a direct anchor-driver workflow, the user must manually hunt through grouped source members.

That is exactly the kind of friction mature CAD tools avoid.

## Contract

### 1. Source text guides now identify the anchor driver

`resolveSourceTextGuide()` now resolves not only:

- `anchor`
- `sourcePoint`
- `currentPoint`

but also:

- `anchorDriverId`
- `anchorDriverType`
- `anchorDriverKind`
- `anchorDriverLabel`

Step225 formalizes these fields as a navigable contract rather than leaving them as internal guide metadata.

### 2. Imported source text exposes `Source Anchor Driver`

Single imported `DIMENSION` / `LEADER` text proxies now surface:

- `Source Anchor Driver`

Current deterministic labels are:

- `line midpoint` for the current `DIMENSION` anchor contract
- `line endpoint` for the current `LEADER` landing contract

### 3. Users can jump directly to the driver

The editor now supports:

- property action `Select Anchor Driver`
- command line `srcdriver`
- command alias `sourceanchordriver`

Both narrow the selection to the geometry member that currently drives the anchor.

### 4. Source-type-specific rules stay explicit

#### `DIMENSION`

The driver is the longest non-text linear member in the same group.

That stays consistent with Step224:

- anchor = midpoint of that member
- driver = that same member

#### `LEADER`

The driver is the geometry member whose endpoint is nearest the preserved source text point.

That keeps the contract grounded in actual imported leader geometry, rather than inventing a text-attachment schema that current artifacts do not reliably carry.

### 5. Navigation stays non-destructive and transform-aware

Selecting the anchor driver does **not**:

- release the source bundle
- change proxy editability
- strip `sourceType / editMode / proxyKind`
- step outside the current `space / layout`

The selected driver remains the transformed current-instance guide driver after grouped-source `move / rotate / scale`; it does not fall back to stale import-space geometry.

## Implementation

### Guide resolution

`tools/web_viewer/insert_group.js`

Extends source-text guide resolution to carry driver identity alongside anchor/offset data.

### Command layer

`tools/web_viewer/commands/command_registry.js`

Adds:

- `selection.sourceSelectAnchorDriver`

This command works from:

- direct imported source text selection
- grouped source member selection

as long as the current selection resolves to a valid source-text guide.

### UI layer

`tools/web_viewer/ui/selection_presenter.js`

Adds the quicklook fact:

- `source-anchor-driver`

`tools/web_viewer/ui/property_panel.js`

Adds:

- property metadata row `Source Anchor Driver`
- property action `Select Anchor Driver`

`tools/web_viewer/ui/workspace.js`

Adds:

- `srcdriver`
- `sourceanchordriver`

and wires the property action to the same command contract.

### Browser coverage

`tools/web_viewer/scripts/editor_source_group_smoke.js`

Verifies:

- imported `DIMENSION` text reports driver `21:line midpoint`
- property action jumps to that driver geometry
- imported `LEADER` text reports driver `41:line endpoint`
- command `srcdriver` jumps to that driver geometry

## Out Of Scope

Step225 does not yet add:

- anchor driver highlight-on-hover
- anchor driver editing handles
- dimension placement presets
- leader elbow landing handles
- direct anchor reassignment
- multiple simultaneous candidate drivers

This slice is about moving from “anchor is visible” to “anchor-driving geometry is directly reachable”.
