# Step222 Editor Source Text Placement Reset Design

## Goal

Turn imported source-text editing into a reversible workflow instead of a one-way override.

After Step220 and Step221, imported `DIMENSION` / `LEADER` text proxies already supported:

- direct in-place text edits
- grouped-source text focus without release
- release-and-edit when detachment was desired

But once text placement changed, the editor had no first-class way to return to the imported source placement. Step222 adds that missing source-type-specific placement affordance.

## Why This Slice

This is a stronger benchmark move than just exposing editable fields because it supports a real CAD correction loop:

1. inspect imported annotation
2. adjust text placement
3. compare against source placement
4. restore source placement when needed

Reference-grade tools often force users into:

- manual numeric re-entry
- explode/reimport
- no clear separation between current placement and source placement

Step222 adds an explicit reversible contract.

## Contract

### 1. Preserve original imported source text placement

Imported `DIMENSION` / `LEADER` text proxies now keep editor-side source placement metadata:

- `sourceTextPos`
- `sourceTextRotation`

This data is cached from import and survives in editor state even after direct in-place edits move the current text.

### 2. New reset command

New command:

- `selection.sourceResetTextPlacement`

New command-line entry:

- `srcplace`

The command works on:

- a focused source text proxy
- any grouped non-`INSERT` source selection that contains source text

It restores the proxy text back to its preserved source placement without releasing the source bundle.

### 3. Dimension-specific sync stays intact

For `DIMENSION` text proxies, resetting placement restores both:

- visible text `position / rotation`
- dimension metadata `dimTextPos / dimTextRotation`

This keeps current text placement and dimension metadata from drifting apart.

### 4. Property action parity

The property panel now exposes:

- `Reset Source Text Placement`

for:

- direct editable source text proxies with preserved source placement
- grouped non-`INSERT` source selections whose text members carry preserved source placement

This keeps the command path and UI path on the same contract.

### 5. Source placement becomes inspectable

Quicklook/property metadata now surface:

- `Source Text Pos`
- `Source Text Rotation`

This makes the comparison explicit:

- current text placement
- original imported source placement

### 6. Release still clears imported placement state

`Release Source Group` and `Release & Edit Source Text` still detach the imported source contract.

Once a source bundle is released:

- `sourceType`
- `editMode`
- `proxyKind`
- `sourceTextPos`
- `sourceTextRotation`

are removed with the rest of the imported-source metadata.

## Implementation

### Import/state layer

`tools/web_viewer/adapters/cadgf_document_adapter.js`
`tools/web_viewer/state/documentState.js`

Add editor-side source placement capture for imported `DIMENSION` / `LEADER` text proxies.

For `DIMENSION`, source placement prefers:

- `dim_text_pos`
- `dim_text_rotation`

For `LEADER`, source placement falls back to:

- text `pos`
- text `rot`

### Command layer

`tools/web_viewer/commands/command_registry.js`

Adds:

- `hasSourceTextPlacement()`
- `buildSourceTextPlacementResetPatch()`
- `runResetSourceTextPlacement()`
- `selection.sourceResetTextPlacement`

This command is group-aware and layout-scoped because it reuses existing source-group resolution.

### Presentation layer

`tools/web_viewer/ui/selection_presenter.js`
`tools/web_viewer/ui/property_panel.js`
`tools/web_viewer/ui/workspace.js`

Add:

- `Source Text Pos`
- `Source Text Rotation`
- property action `Reset Source Text Placement`
- command-line `srcplace`

### Browser workflow coverage

`tools/web_viewer/scripts/editor_source_group_smoke.js`

Now verifies:

- grouped `DIMENSION` focuses text proxy, edits placement, then resets via property action
- grouped `LEADER` focuses text proxy, edits placement, then resets via `srcplace`
- both paths preserve imported proxy provenance after reset
- Step219 release-and-edit still works afterward

## Out Of Scope

Step222 does not yet add:

- visual source-anchor overlay in canvas
- leader landing/attachment editing widgets
- dimension-line-specific placement tools
- preview/editor shared text-box extents math

This slice is about reversible source-text placement, not full annotation authoring parity.
