# STEP202 Editor Effective BYLAYER Style Design

## Scope

This step extends the current-layer drafting contract from Step201's color-only path into a fuller layer-style model:

- layer defaults now include `lineType` and `lineWeight`
- editor-created `Line` / `Polyline` / `Circle` / `Arc` / `Text` entities keep raw `BYLAYER` style instead of baking effective line style into the entity
- editor rendering and inspection resolve effective style from the layer at draw/read time
- no-selection property panel state becomes the UI surface for current-layer drafting defaults

The target is closer to the behavior users expect from AutoCAD/BricsCAD-style 2D drafting, and closer to the deferred style-resolution model documented in [DXF_STYLE_REFERENCE_COMPARISON.md](./DXF_STYLE_REFERENCE_COMPARISON.md).

## Problem

Before this step:

- Step201 made new editor-created entities inherit current-layer `BYLAYER` color
- but layer defaults for `line type` and `line weight` were not part of the editor layer schema
- canvas rendering, selection summary, and property presentation still mixed raw entity style with partially baked layer style
- changing a layer default after import or during editing did not produce a coherent editor-visible effective style story

That left a benchmark-visible gap:

- commercial 2D CAD users expect current-layer defaults to be editable and immediately visible
- LibreCAD-style deferred resolution lets layer edits propagate to BYLAYER entities
- the editor already had enough provenance and layer-state structure to support this cleanly, but not a shared effective-style contract

## Design

### 1. Layer schema and CADGF adapter

- `schemas/document.schema.json`
  - adds optional layer-level `line_type` and `line_weight`
- `tools/web_viewer/state/documentState.js`
  - extends editor layer state with `lineType` and `lineWeight`
  - default layer contract is now:
    - `lineType: 'CONTINUOUS'`
    - `lineWeight: 0`
- `tools/web_viewer/adapters/cadgf_document_adapter.js`
  - imports `layer.line_type` -> `lineType`
  - imports `layer.line_weight` -> `lineWeight`
  - exports the same fields back to CADGF

This keeps the editor layer model aligned with the underlying document contract rather than inventing viewer-only state.

### 2. Shared effective-style resolution

- `tools/web_viewer/line_style.js`
  - adds `resolveEffectiveEntityColor(entity, layer)`
  - adds `resolveEffectiveEntityStyle(entity, layer)`
  - updates `resolveCanvasStrokeStyle(...)` to consume effective style

The important rule is:

- raw entity values remain the source of truth for explicit overrides
- `BYLAYER` or defaulted entity style resolves against the owning layer at render/read time

This is the main architectural shift in Step202. Instead of duplicating style rules in preview, editor canvas, selection summary, and property UI, they now share one effective-style resolver.

### 3. Editor rendering and inspection consume the same contract

- `tools/web_viewer/ui/canvas_view.js`
  - uses layer-aware effective color and effective line style at draw time
- `tools/web_viewer/ui/selection_presenter.js`
  - selection detail rows now report effective `color / line type / line weight / line type scale`
- `tools/web_viewer/ui/property_panel.js`
  - single-select metadata mirrors the same effective-style contract
  - selection hero swatch now uses the same effective-color fact instead of raw entity color
  - with no selection, the panel exposes current-layer drafting defaults
- `tools/web_viewer/ui/workspace.js`
  - wires `getCurrentLayer(...)` and `updateCurrentLayer(...)` into property-panel rendering

This eliminates a drift class where canvas, property panel, and selection details each told a different style story.

### 4. Tool-authored entities keep raw BYLAYER style

- `tools/web_viewer/tools/tool_context.js`
  - `buildDraftEntity(...)` now emits:
    - `colorSource: 'BYLAYER'`
    - `lineType: 'BYLAYER'`
    - `lineWeight: 0`
    - plus current-layer `color`

Drawing tools continue to create on the current layer, but they now preserve the raw drafting intent instead of baking effective line style into the entity payload.

This matters for later layer edits:

- newly created geometry remains honest about being `BYLAYER`
- editor summaries and rendering can show the effective result without destroying provenance

### 5. Property-panel current-layer defaults

With no selection:

- property panel shows current-layer context
- current-layer `color`
- current-layer `line type`
- current-layer `line weight`

This is intentionally narrow:

- only current-layer drafting defaults are editable here
- this step does not introduce a full layer manager form or per-document line-style authoring workflow

That keeps the UI change proportional while still matching benchmark expectations for everyday drafting.

### 6. Smoke stabilization stays debug-scoped

- `tools/web_viewer/scripts/editor_current_layer_smoke.js`
- `tools/web_viewer/scripts/editor_layer_session_smoke.js`

Both browser smokes now use the same strategy:

- try real toolbar + canvas input first
- if entity creation does not materialize quickly, use a debug-only `window.__cadDebug.runCommand('entity.create', ...)` fallback

This does not change product behavior. It narrows the smoke to the contract under test:

- current-layer fallback
- layer-session fallback
- raw `BYLAYER` entity payload
- effective editor-visible style

Without this, the gate could still fail on a dropped click even when the layer-style contract was correct.

## Behavior Contract

- layers carry editor-visible defaults for:
  - `color`
  - `lineType`
  - `lineWeight`
- tool-created drafting entities keep raw style:
  - `colorSource: 'BYLAYER'`
  - `lineType: 'BYLAYER'`
  - `lineWeight: 0`
  - `lineTypeScale: 1`
- editor canvas, selection details, and property panel report effective style from layer defaults
- selection hero swatch, effective-color row, and raw entity payload no longer drift after current-layer color edits
- changing current-layer defaults immediately affects:
  - future drafted entities
  - effective rendering of BYLAYER entities on that layer
  - selection/property facts for those entities

## Scope Limits

This step deliberately does not do three things:

- no layer-level `lineTypeScale` default
  - the reference comparison shows `1.0` as the entity-side default, so this step keeps `lineTypeScale` entity-scoped
- no full live `BYBLOCK` propagation engine
- no attempt to rewrite older provenance docs around imported layer/color promotion

So Step202 improves the editor's BYLAYER contract materially, but it does not claim full DWG/DXF style inheritance parity yet.

## Benchmark Intent

This is a meaningful quality step against both product and code references:

- stronger than a typical lightweight editor that only stores `layerId` but not effective layer style
- closer to AutoCAD/BricsCAD user expectations because current-layer defaults can be edited and observed immediately
- closer to LibreCAD's deferred-resolution model because BYLAYER entities now respond to layer defaults in editor rendering and summaries

The key improvement is not more geometry. It is a cleaner contract:

- raw drafting intent stays raw
- effective style is resolved once, centrally
- UI, rendering, export, and smoke verification all point at the same truth
