# STEP209 Editor Insert Group Transform Verification

## Scope

Verification for Step209 covers:

- command-layer whole-instance transform behavior for imported `INSERT` groups
- regression that editable-only insert selections still exclude proxy members from transforms
- real-browser proof that full-group `move/rotate` keep proxy members aligned

## Node Test

Run:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Result:

- `211/211 PASS`

Relevant additions:

- `selection.move keeps read-only INSERT proxy with the full insert group`
- `selection.move still skips INSERT proxy when only editable members are selected`
- `selection.rotate keeps read-only INSERT proxy with the full insert group`

## Browser Smoke

Run:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js
```

Result:

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260323_164252/summary.json`

Key checked facts:

- full-group selection `[7, 8, 9]` shows the mixed-selection note:
  - property edits skip proxies
  - full-group `move/rotate` keep them with the insert group
- `after_move.result.message = "Moved insert group (3 entities, including 1 proxy)"`
- `after_move.entities[2].position` changes from `(12, 11)` to `(17, 8)`
- `after_rotate.result.message = "Rotated insert group (3 entities, including 1 proxy)"`
- `after_rotate.entities[1].position` changes to `(-11, 12)`
- `after_rotate.entities[1].rotation = π/2`
- the later editable-only path still resolves `[7, 8]`

## Regression Check

Run:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
```

Result:

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260323_164306/summary.json`

This confirms the Step209 property-note change did not regress the existing provenance/style contract.

## Diff Hygiene

Run:

```bash
git -C deps/cadgamefusion diff --check
```

Result:

- PASS
