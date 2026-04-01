# Step221 Editor Source Text Focus Workflow Design

## Goal

Turn Step220's direct proxy text editing capability into a complete grouped-source workflow.

Before Step221, imported `DIMENSION` / `LEADER` text proxies were already directly editable in place, but only after the user explicitly selected the text proxy itself. That still left a workflow gap:

- users often click a dimension line or leader line first
- grouped-source selections already exposed bundle actions
- but there was no one-step path from the bundle to the imported text proxy without release

Step221 closes that gap.

## Why This Slice

This is the next high-value move after Step220 because it upgrades a narrow capability into an ergonomic authoring path:

- pick any member of the imported annotation bundle
- focus the source text proxy
- edit wording in place
- keep provenance intact

Many reference implementations stop at:

- grouped selection
- explode/release
- manual reselection of text

Step221 is stronger because it supports imported annotation cleanup without either of those extra detours.

## Contract

### 1. New source-text focus command

New command:

- `selection.sourceSelectText`

New command-line entry:

- `srctext`

The command:

- resolves the grouped non-`INSERT` source bundle from the current selection
- finds text members in the same `space / layout`
- narrows selection to those text proxies
- preserves imported/source-group provenance

### 2. Property action for grouped-source discoverability

Grouped non-`INSERT` source bundles with text now expose:

- `Select Source Text`

This action appears alongside:

- `Select Source Group`
- `Fit Source Group`
- `Release & Edit Source Text`
- `Release Source Group`

### 3. No release is performed

Unlike `srcedit`, this command does not detach geometry.

After `selection.sourceSelectText`:

- `groupId` remains
- `sourceType` remains
- `editMode` remains `proxy`
- `proxyKind` remains

This is the distinguishing contract: the editor focuses the imported text proxy, it does not convert the bundle into native geometry.

### 4. Step220 and Step219 stay separate

The product now exposes three distinct levels:

- `Select Source Text` / `srctext`
  - focus imported text proxy in place
- direct property edit on the selected text proxy
  - update wording/position/rotation while preserving provenance
- `Release & Edit Source Text` / `srcedit`
  - detach bundle, then focus released text

That separation is important. Users can now choose the lightest workflow that fits the task.

### 5. Groups without text fail explicitly

If a grouped source bundle has no text members, the new command returns:

- `GROUP_HAS_NO_TEXT`

This keeps hatch-like source bundles on their existing grouped bundle path instead of pretending every source bundle is text-editable.

## Implementation

### Command layer

`tools/web_viewer/commands/command_registry.js`

Adds:

- `runSelectSourceGroupText()`
- `selection.sourceSelectText`

The command reuses existing grouped-source resolution rules:

- same `groupId`
- same `sourceType`
- same `space / layout`
- non-`INSERT` only

### Property/workspace layer

`tools/web_viewer/ui/property_panel.js`
`tools/web_viewer/ui/workspace.js`

Adds:

- property action `Select Source Text`
- command-line `srctext`

This keeps property and command routes on the same selection contract instead of creating another debug-only path.

### Browser workflow layer

`tools/web_viewer/scripts/editor_source_group_smoke.js`

Now verifies two new real-browser focus paths:

- grouped `DIMENSION` uses property action `Select Source Text`
- grouped `LEADER` uses command-line `srctext`

Both then edit imported text in place through the real property form while preserving grouped-source provenance.

### Test layer

`tools/web_viewer/tests/editor_commands.test.js`

Locks:

- grouped `DIMENSION` to source-text proxy narrowing
- grouped `LEADER` to source-text proxy narrowing
- `GROUP_HAS_NO_TEXT` for hatch-like bundles
- post-selection in-place edits that preserve proxy provenance

## Out Of Scope

Step221 does not add:

- source-type-specific leader geometry editing
- dimension-line editing on imported proxies
- multi-text bundle text-choice UI
- full annotation refedit/source-definition authoring

This slice is only about making imported source text easy to reach and edit without forcing release.
