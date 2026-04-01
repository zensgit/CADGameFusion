# STEP198 Editor Layoff Workspace Design

## Scope

This step promotes the Step197 layer-off/on helper contract into real editor behavior:

- command-line `layoff` / `layon`
- layer-panel `Off` / `On`
- property-panel layer off/on actions

The goal is to reach AutoCAD/LibreCAD-style layer visibility workflows without letting current-layer state drift onto a hidden drawing layer.

## Design

- `tools/web_viewer/ui/workspace.js`
  - wires `layoff` to `resolveSelectionLayerOffLayers(...)` + `activateLayerOff(...)`
  - wires `layon` to `restoreLayerOff(...)`
  - tracks a dedicated `layerOffSession` alongside the existing isolation session
  - prefers the helper-provided fallback current layer when the turned-off set contains the current layer
  - clears conflicting visibility sessions before applying a new `LAYOFF` / `LAYISO` operation
- `tools/web_viewer/ui/layer_panel.js`
  - existing `Off` / `On` buttons now have live workspace callbacks
  - `Off` maps to a session-based `LAYOFF`
  - `On` restores the active layer-off session when present; otherwise it behaves like a direct visibility restore
- `tools/web_viewer/ui/property_panel.js`
  - existing layer action row now consumes the new workspace hooks
  - single-select layer facts can trigger `Turn Off Layer` / `Turn On Layer` from the same context as `Make Current` / `Isolate Layer`

## Behavior Contract

- `layoff`
  - resolves the selected entities to unique layer ids
  - hides those layers
  - falls back off the current layer when needed
  - fails with `NO_FALLBACK_LAYER` instead of leaving the editor on a hidden current layer
- `layon`
  - restores the last layer-off visibility session
  - restores the prior current-layer preference when possible
- `layoff` and `layiso` do not stack invisibly
  - starting one restores the other session first
  - this keeps visibility semantics explicit and reversible

## Benchmark Intent

Compared with benchmark CAD behavior, this keeps the high-value user flow while being more explicit internally:

- selection-driven layer-off targeting like AutoCAD layer commands
- reversible visibility session like isolate/unisolate workflows
- explicit current-layer fallback instead of hidden implicit state
- no UI-only mutation path that bypasses the same helper contract used by commands
