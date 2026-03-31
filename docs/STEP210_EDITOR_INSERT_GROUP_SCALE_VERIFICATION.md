# STEP210 Editor Insert Group Scale Verification

## Scope

Verification for Step210 covers:

- command-layer `selection.scale`
- full imported insert-group scale behavior with read-only proxy follow
- regression that editable-only insert selections still exclude proxy members
- real-browser proof that command-line `scale` matches the command contract

## Node Test

Run:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Result:

- `215/215 PASS`

Relevant additions:

- `selection.scale scales geometry and can undo/redo`
- `selection.scale keeps read-only INSERT proxy with the full insert group`
- `selection.scale still skips INSERT proxy when only editable members are selected`
- `selection.scale rejects invalid factor`

## Syntax Check

Run:

```bash
node --check deps/cadgamefusion/tools/web_viewer/tools/scale_tool.js
node --check deps/cadgamefusion/tools/web_viewer/commands/command_registry.js
node --check deps/cadgamefusion/tools/web_viewer/ui/workspace.js
```

Result:

- PASS

## Browser Smoke

Run:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js
```

Result:

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260323_165344/summary.json`

Key checked facts:

- full mixed insert-group note now states:
  - property edits skip proxies
  - full-group `move/rotate/scale` keep them with the insert group
- `after_scale.statusText = "Scaled insert group (3 entities, including 1 proxy)"`
- line member `7` scales to:
  - `start = (-9, 0)`
  - `end = (9, 0)`
- circle member `8` scales to:
  - `center = (0, 5)`
  - `radius = 2`
- proxy text member `9` scales to:
  - `position = (6, 5.5)`
  - `height = 1.25`
- same-layout scoping still holds and the later editable-only command path remains separate

The smoke also executes an undo after scale before continuing to the later `insedit` path, so the new transform remains compatible with the existing instance workflow sequence.

## Regression Smoke

Run:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
```

Result:

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260323_165354/summary.json`

This confirms the Step210 property-note and command-bar changes did not regress the single-selection provenance/style surface.

## Diff Hygiene

Run:

```bash
git -C deps/cadgamefusion diff --check
```

Result:

- PASS
