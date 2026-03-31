# Step252: Desktop Live Settings UI Verification

## Scope

Verify that the real Electron viewer entrypoint now exposes desktop settings and readiness controls, and that the live renderer change does not break the actual desktop DWG-open path.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --outdir deps/cadgamefusion/build/step252_dwg_open_desktop_ui_smoke
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static check

`node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`

- PASS

### 2. Desktop settings helper tests

`node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`

- PASS
- `5/5` tests green

Covered facts:

- explicit empty-string overrides still beat detected defaults
- number fields normalize correctly
- router readiness formatting includes health facts
- DWG readiness formatting includes route/readiness facts
- open-result formatting distinguishes success vs cancel

### 3. Real desktop DWG smoke

`python3 deps/cadgamefusion/tools/plm_dwg_open_desktop_smoke.py --outdir deps/cadgamefusion/build/step252_dwg_open_desktop_ui_smoke`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step252_dwg_open_desktop_ui_smoke/20260325_233253/summary.json`

Key verified facts:

- wrapper smoke status: `ok=true`
- Electron desktop run return code: `0`
- desktop summary status: `ok=true`
- `prepared.route = direct-plugin`
- viewer load still succeeds with `status_code = 200`
- viewer still contains the expected preview/statusbar shell
- manifest/document validators both passed

This proves the live renderer UI additions did not break the actual desktop DWG-open business path.

### 4. Real browser UI check with mocked desktop bridge

Using a local HTTP server on `tools/web_viewer/` plus a mocked `window.vemcadDesktop` bridge in Chrome DevTools, the live viewer was checked interactively.

Verified facts:

- `Open CAD File` and `Settings` buttons become visible when the desktop bridge exists
- clicking `Settings` opens the live modal from `tools/web_viewer/index.html`
- detected/default values populate the form, including `DWG Plugin Path`
- `Check DWG` renders structured status lines:
  - `Route: direct-plugin`
  - `Direct plugin ready: yes`
  - `Local convert ready: yes`
  - `DWG plugin: ...`
  - `DWG convert cmd: ...`
  - `dwg2dxf: ...`
- `Test Router` renders structured router health lines:
  - `Router URL: ...`
  - `Health ok: yes`
  - `Router mode: dev`
  - `Default plugin: ...`
  - `Default convert CLI: ...`

### 5. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step252 is verified because the live desktop viewer now exposes usable settings/readiness controls, those controls display the Step250 route-aware backend contract in structured form, and the real desktop DWG smoke still passes on the preferred `direct-plugin` path.
