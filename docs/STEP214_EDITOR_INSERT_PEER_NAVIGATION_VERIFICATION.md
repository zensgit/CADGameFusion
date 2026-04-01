# Step214 Editor Insert Peer Navigation Verification

## Scope

Verify that imported `INSERT` peer-instance navigation works across layouts while preserving:

- peer provenance facts
- selection intent
- space/layout switching
- instance overlay/bounds alignment
- existing Step212/213 insert-group workflows

## Commands

From `/Users/huazhou/Downloads/Github/VemCAD`:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Node contract tests

`node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

- PASS
- `220/220`

This covers the updated single-select presentation contract, including the new imported-`INSERT` peer facts.

### 2. Real browser insert peer workflow

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_insert_group_smoke/20260323_173531/summary.json)

Key assertions from the artifact:

- initial `Layout-A` single select exposes:
  - `peer-instance = 1 / 2`
  - `peer-instances = 2`
  - `peer-layouts = Paper / Layout-A | Paper / Layout-B`
- property actions expose:
  - `previous-insert-peer`
  - `next-insert-peer`
- `Next Peer Instance` moves the editor to `Paper / Layout-B`
- peer selection becomes `[10]`
- peer bounds switch to:
  - `group-center = 0, -12`
  - `group-size = 32 x 0`
  - `group-bounds = -16, -12 -> 16, -12`
- overlay follows the peer bounds exactly
- command-line `insprev` returns to `Paper / Layout-A`
- return hop preserves single-fragment intent and lands back on `[7]`, not the whole `[7,8,9]` group
- the remainder of the smoke still passes:
  - fit
  - select group
  - move
  - rotate
  - scale
  - copy
  - delete
  - editable-only select
  - release
  - released text edit

Note:

- after peer navigation, `Fit Insert Group` can be a valid no-op because peer navigation already fits the camera to the destination bounds. The smoke now accepts that idempotent state and still locks status/overlay correctness.

### 3. Selection summary regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_selection_summary_smoke/20260323_173355/summary.json)

This confirms the broader selection/property provenance contract remains stable after the Step214 presenter/property changes.

### 4. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step214 is verified.

Imported `INSERT` peer instances are now:

- visible in quicklook/property metadata
- reachable from property actions and command input
- layout-aware
- selection-intent preserving
- aligned with the existing instance overlay and bounds contract
