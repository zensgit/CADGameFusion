# Step242: Editor Insert Attribute Position Lock Design

## Goal

Turn imported `INSERT` attribute `lock-position` from a read-only badge into real in-place editor behavior.

## Why This Slice

- Step237 established the narrow imported `INSERT / text / proxy` text-edit path.
- Step238 surfaced authoritative attribute metadata, including `attribute_lock_position`.
- Step240 made `constant` and `invisible` behavioral, but `lock-position` was still descriptive only.
- The remaining high-value gap was attribute placement semantics: users need to see a real difference between unlocked and position-locked imported attributes without detaching the whole insert.

## Contract

For real imported inserted `ATTRIB / ATTDEF` text proxies:

- `attribute_lock_position = true`
  - keeps the in-place contract value-only
  - hides `position.x / position.y`
  - rejects direct position patches
  - makes the property note explicit that position stays locked until release

- `attribute_lock_position = false`
  - keeps `value` editable in place
  - also allows direct in-place edits of `position.x / position.y`
  - preserves full `INSERT / text / proxy` provenance
  - keeps `height / rotation` read-only

This slice is intentionally narrower than a full attribute editor:

- it does not add free rotation/height editing
- it does not change full-group `move / rotate / scale / copy / delete`
- it does not change `Release Insert Group`

## Scope Boundary

The widened position-edit path applies only to real imported attribute text that carries authoritative lock metadata.

That means:

- real imported `ATTRIB / ATTDEF` with explicit `attribute_lock_position = false`
  - can edit `value + position`
- real imported `ATTRIB / ATTDEF` with explicit `attribute_lock_position = true`
  - stay `value`-only
- generic imported insert text proxies without attribute metadata
  - stay on the older `value`-only contract

This avoids accidentally widening generic tag-like `INSERT` proxy text such as fixture-only door tags.

## UI Semantics

The property panel now reflects three distinct states:

- imported attribute text, unlocked:
  - shows `value`
  - shows `position.x / position.y`
  - note explains that text position stays editable while instance geometry remains proxy-only

- imported attribute text, lock-positioned:
  - shows `value`
  - hides `position.x / position.y`
  - note explains that position stays lock-positioned until release

- generic imported insert text proxy:
  - still shows `value` only
  - keeps the older proxy-only note

## Implementation Notes

- `tools/web_viewer/commands/command_registry.js`
  - widens `buildDirectEditableInsertTextProxyPatch()` so `position` is accepted only when authoritative `attributeLockPosition === false`
  - keeps generic insert text proxies and lock-positioned attributes on the value-only path
- `tools/web_viewer/ui/property_panel.js`
  - exposes `position.x / position.y` only for unlocked imported attribute proxies
  - updates read-only notes to distinguish unlocked vs lock-positioned imported attributes
- `tools/web_viewer/tests/editor_commands.test.js`
  - locks the split behavior between:
    - generic insert text proxy
    - lock-positioned imported attribute
    - unlocked imported attribute
- `tools/web_viewer/scripts/editor_insert_attribute_smoke.js`
  - validates real browser behavior for:
    - lock-positioned imported `ATTRIB`
    - unlocked imported `ATTDEF`
    - hidden unlocked imported attribute

## Out Of Scope

- editing `height` or `rotation` on imported insert attributes
- authoring new `ATTRIB / ATTDEF`
- editing `attribute_tag`, `attribute_prompt`, or `attribute_flags`
- changing full insert-instance transform/release semantics
- widening generic insert text proxies beyond the existing value-only contract
