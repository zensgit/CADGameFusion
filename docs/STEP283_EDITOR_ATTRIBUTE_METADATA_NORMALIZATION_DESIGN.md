# Step283 Editor Attribute Metadata Normalization Design

## Goal

Continue the object-level import normalization cleanup after Step282:

- extract shared imported `attribute/text metadata` normalization
- keep `documentState` and CADGF import semantics aligned
- leave larger base-metadata and annotation-geometry refactors for later steps

## Problem

The next largest object-level duplication after style lived in the attribute/text metadata block of:

- [documentState.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/state/documentState.js)
- [cadgf_document_adapter.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/cadgf_document_adapter.js)

Both modules were parallel-normalizing the same imported fields:

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

They also shared the same flag-fallback behavior:

- bit `1` -> invisible
- bit `2` -> constant
- bit `4` -> verify
- bit `8` -> preset
- bit `16` -> lock-position

This was duplicated almost line-for-line, with alias support as the main difference.

## Design

### 1. Extend the object-level normalization module

Extend [entity_import_normalization.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/entity_import_normalization.js) with:

- `normalizeImportedAttributeMetadata(raw, options)`
- `applyAttributeFlagFallbacks(meta)`

The helper owns:

- alias-aware lookup for editor-style and CADGF-style field names
- ATTDEF default derivation via the shared legacy-default helper
- explicit boolean parsing
- bitmask fallback when the booleans are not explicitly present

### 2. Keep the caller-specific logic outside the helper

This helper intentionally does not absorb:

- `releasedInsertArchive`
- CADGF source-proxy inference
- promoted insert text proxy rules
- dimension/leader/table geometry metadata

Those remain at the caller level because they are not shared attribute/text normalization semantics.

### 3. Rebind both import paths to the same shared metadata block

Both import paths now assign the helper output directly into their metadata object:

- [documentState.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/state/documentState.js)
- [cadgf_document_adapter.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/cadgf_document_adapter.js)

`documentState` uses the default alias set, which accepts camelCase and snake_case.

CADGF import passes a narrowed snake_case alias set so the shared helper still reflects the true CADGF field contract.

## Files

- [entity_import_normalization.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/entity_import_normalization.js)
- [documentState.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/state/documentState.js)
- [cadgf_document_adapter.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/cadgf_document_adapter.js)
- [entity_import_normalization.test.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/entity_import_normalization.test.js)

## Why This Is The Right Cut

This matches the agreed refactor sequence:

1. primitive helpers
2. style object
3. attribute/text metadata
4. base metadata and annotation geometry later

That sequencing removes the freshest duplication first while keeping the risk bounded and the behavior auditable.
