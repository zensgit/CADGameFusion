# Step260: Desktop Packaged Autostart Verification

## Scope

Verify that a real packaged desktop app can auto-start the bundled router and open a real `.dwg` using only packaged CAD resources.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
node --check deps/cadgamefusion/tools/web_viewer_desktop/scripts/stage_bundled_cad_resources.mjs
python3 -m py_compile deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py
node deps/cadgamefusion/tools/web_viewer_desktop/scripts/stage_bundled_cad_resources.mjs
cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack
cd /Users/huazhou/Downloads/Github/VemCAD
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect --router-auto-start-mode default --outdir deps/cadgamefusion/build/step260_packaged_dwg_open_smoke
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static checks

All of the following passed:

- `node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`
- `node --check deps/cadgamefusion/tools/web_viewer_desktop/scripts/stage_bundled_cad_resources.mjs`
- `python3 -m py_compile deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py`

### 2. Bundled runtime staging

`node deps/cadgamefusion/tools/web_viewer_desktop/scripts/stage_bundled_cad_resources.mjs`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer_desktop/bundled_resources/stage_summary.json`

Key verified facts:

- staged router runtime now includes `router/plm_router_service.py`
- staged packaged runtime now includes `tools/plm_convert.py`
- staged packaged runtime now includes `tools/web_viewer/**`
- staged packaged runtime now includes:
  - `schemas/document.schema.json`
  - `schemas/plm_manifest.schema.json`

### 3. Packaged app build

`cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack`

- PASS
- packaged app output:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer_desktop/dist/mac-arm64/VemCAD.app`

### 4. Real packaged DWG smoke

`python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect --router-auto-start-mode default --outdir deps/cadgamefusion/build/step260_packaged_dwg_open_smoke`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step260_packaged_dwg_open_smoke/20260326_084535/summary.json`

Key verified facts:

- `desktop_bin` is the packaged app binary:
  - `tools/web_viewer_desktop/dist/mac-arm64/VemCAD.app/Contents/MacOS/VemCAD`
- runtime uses packaged `cad_resources`, not repo-local dev roots
- packaged router assets resolve to:
  - `Resources/cad_resources/router/plugins/libcadgf_dxf_importer_plugin.dylib`
  - `Resources/cad_resources/router/tools/convert_cli`
- packaged DWG path resolves to:
  - `Resources/cad_resources/router/plugins/libcadgf_dwg_importer_plugin.dylib`
- packaged DWG service resolves to:
  - `Resources/cad_resources/dwg_service/cadgf_dwg_service.py`
- packaged router conversion succeeds:
  - `desktop_summary.convert.ok = true`
- packaged viewer succeeds:
  - `desktop_summary.viewer.status_code = 200`
  - `desktop_summary.viewer.ok = true`
  - `desktop_summary.viewer.contains_statusbar = true`
  - `desktop_summary.viewer.contains_solver_panel = true`
- validator checks are all green:
  - `validators.route_contract.ok = true`
  - `validators.preview_artifacts.ok = true`
  - `validators.manifest.ok = true`

### 5. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step260 is verified because:

- packaged auto-detect now resolves to real packaged `cad_resources`
- packaged auto-start can launch the local router without smoke-only path injection
- packaged router conversion completes using the staged runtime tool set
- the packaged viewer loads successfully from the same packaged resource root
- a real packaged app now opens a real `.dwg` end-to-end
