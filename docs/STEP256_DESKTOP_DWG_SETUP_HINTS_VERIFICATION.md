# Step256: Desktop DWG Setup Hints Verification

## Scope

Verify that desktop DWG route/setup failures now surface actionable hints and automatically return the user to Settings, without regressing the real DWG open path.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/desktop_settings.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --outdir deps/cadgamefusion/build/step256_dwg_open_desktop_smoke
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static checks

All of the following passed:

- `node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`
- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer/desktop_settings.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`

### 2. Desktop settings helper tests

`node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`

- PASS
- `6/6` tests green

Protected facts now include:

- `formatDesktopDwgStatus()` renders `Hint: ...` for `DWG_NOT_READY`
- `formatDesktopOpenResult()` renders `Hint: ...` for actionable open failures

### 3. Live desktop settings smoke

`node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_live_settings_smoke/20260326_080607/summary.json`

Key verified facts:

- opening Settings still auto-renders the current DWG route
- successful `Open CAD File` still reports `Opened desktop_live_settings_sample via direct-plugin.`
- blanking `DWG Plugin Path` and `DWG Convert Command` makes the mock route not ready
- failed `Open CAD File` automatically reopens Settings
- the modal shows:
  - `DWG open path not configured...`
  - `Route: unavailable`
  - `Hint: Set DWG Plugin Path for direct import, or set DWG Convert Command for local conversion in Settings.`
  - `Error code: DWG_NOT_READY`
- `Reset` restores detected defaults after the failure scenario

### 4. Real desktop DWG smoke

`python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --outdir deps/cadgamefusion/build/step256_dwg_open_desktop_smoke`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step256_dwg_open_desktop_smoke/20260326_080606/summary.json`

Key verified facts:

- real desktop DWG open still succeeds
- `desktop_summary.convert.route = direct-plugin`
- `desktop_summary.convert.dwg_plugin_path` remains populated
- `validators.route_contract.ok = true`

Step256 therefore improves failure recovery without regressing the real desktop business path.

### 5. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step256 is verified because desktop DWG setup failures are now actionable in the live product flow:

- the user is returned to Settings automatically
- the modal tells them exactly what to configure next
- the real success path remains green
