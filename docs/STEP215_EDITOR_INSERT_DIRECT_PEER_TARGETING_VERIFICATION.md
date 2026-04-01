# Step215 Editor Insert Direct Peer Targeting Verification

## Scope

Verify that imported `INSERT` peer navigation supports direct targets and preserves selection scope across layouts.

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

This locks the updated selection-presentation contract, including the new `peer-targets` fact on imported `INSERT` fragments.

### 2. Real browser insert peer-target workflow

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_insert_group_smoke/20260323_174444/summary.json)

Key verified behaviors:

- initial `Layout-A` single-select exposes:
  - `peer-instance = 1 / 3`
  - `peer-layouts = Paper / Layout-A | Paper / Layout-B | Paper / Layout-C`
  - `peer-targets = 1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C`
- property actions expose:
  - `open-insert-peer-2`
  - `open-insert-peer-3`
  - plus cyclic peer actions
- clicking direct property action `open-insert-peer-3` switches to `Layout-C`
  - selection becomes `[12]`
  - peer bounds become `-14, 20 -> 14, 31`
  - status becomes `Peer Insert 3/3: DoorTag | Paper / Layout-C`
- command `inspeer 2` jumps directly to `Layout-B`
  - selection becomes `[10]`
  - singleton peer keeps singleton selection
- command `insprev` returns to `Layout-A`
  - selection becomes `[7]`
- full-group targeting is preserved:
  - `[7,8,9]` in `Layout-A`
  - `inspeer Layout-C`
  - becomes `[12,13,14]`
- editable-only targeting is preserved:
  - `[7,8]` in `Layout-A`
  - `inspeer Layout-C`
  - becomes `[12,13]`
- existing Step212/213 flows still pass after the new peer-target steps:
  - fit
  - move
  - rotate
  - scale
  - copy
  - delete
  - release
  - released text edit

### 3. Selection summary regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_selection_summary_smoke/20260323_174415/summary.json)

This confirms the broader selection/property contract still holds after the presenter/property metadata expansion.

### 4. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step215 is verified.

Imported `INSERT` peer navigation now supports both:

- sequential browsing
- direct peer targeting by action, ordinal, or layout name

and preserves the user’s selection scope while crossing layouts.
