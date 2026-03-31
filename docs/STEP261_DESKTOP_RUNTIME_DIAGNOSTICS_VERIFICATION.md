# Step261: Desktop Runtime Diagnostics Verification

## Scope

Verify that desktop runtime provenance is now visible in live Settings and preserved in the real packaged DWG open path.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
node --check deps/cadgamefusion/tools/web_viewer/desktop_settings.js
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack
cd /Users/huazhou/Downloads/Github/VemCAD
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect --router-auto-start-mode default --outdir deps/cadgamefusion/build/step261_desktop_runtime_diagnostics_smoke
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static checks

All of the following passed:

- `node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`
- `node --check deps/cadgamefusion/tools/web_viewer/desktop_settings.js`
- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`

### 2. Desktop settings contract tests

`node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`

- PASS
- result:
  - `7/7 PASS`

Key verified facts:

- router formatting now includes runtime source/root/ready plus router service / preview pipeline / viewer root
- DWG formatting now includes runtime source/root/ready plus DWG service
- combined router + DWG formatting is stable

### 3. Live desktop settings smoke

`node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_live_settings_smoke/20260326_085509/summary.json`

Key verified facts:

- opening Settings now shows a combined status with `[Router]` and `[DWG]`
- combined status exposes:
  - `CAD runtime source: packaged-cad-resources`
  - `CAD runtime root: /tmp/vemcad/cad_resources`
  - `CAD runtime ready: yes`
  - `Router service: /tmp/vemcad/cad_resources/router/plm_router_service.py`
  - `Preview pipeline: /tmp/vemcad/cad_resources/tools/plm_convert.py`
  - `Viewer root: /tmp/vemcad/cad_resources/tools/web_viewer`
- router failure and DWG failure paths keep those same runtime facts visible

### 4. Packaged app rebuild

`cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack`

- PASS

### 5. Real packaged DWG smoke with runtime diagnostics

`python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --use-packaged-app --use-runtime-autodetect --router-auto-start-mode default --outdir deps/cadgamefusion/build/step261_desktop_runtime_diagnostics_smoke`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step261_desktop_runtime_diagnostics_smoke/20260326_085536/summary.json`

Key verified facts in `desktop_summary.convert`:

- `cad_runtime_source = packaged-cad-resources`
- `cad_runtime_root = .../Contents/Resources/cad_resources`
- `cad_runtime_ready = true`
- `router_service_path = .../cad_resources/router/plm_router_service.py`
- `plm_convert_path = .../cad_resources/tools/plm_convert.py`
- `viewer_root = .../cad_resources/tools/web_viewer`
- `route = direct-plugin`
- viewer still loads successfully:
  - `desktop_summary.viewer.status_code = 200`
  - `desktop_summary.viewer.ok = true`

### 6. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step261 is verified because:

- packaged runtime provenance is now a formal desktop contract
- Settings opens with combined router + DWG truth instead of a DWG-only subset
- live UI smoke and real packaged DWG smoke both prove the same packaged runtime facts
