# Step240: Editor Insert Attribute Flag Behavior Design

## Goal

Turn imported `INSERT` attribute flags from metadata-only badges into real editor behavior.

## Why This Slice

- Step237 established the narrow `INSERT / text / proxy` value-only edit path for real imported `ATTRIB / ATTDEF`.
- Step238 surfaced authoritative `attribute_flags` plus decoded booleans such as `attributeInvisible` and `attributeConstant`.
- Step239 separated `ATTDEF` default text from prompt metadata.
- The remaining gap was behavioral: `invisible` and `constant` were visible in the UI, but they did not yet change editor behavior.

## Contract

For real imported `INSERT / text / proxy` entities:

- `attributeConstant = true`
  - blocks direct in-place `value` edits
  - keeps the proxy read-only until the insert is released
- `attributeInvisible = true`
  - hides the proxy from default rendering and visible-entity queries
  - does not remove the proxy from the logical insert group
  - does not prevent explicit inspection when the user intentionally narrows to insert text

The narrow insert-text proxy contract remains otherwise unchanged:

- imported `INSERT` text proxies still only allow `value`
- `position`, `height`, and `rotation` remain read-only
- full-group `move / rotate / scale / copy / delete` stay instance-level
- `Release Insert Group` still detaches the instance into editable geometry

## New Workflow Surface

Hidden insert text must stay reachable without making hidden geometry generally pickable.

This slice adds a narrow focus path:

- property action: `Select Insert Text`
- command line: `instext`
- command line alias: `inserttext`
- command id: `selection.insertSelectText`

Behavior:

- starts from any member of an imported insert group
- narrows selection to the group's text members, including hidden ones
- preserves imported `INSERT / text / proxy` provenance
- keeps the insert-group overlay visible even when the focused text proxy itself is hidden

## Visibility And Selection Semantics

Hidden insert text proxies are intentionally not treated like normal visible geometry:

- they are excluded from `listVisibleEntities()` and default canvas filtering
- they remain inspectable once explicitly focused through the insert-text workflow
- selection pruning must not drop a focused hidden insert text proxy after a successful value edit

That means Step240 is not “make hidden attributes visible”; it is “make hidden attributes intentionally reachable”.

## Implementation Notes

- `tools/web_viewer/adapters/cadgf_document_adapter.js`
  - maps imported `attribute_invisible` onto editor-side `visible: false` for real imported insert text proxies
- `tools/web_viewer/state/documentState.js`
  - applies the same invisible fallback during `restore()` so older editor snapshots do not regress
- `tools/web_viewer/insert_group.js`
  - distinguishes generic insert text proxies from directly editable ones
  - treats `attributeConstant` as the gate for direct in-place value edits
  - enumerates insert-group text members for focus workflows
- `tools/web_viewer/commands/command_registry.js`
  - adds `selection.insertSelectText`
  - rejects direct `selection.propertyPatch({ value })` on constant insert text proxies
- `tools/web_viewer/ui/workspace.js`
  - exposes `instext` / `inserttext`
  - preserves focused hidden insert text during selection pruning after document changes
  - keeps insert/source overlays alive for grouped hidden text selection
- `tools/web_viewer/ui/property_panel.js`
  - surfaces `Entity Visibility`
  - adds `Select Insert Text`
  - explains constant and invisible proxy behavior with explicit read-only notes
- `tools/web_viewer/ui/selection_presenter.js`
  - surfaces `entity-visibility` in the quicklook contract
- `tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - validates hidden constant and hidden editable insert-text paths in the browser
- `tools/web_viewer/tests/editor_commands.test.js`
  - locks command-layer behavior for hidden constant and hidden editable insert text proxies

## Out Of Scope

- general hidden-entity picking
- editing `attribute_tag`, `attribute_prompt`, or `attribute_flags`
- creating new attribute definitions in the editor
- peer-preserving text-only insert navigation across layouts
- full attribute authoring semantics beyond the current value-only proxy contract
