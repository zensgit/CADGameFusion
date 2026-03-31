# Step272: Desktop Drop And Recent Flow Design

## Goal

Make packaged desktop CAD open feel like a real desktop app, not only a button-driven demo.

Step272 adds:

- drag-and-drop CAD open directly onto the viewer viewport;
- a renderer-visible recent CAD list;
- a matching `File -> Open Recent CAD` menu backed by the same source of truth.

## Problem

Step271 proves native startup-arg and second-instance file handoff, but normal desktop use still has two UX gaps:

1. users cannot drop a DWG onto the window to open it;
2. after a successful open, there is no first-class recent-file recall path inside the UI or menu.

That leaves VemCAD behind the interaction quality expected from desktop CAD viewers even if the core DWG open pipeline already works.

## Contract

### 1. One open pipeline only

Step272 must not introduce a second CAD open implementation.

All entry points still converge on the same renderer and main-process flow:

- renderer button open;
- renderer drop open;
- renderer recent replay;
- main-menu recent replay;
- startup arg handoff;
- second-instance handoff.

Each of them ultimately reuses `openCadSelection(...)` in the desktop main process and therefore keeps identical status text, manifest loading, route reporting, and settings auto-recovery behavior.

### 2. Main process owns recent-file truth

Recent CAD files are desktop state, not renderer-only state.

- stored under `app.getPath("userData")`;
- persisted as a small JSON MRU list;
- deduped by resolved absolute path;
- capped to a short list;
- updated only after a successful CAD open.

Renderer and menu both consume that same main-process list.

### 3. Renderer exposes a visible desktop-open lane

When the desktop bridge exists, the viewer sidebar must expose:

- a recent-file section;
- an empty-state hint;
- a `Clear` action when entries exist.

The viewport must also expose a drag-drop overlay during active file drag.

### 4. Menu and renderer stay synchronized

When recent CAD files change:

- `File -> Open Recent CAD` must rebuild from the latest MRU order;
- renderer recent list must update through the desktop bridge event;
- clearing recents must remove entries from both places.

### 5. Packaged smoke must prove the interaction contract

This step needs a dedicated packaged smoke that verifies:

1. clean profile starts with empty recents;
2. dragenter reveals the drop overlay;
3. dropping one DWG opens it and creates one recent entry;
4. dropping a second DWG reorders recents newest-first;
5. replaying from the renderer recent list reopens the selected file and moves it back to the top;
6. clearing recents empties both renderer UI and app menu.

## Scope

- `tools/web_viewer/index.html`
- `tools/web_viewer/style.css`
- `tools/web_viewer/preview_app.js`
- `tools/web_viewer_desktop/preload.js`
- `tools/web_viewer_desktop/main.js`
- `tools/web_viewer/scripts/desktop_packaged_drop_recent_smoke.js`
- `docs/STEP272_DESKTOP_DROP_RECENT_FLOW_DESIGN.md`
- `docs/STEP272_DESKTOP_DROP_RECENT_FLOW_VERIFICATION.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`

## Acceptance

Step272 is complete when:

- dropping a sample DWG onto packaged desktop opens it successfully;
- recent CAD entries persist through the desktop main process and render in the sidebar;
- `File -> Open Recent CAD` matches renderer recent ordering;
- `Clear Recent CAD Files` empties both renderer and menu state;
- Step271 native handoff smoke still passes;
- Step270 packaged settings smoke still passes;
- packaged Python DWG smoke still passes.
