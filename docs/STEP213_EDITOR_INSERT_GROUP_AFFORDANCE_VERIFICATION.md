# STEP213 Editor Insert Group Affordance Verification

## Scope

Verification for Step213 covers:

- computed insert-group bounds facts in selection presentation
- property-panel fit action and command-path readiness
- real-browser proof that the overlay extents, metadata extents, and fit behavior stay aligned

## Node Test

Run:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Result:

- `220/220 PASS`

Relevant updated regression:

- `selection presentation exposes insert group facts for imported INSERT fragments`

Additional locked facts:

- `group-center = 0, 7`
- `group-size = 36 x 14`
- `group-bounds = -18, 0 -> 18, 14`

## Syntax Check

Run:

```bash
node --check deps/cadgamefusion/tools/web_viewer/insert_group.js
node --check deps/cadgamefusion/tools/web_viewer/ui/selection_presenter.js
node --check deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
node --check deps/cadgamefusion/tools/web_viewer/ui/workspace.js
node --check deps/cadgamefusion/tools/web_viewer/ui/canvas_view.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js
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
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260323_172322/summary.json`

Key checked facts:

- initial imported fragment quicklook:
  - `group-center = 0, 7`
  - `group-size = 36 x 14`
  - `group-bounds = -18, 0 -> 18, 14`
- property metadata shows the same values
- property actions now include `fit-insert-group`
- debug overlay `insertGroupFrame` carries:
  - `minX = -18`
  - `minY = 0`
  - `maxX = 18`
  - `maxY = 14`
  - `center = (0, 7)`
  - `blockName = DoorTag`
- `Fit Insert Group` updates the view:
  - before view `zoom = 16`, `pan = {x: 504, y: 665.5}`
  - after view `zoom = 16`, `pan = {x: 504, y: 1625}`
  - status text = `Fit Insert Group: DoorTag`

The zoom stayed clamped at max zoom in this fixture, so the smoke accepts either zoom change or pan change as a valid fit signal. In this run, pan changed and overlay extents stayed aligned with the metadata contract.

## Regression Smoke

Run:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
```

Result:

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260323_172322/summary.json`

This confirms Step213 did not regress the general single-selection provenance/style path.

## Diff Hygiene

Run:

```bash
git -C deps/cadgamefusion diff --check
```

Result:

- PASS
