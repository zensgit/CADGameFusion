# Step223 Editor Transformed Source Text Placement Verification

## Scope

Verify that imported `DIMENSION` / `LEADER` source text keeps reversible placement after whole-bundle transforms, while preserving:

- Step217 grouped-source `move / rotate / scale`
- Step220 direct in-place proxy text edits
- Step221 grouped source-text focus
- Step222 source placement reset
- insert-group and broader selection/property contracts

## Commands

From `/Users/huazhou/Downloads/Github/VemCAD`:

```bash
node --check deps/cadgamefusion/tools/web_viewer/tools/geometry.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js
node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Syntax checks

All `node --check` commands above passed.

### 2. Node contract tests

`node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

- PASS
- `244/244`

New locked behaviors:

- grouped `DIMENSION` move carries `sourceTextPos / dimTextPos` and `srcplace` resets to the moved source
- grouped `LEADER` rotate carries `sourceTextPos / sourceTextRotation` and `srcplace` resets to the rotated source
- grouped `DIMENSION` scale carries `sourceTextPos / dimTextPos` and `srcplace` resets to the scaled source

### 3. Real browser transformed-source reset workflow

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_source_group_smoke/20260323_224545/summary.json)

Key verified behaviors:

- grouped `DIMENSION` bundle still supports full-bundle `move`
- after that move, focused imported source text reports:
  - `Source Text Pos = 3, 12`
  - `Source Text Rotation = 0`
- after a second direct placement drift, property action reset returns the imported dimension text to:
  - `position = 3, 12`
  - `rotation = 0`
- the same reset also restores:
  - `dimTextPos = 3, 12`
  - `dimTextRotation = 0`
- grouped `LEADER` still keeps Step222 reset behavior intact:
  - `position = 58, 7`
  - `rotation = 0`
  - `sourceTextPos = 58, 7`
- Step219 release-and-edit still remains valid in the same smoke:
  - released leader text ends at `LEADER_EDITED`

### 4. Insert workflow regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_insert_group_smoke/20260323_224555/summary.json)

This confirms the transformed source-placement slice did not regress the richer imported insert workflow.

### 5. Selection/property regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_selection_summary_smoke/20260323_224555/summary.json)

This confirms the broader imported editor quicklook/property contract remains stable after making source placement transform-aware.

### 6. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step223 is verified.

Imported annotation text now keeps a stronger reversible contract:

- transform the whole imported bundle
- focus the imported text proxy
- edit wording or placement in place
- reset back to the current transformed source placement

That is a materially stronger imported annotation workflow than the common reset-to-import-origin or release-first reference path.
