# STEP204 Editor Linetype Scale Provenance Verification

## Scope

This verification covers Step204's linetype-scale provenance closure:

- `lineTypeScale` now has `DEFAULT/EXPLICIT` source semantics in editor state
- selection/property UI exposes `line type scale source`
- property recovery can reset explicit scale back to default
- export omits `line_type_scale` when the source is default
- current-layer and layer-session draft paths still emit default scale provenance

## Automated Verification

### 1. Node unit/integration suite

Command:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Result:

- `199/199 PASS`

Relevant coverage added or extended in:

- `create tools use current layer for new entities`
  - drafted entities now assert `lineTypeScaleSource === 'DEFAULT'`
- `line style helpers keep preview and editor mappings aligned`
  - verifies `lineTypeScaleSource` normalization for both default and explicit cases
- `selection presentation ... detail facts`
  - now locks `line-type-scale-source`
- `cadgf adapter imports and exports entity line style fields`
  - imported explicit `line_type_scale` becomes `lineTypeScaleSource = EXPLICIT`
- `cadgf adapter omits line_type_scale when explicit scale returns to default source`
  - locks the new export omission rule
- `selection.propertyPatch updates line style fields and undo/redo`
  - verifies direct property patching keeps scale provenance explicit across history

### 2. Syntax / diff hygiene

Commands:

```bash
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_layer_session_smoke.js
git -C deps/cadgamefusion diff --check
```

Result:

- all passed

## Browser Smoke Verification

### 1. Selection summary + property recovery smoke

Command:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
```

Artifact:

- [summary.json](../build/editor_selection_summary_smoke/20260323_132501/summary.json)

Key assertions from the artifact:

- imported line starts with:
  - `line-type-scale = 1.7`
  - `line-type-scale-source = EXPLICIT`
- after reassignment to `2:REDLINE`, explicit scale provenance remains explicit
- property actions include:
  - `use-default-line-type-scale`
- after the recovery click:
  - selection details show:
    - `line-type-scale = 1`
    - `line-type-scale-source = DEFAULT`
  - raw entity shows:
    - `lineTypeScale = 1`
    - `lineTypeScaleSource = DEFAULT`
  - recovery action disappears, proving the entity is no longer considered explicitly scaled

This is the main Step204 proof: the editor can now clear imported explicit linetype scale back to the default authored state.

### 2. Current-layer drafting regression smoke

Command:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js
```

Artifact:

- [summary.json](../build/editor_current_layer_smoke/20260323_132501/summary.json)

Key assertions from the artifact:

- drafted current-layer entity stores:
  - `lineTypeScaleSource = DEFAULT`
- selection details for that drafted entity show:
  - `line-type-scale-source = DEFAULT`
- later drafted entities created through `laymcur` and fallback-current flows also keep default scale provenance

This confirms Step204 did not accidentally turn normal drafting into an explicit-scale workflow.

### 3. Layer-session regression smoke

Command:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_layer_session_smoke.js
```

Artifact:

- [summary.json](../build/editor_layer_session_smoke/20260323_132501/summary.json)

Key assertions from the artifact:

- fallback-created entities during layer lock/freeze flows now include:
  - `lineTypeScaleSource = DEFAULT`
- panel-freeze debug fallback creation also carries the same default source

This keeps all drafting entry paths aligned instead of letting browser fallback helpers drift away from product semantics.

## Result

Step204 is verified as green:

- unit/integration suite passed
- selection/property browser smoke passed
- current-layer browser regression smoke passed
- layer-session browser regression smoke passed

The editor now distinguishes default linetype scale from explicit linetype scale in the same way it already distinguishes effective style from source style, which is a material benchmark-quality improvement.
