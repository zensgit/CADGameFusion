# Step243: Editor Insert Editable Text Selection Design

## Goal

Turn mixed imported `INSERT` text selection into an explicit workflow: users should be able to narrow an insert group to directly editable text proxies only, without dragging constant text along.

## Why This Slice

- Step237 and Step238 established the real imported `ATTRIB / ATTDEF` proxy contract.
- Step240 and Step242 made `constant / invisible / lock-position` behavioral.
- The remaining workflow gap was selection scope, not metadata:
  - `Select Insert Text` correctly finds all insert text members
  - mixed groups still lacked a first-class way to skip constant text and land only on directly editable text

Without that narrower scope, users have to manually disambiguate text members or immediately hit read-only constant proxies in otherwise editable attribute groups.

## Contract

For imported `INSERT` groups:

- `Select Insert Text`
  - selects all text members in the current insert group
  - includes both editable and read-only text proxies

- `Select Editable Insert Text`
  - selects only directly editable insert text proxies
  - currently excludes constant insert text proxies
  - preserves `INSERT / text / proxy` provenance
  - keeps the insert-group overlay active

- Command aliases:
  - `instext` / `inserttext`
    - all insert text members
  - `instextedit` / `inserteditabletext`
    - editable insert text subset only

## Peer Scope

Insert peer navigation now treats `editable-text` as a first-class insert selection scope.

That means:

- single-fragment scope stays single-fragment
- full-group scope stays full-group
- text-only scope stays text-only
- editable-only scope stays editable-only
- editable-text scope now also stays editable-text

So once a user narrows to directly editable text, peer-targeting across layouts should keep that same semantic scope instead of collapsing back to a single fragment or broadening back to all text.

## UI Semantics

For mixed imported insert-attribute groups:

- the driver line or any same-group member can surface both:
  - `Select Insert Text`
  - `Select Editable Insert Text`

- choosing the first action selects all text proxies
- choosing the second action selects only directly editable text proxies

This slice is intentionally selection-only:

- it does not widen property edit permissions
- it does not change `Release Insert Group`
- it does not invent behavior for `attribute_verify` or `attribute_preset`

## Implementation Notes

- `tools/web_viewer/insert_group.js`
  - adds `listEditableInsertTextMembers()`
  - adds `editable-text` to insert selection scope classification
  - preserves that scope during peer targeting

- `tools/web_viewer/commands/command_registry.js`
  - adds `selection.insertSelectEditableText`
  - returns `GROUP_HAS_NO_EDITABLE_TEXT` when the group has no directly editable text members

- `tools/web_viewer/ui/property_panel.js`
  - exposes `Select Editable Insert Text (N)` for mixed insert groups

- `tools/web_viewer/ui/workspace.js`
  - adds `instextedit` / `inserteditabletext`

- `tools/web_viewer/tests/editor_commands.test.js`
  - locks the difference between:
    - all insert text
    - editable insert text only
    - no-editable-text failure

- `tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - extends the generated fixture with a mixed imported attribute group
  - proves the property action and command path both land on the editable proxy only

## Out Of Scope

- new attribute authoring
- release normalization for detached attribute text
- post-import behavior for `attribute_verify` or `attribute_preset`
- generic non-attribute insert text semantics
