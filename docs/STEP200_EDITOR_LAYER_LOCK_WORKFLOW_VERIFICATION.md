# STEP200 Editor Layer Lock Workflow Verification

## Scope

This verification covers the lock/unlock workflow completed in Step200:

- helper contract for `LAYLCK` / `LAYULK`
- workspace command wiring
- property-panel lock/unlock actions
- layer-panel persistent lock toggle with current-layer fallback
- browser smoke for property, command, and panel lock entry points

## Commands

### Syntax and contracts

```bash
node --check deps/cadgamefusion/tools/web_viewer/ui/workspace.js
node --check deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_layer_session_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
git -C deps/cadgamefusion diff --check
```

Observed result:

- `workspace.js` syntax: PASS
- `property_panel.js` syntax: PASS
- `editor_layer_session_smoke.js` syntax: PASS
- `editor_commands.test.js`: `194/194 PASS`
- `diff --check`: PASS

## Browser Smoke

Commands:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_layer_session_smoke.js
node deps/cadgamefusion/tools/web_viewer/scripts/editor_current_layer_smoke.js
```

Observed result:

- `editor_layer_session_smoke.js`: PASS
  - artifact: `build/editor_layer_session_smoke/20260323_110425/summary.json`
- `editor_current_layer_smoke.js`: PASS
  - artifact: `build/editor_current_layer_smoke/20260323_110425/summary.json`

Observed browser contract from the artifacts:

- selecting the visible entity on `2:REDLINE` surfaces:
  - `Lock Layer`
  - `Turn Off Layer`
  - `Freeze Layer`
- property-panel `Lock Layer`:
  - keeps the selected entity on the locked layer selected
  - keeps the focused layer row on `2:REDLINE`
  - locks only `2:REDLINE`
  - falls current layer back to `1:PLOT`
  - status: `Layer REDLINE lock: On`
- command-line `layulk` with the locked-layer entity selected:
  - unlocks only `2:REDLINE`
  - keeps current layer stable on `1:PLOT`
  - restores property action availability to `Lock Layer` + `Make Current`
  - status: `LAYULK: 2:REDLINE | unlocked 1 layer`
- command-line `layfrz` still works after the new lock path:
  - freezes `2:REDLINE`
  - clears selection
  - falls current layer back to `1:PLOT`
  - created fallback entity `9` is on layer `1`
- property-panel `Thaw Layers` still restores the previous freeze session:
  - current layer returns to `2:REDLINE`
  - status: `LAYTHW: restored 3 layer freeze states | current -> 2:REDLINE`
- layer-panel `Locked/Open` path remains green through the current-layer smoke:
  - locking non-current `1:PLOT` makes `laymcur` reject the locked drawing target
  - locking current `2:REDLINE` falls current layer back to `1:PLOT`
  - the next created entity `10` is on fallback layer `1`

## Notes

- The first smoke attempt failed in the restricted sandbox because the temporary local static server could not bind a localhost port.
- The verification above is based on the later unrestricted rerun, where both browser smokes passed and emitted full artifacts.
- Step199 remains the freeze/thaw milestone; Step200 is the point where lock/unlock reaches the same command/property/panel/browser parity.
