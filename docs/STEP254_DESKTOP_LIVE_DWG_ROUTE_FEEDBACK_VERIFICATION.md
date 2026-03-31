# Step254: Desktop Live DWG Route Feedback Verification

## Scope

Verify that the live desktop viewer now shows DWG route/readiness immediately when Settings opens, and that successful `Open CAD File` feedback includes the actual route.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer/desktop_settings.js
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js --outdir deps/cadgamefusion/build/step254_desktop_live_settings_smoke
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --outdir deps/cadgamefusion/build/step254_dwg_open_desktop_smoke
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static checks

All of the following passed:

- `node --check deps/cadgamefusion/tools/web_viewer/desktop_settings.js`
- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`

### 2. Desktop settings helper tests

`node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`

- PASS
- `5/5` tests green

Protected facts include:

- successful open results format route and DWG plugin details
- cancellation remains distinct from success

### 3. Live desktop settings smoke

`node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js --outdir deps/cadgamefusion/build/step254_desktop_live_settings_smoke`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step254_desktop_live_settings_smoke/20260325_235054/summary.json`

Key verified facts:

- opening Settings auto-renders `Route: direct-plugin`
- initial modal-open status shows the detected DWG plugin path
- reopening Settings after save auto-renders the overridden DWG plugin path
- manual `Check DWG` still works and shows the same structured route facts
- successful `Open CAD File` status becomes `Opened desktop_live_settings_sample via direct-plugin.`
- `Reset` immediately returns the modal to detected DWG readiness instead of a generic placeholder state
- saved overrides are still the settings passed into `openCadFile`

### 4. Real desktop DWG smoke

`python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --outdir deps/cadgamefusion/build/step254_dwg_open_desktop_smoke`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step254_dwg_open_desktop_smoke/20260325_235054/summary.json`

Key verified facts:

- desktop main-process DWG open still succeeds
- the prepared route remains visible as `direct-plugin`
- Step254 did not regress the real desktop business path

### 5. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step254 is verified because the live desktop viewer now surfaces DWG route facts at the two moments that matter most:

- when the user opens Settings
- when the user successfully opens a CAD file

Both behaviors are now covered by automated regression, and the real desktop DWG smoke remains green.
