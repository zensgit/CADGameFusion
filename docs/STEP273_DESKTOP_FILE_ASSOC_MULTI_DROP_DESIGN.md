# Step273: Desktop File Association And Multi-Drop Design

## Goal

Make packaged VemCAD behave more like a finished desktop CAD viewer when users interact with files from the OS, not only from inside the app.

Step273 adds:

- packaged file-association declarations for `.dwg`, `.dxf`, and `.cad`;
- multi-file CAD drop queueing through the existing open pipeline;
- richer recent-file metadata so renderer recents are easier to scan.

## Problem

Step272 already proves that packaged desktop can open CAD files from button open, native handoff, drag-drop, and recent replay. Two product-level gaps still remain:

1. the packaged app bundle does not explicitly advertise CAD document support to the OS;
2. drag-dropping multiple CAD files behaves like an incidental loop, not a declared queue contract;
3. recent entries only expose a label and a raw path, which is weaker than the scanability expected from desktop CAD tools.

That keeps VemCAD behind mature desktop viewers in first-run discoverability and in high-frequency repeat-open workflows.

## Contract

### 1. File associations must be narrow and intentional

Packaged desktop should claim only CAD-like formats that this lane is meant to preview:

- `.dwg`
- `.dxf`
- `.cad`

It must not claim broad generic file types such as `.json`, because that would be noisy and risky for users.

The declared role should remain viewer-oriented, not editor-oriented.

### 2. Multi-drop must reuse the existing queue

Step273 must not invent a second batch-open implementation.

When users drop multiple CAD files onto the viewport:

- renderer normalizes and dedupes the paths;
- each path is pushed through the existing `queueDesktopCadOpen(...)` path;
- final behavior matches repeated single-file opens in deterministic order.

That keeps status text, manifest loading, route reporting, settings repair, and recent-file updates identical to the rest of desktop open.

### 3. Recent-file truth still belongs to the main process

The recent-file store remains main-process state.

Step273 only enriches derived renderer-facing metadata:

- `fileName`
- `directory`
- `extension`
- existing `lastOpenedAt`
- existing `exists`

Renderer does not become the source of truth.

### 4. Recent metadata must improve scanability

The renderer sidebar should make recent entries understandable without forcing users to parse full absolute paths.

Each entry should expose:

- extension badge text;
- last-opened timestamp;
- containing directory when the file still exists;
- explicit missing-file messaging when it does not.

### 5. Packaged smoke must prove OS-facing and UI-facing behavior together

This step needs a dedicated packaged smoke that verifies:

1. the packaged bundle declares the expected file associations;
2. the packaged bundle does not claim `.json`;
3. dropping two DWGs in one drop gesture queues and opens both in order;
4. renderer recent UI shows two entries newest-first;
5. recent metadata includes `Last opened:`;
6. recent bridge state and `File -> Open Recent CAD` stay aligned with the renderer;
7. no CDN regression appears in packaged mode.

## Scope

- `tools/web_viewer_desktop/package.json`
- `tools/web_viewer_desktop/main.js`
- `tools/web_viewer/preview_app.js`
- `tools/web_viewer/style.css`
- `tools/web_viewer/scripts/desktop_packaged_assoc_multidrop_smoke.js`
- `docs/STEP273_DESKTOP_FILE_ASSOC_MULTI_DROP_DESIGN.md`
- `docs/STEP273_DESKTOP_FILE_ASSOC_MULTI_DROP_VERIFICATION.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`

## Acceptance

Step273 is complete when:

- the packaged app bundle advertises `.dwg`, `.dxf`, and `.cad` associations;
- packaged smoke proves `.json` is not claimed;
- one multi-file drop gesture opens two sample DWGs through the existing queue;
- renderer recents, bridge recents, and `File -> Open Recent CAD` remain synchronized;
- recent metadata exposes extension and last-opened context clearly;
- Step272 drop/recent smoke still passes;
- Step271 native handoff smoke still passes;
- Step270 packaged settings smoke still passes;
- packaged Python DWG smoke still passes.
