# Step219 Editor Source Text Edit Workflow Design

## Goal

Turn grouped imported annotation bundles with text into a one-step authoring workflow instead of a two-step recovery workflow.

Before Step219, grouped non-`INSERT` source bundles already supported:

- select whole bundle
- fit to bounds
- move / rotate / scale
- copy / delete
- release to editable geometry

But for the most important annotation cases, especially:

- `DIMENSION`
- `LEADER`

the user still had to:

1. release the bundle
2. manually reselect the released text member
3. only then start editing the annotation text

Step219 removes that extra manual reselection step.

## Why This Slice

This is a better benchmark move than adding another metadata row because it shortens a real user workflow:

- imported dimension text correction
- imported leader note cleanup
- annotation rewrite after import

Reference implementations often stop at “explode/release succeeded”. Step219 goes one step further by turning release into an editing workflow, not just a data-state transition.

## Contract

### 1. New source-text edit command

New command:

- `selection.sourceEditGroupText`

New command-line entry:

- `srcedit`

The command:

- validates the grouped non-`INSERT` source bundle
- releases the whole bundle to editable native geometry
- automatically narrows selection to the released text member(s)

### 2. Property action for discoverability

Grouped source bundles with text members now expose:

- `Release & Edit Source Text`

This action appears for grouped non-`INSERT` bundles only when the bundle contains at least one text member.

It does not appear for source bundles without text, such as the current hatch fixture.

### 3. Selection focus after release is intentional

When `srcedit` / `Release & Edit Source Text` succeeds:

- the whole bundle is still released
- but the resulting selection narrows to released text members only

This is the key operational change. The user lands directly on the most likely editing target instead of being left on a whole-bundle selection.

### 4. Source bundles without text fail explicitly

If the source bundle has no text members, the new command returns a stable error:

- `GROUP_HAS_NO_TEXT`

This avoids pretending that every grouped source bundle has a text-edit affordance.

### 5. Existing release remains available

Step219 does not replace the broader grouped-source release contract.

Users still have:

- `Release Source Group`
- `srcrel`

when they want the full bundle detached but do not want the editor to narrow selection to text.

### 6. Insert workflow remains separate

This is not an `INSERT` feature.

Imported block/reference workflows remain on their own path with:

- peer navigation
- editable-member narrowing
- insert release semantics

Step219 is specifically about source-derived annotation bundles where text editing is the highest-value follow-up action.

## Implementation

### Shared helper layer

`tools/web_viewer/insert_group.js`

Adds:

- `listSourceGroupTextMembers()`

so both command and UI layers can reason about grouped-source text targets using the same group/layout scoping rules.

### Command layer

`tools/web_viewer/commands/command_registry.js`

Adds:

- `resolveReleasableSourceGroup()`
- `applyReleasedSourceGroup()`
- `runEditSourceGroupText()`
- `selection.sourceEditGroupText`

The new command reuses the grouped-source release safety checks:

- non-`INSERT` grouped source only
- same-layout bundle summary
- releasable member types only
- locked-layer rejection

then selects the released text members instead of the full released bundle.

### Property/workspace layer

`tools/web_viewer/ui/property_panel.js`
`tools/web_viewer/ui/workspace.js`

Adds:

- property action `Release & Edit Source Text`
- command-line `srcedit`

and updates the grouped-source read-only note so users understand that text-directed release is available when the bundle contains text.

### Browser fixture/smoke layer

`tools/web_viewer/tests/fixtures/editor_source_group_fixture.json`
`tools/web_viewer/scripts/editor_source_group_smoke.js`

The fixture now includes:

- grouped `DIMENSION`
- grouped `LEADER`
- grouped `HATCH`

The smoke verifies:

- `DIMENSION` uses command-line `srcedit`
- `LEADER` uses property action `Release & Edit Source Text`
- both paths release to editable text without stale grouped-source provenance
- `HATCH` keeps the non-text bundle path and still uses grouped delete

## Out Of Scope

Step219 does not yet add:

- source-type-specific dimension editing tools
- leader arrow/head editing tools
- hatch pattern editing UI
- refedit/block-definition authoring

This slice is about the shortest useful post-release authoring path for imported annotation text, not about full annotation feature parity.
