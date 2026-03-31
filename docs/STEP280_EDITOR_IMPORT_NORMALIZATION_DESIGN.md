# Step280 Editor Import Normalization Design

## Goal

Make the editor import boundary explicit:

- `DocumentState.restore()` should only restore internal editor snapshots.
- External CAD payloads should be normalized by adapter code before they ever reach state restoration.
- Workspace and non-UI scripts should share the same import normalization entrypoint.

## Problem

Before this step, external-format handling was split across layers:

- `DocumentState.restore()` silently adapted `convert_cli document.json` payloads.
- `workspace.importPayload()` had a manual `CADGF` branch and a separate generic `hydrateDocument(...)` branch.
- `editor_real_scene_perf_smoke.js` duplicated the same `CADGF` vs non-`CADGF` branching.

That created two architectural problems:

1. State restoration was doing import-format work.
2. External import behavior was duplicated between runtime and scripts.

## Design

### 1. Introduce a unified editor import adapter

Add [editor_import_adapter.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/editor_import_adapter.js) as the shared normalization layer for editor imports.

It now owns three cases:

- `CADGF document.json` -> `importCadgfDocument(...)` -> `docSnapshot`
- `convert_cli document.json` -> in-place field and geometry normalization -> `docSnapshot`
- native editor JSON / envelope -> `document` extraction without geometry translation

The adapter exposes:

- `isConvertCliDocument(...)`
- `adaptConvertCliDocument(...)`
- `resolveEditorImportPayload(...)`
- `applyResolvedEditorImport(...)`

### 2. Tighten `DocumentState.restore()`

`DocumentState.restore()` in [documentState.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/state/documentState.js) no longer performs convert-cli adaptation.

Instead it now enforces the boundary:

- accept editor snapshots
- reject raw `CADGF`
- reject raw `convert_cli`

The error is deliberate and explicit so future callers do not reintroduce format-coupling into the state layer.

### 3. Keep `hydrateDocument(...)` as the editor-side import applicator

[document_json_adapter.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/document_json_adapter.js) now delegates normalization to the new adapter before restoring document, selection, snap, and view state.

This keeps the old API surface available for editor JSON style imports, while moving external format handling out of `DocumentState`.

`hydrateDocument(...)` now rejects raw `CADGF` payloads with a clear message, because that path should go through the CADGF adapter.

### 4. Route runtime and script entrypoints through the same normalization logic

Two practical entrypoints were updated:

- [workspace.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/workspace.js)
- [editor_real_scene_perf_smoke.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_real_scene_perf_smoke.js)

This removes duplicated `CADGF` vs non-`CADGF` branching and makes both runtime and script imports consume the same normalized snapshot contract.

## Files

- [editor_import_adapter.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/editor_import_adapter.js)
- [document_json_adapter.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/document_json_adapter.js)
- [documentState.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/state/documentState.js)
- [workspace.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/workspace.js)
- [editor_real_scene_perf_smoke.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_real_scene_perf_smoke.js)
- [editor_import_adapter.test.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_import_adapter.test.js)

## Why This Is The Right Cut

This step deliberately does not touch presenter/property-panel overlap or other UI architecture debt.

It only fixes the freshest import-layer duplication:

- the state layer is simpler
- the import boundary is explicit
- future refactors can now consolidate UI fact-generation without also carrying format adaptation debt
