# STEP208 Editor Insert Editability Workflow Verification

## Scope

Verification for the Step208 insert editability workflow covers:

- command-layer editable-member selection
- quicklook/property facts for mixed insert groups
- property-panel recovery from mixed insert selection
- command-line `insedit`
- continued `space / layout` isolation

## Node Test

Run:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Expected highlights:

- `selection.insertEditableGroup selects only editable INSERT members in the same space/layout`
- `selection.insertEditableGroup rejects INSERT groups without editable members`
- `selection presentation exposes insert group facts for imported INSERT fragments`

Result:

- `208/208 PASS`

## Browser Smoke

Run:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js
```

Expected assertions:

- single imported fragment in `Paper / Layout-A` shows:
  - `group id = 500`
  - `block name = DoorTag`
  - `insert group members = 3`
  - `editable members = 2`
  - `read-only members = 1`
- property actions include:
  - `select-insert-group`
  - `select-insert-editable`
- `Select Insert Group` expands selection to:
  - `[7, 8, 9]`
- `Select Editable Members` narrows selection to:
  - `[7, 8]`
- command-line `insedit` reproduces the editable-only selection:
  - `[7, 8]`
- same-group member in `Layout-B` stays excluded

Result:

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260323_160213/summary.json`
- checked facts:
  - single-select quicklook shows `insert-group-members = 3`, `editable-members = 2`, `read-only-members = 1`
  - property action `select-insert-group` expands selection to `[7, 8, 9]`
  - property action `select-insert-editable` narrows selection to `[7, 8]`
  - command-line `insedit` also resolves `[7, 8]`
  - `Layout-B` sibling stays excluded

## Regression Check

Run:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
```

This confirms the Step208 quicklook/property changes did not break the existing single-select provenance contract.

Result:

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260323_160213/summary.json`

## Diff Hygiene

Run:

```bash
git -C deps/cadgamefusion diff --check
```

Expected result:

- PASS
