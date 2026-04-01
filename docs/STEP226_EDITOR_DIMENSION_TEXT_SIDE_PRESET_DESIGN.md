# Step226 Editor Dimension Text Side Preset Design

## Goal

Add one stable, non-destructive placement preset for imported `DIMENSION` text: move it to the opposite side of the current source anchor.

After Step223 to Step225, imported `DIMENSION` text already had:

- transform-aware preserved source placement
- visible anchor and offset facts
- anchor-driver navigation

What was still missing was a benchmark-grade preset action. Users could edit text position numerically, but there was no one-step way to place the text on the opposite side of the dimension while keeping grouped-source provenance.

Step226 closes that gap.

## Why This Slice

This is the most reliable next annotation slice because it only depends on contracts that are already proven:

- `Source Anchor`
- `Source Offset`
- `Source Text Pos`
- `dimTextPos / dimTextRotation`

It does not require guessing any missing attachment semantics.

Compared with `LEADER` landing/elbow editing, imported `DIMENSION` opposite-side placement is more stable because:

- the anchor is already resolved from dimension geometry
- the source offset is already preserved and transform-aware
- the dimension text metadata already syncs through `dimTextPos / dimTextRotation`

## Contract

### 1. Imported `DIMENSION` text gets one preset

The preset is:

- `Use Opposite Text Side`
- command aliases `srcflip` and `dimflip`

It mirrors the preserved source offset across the current anchor.

### 2. The preset is non-destructive

Applying the preset:

- does not release the source group
- does not clear `sourceType / editMode / proxyKind`
- does not mutate `sourceTextPos / sourceTextRotation`

It only changes the current visible text placement and synced dimension text metadata.

### 3. The preset reuses transformed source truth

The opposite-side target is computed from:

- current resolved source anchor
- current preserved source offset

That means grouped-source `move / rotate / scale` remain part of the same contract. The preset does not fall back to stale import-space geometry.

### 4. Rotation stays deterministic

Opposite-side placement uses preserved source rotation rather than current drifted rotation.

This keeps the preset predictable and aligned with the dimension source contract instead of mixing preset placement with arbitrary direct text drift.

### 5. `LEADER` stays out of scope on purpose

This slice does not pretend `LEADER` has the same reliable preset semantics.

`LEADER` landing/elbow editing needs its own geometry contract. Step226 only formalizes the imported `DIMENSION` path that is already backed by preserved source placement and dimension metadata.

## Implementation

### Command layer

`tools/web_viewer/commands/command_registry.js`

Uses the existing `selection.dimensionFlipTextSide` command to:

- resolve grouped source members in the current `space / layout`
- filter imported `DIMENSION` text proxies
- compute opposite-side placement from `anchor - sourceOffset`
- sync `dimTextPos / dimTextRotation`

### Workspace layer

`tools/web_viewer/ui/workspace.js`

Adds command alias:

- `srcflip`

while keeping `dimflip / dimensionflip` working.

### Property panel

`tools/web_viewer/ui/property_panel.js`

Shows `Use Opposite Text Side` whenever the current source-text guide resolves to imported `DIMENSION`, including grouped-source selection paths that are not already narrowed to text.

### Browser coverage

`tools/web_viewer/scripts/editor_source_group_smoke.js`

Verifies both:

- direct property action use on imported `DIMENSION` text
- transform-aware command use after grouped-source move

## Out Of Scope

Step226 does not yet add:

- leader landing presets
- elbow editing
- dimension-style-specific preset families
- drag handles for preset placement

This slice is only the narrow, high-confidence opposite-side preset for imported `DIMENSION` text.
