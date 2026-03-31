# STEP194 Editor Current Layer Design

## Background

Step193 closed the recovery loop for locked layers:

- selected entity drives layer focus
- `Locate Layer` makes the target row easy to find
- `Unlock Layer` restores editing without a reload

That still left a benchmark-sized gap.

In real 2D drafting workflows, the editor must answer two different questions:

- which layer does the current selection live on?
- which layer will the next newly created entity land on?

Step193 solved the first question. Step194 addresses the second.

## Benchmark Reading

Against `AutoCAD`, `BricsCAD`, and `LibreCAD`, the missing capability was not layer listing or layer flags. The repo already had those.

The gap was the absence of an explicit **current layer** workflow:

- layer focus is selection-driven and diagnostic
- current layer is the active creation context
- new objects should follow current layer, not a hard-coded default like `0`

VemCAD can surpass the benchmark by making this distinction visible and operational:

- focused layer continues to explain the current selection
- current layer drives all native creation tools
- the user can change current layer directly from layer UI or command input
- locked, frozen, or hidden layers cannot silently become drawing targets

That is a cleaner and more honest drafting model than mixing selection context with creation context.

## Product Goal

For the editor session, the user should be able to:

1. see the focused layer of the current selection
2. see the active current layer that creation tools will use
3. change the current layer explicitly
4. create new `line`, `polyline`, `circle`, `arc`, and `text` entities on that current layer
5. recover immediately if the current layer becomes unavailable

## Non-goals

- do not move current layer into the document export schema
- do not conflate current layer with selection focus
- do not auto-switch current layer on selection change
- do not broaden this step into full AutoCAD layer management
- do not change provenance, `BYLAYER`, or line-style contracts in this step

## Design

### 1. Focused layer vs current layer

The editor must keep these concepts separate:

- `focused layer`
  - derived from the current selection
  - used for inspect/recovery workflows
  - shown in the property context and layer panel focus state
- `current layer`
  - explicit session state
  - used by creation tools
  - shown in the status bar and layer panel current state

Selection changes may update focus, but they must not silently rewrite the current layer.

### 2. Layer panel current surface

`tools/web_viewer/ui/layer_panel.js` should expose a stable current-layer surface:

- `.cad-layer-item.is-current`
- `data-current`
- `Use` or `Current` affordance in the row controls

The layer panel should make the distinction between focus and current visible at a glance.

### 3. Status bar current-layer surface

`tools/web_viewer/index.html` and `tools/web_viewer/ui/statusbar.js` should expose a compact current-layer readout:

- `Current: <layer ref>`
- `0:0` style reference when the default layer is active

This gives the operator a fast, always-visible check of where new geometry will land.

### 4. Creation tools use current layer

The native creation tools must read the current layer instead of hard-coding layer `0`:

- `line`
- `polyline`
- `circle`
- `arc`
- `text`

These tools should continue to own geometry creation and preview state. They only need the current layer id as session context.

### 5. Layer activation rules

The current layer should only be set to an editable layer:

- existing layer
- visible
- not frozen
- not locked

If the selected target layer becomes invalid, the workspace should fall back to a safe editable layer rather than silently allowing creation on an unusable target.

### 6. Command and property surfaces

The editor should provide at least one explicit command path to current-layer changes:

- `layer <id>`
- `clayer <name or id>`

The property panel should keep its existing `Locate Layer` and `Unlock Layer` actions for focused-layer recovery. Those actions do not replace current-layer control. When the focused layer is editable but not current, the panel can also surface `Use Layer` as a direct bridge from inspection to drafting context.

## Files

- `tools/web_viewer/ui/layer_session_policy.js`
- `tools/web_viewer/ui/layer_panel.js`
- `tools/web_viewer/ui/statusbar.js`
- `tools/web_viewer/ui/workspace.js`
- `tools/web_viewer/tools/line_tool.js`
- `tools/web_viewer/tools/polyline_tool.js`
- `tools/web_viewer/tools/circle_tool.js`
- `tools/web_viewer/tools/arc_tool.js`
- `tools/web_viewer/tools/text_tool.js`
- `tools/web_viewer/style.css`
- `tools/web_viewer/tests/editor_commands.test.js`
- `tools/web_viewer/scripts/editor_current_layer_smoke.js`
- `tools/web_viewer/scripts/editor_selection_summary_smoke.js`
- `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- `tools/web_viewer/README.md`

## Acceptance Criteria

- the editor shows both focused layer and current layer as separate concepts
- clicking a layer row can set the current layer explicitly
- `line`, `polyline`, `circle`, `arc`, and `text` create on the current layer
- current layer does not auto-follow selection focus
- locked, frozen, or hidden layers cannot be used as creation targets
- command input can query and change the current layer
- browser smoke verifies current-layer creation and focus/current separation
