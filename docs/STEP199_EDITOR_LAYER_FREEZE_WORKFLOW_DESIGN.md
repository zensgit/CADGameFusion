# STEP199 Editor Layer Freeze Workflow Design

## Scope

This step closes the freeze/thaw side of the editor layer workflow so it reaches the same product tier as the already-shipped `LAYOFF` / `LAYON` path:

- command-line `layfrz` / `laythw`
- property-panel `Freeze Layer` / `Thaw Layers`
- layer-panel `Frozen/Live` toggle with current-layer safety
- browser smoke coverage for command, property, and panel entry points

The goal is to match AutoCAD/BricsCAD/LibreCAD-class layer-freeze behavior without letting current-layer state drift onto a frozen drawing target.

## Design

- `tools/web_viewer/ui/layer_session_policy.js`
  - adds `resolveSelectionLayerFreezeLayers(...)` for selection-driven layer target resolution
  - adds `activateLayerFreeze(...)` and `restoreLayerFreeze(...)`
  - freeze only applies to the selected layer ids; it must not thaw unrelated already-frozen layers
  - returns a `nextCurrentLayerId` hint when the current layer is frozen by the operation
  - rejects the operation with `NO_FALLBACK_LAYER` when no editable visible fallback layer exists
- `tools/web_viewer/ui/workspace.js`
  - wires `layfrz` to `resolveSelectionLayerFreezeLayers(...)` + `activateLayerFreeze(...)`
  - wires `laythw` to `restoreLayerFreeze(...)`
  - tracks a dedicated `layerFreezeSession` alongside isolate/off sessions
  - clears conflicting isolate/off/freeze sessions before starting a new freeze session
  - keeps raw layer-panel `Frozen/Live` as a persistent toggle, but routes it through `setLayerFrozenState(...)` so freezing the current layer still falls back safely
- `tools/web_viewer/ui/property_panel.js`
  - adds `freeze-layer` for the selected editable visible layer
  - adds `thaw-layers` when a freeze session is active
  - keeps these actions on the same action row as `Locate Layer`, `Isolate Layer`, and `Turn Off Layer`
- `tools/web_viewer/scripts/editor_layer_session_smoke.js`
  - extends browser acceptance from layer off/on into freeze/thaw
  - verifies command-path, property-path, and layer-panel-path behavior in one real browser run
  - retries static-server startup on a few deterministic ports when ephemeral `port=0` binding is refused locally
- `tools/web_viewer/README.md`
  - documents `layfrz` / `laythw`
  - documents that layer-session smoke now covers persistent panel freeze fallback too

## Behavior Contract

- `layfrz`
  - resolves selected entities to unique layer ids
  - freezes those layers
  - keeps unrelated frozen layers unchanged
  - falls current layer back to a safe editable visible layer when needed
  - fails instead of leaving the editor on a frozen drawing target
- `laythw`
  - restores the frozen state snapshot from the last freeze session
  - restores the prior current-layer preference when possible
- `Frozen/Live` in the layer panel
  - remains a persistent layer-state toggle, not a hidden alias for session restore
  - still enforces the same drafting safety rule when the current layer is being frozen
- session interaction
  - `layiso`, `layoff`, and `layfrz` do not stack invisibly
  - a new session restores conflicting prior session state first, then applies its own contract

## Benchmark Intent

This step closes a real gap called out by the local benchmark/reference docs:

- LibreCAD-style layer lists expose freeze as a first-class layer state
- AutoCAD/BricsCAD-style workflows treat freeze as stronger than simple visibility-off
- current drawing context must stay explainable and valid after every layer-state operation

The implementation stays narrower and more auditable than benchmark products:

- one shared helper contract for selection resolution and fallback
- explicit session restore rather than hidden UI state
- browser-smoke-visible DOM/status contracts for every recovery path
