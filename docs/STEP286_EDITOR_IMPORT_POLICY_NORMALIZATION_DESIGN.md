# Step286 Editor Import Policy Normalization Design

## Goal

Finish the last small-but-repeated import-normalization slice:

- extract shared import-policy helpers for text value resolution and entity visibility
- keep editor snapshot restore and CADGF import on one normalization surface
- preserve the caller-specific policy differences that are intentional

## Problem

After Step285, most object-level normalization duplication was already removed from:

- [documentState.js](../tools/web_viewer/state/documentState.js)
- [cadgf_document_adapter.js](../tools/web_viewer/adapters/cadgf_document_adapter.js)

The remaining repeated logic was policy-shaped rather than field-shaped:

- how imported text entities choose their final `value`
- how imported entities choose their final `visible` state

These blocks were still duplicated because the callers do not use exactly the same policy:

- editor snapshot restore prefers explicit editor value first and treats only strict `false` as hidden
- CADGF import prefers imported text payload first and supports `0/1` visibility encoding

That means full behavior unification would be wrong. The right cut is to share the policy helper surface while letting callers choose their own option set.

## Design

### 1. Add shared policy helpers to the import-normalization module

Extend [entity_import_normalization.js](../tools/web_viewer/entity_import_normalization.js) with:

- `resolveImportedTextValuePolicy(input, options)`
- `resolveImportedEntityVisibilityPolicy(input, options)`

These helpers do not read raw CADGF/editor payload shapes. They operate on canonical inputs such as:

- `legacyAttributeDefault`
- `explicitValue`
- `textValue`
- `hasExplicitVisible`
- `explicitVisible`
- `isInsertTextProxy`
- `attributeInvisible`

This keeps the helpers aligned with the existing normalization architecture from Step281-Step285.

### 2. Preserve caller differences through options

The helpers are intentionally configurable.

For text value resolution:

- editor snapshot restore uses:
  - `valueOrder: ['explicit', 'text']`
  - `fallback: 'TEXT'`
- CADGF import uses:
  - `valueOrder: ['text', 'explicit']`
  - `fallback: ''`

For visibility resolution:

- editor snapshot restore uses:
  - `explicitVisibleMode: 'strict-boolean'`
- CADGF import uses:
  - `explicitVisibleMode: 'bool-int'`

Both callers still keep the shared insert-text-proxy rule:

- if there is no explicit visibility and the imported insert-text proxy is marked `attributeInvisible === true`, the entity is hidden

### 3. Remove duplicated local helpers from both callers

After the shared helpers exist:

- [documentState.js](../tools/web_viewer/state/documentState.js) no longer carries its own text-value or visibility policy functions
- [cadgf_document_adapter.js](../tools/web_viewer/adapters/cadgf_document_adapter.js) no longer carries its own text-value or visibility policy functions

Both callers now only prepare canonical input and select the correct policy mode.

## Files

- [entity_import_normalization.js](../tools/web_viewer/entity_import_normalization.js)
- [documentState.js](../tools/web_viewer/state/documentState.js)
- [cadgf_document_adapter.js](../tools/web_viewer/adapters/cadgf_document_adapter.js)
- [entity_import_normalization.test.js](../tools/web_viewer/tests/entity_import_normalization.test.js)

## Why This Is The Right Cut

This step finishes the import-normalization cleanup without overreaching into presenter or panel architecture.

The sequence is now:

1. shared primitive normalization
2. shared entity style normalization
3. shared attribute/text metadata normalization
4. shared base metadata normalization
5. shared annotation metadata normalization
6. shared import policy normalization

That leaves the import boundary cleaner while still respecting the few caller-specific semantics that actually matter.
