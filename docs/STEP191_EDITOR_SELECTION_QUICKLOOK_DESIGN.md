# STEP191 Editor Selection Quicklook Design

## Background

Step190 already made editor-side provenance honest at the data layer:

- imported `color_source / color_aci / space / layout` now survive into `DocumentState`
- property edits promote imported color provenance to explicit `TRUECOLOR` when the user changes `Layer ID` or `Color`
- CADGF export keeps that promotion explicit

What was still missing was the product surface.

At the start of this step, the right-side `Selection` panel was still effectively a thin summary plus a list-shaped DOM contract. Users had to read the property form to understand imported provenance and effective style, and browser smoke still depended on summary rows that were optimized for compact regression output rather than for a high-signal operator-facing quicklook.

## Benchmark Reading

Against benchmark products and reference code, the gap was not geometric capability. It was selection explainability.

- `AutoCAD LT / BricsCAD / DraftSight` give users a strong sense of effective current properties, but source/provenance usually stays implicit or spread across layer semantics, command line feedback, and property tables.
- `LibreCAD` keeps 2D editing simple and predictable, but does not provide a strong provenance-aware quicklook model for imported/derived content.
- Current VemCAD contracts already know more than these UIs expose:
  - `sourceType`
  - `proxyKind`
  - `editMode`
  - `colorSource`
  - `colorAci`
  - `space / layout`
  - `lineType / lineWeight / lineTypeScale`

The benchmark-aligned opportunity is therefore not “copy the exact panel layout”, but “surface effective style and provenance side by side without inventing new semantics”.

## Product Goal

For single selection, the user should be able to answer all of these in one glance:

- what object type is selected?
- where did it come from?
- what effective color is being shown right now?
- is that color inherited or explicit?
- is the entity in model or paper space, and what layout is it attached to?
- what line style contract is active?

The answer must be available from a stable, intentionally designed DOM surface so browser smoke and downstream tooling do not need to scrape the property form.

## Non-goals

- Do not infer new provenance for `lineType` or `lineWeight`; the repo does not yet carry stable source fields for them.
- Do not add new import/export semantics in this step.
- Do not replace the property form; the quicklook complements it.
- Do not broaden multi-select semantics beyond existing safe facts.

## Design

### 1. Shared presentation helper

Add a shared presenter in `tools/web_viewer/ui/selection_presenter.js` that becomes the single source of truth for:

- selection summary text
- status-bar selection text
- read-only classification
- origin formatting
- single-selection detail facts
- badge content for quick inspection

This prevents `workspace`, `Selection`, and smoke code from drifting into separate formatting contracts.

### 2. Selection quicklook surface

The `Selection` panel keeps the existing headline summary, but gains a richer quicklook under `#cad-selection-details`:

- hero row:
  - effective color swatch
  - primary type
  - origin caption
- badges:
  - type
  - space
  - layout
  - color source
  - read-only when applicable
- fact rows:
  - `origin`
  - `effective-color`
  - `color-source`
  - `color-aci`
  - `space`
  - `layout`
  - `line-type`
  - `line-weight`
  - `line-type-scale`

This is intentionally stronger than a plain label/value stack, but still grounded in already-shipped contracts.

### 3. Stable browser contract

The quicklook exposes stable hooks:

- `#cad-selection-details`
- `data-selection-field="..."`
- `data-selection-badge="..."`
- dataset state on the container:
  - `data-mode`
  - `data-entity-count`
  - `data-primary-type`
  - `data-read-only`

This gives smoke a durable API without coupling tests to property form ordering.

### 4. Multi-select behavior

Multi-select remains intentionally conservative:

- keep the existing summary headline
- show a note that provenance quicklook is single-select only
- show only safe badges such as `type` and `read-only`

This avoids pretending there is a canonical merged provenance model where none exists.

## Files

- `tools/web_viewer/ui/selection_presenter.js`
- `tools/web_viewer/ui/property_panel.js`
- `tools/web_viewer/ui/workspace.js`
- `tools/web_viewer/style.css`
- `tools/web_viewer/scripts/editor_ui_flow_smoke.sh`
- `tools/web_viewer/scripts/editor_selection_summary_smoke.js`
- `tools/web_viewer/tests/editor_commands.test.js`
- `tools/web_viewer/README.md`

## Acceptance Criteria

- single selection renders a stable quicklook with effective style and provenance facts
- quicklook content is derived only from existing entity metadata/contracts
- property edits update quicklook immediately from document state
- imported color provenance promotion is visible in quicklook after `Layer ID` edit
- `editor_selection_summary_smoke.js` validates the browser path against the stable DOM surface
- Node tests protect both compact contract formatting and new presentation helpers
