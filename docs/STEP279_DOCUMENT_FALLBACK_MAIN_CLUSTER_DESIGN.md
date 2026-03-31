# Step279: Document Fallback Main-Cluster Focus Design

## Goal

Push packaged DWG fallback preview one step closer to a usable CAD first view by locking the camera onto the main drawing cluster instead of letting sparse extents dominate the fit.

Step278 improved presentation and general fit behavior, but the packaged screenshot still showed a common failure mode:

- the viewport no longer opened blank;
- the theme and interaction looked more CAD-like;
- but the first frame could still be pulled around by sparse extents and nearby annotation spread, so the visible part remained smaller than it should be.

## Problem

For the current sample DWG, the fallback pipeline only provides `document.json` geometry and text metadata:

- no `mesh_gltf`;
- no layout/viewports metadata in `document.json`;
- all renderable entities land in `space=0`.

That means the viewer cannot rely on explicit layout viewport data to identify the intended first view. A pure bounds-based fit still overweights low-density extents. A text-inclusive fit can then re-expand the frame and partially undo the geometry focus.

## Contract

### 1. Fallback focus should be chosen from geometry density, not only extents

The viewer should derive a primary focus region from fallback line geometry by:

- rasterizing segment midpoints into a coarse density grid;
- capping very long-segment influence so sparse border lines do not dominate;
- evaluating connected dense-cell clusters instead of using a single global box;
- selecting the strongest cluster using density, compactness, and aspect-ratio penalties.

### 2. The chosen cluster should expand to nearby supporting geometry

A dense cluster on its own can be too local, for example locking onto only one detailed corner of the part. After choosing the primary cluster, the viewer should:

- expand the selected cluster bounds in world space;
- absorb nearby geometry that intersects that expanded focus region;
- keep the result tighter than full-sheet framing.

### 3. Text should support the fit without dragging it back to sheet scale

Dimension text is useful context, but it should not pull the camera back to a much larger frame. For `document-fallback`:

- nearby text may expand the fit slightly;
- text contribution must be clamped to a limited expansion box derived from the geometry focus.

### 4. Verification must prove the packaged lane still works

This step is only complete if the real packaged app still:

- opens the sample DWG;
- reports `document-fallback`;
- exposes a deterministic `focusRegion` in preview debug state;
- passes the packaged settings smoke unchanged.

## Scope

- `tools/web_viewer/document_preview_fallback.js`
- `tools/web_viewer/preview_app.js`
- `tools/web_viewer/tests/document_preview_fallback.test.js`
- `tools/web_viewer/scripts/desktop_packaged_document_fallback_smoke.js`
- `docs/STEP279_DOCUMENT_FALLBACK_MAIN_CLUSTER_DESIGN.md`
- `docs/STEP279_DOCUMENT_FALLBACK_MAIN_CLUSTER_VERIFICATION.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`

## Acceptance

Step279 is complete when:

- fallback preview computes and exposes a density-cluster `focusRegion`;
- unit tests cover the "dense interior vs sparse border" case;
- packaged fallback smoke passes against `/Applications/VemCAD.app`;
- packaged settings smoke still passes;
- documentation records both the improvement and the remaining visual gap on the current sample.
