# STEP198 Editor Layoff Workspace Verification

## Scope

This verification covers the workspace wiring added on top of Step197:

- command-line `layoff` / `layon`
- layer-panel `Off` / `On`
- property-panel layer off/on hooks
- current-layer fallback during layer-off

## Commands

### Syntax and contracts

```bash
node --check deps/cadgamefusion/tools/web_viewer/ui/workspace.js
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
git -C deps/cadgamefusion diff --check
```

Observed result:

- `workspace.js` syntax: PASS
- `editor_commands.test.js`: `186/186 PASS`
- `diff --check`: PASS

## Browser Spot Check

Observed against:

- `http://127.0.0.1:18103/tools/web_viewer/?mode=editor&debug=1`

Workflow exercised:

1. add layer `LAYOFF_SPOT`
2. create one line on the new layer and one line on layer `0`
3. select the new-layer entity
4. run command input `layoff`
5. confirm the selected layer becomes hidden and current layer falls back to layer `0`
6. run command input `layon`
7. confirm the hidden layer is restored and current layer returns to the restored layer context

Observed browser result:

- `layoff` status: `LAYOFF: 1:LAYOFF_SPOT | hid 1 layer`
- after `layoff`, current layer fallback moved to `0`
- `layon` status: `LAYON: restored 2 layer visibility states | current -> 1:LAYOFF_SPOT`
- after `layon`, the hidden layer was visible again

## Notes

- Step197 remains the low-level helper contract record.
- Step198 is the first step where `LAYOFF / LAYON` become reachable from editor workspace behavior.
