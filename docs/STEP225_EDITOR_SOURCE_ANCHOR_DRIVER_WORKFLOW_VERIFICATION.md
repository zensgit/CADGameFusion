# Step225 Editor Source Anchor Driver Workflow Verification

## Scope

Verify that imported `DIMENSION` / `LEADER` source text can now reveal and select its anchor-driving geometry, while preserving:

- Step220 direct proxy text override
- Step221 source-text focus
- Step222 source placement reset
- Step223 transform-aware preserved source placement
- Step224 source anchor/offset visibility and fit

## Commands

From `/Users/huazhou/Downloads/Github/VemCAD`:

```bash
node --check deps/cadgamefusion/tools/web_viewer/insert_group.js
node --check deps/cadgamefusion/tools/web_viewer/commands/command_registry.js
node --check deps/cadgamefusion/tools/web_viewer/ui/selection_presenter.js
node --check deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
node --check deps/cadgamefusion/tools/web_viewer/ui/workspace.js
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
- `248/248`

New locked behaviors:

- `resolveSourceTextGuide()` returns `anchorDriverId` for both `DIMENSION` and `LEADER`
- `DIMENSION` source text resolves `anchorDriverLabel = line midpoint`
- `LEADER` source text resolves `anchorDriverLabel = line endpoint`
- `selection.sourceSelectAnchorDriver` narrows imported source text to the geometry member that drives the anchor
- single-select presentation exposes `source-anchor-driver`

### 3. Real browser source-anchor-driver workflow

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_source_group_smoke/20260323_230722/summary.json)

Key verified behaviors:

- focused imported `DIMENSION` text reports:
  - `Source Anchor = 0, 0`
  - `Source Anchor Driver = 21:line midpoint`
  - `Source Offset = 0, 14`
  - `Current Offset = 0, 14`
- the same selection exposes property action:
  - `select-source-anchor-driver`
- property action `Select Anchor Driver` narrows selection to:
  - `[21]`
  - status `Selected source anchor driver (line midpoint)`
- focused imported `LEADER` text reports:
  - `Source Anchor = 56, 6`
  - `Source Anchor Driver = 41:line endpoint`
  - `Source Offset = 2, 1`
  - `Current Offset = 2, 1`
- command line `srcdriver` narrows selection to:
  - `[41]`
  - status `Selected source anchor driver (line endpoint)`

### 4. Insert workflow regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260323_230722/summary.json)

This confirms the new source-driver workflow did not regress the imported insert path.

### 5. Selection/property regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260323_230722/summary.json)

This confirms the broader quicklook/property contract remains stable after adding anchor-driver facts and actions.

### 6. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step225 is verified.

Imported annotation source text now supports a stronger diagnostic-edit loop:

1. focus the imported text proxy
2. inspect anchor and offsets
3. jump directly to the anchor-driving geometry
4. decide whether to edit text placement or the driver geometry

That is a materially stronger imported annotation workflow than reference paths that stop at showing anchor facts but still force the user to hunt the driver manually.
