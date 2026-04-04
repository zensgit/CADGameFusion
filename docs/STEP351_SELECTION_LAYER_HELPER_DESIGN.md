# Step351 Selection Layer Helper Design

## Goal

Extract the duplicated `resolveLayer(getLayer, layerId)` helper logic that is currently repeated across multiple selection-related modules into a dedicated shared leaf helper.

This step should reduce duplication without changing any public behavior.

## Scope

Adopt a shared layer helper in the following modules where the local `resolveLayer(...)` logic is identical:

- `tools/web_viewer/ui/selection_meta_helpers.js`
- `tools/web_viewer/ui/selection_contract.js`
- `tools/web_viewer/ui/selection_detail_facts.js`
- `tools/web_viewer/ui/selection_presentation.js`

Compatibility requirement:

- `tools/web_viewer/ui/selection_editability_helpers.js` must continue exporting `resolveLayer(...)`

That means the new shared layer helper should become the canonical source, and `selection_editability_helpers.js` should re-export it.

## Non-Goals

Do not change:

- `supportsInsertTextPositionEditing(...)`
- any selection contract behavior
- any selection detail fact behavior
- any selection presentation behavior
- any selection meta formatting behavior
- note plan or property panel behavior
- object shapes, labels, ordering, or text semantics

Do not bundle unrelated helper cleanup into this step.

## Intended Structure

Create a dedicated leaf helper module:

- `tools/web_viewer/ui/selection_layer_helpers.js`

It should export:

- `resolveLayer(getLayer, layerId)`

Then update the target modules to import from that helper instead of defining a local duplicate.

Also update:

- `tools/web_viewer/ui/selection_editability_helpers.js`

to re-export `resolveLayer(...)` from the new shared helper so existing imports keep working.

## Constraints

- No behavior changes.
- No new dependency cycles.
- Keep the new helper module leaf-level and minimal.
- Preserve the existing public contract of `selection_editability_helpers.js`.

## Acceptance

Step351 is complete when:

1. duplicated `resolveLayer(...)` implementations are removed from the target modules
2. the new leaf helper is the canonical source
3. `selection_editability_helpers.js` still exports `resolveLayer(...)`
4. focused tests and `editor_commands.test.js` still pass
5. `git diff --check` is clean
