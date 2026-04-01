# Step224 Editor Source Text Anchor Affordance Design

## Goal

Make imported annotation text placement readable as an anchor relationship instead of a raw coordinate edit.

After Step223, imported `DIMENSION` / `LEADER` text proxies could already:

- keep reversible source placement
- survive grouped-source `move / rotate / scale`
- reset with `srcplace`

But the editor still made the user infer the real attachment relationship from geometry by eye.

Step224 closes that gap.

## Why This Slice

This is a higher-value slice than adding another generic metadata row because it improves the object model the user actually edits.

Reference tools and lighter viewer-style implementations usually stop at one of these weak points:

- only expose `position / rotation`
- force `explode/release` before attachment becomes understandable
- pretend all annotation source types share one attachment contract

Step224 moves past that. The editor now exposes a source anchor and text offset directly while keeping the non-destructive proxy path intact.

## Contract

### 1. Imported source text exposes anchor and offset facts

Direct editable imported source-text proxies now surface:

- `Source Anchor`
- `Source Offset`
- `Current Offset`

This applies to:

- imported `DIMENSION` text proxies
- imported `LEADER` text proxies

### 2. `DIMENSION` and `LEADER` intentionally use different anchor strategies

This slice does not over-generalize annotation attachment.

For imported `DIMENSION` text:

- the anchor is resolved from grouped dimension geometry
- the current implementation uses the midpoint of the longest non-text linear group member
- this stays compatible with the imported dimension metadata already preserved in CADGF artifacts such as `dim_text_pos / dim_text_rotation`

For imported `LEADER` text:

- the anchor is resolved from actual leader geometry
- the current implementation uses the nearest leader endpoint to the source text point
- this avoids inventing a fake leader text-attachment enum that the imported artifacts do not reliably carry

That split is deliberate. It is more truthful to real imported data than a single abstract attachment model.

### 3. Source-anchor fitting becomes a first-class action

When a grouped source selection or imported source text proxy has a resolvable guide, the editor now exposes:

- property action `Fit Source Anchor`
- command line `srcanchor`

Both route through the same guide resolution contract.

### 4. Canvas overlay explains the relationship directly

The editor canvas now renders a source-text guide overlay that shows:

- anchor point
- source text point
- current text point when it has drifted
- source-type label

This keeps placement reasoning visible without release.

### 5. Transform-aware source placement remains intact

Step224 builds on Step223 rather than replacing it.

After grouped-source `move / rotate / scale`, all of the following continue to resolve against the transformed source instance:

- `Source Anchor`
- `Source Offset`
- `Current Offset`
- source-anchor overlay
- `srcanchor`

The guide does not fall back to stale import-space geometry.

## Implementation

### Source-group geometry layer

`tools/web_viewer/insert_group.js`

Adds reusable source-text guide resolution:

- `isDirectEditableSourceTextEntity()`
- `resolveSourceTextGuide()`
- `computeSourceTextGuideExtents()`

This is also where the source-type-specific anchor logic lives.

### Selection/property layer

`tools/web_viewer/ui/selection_presenter.js`

Adds quicklook facts for imported source-text proxies:

- `source-anchor`
- `source-offset`
- `current-offset`

`tools/web_viewer/ui/property_panel.js`

Adds matching property rows plus the `Fit Source Anchor` action.

### Workspace/canvas layer

`tools/web_viewer/ui/workspace.js`

Adds command-line `srcanchor` and keeps the source-text guide overlay synchronized with current selection.

`tools/web_viewer/ui/canvas_view.js`

Adds the visual source-anchor guide overlay.

### Browser coverage

`tools/web_viewer/scripts/editor_source_group_smoke.js`

Extends the real browser path to verify:

- `DIMENSION` anchor facts
- `LEADER` anchor facts
- property action `Fit Source Anchor`
- command-line `srcanchor`
- transformed-source anchor stability after grouped-source move

## Out Of Scope

Step224 does not yet add:

- draggable source-anchor handles
- dimension placement presets
- leader landing-point editing
- a fake generic attachment enum across all annotation source types

This slice is about making source anchoring explicit and trustworthy, not about inventing a full annotation authoring UI in one step.
