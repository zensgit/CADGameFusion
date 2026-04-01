# Step255: Desktop DWG Smoke Route Propagation Verification

## Scope

Verify that the real desktop DWG smoke now proves route metadata continuity from the prepared open plan into the final convert result.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --outdir deps/cadgamefusion/build/step255_dwg_open_desktop_smoke
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static check

`node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`

- PASS

### 2. Real desktop DWG smoke

`python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --outdir deps/cadgamefusion/build/step255_dwg_open_desktop_smoke`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step255_dwg_open_desktop_smoke/20260325_235414/summary.json`

Key verified facts:

- `desktop_summary.prepared.route = direct-plugin`
- `desktop_summary.convert.route = direct-plugin`
- `desktop_summary.convert.dwg_plugin_path` matches the prepared direct-plugin path
- `validators.route_contract.ok = true`
- preview artifact and manifest validation remain green

### 3. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step255 is verified because the real desktop DWG smoke no longer proves route choice only indirectly. It now proves that the final successful convert result preserves the same route/plugin facts used by the live desktop viewer.
