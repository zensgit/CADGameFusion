# Step296 Property Panel Info Rows Extraction Design

## Goal

Reduce the remaining fact-generation weight inside `property_panel.js` without changing any user-visible property metadata contract.

## Problem

After Steps 291-295, `property_panel.js` still owned one large mixed-responsibility block:

- entity metadata fact collection
- source/insert group info row construction
- released insert archive info row construction
- compact formatting helpers used only by those rows

That left the panel file doing both branch orchestration and read-only metadata assembly.

## Design

Extract all info-row assembly into a new pure builder module:

- `tools/web_viewer/ui/property_panel_info_rows.js`

The new module exports:

- `buildEntityMetadataInfoRows(...)`
- `buildSourceGroupInfoRows(...)`
- `buildInsertGroupInfoRows(...)`
- `buildReleasedInsertArchiveSelectionInfoRows(...)`

These builders return descriptor rows shaped like:

```js
{ key, label, value }
```

They do not touch DOM.

## Boundaries

`property_panel.js` now remains responsible for:

- selection branch orchestration
- action row rendering
- field rendering
- appending info rows to DOM

`property_panel_info_rows.js` is responsible for:

- formatting compact numeric and peer-context strings
- deriving group bounds for source/insert groups
- converting released archive context into property info rows
- forwarding presenter property metadata facts into property-panel rows

## Non-Goals

- No change to property action ids or labels
- No change to field descriptors
- No presenter contract rewrite
- No smoke contract changes

## Expected Outcome

`property_panel.js` becomes more purely an orchestration shell, while all metadata/info contracts remain byte-for-byte stable for downstream tests and smoke scripts.
