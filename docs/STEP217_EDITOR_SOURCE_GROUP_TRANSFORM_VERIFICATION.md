# Step217 Editor Source Group Transform Verification

## Scope

Verify that grouped non-`INSERT` source/proxy bundles now support full-bundle:

- move
- rotate
- scale

while still:

- rejecting isolated read-only proxy movement
- preserving the richer imported `INSERT` workflow
- keeping the broader selection/property contract stable

## Commands

From `/Users/huazhou/Downloads/Github/VemCAD`:

```bash
node --check deps/cadgamefusion/tools/web_viewer/commands/command_registry.js
node --check deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
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
- `226/226`

New locked behaviors:

- `selection.move` keeps grouped read-only `DIMENSION` members aligned when the full source group is selected
- `selection.rotate` keeps grouped read-only `LEADER` members aligned when the full source group is selected
- `selection.scale` keeps grouped read-only `HATCH` members aligned when the full source group is selected
- the full-group resolver still refuses accidental single-fragment promotion

### 3. Real browser grouped-source transform workflow

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_source_group_smoke/20260323_200701/summary.json)

Key verified behaviors:

- grouped `DIMENSION` selection expands to all 4 same-layout members
- property note explains that grouped read-only bundles still allow `move/rotate/scale`
- `selection.move` returns:
  - `Moved source group (4 entities, including 4 read-only)`
- `selection.rotate` returns:
  - `Rotated source group (4 entities, including 4 read-only)`
- `selection.scale` returns:
  - `Scaled source group (4 entities, including 4 read-only)`
- the transformed line/text geometry matches the expected moved/rotated/scaled coordinates
- `history.undo` restores the pre-transform bundle after each step

### 4. Insert workflow regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260323_200701/summary.json)

This confirms the grouped-source transform generalization did not regress the richer imported insert workflow.

### 5. Selection/property regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260323_200912/summary.json)

This confirms the broader quicklook/property contract still holds after the grouped-source transform note change.

### 6. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step217 is verified.

Grouped non-`INSERT` imported source bundles are no longer inspection-only. Full same-layout bundles now behave like transformable compound objects for:

- move
- rotate
- scale

while single read-only proxy fragments remain correctly blocked.
