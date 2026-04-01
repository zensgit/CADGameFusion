# Step235: Editor Imported TABLE Proxy Design

## Goal

Bring real imported `TABLE` text-only payloads into the same editor-side source/proxy workflow already used by imported `MLEADER`, without inventing unsupported table geometry or cell-grid heuristics.

## Why This Slice

- Real imported `TABLE` already reaches CADGF as `TEXT + text_kind=table`, but until now the editor treated it like plain editable text with no provenance.
- That left a real imported annotation class behind the richer `DIMENSION / LEADER / MLEADER` workflows.
- `TABLE` is narrow and evidence-backed: current importer output is text-only, so the correct next step is provenance-aware text proxy behavior, not guessed row/column geometry.

## Contract

Imported `TEXT` entities with `text_kind=table` and no explicit source metadata now import into the editor as:

- `sourceType = TABLE`
- `editMode = proxy`
- `proxyKind = table`
- synthetic single-entity `groupId`
- `sourceTextPos / sourceTextRotation` copied from imported text geometry

That makes real imported `TABLE` notes participate in the existing source/proxy command surface:

- direct in-place text overrides for `value / position / height / rotation`
- `srcplace` / `Reset Source Text Placement`
- `Fit Source Group`
- `Fit Source Anchor`
- `Release & Edit Source Text`
- `Release Source Group`

## Guide Semantics

Text-only `TABLE` uses the same minimal self-anchor rule as other text-only imported proxies:

- `Source Anchor = Source Text Pos`
- `Source Offset = 0, 0` when unmodified
- no synthetic driver entity
- no synthetic elbow or landing geometry

So the workflow is inspectable and reversible, but it does not pretend the importer provided a real table frame or attachment path.

## Implementation Notes

- `cadgf_document_adapter.js`
  - infers `TABLE / proxy / table` for imported `TEXT` entities with `text_kind=table`
  - assigns a synthetic single-entity `groupId` when the payload has none
  - preserves `text_kind=table` through import and export
- `insert_group.js`, `command_registry.js`, `property_panel.js`
  - broaden direct-editable source text handling from `DIMENSION / LEADER` to include `TABLE`
  - keep `DIMENSION`-only and `LEADER`-only specialized actions narrow
- `editor_commands.test.js`
  - covers adapter inference/export, direct patch/reset, and release-to-editable
- `editor_table_smoke.js`
  - validates the real imported browser path from a fixture copied from `step186_table_sample.dxf`

## Out Of Scope

- reconstructing table rows, cells, borders, or attachment frames from current importer output
- adding new `TABLE`-specific commands
- pretending text-only `TABLE` has a real anchor driver or leader-like landing geometry
