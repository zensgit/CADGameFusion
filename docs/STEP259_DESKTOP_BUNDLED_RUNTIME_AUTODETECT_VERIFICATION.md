# Step259: Desktop Bundled Runtime Auto-Detect Verification

## Scope

Verify that desktop runtime open can now succeed using staged/bundled CAD resources instead of explicit smoke-only CLI path overrides.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
node --check deps/cadgamefusion/tools/web_viewer_desktop/scripts/stage_bundled_cad_resources.mjs
python3 -m py_compile deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py
node deps/cadgamefusion/tools/web_viewer_desktop/scripts/stage_bundled_cad_resources.mjs
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-runtime-autodetect --outdir deps/cadgamefusion/build/step259_dwg_open_desktop_smoke
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static checks

All of the following passed:

- `node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`
- `node --check deps/cadgamefusion/tools/web_viewer_desktop/scripts/stage_bundled_cad_resources.mjs`
- `python3 -m py_compile deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py`

### 2. Bundled resource staging

`node deps/cadgamefusion/tools/web_viewer_desktop/scripts/stage_bundled_cad_resources.mjs`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer_desktop/bundled_resources/stage_summary.json`

Key verified facts:

- DXF importer plugin copied into `bundled_resources/router/plugins`
- DWG importer plugin copied into `bundled_resources/router/plugins`
- `convert_cli` copied into `bundled_resources/router/tools`
- `cadgf-dwg-service` copied into `bundled_resources/dwg_service`

### 3. Real desktop DWG smoke with runtime auto-detect

`python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-runtime-autodetect --outdir deps/cadgamefusion/build/step259_dwg_open_desktop_smoke`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step259_dwg_open_desktop_smoke/20260326_083058/summary.json`

Key verified facts:

- the Electron command omits:
  - `--router-plugin`
  - `--router-convert-cli`
  - `--dwg-convert-cmd`
- runtime still succeeds
- `desktop_summary.router_plugin` resolves to:
  - `tools/web_viewer_desktop/bundled_resources/router/plugins/libcadgf_dxf_importer_plugin.dylib`
- `desktop_summary.router_convert_cli` resolves to:
  - `tools/web_viewer_desktop/bundled_resources/router/tools/convert_cli`
- `desktop_summary.dwg_convert_cmd` resolves to the staged bundled service:
  - `tools/web_viewer_desktop/bundled_resources/dwg_service/cadgf_dwg_service.py`
- `desktop_summary.prepared.dwg_plugin_path` and `desktop_summary.convert.dwg_plugin_path` both resolve to the bundled DWG plugin path
- `validators.route_contract.ok = true`

This proves the real desktop open path no longer needs explicit smoke-only plugin / convert_cli / DWG convert overrides when staged bundled resources are available.

### 4. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step259 is verified because:

- the desktop package now has a first-class CAD resource staging step
- packaged/dev bundled resource roots are part of runtime detection
- the real Electron DWG smoke passes using runtime auto-detect instead of explicit path injection
