# STEP197 Editor Layoff Workflow Design

## Scope

This step adds the low-level contract for a future `LAYOFF` / `LAYON` workflow without touching `workspace.js` or the browser smoke gate.

The goal is to make layer visibility changes selection-driven, reversible, and safe when the current layer would otherwise be hidden.

## Design

- `tools/web_viewer/ui/layer_session_policy.js`
  - adds `resolveSelectionLayerOffLayers(...)` for selection-based layer target resolution
  - adds `activateLayerOff(...)` to hide selected layers and snapshot prior visibility
  - adds `restoreLayerOff(...)` to restore the saved visibility session
  - returns a `nextCurrentLayerId` hint when the current layer is part of the off set
  - rejects the operation when no editable fallback layer exists
- `tools/web_viewer/ui/layer_panel.js`
  - exposes optional `turn-off` / `turn-on` callbacks as future UI hooks
  - keeps existing layer controls intact
- `tools/web_viewer/ui/property_panel.js`
  - exposes optional layer-off / layer-on actions for future property-panel wiring
  - leaves current workspace behavior unchanged because the caller is not updated in this step

## Contract

- `LAYOFF` resolves selected entities to unique layer ids, then hides those layers.
- `LAYON` restores the saved visibility session from `LAYOFF`.
- If the current layer is included in the off set, the helper returns a fallback current-layer hint instead of leaving the document on a hidden current layer.
- If no fallback layer exists, the helper fails with `NO_FALLBACK_LAYER`.

## Benchmark Intent

This is aligned with the layer workflow seen in LibreCAD-style layer management and AutoCAD-style visibility toggles, but keeps the contract narrower and safer:

- deterministic selection resolution
- reversible visibility sessions
- explicit current-layer fallback
- no UI-only side effects hidden in workspace code
