# STEP203 Editor Style Source Controls Verification

## Scope

This verification covers Step203's source-control and recovery closure:

- selection/property UI exposes `line type source` and `line weight source`
- property actions can restore explicit overrides back to raw `BYLAYER`
- CADGF export no longer leaks stale `color_aci` when color returns to `BYLAYER`
- current-layer drafting regression remains green after the property-panel changes

## Automated Verification

### 1. Node unit/integration suite

Command:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Result:

- `198/198 PASS`

Relevant coverage added or extended in:

- `line style helpers keep preview and editor mappings aligned`
  - verifies normalized `colorSource / lineTypeSource / lineWeightSource`
- `cadgf adapter clears stale color_aci when explicit color returns to BYLAYER`
  - locks the export deletion path that previously regressed
- existing selection-presentation coverage
  - now asserts `line-type-source` and `line-weight-source` rows in single-select detail facts

### 2. Targeted syntax / diff hygiene

Commands:

```bash
node --check deps/cadgamefusion/tools/web_viewer/adapters/cadgf_document_adapter.js
git -C deps/cadgamefusion diff --check
```

Result:

- both passed

## Browser Smoke Verification

### 1. Selection summary + property recovery smoke

Command:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
```

Artifact:

- [summary.json](../build/editor_selection_summary_smoke/20260323_131837/summary.json)

Key assertions from the artifact:

- initial imported selection exposes stable source facts:
  - `line-type-source = EXPLICIT`
  - `line-weight-source = EXPLICIT`
- after moving the entity to `2:REDLINE`, imported `BYLAYER` color still resolves to the new layer effective color
- after explicit color override:
  - `effective-color = #112233`
  - `color-source = TRUECOLOR`
  - property actions include:
    - `use-layer-color`
    - `use-layer-line-type`
    - `use-layer-line-weight`
- after clicking all three recovery actions:
  - selection details show:
    - `effective-color = #ff0000`
    - `color-source = BYLAYER`
    - `line-type = CENTER`
    - `line-type-source = BYLAYER`
    - `line-weight = 0.35`
    - `line-weight-source = BYLAYER`
  - raw entity state becomes:
    - `colorSource = BYLAYER`
    - `lineType = BYLAYER`
    - `lineWeight = 0`
  - recovery actions disappear because the entity is no longer overriding layer style

This is the main Step203 proof: UI recovery actions and in-memory style state converge on the same truth.

### 2. Current-layer drafting regression smoke

Command:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js
```

Artifact:

- [summary.json](../build/editor_current_layer_smoke/20260323_131837/summary.json)

Key regression assertions from the artifact:

- current-layer defaults still drive creation context
- new lines still keep raw drafting intent:
  - `colorSource = BYLAYER`
  - `lineType = BYLAYER`
  - `lineWeight = 0`
- selection facts still resolve effective layer style:
  - `line-type = CENTER`
  - `line-type-source = BYLAYER`
  - `line-weight = 0.35`
  - `line-weight-source = BYLAYER`
- layer/session workflows still expose the expected property actions after Step203 changes

## Consistency Checks

The following contracts are aligned after Step203:

- `line_style.js` source normalization
- selection details under `#cad-selection-details`
- property-panel metadata rows
- property-panel recovery actions
- in-memory entity patching
- CADGF export cleanup for recovered `BYLAYER` color/style
- browser smoke artifacts

## Result

Step203 is verified as green:

- command-layer suite passed
- selection/property browser smoke passed
- current-layer browser regression smoke passed
- export cleanup now matches UI recovery semantics instead of drifting behind them

The editor is now materially closer to benchmark CAD override workflows because users can see override state, clear it directly, and trust the export result.
