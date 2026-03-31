# Step274: Desktop LaunchServices And Batch Queue Design

## Goal

Push packaged desktop closer to real CAD desktop behavior by improving both external-open realism and multi-file drop feedback.

Step274 adds:

- a darwin-only packaged smoke phase that verifies `open -a VemCAD.app <file>` reaches the same visible viewer window;
- a renderer-visible batch queue panel for multi-file drop;
- explicit ignored-file classification when a drop contains unsupported items.

## Problem

Step273 already proves that packaged desktop declares CAD file associations and can queue multiple CAD files from one drop gesture. Two gaps still remain:

1. the packaged automated proof does not yet exercise the real macOS LaunchServices `open -a` lane;
2. multi-file drop still feels like a sequence of overwritten single-file status messages, not a first-class batch workflow.

That means the product logic is ahead of the visible desktop UX and ahead of the most realistic packaged smoke for Finder-style open.

## Contract

### 1. LaunchServices proof is supplemental, not a replacement

The authoritative packaged handoff gate remains the existing direct-binary smoke path.

Step274 extends it with one more darwin-only phase:

- keep the current packaged window running;
- invoke `open -a /abs/path/to/VemCAD.app <dwg>`;
- verify the same visible window reaches `Opened ... via direct-plugin.`

This proves that LaunchServices delivery reuses the same app-visible lane without making the less controllable `open` path the primary gate on every platform.

### 2. Batch feedback must stay renderer-local

Step274 must not add a new main-process progress protocol.

The renderer already owns:

- drag-drop parsing;
- multi-file queue creation through `queueDesktopCadOpen(...)`;
- visible status text.

The batch panel should therefore be derived locally from the existing queue lifecycle:

- `queued`
- `opening`
- `opened`
- `failed`
- `canceled`
- `ignored`

No new IPC channel is required.

### 3. Unsupported drop items need explicit classification

Dropping a mixed selection should not silently discard non-CAD files.

The renderer must:

- separate supported CAD paths from unsupported items;
- queue only supported CAD files;
- surface ignored unsupported items in the batch panel;
- show a status message that distinguishes queued files from ignored ones.

### 4. One open pipeline only

Batch queue UX is presentation, not a new conversion path.

All successful files still flow through the same desktop open contract already used by:

- `Open CAD File`
- recent-file replay
- startup arg handoff
- second-instance handoff
- macOS `open-file`
- drag-drop open

That preserves route reporting, manifest loading, settings recovery, and recent-file updates.

### 5. Packaged smoke must prove both realism and feedback

This step is complete only if packaged evidence proves:

1. second-instance handoff still works;
2. macOS `open -a` reaches the running packaged viewer window;
3. startup-arg open still works;
4. a mixed multi-drop produces a visible batch summary;
5. the batch panel reports `opened` and `ignored` items correctly;
6. renderer recents and menu recents remain correct after the batch.

## Scope

- `tools/web_viewer/index.html`
- `tools/web_viewer/style.css`
- `tools/web_viewer/preview_app.js`
- `tools/web_viewer/scripts/desktop_packaged_open_handoff_smoke.js`
- `tools/web_viewer/scripts/desktop_packaged_assoc_multidrop_smoke.js`
- `docs/STEP274_DESKTOP_LAUNCHSERVICES_BATCH_QUEUE_DESIGN.md`
- `docs/STEP274_DESKTOP_LAUNCHSERVICES_BATCH_QUEUE_VERIFICATION.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`

## Acceptance

Step274 is complete when:

- packaged open handoff smoke proves second-instance, `open -a`, and startup-arg delivery;
- mixed multi-drop shows a completed batch summary with opened and ignored counts;
- ignored unsupported drop items are visible in the batch panel;
- recent-file ordering still matches renderer and `File -> Open Recent CAD`;
- Step272 drop/recent smoke still passes;
- Step270 packaged settings smoke still passes;
- packaged Python DWG smoke still passes.
