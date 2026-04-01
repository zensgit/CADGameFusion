# Step253: Desktop Live Settings Smoke Verification

## Scope

Verify that the live desktop settings workflow now has an automated browser regression on the real viewer page.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Static check

`node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`

- PASS

### 2. Live desktop settings smoke

`node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/desktop_live_settings_smoke/20260325_233914/summary.json`

Key verified facts:

- `Settings` and `Open CAD File` become visible when the desktop bridge exists
- the live modal opens from `tools/web_viewer/index.html`
- detected defaults populate `routerUrl` and `dwgPluginPath`
- saving overrides persists:
  - `routerUrl = http://127.0.0.1:9011`
  - `projectId = dwg-ui-smoke`
  - `dwgPluginPath = /custom/libcadgf_dwg_importer_plugin.dylib`
- `Open CAD File` reuses those saved overrides
- `Test Router` renders structured status with `Router URL` and default plugin/convert facts
- `Check DWG` renders structured status with `Route: direct-plugin` and the overridden DWG plugin path
- `Reset` restores defaults and clears `localStorage`
- `onOpenSettings` can reopen the modal through the same live renderer

### 3. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step253 is verified when the new browser smoke passes and proves that the live desktop settings workflow is no longer protected only by manual inspection.
