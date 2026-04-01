# STEP205 Editor Lineweight Provenance Verification

## Scope

This verification covers Step205's lineweight provenance closure:

- `lineWeight` now has explicit `BYLAYER/EXPLICIT` source semantics in editor state
- selection/property UI exposes `line weight source`
- explicit `lineWeight=0` stays visible as an authored override
- property recovery can reset explicit lineweight back to `BYLAYER`
- export omits `line_weight` only for true `BYLAYER` state and preserves explicit zero
- current-layer and layer-session draft paths still emit `BYLAYER` lineweight provenance

## Automated Verification

### 1. Node unit/integration suite

Command:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Result:

- `201/201 PASS`

Relevant coverage added or extended in:

- `create tools use current layer for new entities`
  - drafted entities now assert `lineWeightSource === 'BYLAYER'`
- `line style helpers keep preview and editor mappings aligned`
  - verifies effective style resolution for both explicit and `BYLAYER` lineweight, including explicit zero
- `cadgf adapter imports and exports entity line style fields`
  - imported raw `line_weight` becomes `lineWeightSource = EXPLICIT`
- `cadgf adapter omits line_weight when explicit weight returns to BYLAYER`
  - locks the restore-to-layer omission rule
- `cadgf adapter preserves explicit zero line_weight`
  - locks the explicit-zero export case
- `selection.propertyPatch updates line style fields and undo/redo`
  - verifies direct property patching keeps lineweight provenance explicit across history

### 2. Syntax / diff hygiene

Commands:

```bash
node --check deps/cadgamefusion/tools/web_viewer/line_style.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
git -C deps/cadgamefusion diff --check
```

Result:

- all passed

## Browser Smoke Verification

### 1. Selection summary + property provenance smoke

Command:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
```

Artifact:

- [summary.json](../build/editor_selection_summary_smoke/20260323_141726/summary.json)

Key assertions from the artifact:

- after `Use Layer ...` restore:
  - selection details show:
    - `line-weight = 0.35`
    - `line-weight-source = BYLAYER`
  - raw entity shows:
    - `lineWeight = 0`
    - `lineWeightSource = BYLAYER`
- after forcing a real authored transition `0.1 -> 0`:
  - selection details show:
    - `line-weight = 0`
    - `line-weight-source = EXPLICIT`
  - raw entity shows:
    - `lineWeight = 0`
    - `lineWeightSource = EXPLICIT`
  - property actions include:
    - `use-layer-line-weight`
- after clicking `Use Layer Line Weight` again:
  - selection details return to:
    - `line-weight = 0.35`
    - `line-weight-source = BYLAYER`
  - the restore action disappears

This is the main Step205 proof: explicit zero is now a first-class authored state instead of being flattened into the inherited layer value.

### 2. Current-layer drafting regression smoke

Command:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js
```

Artifact:

- [summary.json](../build/editor_current_layer_smoke/20260323_141803/summary.json)

Key assertions from the artifact:

- drafted current-layer entities store:
  - `lineWeightSource = BYLAYER`
- selection details for drafted entities continue to resolve effective weight from the active layer defaults
- current-layer fallback creation still uses raw `BYLAYER` style rather than inventing explicit lineweight

This confirms Step205 did not accidentally convert normal drafting into explicit lineweight authoring.

### 3. Layer-session regression smoke

Command:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_layer_session_smoke.js
```

Artifact:

- [summary.json](../build/editor_layer_session_smoke/20260323_141803/summary.json)

Key assertions from the artifact:

- fallback-created entities during lock/freeze recovery flows now include:
  - `lineWeightSource = BYLAYER`
- session fallback creation continues to inherit effective layer style while preserving raw authored `BYLAYER` state

This keeps the layer-session browser paths aligned with the main drafting contract.

## Result

Step205 is verified as green:

- unit/integration suite passed
- selection/property browser smoke passed
- current-layer browser smoke passed
- layer-session browser smoke passed

The editor now distinguishes inherited lineweight from authored lineweight even when the authored value is zero, which is a real benchmark-quality improvement in both inspection and roundtrip fidelity.
