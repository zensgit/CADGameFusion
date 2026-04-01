# Step258: Desktop Router Recovery Diagnostics Verification

## Scope

Verify that desktop router failures now surface structured recovery diagnostics in the live settings workflow, while the real Electron DWG success path remains green.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
node --check deps/cadgamefusion/tools/web_viewer/desktop_settings.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --outdir deps/cadgamefusion/build/step258_dwg_open_desktop_smoke
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static checks

All of the following passed:

- `node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`
- `node --check deps/cadgamefusion/tools/web_viewer/desktop_settings.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`

### 2. Helper tests

`node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`

- PASS
- `6/6` tests green

Protected facts now include:

- router status formatting shows `router_auto_start`, `router_start_ready`, `router_start_source`, `router_start_cmd`, `router_plugin`, and `router_convert_cli`
- router open-failure formatting shows router-specific recovery details and `Hint: ...`

### 3. Live desktop settings smoke

`node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_live_settings_smoke/20260326_082500/summary.json`

Key verified facts:

- `Test Router` success now shows:
  - `Router auto start: on`
  - `Router start ready: yes`
  - `Router start source: configured`
  - `Router start cmd: python3 tools/plm_router_service.py --port 9000`
  - `Router plugin: /tmp/libcadgf_dxf_importer_plugin.dylib`
  - `Router convert CLI: /tmp/convert_cli`
- clearing `Router URL` and using `Open CAD File` produces:
  - main status: `Open CAD failed: Router URL not configured.`
  - modal auto-open
  - structured modal details:
    - `Router URL: n/a`
    - `Router auto start: on`
    - `Router start ready: yes`
    - `Router plugin: /tmp/libcadgf_dxf_importer_plugin.dylib`
    - `Router convert CLI: /tmp/convert_cli`
    - `Hint: Set Router URL in Settings before opening CAD files.`
- reset after router failure restores default `routerUrl`

### 4. Real desktop DWG smoke

`python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --outdir deps/cadgamefusion/build/step258_dwg_open_desktop_smoke`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step258_dwg_open_desktop_smoke/20260326_082459/summary.json`

Key verified facts:

- `desktop_summary.prepared.route = direct-plugin`
- `desktop_summary.prepared.route_mode = auto`
- `desktop_summary.convert.route = direct-plugin`
- `desktop_summary.convert.route_mode = auto`
- `validators.route_contract.ok = true`

This proves the richer router diagnostics did not regress the real desktop `.dwg` success path.

### 5. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step258 is verified because router recovery is now:

- structured instead of raw-error-only
- visible in the same live settings surface already used for DWG recovery
- covered by browser smoke
- green on the real Electron DWG success path
