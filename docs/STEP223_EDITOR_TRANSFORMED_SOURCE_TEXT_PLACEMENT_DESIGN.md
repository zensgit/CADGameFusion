# Step223 Editor Transformed Source Text Placement Design

## Goal

Make imported source-text placement remain reversible even after whole-bundle transforms.

After Step222, imported `DIMENSION` / `LEADER` text proxies could:

- preserve original source placement
- drift in place through direct proxy edits
- reset back with `srcplace`

But that contract was still incomplete because grouped-source `move / rotate / scale` could leave the cached source placement behind in import-space coordinates.

Step223 closes that gap.

## Why This Slice

This is a higher-value move than adding another annotation button because it fixes the actual object model.

Users already had a benchmark-grade path to:

1. select a grouped imported annotation
2. move or rotate the whole bundle
3. focus the source text
4. correct wording/placement
5. restore source placement

Without transform-aware source placement, step 5 could snap back to stale import-space coordinates instead of the current transformed instance.

That is exactly the kind of subtle behavior drift that makes imported annotation editing feel fragile compared with mature CAD tools.

## Contract

### 1. Whole-bundle transform carries preserved source placement

When a full grouped-source bundle is transformed through:

- `selection.move`
- `selection.rotate`
- `selection.scale`

the editor now updates the text proxy's preserved source placement metadata alongside visible geometry.

For imported text proxies this includes:

- `sourceTextPos`
- `sourceTextRotation`

For imported `DIMENSION` text proxies this also includes:

- `dimTextPos`
- `dimTextRotation`

### 2. `srcplace` resets to the transformed source, not the original import coordinates

After a grouped source bundle is transformed, later in-place text overrides can still be reset through:

- property action `Reset Source Text Placement`
- command line `srcplace`

The reset target is the transformed source placement for the current bundle instance.

### 3. Rotation and scale semantics stay explicit

- `move` updates point-based placement metadata only
- `rotate` updates both position and rotation metadata
- `scale` updates point-based placement metadata and text height, but does not invent rotation changes

### 4. Source-type-specific sync remains correct

`DIMENSION` still has two coupled placement truths:

- visible text `position / rotation`
- dimension metadata `dimTextPos / dimTextRotation`

Step223 keeps those fields in sync under both:

- full-bundle transforms
- later `srcplace` resets

`LEADER` keeps the lighter contract:

- visible text `position / rotation`
- preserved `sourceTextPos / sourceTextRotation`

### 5. Release and detached copy still clear imported placement provenance

This slice does not relax the detach boundary.

Released or detached geometry still clears:

- `sourceType`
- `editMode`
- `proxyKind`
- `sourceTextPos`
- `sourceTextRotation`
- `dimTextPos`
- `dimTextRotation`

The new behavior only strengthens the imported proxy workflow before detachment.

## Implementation

### Transform layer

`tools/web_viewer/tools/geometry.js`

Adds metadata-aware text transforms so that text entities carry:

- `sourceTextPos`
- `sourceTextRotation`
- `dimTextPos`
- `dimTextRotation`

through:

- `transformEntityByDelta()`
- `rotateEntity()`
- `scaleEntity()`

### Command layer

`tools/web_viewer/commands/command_registry.js`

No new command was required.

Step223 instead completes the existing contract between:

- grouped-source `move / rotate / scale`
- Step222 `selection.sourceResetTextPlacement`

The reset command now works correctly after source-group transforms because its target metadata remains current.

### Test layer

`tools/web_viewer/tests/editor_commands.test.js`

Adds combined transform-and-reset coverage for:

- moved `DIMENSION` source text
- rotated `LEADER` source text
- scaled `DIMENSION` source text

### Browser layer

`tools/web_viewer/scripts/editor_source_group_smoke.js`

Extends the real browser path to verify:

- full grouped `DIMENSION` move
- focused imported source text after that move
- transformed `Source Text Pos`
- direct placement drift after the move
- `Reset Source Text Placement` returning to the transformed source

## Out Of Scope

Step223 does not yet add:

- canvas source-anchor widgets
- leader landing handles
- dimension-specific placement presets
- multi-anchor annotation authoring UI

This slice is about transform-correct reversible source placement, not new authoring controls.
