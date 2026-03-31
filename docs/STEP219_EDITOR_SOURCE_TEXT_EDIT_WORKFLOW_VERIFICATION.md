# Step219 Editor Source Text Edit Workflow Verification

## Scope

Verify that grouped imported source bundles with text now support:

- one-step release to editable text via command
- one-step release to editable text via property action

while preserving:

- grouped-source transform/copy/delete/release behavior
- insert-group workflows
- the broader selection/property contract

## Commands

From `/Users/huazhou/Downloads/Github/VemCAD`:

```bash
node --check deps/cadgamefusion/tools/web_viewer/insert_group.js
node --check deps/cadgamefusion/tools/web_viewer/commands/command_registry.js
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
- `232/232`

New locked behaviors:

- `selection.sourceEditGroupText` releases grouped `LEADER` source members and selects the released text member
- `selection.sourceEditGroupText` rejects grouped source bundles without text using:
  - `GROUP_HAS_NO_TEXT`

### 3. Real browser grouped-source authoring workflow

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_source_group_smoke/20260323_202636/summary.json)

Key verified behaviors:

- grouped `DIMENSION` exposes:
  - `Select Source Group`
  - `Fit Source Group`
  - `Release & Edit Source Text`
  - `Release Source Group`
- command-line `srcedit` on grouped `DIMENSION` returns:
  - `Released source group and selected source text (1 of 4 entities)`
- after `srcedit`, selection narrows directly to the released dimension text and the real property form exposes:
  - `value`
  - `position.x`
  - `position.y`
  - `height`
  - `rotation`
- grouped `LEADER` exposes the same text-directed property action
- property action `Release & Edit Source Text` on grouped `LEADER` returns:
  - `Released source group and selected source text (1 of 2 entities)`
- the released leader text is edited through the real property input to:
  - `LEADER_EDITED`
- both dimension and leader released text entities no longer keep:
  - `groupId`
  - `sourceType`
  - `editMode`
  - `proxyKind`
- grouped `HATCH` still follows the non-text bundle path and ends with:
  - `Deleted source group (3 entities, including 3 read-only)`

### 4. Insert workflow regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_insert_group_smoke/20260323_202609/summary.json)

This confirms the new grouped-source text-edit workflow did not regress the richer imported insert workflow.

### 5. Selection/property regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_selection_summary_smoke/20260323_202609/summary.json)

This confirms the general imported editor quicklook/property contract remains stable after adding the new grouped-source text-edit action.

### 6. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step219 is verified.

Grouped imported annotation bundles with text are no longer a two-step recovery workflow. The editor now supports one-step release-and-focus text editing for:

- dimensions
- leaders

while preserving the broader grouped-source and imported-insert contracts.
