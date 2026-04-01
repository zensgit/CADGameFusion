# Step216 Editor Source Group Affordance Verification

## Scope

Verify that grouped non-`INSERT` imported source/proxy entities now support:

- stable source-group metadata
- same-layout source-group selection
- source-group camera fit
- dedicated source-group overlay

without regressing the existing `INSERT` workflow or the broader selection/property contract.

## Commands

From `/Users/huazhou/Downloads/Github/VemCAD`:

```bash
node --check deps/cadgamefusion/tools/web_viewer/insert_group.js
node --check deps/cadgamefusion/tools/web_viewer/commands/command_registry.js
node --check deps/cadgamefusion/tools/web_viewer/ui/selection_presenter.js
node --check deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
node --check deps/cadgamefusion/tools/web_viewer/ui/workspace.js
node --check deps/cadgamefusion/tools/web_viewer/ui/canvas_view.js
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

This covers the shared helper layer, command registration, presenter/property/workspace changes, canvas overlay logic, and the new browser smoke script.

### 2. Node contract tests

`node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

- PASS
- `223/223`

New locked behaviors:

- `selection.sourceGroup` selects grouped non-`INSERT` members in the same `space / layout`
- `selection.sourceGroup` rejects non-grouped selections with `NOT_SOURCE_GROUP`
- selection presentation exposes grouped derived-proxy facts:
  - `group-source`
  - `source-group-members`
  - `editable-members`
  - `read-only-members`
  - `group-center / group-size / group-bounds`

### 3. Real browser grouped-source workflow

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_source_group_smoke/20260323_180408/summary.json)

Key verified behaviors:

- grouped `DIMENSION` single-select exposes:
  - `group-source = DIMENSION / dimension`
  - `source-group-members = 4`
  - `editable-members = 0`
  - `read-only-members = 4`
  - `group-bounds = -20, 0 -> 20, 14`
- grouped `DIMENSION` property actions expose:
  - `select-source-group`
  - `fit-source-group`
- grouped `DIMENSION` does not expose insert-only actions:
  - no `select-insert-group`
  - no `release-insert-group`
- property `Select Source Group` expands the dimension bundle to `[21,22,23,24]`
- property `Fit Source Group` drives the `sourceGroupFrame` overlay with the same dimension bounds
- grouped `HATCH` single-select exposes:
  - `group-source = HATCH / hatch`
  - `source-group-members = 3`
  - `group-bounds = 30, 0 -> 38, 6`
- command `srcgrp` expands the hatch bundle to `[31,32,33]`
- same-`groupId` hatch member in `Layout-B` is excluded from the resulting selection
- command `srcfit` drives the same overlay contract with status:
  - `Fit Source Group: HATCH 701`
- non-`INSERT` fits expose `sourceGroupFrame`, not `insertGroupFrame`

### 4. Insert workflow regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_insert_group_smoke/20260323_180408/summary.json)

This confirms the new generic helper layer did not regress the richer insert path:

- `peer-targets` still render as:
  - `1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C`
- direct peer target action still switches to `Layout-C`
  - selection becomes `[12]`
- the rest of the Step215 insert workflow remains green under the shared group helper refactor

### 5. Selection/property regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_selection_summary_smoke/20260323_180408/summary.json)

This confirms the broader selection/property panel contract still holds after adding grouped-source metadata and actions.

### 6. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step216 is verified.

The editor now treats grouped non-`INSERT` imported source/proxy bundles as first-class grouped objects for:

- metadata inspection
- same-layout group selection
- viewport fit
- overlay affordance

while keeping insert-specific behaviors on the richer imported-instance path instead of flattening everything into one lowest-common-denominator workflow.
