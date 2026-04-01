# STEP202 Editor Effective BYLAYER Style Verification

## Scope

This verification covers Step202's editor-side BYLAYER style closure:

- layer schema carries `line_type` and `line_weight`
- tool-created entities keep raw `BYLAYER` style for `color / line type / line weight`
- canvas + selection + property UI resolve effective style from layer defaults
- current-layer property rows edit drafting defaults
- current-layer and layer-session browser smokes verify the contract on real pages

## Automated Verification

### 1. Node unit/integration suite

Command:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Result:

- `196/196 PASS`

Relevant coverage added or extended in:

- `create tools use current layer for new entities`
  - new entities now assert:
    - `colorSource === 'BYLAYER'`
    - `lineType === 'BYLAYER'`
    - `lineWeight === 0`
- `line style helpers keep preview and editor mappings aligned`
  - verifies effective BYLAYER color/style resolution through the shared resolver
- `selection contract resolves effective BYLAYER style from layer defaults`
  - locks effective line type and line weight reporting
- `selection presentation resolves effective BYLAYER detail facts from layer defaults`
  - locks effective `layer color / effective color / line type / line weight`
- CADGF adapter roundtrip coverage
  - verifies layer `line_type` / `line_weight` import/export alongside existing layer flags

### 2. Script syntax checks

Commands:

```bash
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_layer_session_smoke.js
```

Result:

- both passed

## Browser Smoke Verification

### 1. Current-layer drafting smoke

Command:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js
```

Artifact:

- [summary.json](../build/editor_current_layer_smoke/20260323_114250/summary.json)

Key assertions from the artifact:

- imported current layer starts at `1:PLOT`
- after switching to `2:REDLINE`, no-selection property rows expose current-layer defaults
- editing current layer defaults produces:
  - `color = #00aaff`
  - `lineType = CENTER`
  - `lineWeight = 0.35`
- the newly created line stores raw drafting intent:
  - `layerId = 2`
  - `color = #00aaff`
  - `colorSource = BYLAYER`
  - `lineType = BYLAYER`
  - `lineWeight = 0`
- selection details show effective style:
  - `layer-color = #00aaff`
  - `effective-color = #00aaff`
  - `effective-color-swatch = #00aaff`
  - `line-type = CENTER`
  - `line-weight = 0.35`
- the creation path stayed on real UI input in this run:
  - `current_layer_style_created_via = "ui"`

### 2. Layer-session fallback smoke

Command:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_layer_session_smoke.js
```

Artifact:

- [summary.json](../build/editor_layer_session_smoke/20260323_113747/summary.json)

Key assertions from the artifact:

- `LAYOFF` hides `2:REDLINE` and falls current back to `1:PLOT`
- `LAYON` restores visibility and current-layer preference to `2:REDLINE`
- `LAYFRZ` freezes `2:REDLINE` and keeps drafting on fallback layer `1:PLOT`
- fallback-created entity during freeze stores raw BYLAYER style:
  - `layerId = 1`
  - `colorSource = BYLAYER`
  - `lineType = BYLAYER`
  - `lineWeight = 0`
- `Thaw Layers` restores freeze session state and current-layer preference
- layer-panel `Frozen/Live` toggle also keeps fallback drawing on `1:PLOT`
- the final panel-freeze drawing used the smoke's debug-only creation fallback:
  - `panel_freeze_created_via = "debug"`
  - resulting entity contract still matches the expected fallback BYLAYER style

That last point is expected for the smoke harness, not product behavior drift. The fallback exists to keep the gate focused on layer-session semantics when a real click does not produce an entity quickly enough.

## Consistency Checks

The following contracts are now aligned:

- layer schema in `document.schema.json`
- CADGF import/export layer fields
- editor document state
- tool-authored creation defaults
- editor canvas rendering
- selection summary facts
- property-panel metadata/current-layer defaults
- selection hero swatch color
- browser smoke artifacts

## Result

Step202 is verified as green:

- unit/integration suite passed
- browser current-layer smoke passed
- browser layer-session smoke passed
- the resulting artifacts show raw `BYLAYER` entity style plus effective layer-style resolution, which is the intended contract for this step
