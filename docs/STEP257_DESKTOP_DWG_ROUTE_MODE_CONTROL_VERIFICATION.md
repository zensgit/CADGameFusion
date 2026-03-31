# Step257: Desktop DWG Route Mode Control Verification

## Scope

Verify that desktop DWG route mode is now an explicit user capability in both the live browser workflow and the real Electron desktop smoke.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
node --check deps/cadgamefusion/tools/web_viewer/desktop_settings.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
python3 -m py_compile deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --dwg-route-mode local-convert --outdir deps/cadgamefusion/build/step257_dwg_open_desktop_smoke
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static checks

All of the following passed:

- `node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`
- `node --check deps/cadgamefusion/tools/web_viewer/desktop_settings.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `python3 -m py_compile deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py`

### 2. Helper tests

`node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`

- PASS
- `6/6` tests green

Protected facts now include:

- `dwgRouteMode` survives settings merge
- status/result formatting shows `Route mode`
- open-result formatting preserves readiness booleans

### 3. Live desktop settings smoke

`node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_live_settings_smoke/20260326_081739/summary.json`

Key verified facts:

- default settings open with `Route mode: auto`
- successful default open remains `Opened desktop_live_settings_sample via direct-plugin.`
- forcing `local-convert` yields `Opened desktop_live_settings_sample via local-convert.`
- reopening Settings after that shows:
  - `Route: local-convert`
  - `Route mode: local-convert`
- forcing `local-convert` and clearing only `DWG Convert Command` produces:
  - `Route: unavailable`
  - `Route mode: local-convert`
  - `Direct plugin ready: yes`
  - `Local convert ready: no`
  - `Hint: DWG Route Mode is Local Convert...`
- reset restores `Route mode: auto`

### 4. Real desktop DWG smoke with forced local-convert

`python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --dwg-route-mode local-convert --outdir deps/cadgamefusion/build/step257_dwg_open_desktop_smoke`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step257_dwg_open_desktop_smoke/20260326_081517/summary.json`

Key verified facts:

- `desktop_summary.dwg_route_mode = local-convert`
- `desktop_summary.prepared.route = local-convert`
- `desktop_summary.prepared.route_mode = local-convert`
- `desktop_summary.convert.route = local-convert`
- `desktop_summary.convert.route_mode = local-convert`
- `validators.route_contract.ok = true`

This proves the forced route mode survives the real Electron desktop path, not just the browser mock.

### 5. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step257 is verified because DWG route mode is now:

- editable in the live desktop UI
- visible in diagnostics
- enforced by the main process
- proven by both browser smoke and real desktop smoke
