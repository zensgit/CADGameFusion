# STEP206 Editor Current Space/Layout Design

## Scope

This step moves `space / layout` from imported metadata into a real editor session contract:

- the editor now has an active current `space / layout` session
- render, hit-test, and selection visibility filter to that session
- drafted entities inherit the active session
- command bar, status bar, and no-selection property panel can switch sessions
- the contract works for both `Model` and real paper layouts

This is the next high-ROI slice after the layer/style work because it turns existing provenance facts into actual DWG editing behavior.

## Problem

Before this step:

- CADGF import preserved entity `space / layout`
- selection/property UI could show those fields
- but the editor still behaved like a flat canvas:
  - model-space and paper-space entities rendered together
  - hit-testing could see entities from other layouts
  - new geometry had no editor-side current session and silently fell back to model-space defaults unless the caller explicitly authored metadata

That left a large benchmark gap. AutoCAD-like 2D editors do not treat model space and paper layouts as passive labels; they are editing sessions that drive visibility, selection, and creation defaults.

## Design

### 1. Add a shared current space/layout contract

- `tools/web_viewer/space_layout.js`
  - introduces shared normalization and matching helpers:
    - `normalizeSpaceLayoutContext(...)`
    - `resolveCurrentSpaceLayoutContext(...)`
    - `matchesSpaceLayout(...)`
    - `listPaperLayoutsFromEntities(...)`
    - `formatSpaceLayoutLabel(...)`

This keeps `space / layout` behavior consistent across state, UI, and browser smokes instead of duplicating ad-hoc rules.

Key rules:

- `space = 0` canonicalizes to `layout = Model`
- `space = 1` preserves a real paper layout name
- when no explicit current session exists, the editor prefers:
  - model space if model entities exist
  - otherwise the first discovered paper layout

### 2. DocumentState now owns the active session for render/query behavior

- `tools/web_viewer/state/documentState.js`
  - `meta.currentSpace`
  - `meta.currentLayout`
  - `getCurrentSpaceContext()`
  - `setCurrentSpaceContext(...)`
  - `listPaperLayouts()`

`isEntityRenderable(...)` now requires both:

- layer visibility/frozen state
- current `space / layout` match

Spatial queries also now filter candidates through `isEntityRenderable(...)` unconditionally. That is important because session filtering must affect both:

- canvas rendering
- pointer hit-testing / selection / tool picks

Without that, the editor would still select hidden off-session entities even if they were no longer drawn.

### 3. Draft tools inherit the active session

- `tools/web_viewer/tools/tool_context.js`

`buildDraftEntity(...)` now injects:

- `space`
- `layout`

from the current session, the same way it already injects current layer and `BYLAYER` style defaults.

This is the core authoring rule for Step206:

- if the user is drafting in `Layout-A`, new entities are authored in `Layout-A`
- if the user is drafting in `Model`, new entities are authored in `Model`

So current session stops being a viewer filter only and becomes part of authored document semantics.

### 4. Workspace exposes the session as a first-class editing control

- `tools/web_viewer/ui/workspace.js`
- `tools/web_viewer/ui/statusbar.js`
- `tools/web_viewer/index.html`
- `tools/web_viewer/ui/property_panel.js`

The workspace now exposes current session through:

- status bar:
  - `Space: Model`
  - `Space: Paper / Layout-A`
- command bar:
  - `space`
  - `layout <name>`
  - `mspace`
  - `pspace [layout]`
- no-selection property panel:
  - `Current Space`
  - `Current Layout`
  - `Use Model Space`
  - `Use Layout ...`

This is intentionally parallel to the current-layer workflow:

- layer remains the current drafting layer
- `space / layout` becomes the current drafting session

The editor no longer pretends those are the same concept.

### 5. Browser/debug fallbacks must inherit the same session

- `tools/web_viewer/scripts/editor_current_layer_smoke.js`
- `tools/web_viewer/scripts/editor_layer_session_smoke.js`
- `tools/web_viewer/scripts/editor_space_layout_smoke.js`

Existing debug draft fallbacks were patched to include current `space / layout`. That matters because browser gates sometimes fall back from UI clicks to debug creation; if those paths diverged, the gate would again test a different contract from the product.

## Behavior Contract

- import:
  - preserves per-entity `space / layout`
  - resolves an active editor session from document contents
- render/query:
  - only entities in the current session are renderable/selectable
- drafting:
  - new `Line` / `Polyline` / `Circle` / `Arc` / `Text` entities inherit the active `space / layout`
- UI:
  - status bar, command bar, and no-selection property panel can switch sessions
- provenance:
  - single-selection facts continue to expose `Space` and `Layout` explicitly

## Scope Limits

This step intentionally does not do the following:

- no paper viewport reconstruction in editor mode
- no separate tab strip for layouts
- no block-reference edit-in-place workflow yet
- no viewport lock/activation model

So Step206 closes the editing-session gap honestly without claiming full paperspace viewport parity.

## Benchmark Intent

Step206 is the first editor slice that makes `space / layout` feel product-level rather than metadata-level:

- closer to AutoCAD/BricsCAD editing sessions
- stronger than lightweight viewers that only display layout provenance
- materially better for mixed model/paper drawings because selection and creation now follow the active session

The key improvement is that the editor now has a real current `space / layout`, not just entities that happen to carry those fields.
