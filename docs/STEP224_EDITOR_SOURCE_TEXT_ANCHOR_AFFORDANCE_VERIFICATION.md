# Step224 Editor Source Text Anchor Affordance Verification

## Scope

Verify that imported `DIMENSION` / `LEADER` text proxies expose source-anchor guidance without regressing:

- Step220 direct proxy text override
- Step221 source-text focus
- Step222 source placement reset
- Step223 transformed-source placement reset
- insert-group and broader selection/property workflows

## Commands

From `/Users/huazhou/Downloads/Github/VemCAD`:

```bash
node --check deps/cadgamefusion/tools/web_viewer/insert_group.js
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

### 2. Node contract tests

`node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

- PASS
- `247/247`

New locked behaviors:

- `resolveSourceTextGuide()` resolves a `DIMENSION` anchor from the longest non-text source member
- `resolveSourceTextGuide()` resolves a `LEADER` anchor from the nearest leader endpoint to the source text
- selection quicklook exposes `source-anchor / source-offset / current-offset` for imported direct source-text proxies

### 3. Real browser source-anchor workflow

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_source_group_smoke/20260323_225827/summary.json)

Key verified behaviors:

- focused imported `DIMENSION` text reports:
  - `Source Anchor = 0, 0`
  - `Source Offset = 0, 14`
  - `Current Offset = 0, 14`
- the same `DIMENSION` path exposes property action `fit-source-anchor`
- after `Fit Source Anchor`, the overlay reports:
  - `anchor = (0, 0)`
  - `sourcePoint = (0, 14)`
- focused imported `LEADER` text reports:
  - `Source Anchor = 56, 6`
  - `Source Offset = 2, 1`
  - `Current Offset = 2, 1`
- command-line `srcanchor` reuses the same guide and the overlay reports:
  - `anchor = (56, 6)`
  - `sourcePoint = (58, 7)`
- after a grouped `DIMENSION` move, focused imported text still reports transformed guide facts:
  - `Source Anchor = 3, -2`
  - `Source Offset = 0, 14`
  - `Current Offset = 0, 14`
- Step223 reset remains correct in the same transformed path:
  - `position = 3, 12`
  - `sourceTextPos = 3, 12`
  - `dimTextPos = 3, 12`

### 4. Insert workflow regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_insert_group_smoke/20260323_225842/summary.json)

This confirms the source-anchor slice did not regress the imported `INSERT` workflow.

### 5. Selection/property regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_selection_summary_smoke/20260323_225842/summary.json)

This confirms the broader single-selection provenance/effective-style contract remains stable after adding source-anchor facts.

### 6. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step224 is verified.

Imported annotation text now has a stronger non-destructive authoring contract:

- focus imported text without release
- inspect anchor and offset directly
- fit the anchor/landing guide in one step
- keep the same guide valid after grouped-source transforms

That is materially stronger than the common reference path of “only show raw text coordinates” or “release first, then reason about attachment by eye”.
