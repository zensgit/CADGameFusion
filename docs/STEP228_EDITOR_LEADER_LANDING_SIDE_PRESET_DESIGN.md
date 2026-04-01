# Step228: Editor LEADER Landing Side Preset Design

## Goal
Turn imported `LEADER` text placement from a read-only guide into a stable preset action: users can mirror text to the opposite side of the real landing guide without releasing the source bundle.

## Why This Slice
- `Fit Leader Landing` made the imported landing geometry inspectable, but not directly operable.
- `DIMENSION` already had a narrow reversible side preset; `LEADER` still lagged behind on concrete text-placement control.
- This slice goes beyond reference editors that typically require explode/release before any meaningful leader text-side change.

## Contract
Imported `LEADER` source text now supports:
- property action `Use Opposite Landing Side`
- command-line `leadflip`
- command-line alias `leaderflip`
- command id `selection.leaderFlipLandingSide`

The preset:
- mirrors the preserved `sourceOffset` across the real landing line defined by `elbow -> landing`
- keeps `sourceTextPos` and `sourceTextRotation` untouched
- updates only the current editable proxy placement
- stays valid after whole-bundle `move / rotate / scale`, because it derives from the transformed landing guide at execution time
- remains reversible through `srcplace`

## Implementation Notes
- `command_registry.js` adds `buildLeaderOppositeLandingSidePatch()` and `runFlipLeaderLandingSide()`.
- The mirror is geometric, not metadata-driven:
  - parallel component along the landing direction is preserved
  - perpendicular component is negated
- `property_panel.js` exposes the action only for imported `LEADER` source text with a resolved landing guide.
- `workspace.js` wires `leadflip` / `leaderflip` through the same command path as the property action.
- `editor_source_group_smoke.js` validates the real browser path and checks that flipped placement changes `current-offset` while preserved source placement remains intact.

## Out Of Scope
- Editing leader elbow or landing geometry itself
- Synthesizing attachment enums or dogleg metadata
- General freeform leader authoring after release
