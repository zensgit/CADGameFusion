# Step285 Editor Annotation Metadata Normalization Design

## Goal

Finish the last major object-level import-normalization slice:

- extract shared imported `annotation/proxy geometry metadata` finalization
- keep editor-snapshot and CADGF import behavior aligned where semantics are shared
- preserve the known fallback-order differences between the two callers

## Problem

After Step284, the biggest remaining duplication between:

- [documentState.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/state/documentState.js)
- [cadgf_document_adapter.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/cadgf_document_adapter.js)

was the annotation/proxy geometry metadata block:

- `sourceTextPos`
- `sourceTextRotation`
- `dimTextPos`
- `dimTextRotation`
- `sourceAnchor`
- `leaderLanding`
- `leaderElbow`
- `sourceAnchorDriverId`
- `sourceAnchorDriverType`
- `sourceAnchorDriverKind`

The tricky part was not the fields themselves. It was the fallback order:

- editor snapshot restore prefers `explicit -> text -> dimension`
- CADGF dimension proxy import prefers `dimension -> text`

That meant a raw-shape helper would be risky. The safe cut is a shared finalizer that operates on canonical candidates.

## Design

### 1. Add a canonical annotation metadata finalizer

Extend [entity_import_normalization.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/entity_import_normalization.js) with:

- `normalizeImportedAnnotationMetadata(candidates, options)`

This helper expects already-normalized candidates such as:

- `explicitSourceTextPos`
- `explicitSourceTextRotation`
- `textPos`
- `textRotation`
- `dimTextPos`
- `dimTextRotation`
- `sourceAnchor`
- `leaderLanding`
- `leaderElbow`
- `sourceAnchorDriverId`
- `sourceAnchorDriverType`
- `sourceAnchorDriverKind`

The helper owns:

- canonical point/number/string finalization
- driver field normalization
- configurable source-text fallback order

### 2. Keep raw-shape parsing in the callers

The helper deliberately does not read raw DXF/CADGF/editor payload shapes itself.

That stays in the callers:

- [documentState.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/state/documentState.js) still converts `{x,y}` snapshots to canonical candidates
- [cadgf_document_adapter.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/cadgf_document_adapter.js) still converts CADGF `vec2` payloads to canonical candidates

This keeps the helper focused on shared semantics instead of raw-format parsing.

### 3. Encode fallback-order differences as options

The two callers now share one finalizer but keep their existing policy:

- editor snapshot proxy text:
  - `sourceTextFallbackOrder: ['explicit', 'text', 'dimension']`
- CADGF dimension proxy text:
  - `sourceTextFallbackOrder: ['dimension', 'text']`

The same pattern applies to source-text rotation.

## Files

- [entity_import_normalization.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/entity_import_normalization.js)
- [documentState.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/state/documentState.js)
- [cadgf_document_adapter.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/cadgf_document_adapter.js)
- [entity_import_normalization.test.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/entity_import_normalization.test.js)

## Why This Is The Right Cut

This completes the object-level normalization sequence without crossing into unrelated behavior:

1. primitive helpers
2. style
3. attribute/text metadata
4. base metadata
5. annotation/proxy geometry metadata

By keeping raw-shape parsing in the callers and moving only the shared finalization logic, this step removes the duplicate logic while preserving the caller-specific fallback rules that actually matter.
