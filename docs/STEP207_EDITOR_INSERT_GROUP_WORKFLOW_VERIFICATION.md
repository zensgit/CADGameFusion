# STEP207 Editor Insert Group Workflow Verification

## Scope

This verification covers Step207's insert fragment group workflow:

- selection/property UI now exposes `group id` and `block name`
- property metadata shows `Insert Group Members`
- property-panel `Select Insert Group` expands imported insert fragments into the full same-layout group
- command-line `insgrp` reuses the same command-layer contract
- same `groupId` fragments in another layout stay out of the resulting selection
- existing single-select provenance flows stay green after the new facts/actions were added

## Automated Verification

### 1. Node unit/integration suite

Command:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Result:

- `206/206 PASS`

Relevant coverage added or extended in:

- `selection.insertGroup selects matching INSERT members in the same space/layout`
  - locks the new command contract
  - includes a read-only proxy member
  - proves same-`groupId` fragments in another layout are excluded
- `selection.insertGroup rejects non-INSERT selection`
  - locks the failure path
- `selection presentation exposes insert group facts for imported INSERT fragments`
  - locks `group-id` and `block-name` in single-select details

### 2. Syntax / diff hygiene

Commands:

```bash
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js
git -C deps/cadgamefusion diff --check
```

Result:

- all passed

## Browser Smoke Verification

### 1. Insert-group workflow smoke

Command:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js
```

Artifact:

- [summary.json](../build/editor_insert_group_smoke/20260323_145219/summary.json)

Key assertions from the artifact:

- editor session is in:
  - `Space: Paper / Layout-A`
- before expansion:
  - single-select details show:
    - `group-id = 500`
    - `block-name = DoorTag`
  - property metadata shows:
    - `insert-group-members = 3`
  - property actions include:
    - `select-insert-group`
- after clicking `Select Insert Group`:
  - selection ids become:
    - `[7, 8, 9]`
  - property panel switches to mixed-selection mode
  - read-only note appears for the proxy member
- after resetting to one fragment and running `insgrp`:
  - selection ids again become:
    - `[7, 8, 9]`
  - status message reports:
    - `Selected insert group (3 entities)`

The same-group fragment in `Layout-B` is intentionally absent from the resulting selection, proving the layout guard is real.

### 2. Single-select provenance regression smoke

Command:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
```

Artifact:

- [summary.json](../build/editor_selection_summary_smoke/20260323_145315/summary.json)

Key assertion from the artifact:

- the existing imported single-select provenance and style workflow still passes after the new insert-group facts/actions were added

This matters because Step207 changed the same selection/property surfaces used by the Step205 provenance contract.

## Result

Step207 is verified as green:

- unit/integration suite passed
- insert-group browser smoke passed
- single-select provenance browser regression smoke passed

The editor now has a real insert fragment group workflow instead of stopping at provenance display, and it does so without breaking the current space/layout or style-provenance contracts already in place.
