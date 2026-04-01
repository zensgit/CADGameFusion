# Step282 Editor Entity Style Normalization Design

## Goal

Take the first object-level normalization step after Step281:

- extract shared imported `entity style` normalization
- keep `documentState` and CADGF import semantics aligned
- avoid broadening into attribute/proxy metadata refactors in the same step

## Problem

Even after primitive helper extraction, these two modules still carried parallel style-object logic:

- [documentState.js](../tools/web_viewer/state/documentState.js)
- [cadgf_document_adapter.js](../tools/web_viewer/adapters/cadgf_document_adapter.js)

Both were normalizing the same imported editor style contract:

- `lineType`
- `lineWeight`
- `lineWeightSource`
- `lineTypeScale`
- `lineTypeScaleSource`

The only real difference was source-field policy:

- `documentState` honors explicit `lineWeightSource/lineTypeScaleSource` aliases
- CADGF import keeps its older "explicit-by-value-presence" semantics

That is exactly the kind of duplication that drifts quietly over time.

## Design

### 1. Add a shared object-level style normalizer

Add [entity_import_normalization.js](../tools/web_viewer/entity_import_normalization.js) with:

- `normalizeImportedEntityStyle(raw, options)`

The helper owns:

- alias-aware field lookup for camelCase and snake_case style fields
- value normalization for line type, line weight, and line type scale
- source normalization for `EXPLICIT/BYLAYER` and `EXPLICIT/DEFAULT`

### 2. Preserve call-site-specific source semantics via options

The helper is shared, but the policy knob stays explicit:

- `documentState` uses default behavior, which honors source fields when present
- CADGF import calls the helper with:
  - `honorLineWeightSourceKeys: false`
  - `honorLineTypeScaleSourceKeys: false`

That keeps CADGF import compatible with its current "presence implies explicit" behavior while still removing the duplicated object builder.

### 3. Leave larger metadata refactors for the next cut

This step deliberately does not extract:

- attribute/text metadata
- base entity metadata
- annotation/proxy geometry metadata

Those are the next targets, but style is the safest first object-level slice because:

- the output contract is already stable
- the alias surface is small
- regression risk is lower than the metadata-heavy branches

## Files

- [entity_import_normalization.js](../tools/web_viewer/entity_import_normalization.js)
- [documentState.js](../tools/web_viewer/state/documentState.js)
- [cadgf_document_adapter.js](../tools/web_viewer/adapters/cadgf_document_adapter.js)
- [entity_import_normalization.test.js](../tools/web_viewer/tests/entity_import_normalization.test.js)

## Why This Is The Right Cut

This follows the agreed refactor order:

1. primitive helpers first
2. entity style next
3. richer metadata groups later

That sequencing gives us real de-duplication without forcing a risky all-at-once merge of the larger metadata readers.
