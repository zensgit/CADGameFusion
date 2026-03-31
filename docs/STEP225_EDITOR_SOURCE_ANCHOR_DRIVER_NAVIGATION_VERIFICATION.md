# Step225 Editor Source Anchor Driver Navigation Verification

## Scope

Verify that imported `DIMENSION` / `LEADER` text proxies can navigate directly to their current anchor-driving geometry without regressing:

- Step224 source-anchor visibility and fitting
- Step223 transformed-source placement
- grouped-source text focus, reset, release, and direct proxy edits
- insert-group and broader selection/property workflows

## Commands

From `/Users/huazhou/Downloads/Github/VemCAD`:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js
node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Node contract tests

`node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

- PASS
- `248/248`

New locked behavior:

- `selection.sourceSelectAnchorDriver` narrows imported source text to the geometry currently driving its anchor
- selection presentation keeps `source-anchor-driver` visible for imported source text proxies

### 2. Real browser source-driver workflow

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_source_group_smoke/20260323_230724/summary.json)

Key verified behaviors:

- focused imported `DIMENSION` text reports:
  - `Source Anchor Driver = 21:line midpoint`
- the same `DIMENSION` path exposes property action `select-source-anchor-driver`
- clicking that action changes selection to:
  - `selectionIds = [21]`
  - `statusText = Selected source anchor driver (line midpoint)`
- focused imported `LEADER` text reports:
  - `Source Anchor Driver = 41:line endpoint`
- command-line `srcdriver` changes selection to:
  - `selectionIds = [41]`
  - `statusText = Selected source anchor driver (line endpoint)`
- the same smoke still keeps Step224 source-anchor fit behavior and Step223 transformed-source reset behavior green

### 3. Insert workflow regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260323_230735/summary.json)

This confirms source-driver navigation did not regress the richer imported `INSERT` workflow.

### 4. Selection/property regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260323_230747/summary.json)

This confirms the broader single-selection provenance/effective-style contract remains stable after adding source-driver navigation.

### 5. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step225 is verified.

Imported annotation editing now supports a stronger navigation path:

- inspect imported text
- see its current anchor and driver
- jump directly to the driver geometry
- return to grouped text workflows without release

That is materially stronger than the reference path of “show an anchor marker, then make the user hunt for the geometry by hand”.
