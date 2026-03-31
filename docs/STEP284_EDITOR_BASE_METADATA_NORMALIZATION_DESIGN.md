# Step284 Editor Base Metadata Normalization Design

## Goal

Continue the object-level import normalization cleanup after Step283:

- extract shared imported `base entity metadata` normalization
- keep `documentState` and CADGF import semantics aligned
- preserve caller-specific quirks such as CADGF `layout_name` fallback and `space` own-property behavior

## Problem

After style and attribute/text metadata were extracted, the largest remaining shared duplication was still in the base metadata block of:

- [documentState.js](../tools/web_viewer/state/documentState.js)
- [cadgf_document_adapter.js](../tools/web_viewer/adapters/cadgf_document_adapter.js)

The repeated fields were:

- `groupId`
- `space`
- `layout`
- `colorSource`
- `colorAci`
- `sourceType`
- `editMode`
- `proxyKind`
- `blockName`
- `hatchPattern`
- `hatchId`
- `sourceBundleId`

The normalization was nearly identical, but each caller had small policy differences:

- `documentState` reads editor-style aliases
- CADGF import reads snake_case
- CADGF import falls back from `layout` to `layout_name`
- CADGF import only accepts `space` when that key actually exists on the raw payload

## Design

### 1. Extend the shared object-level normalization module

Extend [entity_import_normalization.js](../tools/web_viewer/entity_import_normalization.js) with:

- `normalizeImportedEntityMetadataBase(raw, options)`

The helper owns:

- alias-aware lookup for canonical base metadata fields
- integer clamping/truncation for id-like fields
- shared `colorSource` and `colorAci` normalization

### 2. Keep caller-specific policy knobs explicit

The helper accepts alias arrays and a narrow policy option:

- `requireOwnSpaceKeys`

That lets the two callers share the object builder while still preserving their existing contracts:

- `documentState` uses editor-style aliases
- CADGF import uses snake_case aliases, `layout_name` fallback, and `requireOwnSpaceKeys: true`

### 3. Leave non-base metadata outside this step

This step deliberately does not absorb:

- `releasedInsertArchive`
- attribute/text metadata
- dimension/leader/table geometry metadata
- adapter-only source-proxy inference

Those either were already extracted in earlier steps or remain caller-specific and should not be mixed into the base metadata helper.

## Files

- [entity_import_normalization.js](../tools/web_viewer/entity_import_normalization.js)
- [documentState.js](../tools/web_viewer/state/documentState.js)
- [cadgf_document_adapter.js](../tools/web_viewer/adapters/cadgf_document_adapter.js)
- [entity_import_normalization.test.js](../tools/web_viewer/tests/entity_import_normalization.test.js)

## Why This Is The Right Cut

This follows the agreed sequencing:

1. primitive helpers
2. style object
3. attribute/text metadata
4. base metadata
5. annotation/proxy geometry later

By keeping the helper boundary small and policy-driven, this step removes more duplication without flattening important CADGF-specific behavior.
