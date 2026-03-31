# STEP195 Editor LAYMCUR Design

## Background

Step194 separated two layer concepts cleanly:

- focused layer follows selection for inspection and recovery
- current layer drives new geometry creation

That separation fixed a major UX bug, but it still left one benchmark-sized gap.

In `AutoCAD` and `BricsCAD` style 2D drafting, users do not only switch current layer by opening the layer list and hunting for a name. They also expect a fast path that says:

- I selected an object on the layer I want
- make that layer current now
- keep drawing there

That is the `LAYMCUR` / “make selected object's layer current” workflow.

## Benchmark Reading

Against `AutoCAD`, `BricsCAD`, and `LibreCAD`, the missing piece was not more layer flags. The repo already exposes:

- visibility
- lock
- freeze
- printable
- construction

The missing piece was a direct bridge from **selection context** to **creation context** without collapsing those concepts into one state.

VemCAD can surpass the benchmark by keeping the Step194 separation intact while still exposing a fast `LAYMCUR` path:

- selection still only controls focus
- current layer only changes when the operator explicitly asks for it
- the promoted layer must still pass editor drawing rules (`visible && !frozen && !locked`)

That is stricter and less error-prone than the usual CAD implementation where “make current” can leave the user on a layer that immediately blocks further edits.

## Product Goal

The editor user should be able to:

1. select an entity
2. promote that entity layer to current in one step
3. continue drawing on that layer immediately
4. keep selection focus and current layer conceptually separate
5. get an explainable refusal if the selected entity lives on a locked, frozen, or hidden layer

## Non-goals

- do not auto-switch current layer on every selection change
- do not add “move selected entities to current layer” in this step
- do not broaden into layer search/filter UI
- do not change export schema or persisted document state

## Design

### 1. Selection-to-current resolver

`tools/web_viewer/ui/layer_session_policy.js` should own a small helper that converts selection state into a valid drawing target:

- prefer `primaryId` when multi-select exists
- reject empty selection
- reject stale/missing entity ids
- reject layers that fail editor drawing rules
- return a stable error/message payload for the command surface

This keeps `workspace.js` thin and makes the contract unit-testable.

### 2. Command input: `laymcur`

`tools/web_viewer/ui/workspace.js` should add a `laymcur` verb:

- resolve the primary selected entity layer
- call the existing `setCurrentLayer()` path
- reuse the current-layer status bar and panel updates
- surface refusal messages instead of silently doing nothing

This is intentionally different from `layer/clayer`, which remain direct lookup commands by name or id.

### 3. Property panel wording

The property panel already had a useful bridge action, but the wording was too implementation-shaped.

For editable focused layers that are not current:

- keep the stable action id `use-layer` for smoke compatibility
- change the visible label to `Make Current`

That matches the actual user intent better than `Use Layer`.

### 4. Browser contract

The browser smoke should verify four things in one run:

- imported editable layer becomes initial current
- selecting an entity can focus one layer while current stays elsewhere
- `laymcur` promotes the selected entity layer and new geometry lands there
- `laymcur` refuses locked target layers and preserves the previous current layer

## Files

- `tools/web_viewer/ui/layer_session_policy.js`
- `tools/web_viewer/ui/workspace.js`
- `tools/web_viewer/ui/property_panel.js`
- `tools/web_viewer/tests/editor_commands.test.js`
- `tools/web_viewer/scripts/editor_current_layer_smoke.js`
- `tools/web_viewer/README.md`

## Acceptance Criteria

- `laymcur` exists as a command input verb
- multi-select uses the primary selected entity layer
- locked/frozen/hidden layers are rejected as current drawing targets
- property panel shows `Make Current` for editable off-current focused layers
- browser smoke proves both success and refusal paths
