# Step236: Editor INSERT Proxy Text Override Design

## Goal

Allow imported `INSERT` text proxies to accept narrow in-place text corrections without forcing `Release Insert Group`, while keeping block-instance geometry and provenance boundaries intact.

## Why This Slice

- Imported `INSERT` workflow already supports instance-level `move / rotate / scale / copy / delete / release`, but tag-like proxy text still required a full release before any edit.
- That lagged behind the existing direct proxy text workflows for imported `DIMENSION / LEADER / TABLE`.
- The highest-value safe contract is text-value correction only. It solves a real workflow gap without pretending imported block-local text is native editable geometry.

## Contract

Single imported `INSERT` text proxies now support:

- direct property-panel `value` override
- `selection.propertyPatch` with `{ value }`
- preserved `sourceType = INSERT`
- preserved `editMode = proxy`
- preserved `proxyKind = text`
- preserved `groupId / blockName / space / layout`

Single imported `INSERT` text proxies still reject:

- `position`
- `height`
- `rotation`
- any mixed patch that includes geometry fields

So the text can be corrected in place, but instance geometry remains proxy-only until release.

## UI Semantics

When a single imported `INSERT` text proxy is selected:

- the property panel shows the existing insert-group metadata/actions
- the read-only note explicitly says text value overrides remain editable while instance geometry stays proxy-only
- only the `Text` input is rendered
- `Position X / Position Y / Height / Rotation` are intentionally hidden

This keeps the workflow consistent with the existing direct-edit source-text contract, but narrower.

## Implementation Notes

- `insert_group.js`
  - adds `isDirectEditableInsertTextProxyEntity`
- `command_registry.js`
  - adds `buildDirectEditableInsertTextProxyPatch`
  - extends read-only `selection.propertyPatch` handling so imported `INSERT` text proxies accept value-only edits
- `property_panel.js`
  - recognizes imported `INSERT` text proxies as a narrow direct-edit case
  - renders only the `value` field for that case
- `editor_commands.test.js`
  - covers value-only patch success
  - covers geometry patch rejection
  - covers export preserving `INSERT / text / proxy` provenance after the text edit
- `editor_insert_group_smoke.js`
  - validates the browser path before release
  - keeps the old release-to-editable path as regression coverage

## Out Of Scope

- true block attribute semantics such as `tag / prompt / constant / invisible`
- editing imported `INSERT` proxy text position, rotation, or height in place
- adding a new insert-text-specific command surface
- converting imported `INSERT` proxy text into native editable geometry without release
