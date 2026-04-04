# Step350 Selection Display Helper Adoption Design

## Goal

Adopt the shared selection display helper module introduced in Step349 from two remaining call sites:

- `tools/web_viewer/ui/property_metadata_facts.js`
- `tools/web_viewer/ui/selection_action_context.js`

This step should reduce the remaining duplicated display-formatting logic without changing any public behavior.

## Scope

Only replace duplicated helper logic that is already represented in:

- `tools/web_viewer/ui/selection_display_helpers.js`

Expected adoption targets:

- compact numeric formatting
- point formatting
- peer context formatting
- peer target formatting

## Non-Goals

Do not change:

- `buildPropertyMetadataFacts(...)`
- `buildSelectionActionContext(...)`
- fact ordering
- action-context object shape
- peer target text
- selection matching semantics
- property panel behavior
- `selection_display_helpers.js` public behavior

Do not expand this step into a broader presenter or property-panel refactor.

## Intended Structure

Update:

- `tools/web_viewer/ui/property_metadata_facts.js`
- `tools/web_viewer/ui/selection_action_context.js`

to import shared helpers from `tools/web_viewer/ui/selection_display_helpers.js` instead of defining duplicate local helpers.

Keep call-site-specific logic local. For example:

- `pushFact(...)`
- `insertFactsAfterFirstKey(...)`
- `idsEqual(...)`
- `hasSourceTextPlacement(...)`
- `buildPeerTargets(...)`

should stay in their current files.

## Constraints

- No new dependency cycles.
- No text drift in generated facts or peer target labels.
- Keep the change as a narrow adoption step on top of Step349.

## Acceptance

Step350 is complete when:

1. the duplicated helper logic is removed from both target files
2. both files import the shared display helper module
3. focused tests and `editor_commands.test.js` still pass
4. `git diff --check` is clean
