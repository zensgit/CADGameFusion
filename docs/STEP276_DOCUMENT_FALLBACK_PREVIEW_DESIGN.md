# Step276: Document Fallback Preview Design

## Goal

Close the packaged desktop gap where a DWG can "open successfully" yet still render a blank viewport because the conversion output only contains `document.json` and no `mesh_gltf`.

Step276 adds:

- a renderer-side fallback preview path that synthesizes visible line geometry from `document.json`;
- honest status text that distinguishes mesh preview, fallback preview, text-only preview, and metadata-only loads;
- a packaged smoke that proves a real DWG now produces on-screen fallback geometry instead of an empty scene.

## Problem

Before this step, `preview_app.js` treated `manifest.artifacts.mesh_gltf` as the only renderable scene source.

That left one bad behavior for real DWGs that currently convert to:

- `manifest.json` with `outputs: ["json"]`;
- `status: "partial"`;
- a populated `document.json`;
- no `mesh_gltf`, no `mesh_metadata`, and no precomputed line geometry.

The old fallback branch did this:

1. reset the scene;
2. create an empty `THREE.Group`;
3. call `frameTextEntries()` if text existed;
4. still show `Loaded document successfully.`

For the user, that looked like a successful open with a blank viewport.

## Contract

### 1. `document.json` must become a first-class preview fallback

If a manifest has no `mesh_gltf` but the loaded `document.json` contains common 2D entities, the viewer must synthesize a visible line preview instead of leaving the scene empty.

The first supported subset is:

- line
- polyline
- arc
- circle
- ellipse
- point

This subset covers the dominant visible content in the current real DWG sample and reuses the existing line-overlay rendering stack.

### 2. Fallback preview must reuse existing viewer plumbing

Step276 must not add a second scene renderer.

The synthesized preview feeds the existing:

- `lineGeometryData`
- `lineSlices`
- `LineSegments2` overlay pipeline
- selection rebuild path
- camera framing helpers

That keeps line color, line width, entity ids, and later selection/highlight work on the same contract already used by mesh metadata.

### 3. Status text must tell the truth

`loadFromManifest()` now has to report which preview mode was actually obtained:

- `mesh-gltf-loading` / `mesh-gltf`
- `document-fallback`
- `text-only`
- `metadata-only`

`runDesktopCadOpen()` must respect that result instead of blindly overwriting the status with a generic `Opened ... via direct-plugin.`

### 4. The fallback must be directly testable

The viewer already exposes debug hooks. Step276 extends that surface with `getLastManifestPreviewState()` so packaged smoke can assert:

- the preview mode kind;
- renderable entity count;
- segment count.

### 5. Packaged proof must be visual, not just artifact-based

This step is only complete if packaged evidence proves:

1. a real DWG that previously yielded a blank viewport now reaches `document-fallback`;
2. the line overlay is non-empty;
3. the visible status explicitly says `document fallback preview`;
4. a real screenshot from the packaged app shows geometry on screen.

## Scope

- `tools/web_viewer/document_preview_fallback.js`
- `tools/web_viewer/preview_app.js`
- `tools/web_viewer/tests/document_preview_fallback.test.js`
- `tools/web_viewer/scripts/desktop_packaged_document_fallback_smoke.js`
- `tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js`
- `tools/web_viewer/scripts/desktop_packaged_drop_recent_smoke.js`
- `tools/web_viewer/scripts/desktop_packaged_assoc_multidrop_smoke.js`
- `tools/web_viewer/scripts/desktop_packaged_resume_batch_recovery_smoke.js`
- `tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `docs/STEP276_DOCUMENT_FALLBACK_PREVIEW_DESIGN.md`
- `docs/STEP276_DOCUMENT_FALLBACK_PREVIEW_VERIFICATION.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`

## Acceptance

Step276 is complete when:

- json-only CAD manifests no longer silently render an empty scene;
- packaged desktop shows visible fallback line geometry for the current real DWG sample;
- packaged desktop status says `document fallback preview` for that lane;
- static checks and unit tests pass for the new helper and viewer integration;
- packaged settings smoke still passes with the new status wording.
