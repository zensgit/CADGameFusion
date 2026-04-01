# STEP200 Editor Layer Lock Workflow Design

## Scope

This step closes the lock/unlock side of the editor layer workflow so it reaches the same command/property/panel tier as the already-shipped current-layer, off/on, and freeze/thaw paths:

- command-line `laylck` / `layulk`
- property-panel `Lock Layer` / `Unlock Layer`
- layer-panel `Locked/Open` toggle with current-layer safety
- browser smoke coverage for property, command, and panel entry points

The goal is AutoCAD/BricsCAD-class layer-lock behavior without leaving the drafting target on a locked current layer.

## Design

- `tools/web_viewer/ui/layer_session_policy.js`
  - adds `resolveSelectionLayerLockLayers(...)` and `resolveSelectionLayerUnlockLayers(...)` for selection-driven layer targeting
  - adds `activateLayerLock(...)` and `activateLayerUnlock(...)`
  - lock/unlock only touches the selected layer ids; it must not mutate unrelated locked layers
  - `activateLayerLock(...)` returns a `nextCurrentLayerId` hint when the current layer is being locked
  - rejects locking the current layer with `NO_FALLBACK_LAYER` when no editable visible unlocked fallback exists
- `tools/web_viewer/ui/workspace.js`
  - wires `laylck` / `laylock` to selection resolution + `activateLayerLock(...)`
  - wires `layulk` / `layunlock` to selection resolution + `activateLayerUnlock(...)`
  - adds shared `applyLayerLockByIds(...)`, `applyLayerUnlockByIds(...)`, and `setLayerLockedState(...)`
  - routes raw layer-panel `Locked/Open` through `setLayerLockedState(...)` so current-layer fallback is enforced for panel clicks too
  - keeps lock as a persistent layer state, not a reversible session like `layoff/layon` or `layfrz/laythw`
- `tools/web_viewer/ui/property_panel.js`
  - adds `lock-layer` for selected unlocked layers
  - keeps `unlock-layer` for selected locked layers
  - exposes the two actions on the same row as `Locate Layer`, `Make Current`, `Isolate Layer`, `Turn Off Layer`, and `Freeze Layer`
- `tools/web_viewer/scripts/editor_layer_session_smoke.js`
  - extends the real browser layer workflow acceptance to cover property `Lock Layer` and command `layulk`
  - verifies that locking preserves selection/focus context while moving current away from the locked drafting target
- `tools/web_viewer/scripts/editor_current_layer_smoke.js`
  - remains the panel-fallback regression for the persistent `Locked/Open` row action
- `tools/web_viewer/README.md`
  - documents `laylck` / `layulk`
  - documents that layer-session smoke now covers the lock/unlock path too

## Behavior Contract

- `laylck`
  - resolves selected entities to unique layer ids
  - locks those layers only
  - never unlocks or rewrites unrelated locked layers
  - falls current layer back to a safe editable visible unlocked layer when the current drafting target is locked
  - fails instead of silently leaving creation on a locked target
- `layulk`
  - resolves selected entities to unique layer ids
  - unlocks those layers only
  - does not act like a hidden global restore
- `Locked/Open` in the layer panel
  - remains a persistent layer-state toggle
  - enforces the same drafting safety rule as command/property locking when the current layer is toggled to locked
- locked-layer selection
  - remains inspectable and focusable in the property panel
  - exposes `Unlock Layer` recovery instead of pretending the selected entity is editable

## Benchmark Intent

This step closes another benchmark-visible gap in the local editor:

- AutoCAD/BricsCAD users expect `LAYLCK`-style locking to be independent from visibility/freeze sessions
- LibreCAD-style layer lists treat lock as a first-class state, not a UI-only flag
- a modern editor should keep focus on the selected layer while current drafting context falls back safely

The implementation stays narrower and more auditable than the benchmark products:

- shared helper contracts own selection resolution and fallback instead of ad hoc UI branching
- persistent lock semantics stay separate from session restore semantics
- browser-smoke-visible status/current/focus contracts make recovery behavior explainable and testable
