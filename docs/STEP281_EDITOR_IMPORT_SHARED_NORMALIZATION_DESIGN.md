# Step281 Editor Import Shared Normalization Design

## Goal

Continue the import-boundary cleanup from Step280 without widening scope into UI refactors:

- extract the first truly shared import-normalization helpers out of duplicate adapter/state code
- keep CADGF and editor-snapshot import semantics aligned
- fix the perf smoke so it exercises the same visible-space contract as runtime import

## Problem

After Step280, the external import boundary was explicit, but two follow-up debts remained:

1. `documentState.js` and `cadgf_document_adapter.js` still duplicated low-level normalization semantics for:
   - `colorSource`
   - `colorAci`
   - optional attribute booleans
   - text-kind normalization
   - legacy ATTDEF default derivation
2. `editor_real_scene_perf_smoke.js` used the new shared adapter but did not replay the runtime's current `space/layout` sync, so imported paper-space fixtures could pass import and still look empty to drag sampling.

The first issue risks semantic drift. The second issue produces a false regression signal in perf validation.

## Design

### 1. Extract shared import-normalization helpers

Add [import_normalization.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/import_normalization.js) as the first shared import-normalization module.

It owns the helpers that were duplicated and semantically identical across the editor snapshot normalizer and the CADGF adapter:

- `normalizeColorSource(...)`
- `normalizeColorAci(...)`
- `normalizeOptionalBool(...)`
- `normalizeTextKind(...)`
- `deriveLegacyAttdefDefault(...)`

This is intentionally a narrow cut. It reduces duplicated semantics without trying to collapse the full entity adapters in one step.

### 2. Rebind both import paths to the same helper source

Both of these modules now import shared helper semantics from the same file:

- [documentState.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/state/documentState.js)
- [cadgf_document_adapter.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/cadgf_document_adapter.js)

This means the two import paths cannot silently diverge on the basic provenance/style fields listed above.

### 3. Make the perf smoke honor runtime space/layout visibility

[workspace.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/workspace.js) already syncs current `space/layout` after import, so imported paper-space fixtures render as visible content.

[editor_real_scene_perf_smoke.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_real_scene_perf_smoke.js) now mirrors that runtime contract by calling:

- `document.setCurrentSpaceContext(document.getCurrentSpaceContext(), { silent: true })`

immediately after applying the resolved import payload.

This is not a perf-only workaround. It is the script-side equivalent of the editor runtime's current-space reconciliation.

## Files

- [import_normalization.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/import_normalization.js)
- [documentState.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/state/documentState.js)
- [cadgf_document_adapter.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/cadgf_document_adapter.js)
- [editor_real_scene_perf_smoke.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_real_scene_perf_smoke.js)
- [import_normalization.test.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/import_normalization.test.js)

## Why This Is The Right Cut

This step stays aligned with the agreed priority:

- it keeps working on import normalization debt
- it does not broaden into presenter/property-panel architecture
- it removes the freshest duplicate semantics first
- it repairs a misleading perf regression without hiding real runtime behavior

The next refactor can now target larger normalization groups with a smaller risk of semantic drift in the already-extracted core helpers.
