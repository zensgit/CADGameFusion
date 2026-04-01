# Step250: Desktop DWG Route Readiness Verification

## Scope

Verify that desktop DWG open now uses a shared route-selection helper, that readiness reporting is route-based, and that the real desktop smoke can prove the preferred `direct-plugin` path.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --outdir deps/cadgamefusion/build/step250_dwg_open_desktop_smoke
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static check

`node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`

- PASS

### 2. Desktop DWG smoke

`python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --outdir deps/cadgamefusion/build/step250_dwg_open_desktop_smoke`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step250_dwg_open_desktop_smoke/20260325_225144/summary.json`

Key verified facts:

- wrapper smoke status: `ok=true`
- Electron main-process return code: `0`
- desktop summary status: `ok=true`
- `prepared.route = direct-plugin`
- `prepared.path` stayed on the original `.dwg`
- `prepared.router_plugin = libcadgf_dwg_importer_plugin.dylib`
- `prepared.dwg_plugin_path = libcadgf_dwg_importer_plugin.dylib`
- router `/convert` succeeded
- viewer load succeeded with `contains_statusbar=true`
- artifact validators both passed

This matters because the smoke no longer only proves the fallback conversion path. It now proves the real preferred desktop DWG route when a DWG plugin is available.

### 3. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step250 is verified when the real desktop smoke passes and explicitly records `prepared.route = direct-plugin`, proving that the desktop product path and smoke path now share the same DWG route-selection logic.
