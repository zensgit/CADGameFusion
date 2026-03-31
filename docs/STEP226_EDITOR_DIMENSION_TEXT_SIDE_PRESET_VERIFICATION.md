# Step226 Editor Dimension Text Side Preset Verification

## Scope

Verify that imported `DIMENSION` text can flip to the opposite anchor side without regressing:

- Step223 transform-aware source placement
- Step224 source-anchor guidance
- Step225 source-anchor-driver navigation
- grouped-source text focus, reset, and release flows
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
- `250/250`

Locked behaviors:

- `selection.dimensionFlipTextSide` mirrors imported `DIMENSION` text across the current source anchor
- the command preserves `sourceTextPos` while syncing `dimTextPos / dimTextRotation`
- the same command follows transformed source anchors after grouped-source move

### 2. Real browser opposite-side preset workflow

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_source_group_smoke/20260323_233137/summary.json)

Key verified behaviors:

- focused imported `DIMENSION` text exposes property action `flip-dimension-text-side`
- clicking that action moves the text from:
  - `current-offset = 0, 14`
  to:
  - `current-offset = 0, -14`
- the same action keeps preserved source placement intact:
  - `sourceTextPos = 0, 14`
- after grouped-source move, command-line `srcflip` still flips against the transformed anchor:
  - anchor `= 3, -2`
  - flipped text `position = 3, -16`
  - `current-offset = 0, -14`
- `reset-source-text-placement` still returns the text to the transformed source side afterward

### 3. Insert workflow regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260323_233154/summary.json)

This confirms the DIMENSION preset slice did not regress the imported `INSERT` workflow.

### 4. Selection/property regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260323_233154/summary.json)

This confirms the broader selection/property contract remains stable after adding the opposite-side preset.

### 5. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step226 is verified.

Imported `DIMENSION` text now supports a stronger benchmark-grade preset path:

- inspect source anchor
- flip to the opposite side in one step
- keep grouped-source provenance intact
- reset back to source side when needed

That is stronger than the reference path of “only numeric text edits” or “manual drag to the other side and hope the source contract still holds”.
