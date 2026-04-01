# Step244: Editor Released Insert Attribute Normalization Design

## Goal

When imported `ATTRIB / ATTDEF` text is released from an `INSERT`, the resulting entity should behave like plain editable text, not like a detached text entity that still carries active attribute contract fields.

## Why This Slice

- Step237 through Step243 made imported insert-attribute proxy behavior much stronger.
- That sharper contract exposed a real inconsistency:
  - `selection.insertEditText` detached the text from `INSERT`
  - but the released text still retained active `attribute_*` fields and `textKind`
  - detached constant text could therefore keep attribute semantics alive after release

That is the wrong product boundary. Release is the escape hatch from imported-instance semantics, so the result should be native text semantics.

## Contract

For text released through:

- `selection.insertEditText`
- `selection.insertReleaseGroup`

released insert text now normalizes to plain text semantics:

- clears:
  - `sourceType`
  - `editMode`
  - `proxyKind`
  - `groupId`
  - `blockName`
  - `textKind`
  - `attributeTag`
  - `attributeDefault`
  - `attributePrompt`
  - `attributeFlags`
  - `attributeInvisible`
  - `attributeConstant`
  - `attributeVerify`
  - `attributePreset`
  - `attributeLockPosition`
  - `sourceTextPos`
  - `sourceTextRotation`
- keeps:
  - geometry
  - layer
  - color/style facts that still make sense for plain text
  - current edited value

## User-Facing Effect

After release:

- detached text edits like native text again
- constant/invisible/lock-position no longer interfere with detached editing
- detached text stops looking like live attribute data in property/selection UI
- export no longer writes stale `attribute_*` fields back out for released text

## Implementation Notes

- `tools/web_viewer/commands/command_registry.js`
  - `buildReleasedInsertEntity()` now clears active attribute contract fields in addition to imported insert provenance

- `tools/web_viewer/tests/editor_commands.test.js`
  - released insert text test now locks:
    - attribute metadata cleared
    - detached text value edits succeed

- `tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - existing hidden constant release-edit path now doubles as a real browser regression:
    - released hidden constant text becomes editable plain text

## Out Of Scope

- archived provenance fields for released attribute history
- full attribute authoring
- block/reference-aware attribute editing after release
