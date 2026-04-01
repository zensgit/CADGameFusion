# STEP201 Editor BYLAYER Create Defaults Design

## Scope

This step closes a benchmark-visible drafting gap in the editor creation path:

- `Line`, `Polyline`, `Circle`, `Arc`, and `Text` already create on the current layer
- but they still used hard-coded editor colors instead of current-layer defaults

The goal of this step is to make new editor-created entities inherit current-layer `BYLAYER` color semantics so the drafting result matches AutoCAD/BricsCAD expectations more closely.

## Design

- `tools/web_viewer/tools/tool_context.js`
  - adds `buildDraftEntity(...)`
  - centralizes creation defaults for tool-authored entities
  - resolves the current layer color and emits:
    - `layerId`
    - `visible`
    - `color`
    - `colorSource: 'BYLAYER'`
  - keeps the helper narrow on purpose; this step does not yet expand layer schema into line type/line weight defaults
- drawing tools
  - `line_tool.js`
  - `polyline_tool.js`
  - `circle_tool.js`
  - `arc_tool.js`
  - `text_tool.js`
  - now route `entity.create` payloads through `ctx.buildDraftEntity(...)`
  - retain a fallback literal payload for isolated test harnesses that do not expose the helper
- `tools/web_viewer/tests/editor_commands.test.js`
  - extends the creation-tool harness with `buildDraftEntity(...)`
  - upgrades the existing current-layer creation test to lock:
    - `layerId`
    - `color`
    - `colorSource`
- browser smoke
  - `editor_current_layer_smoke.js`
    - verifies new drawing after `laymcur`, direct current-layer drawing, and lock fallback drawing all carry the correct `BYLAYER` color
  - `editor_layer_session_smoke.js`
    - verifies fallback drawing after `layfrz` and panel freeze carries the fallback layer `BYLAYER` color
- `tools/web_viewer/README.md`
  - documents that current-layer drafting now inherits `BYLAYER` color

## Behavior Contract

- tool-authored entities
  - create on the active current layer
  - default to the current layer color
  - mark `colorSource` as `BYLAYER`
- current-layer transitions
  - `laymcur`
  - `laylck`
  - `layfrz`
  - layer-panel current/fallback changes
  - all continue to influence not just target `layerId`, but also the next draft color source
- scope limit
  - this step does not yet introduce layer-level line type / line weight / line type scale defaults
  - those remain future schema work

## Benchmark Intent

This is a small but product-visible quality jump:

- commercial CAD users expect current-layer drawing to look like the current layer immediately
- open-source viewers often stop at correct `layerId` and miss the style contract
- pushing `BYLAYER` defaults into the editor creation path makes screenshots, exports, and smoke artifacts more faithful without adding hidden UI state

The implementation stays intentionally simple:

- one shared helper for tool-authored entity defaults
- no new layer schema yet
- real browser smoke proves the behavior on fallback/current transitions rather than only in unit tests
