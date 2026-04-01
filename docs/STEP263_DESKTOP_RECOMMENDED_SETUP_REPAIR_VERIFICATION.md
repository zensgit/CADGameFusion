# Step263: Desktop Recommended Setup Repair Verification

## Scope

Verify the new `Use Recommended` workflow in both the mocked live desktop viewer smoke and the real packaged Settings smoke.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack
cd /Users/huazhou/Downloads/Github/VemCAD
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static checks and contract tests

Passed:

- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`
  - `7/7 PASS`

### 2. Live settings smoke

Passed:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_live_settings_smoke/20260326_090724/summary.json`

Key verified facts:

- saving custom overrides still works
- clicking `Use Recommended` restores:
  - `routerUrl = http://127.0.0.1:9000`
  - `projectId = dwg-desktop-smoke`
  - `dwgPluginPath = /tmp/libcadgf_dwg_importer_plugin.dylib`
- `settings-status` begins with:
  - `Applied recommended desktop setup from detected runtime.`
- local storage is cleared:
  - `stored = null`
- subsequent `Open CAD File` uses repaired defaults instead of the stale override

### 3. Packaged settings smoke

Passed:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`

Artifact:

- `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_packaged_settings_smoke/20260326_091123/summary.json`

Key verified facts:

- the real packaged modal exposes `Use Recommended`
- after deliberate field overrides, clicking it restores:
  - injected packaged `Router URL`
  - packaged router start command
  - packaged DWG plugin path
  - `DWG Route Mode = auto`
- local storage is cleared in the packaged app too:
  - `stored = null`

### 4. Patch hygiene

Passed:

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step263 is verified because stale local overrides can now be repaired from the live UI with one click, and that recovery path is protected in both mocked and real packaged browser automation.
