# Step269: Desktop Startup Auto-Repair Verification

## Scope

Verify that desktop startup can self-heal from stale local settings overrides when defaults are healthy, while keeping existing setup-repair flows.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer/desktop_settings.js
node --check deps/cadgamefusion/tools/web_viewer/preview_app.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js
cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js --pack-if-needed
git -C deps/cadgamefusion diff --check
```

## Expected Results

### 1. Static and unit checks

Expected to pass:

- `node --check deps/cadgamefusion/tools/web_viewer/desktop_settings.js`
- `node --check deps/cadgamefusion/tools/web_viewer/preview_app.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `node --test deps/cadgamefusion/tools/web_viewer/tests/desktop_settings.test.js`

### 2. Live desktop settings smoke

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_live_settings_smoke.js`

Key facts:

- startup status initially shows ready;
- with intentionally stale persisted startup overrides, app reload triggers:
  - auto-repair confirmation on main status;
  - readiness returning to `Desktop ready via direct-plugin from packaged-cad-resources. Open CAD File or Settings.`;
  - localStorage stale override cleared;
  - settings form restored to defaults and `Open CAD File` uses repaired settings.

### 3. Packaged desktop settings smoke

Expected to pass:

- `cd deps/cadgamefusion/tools/web_viewer_desktop && npm run pack`
- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js --pack-if-needed`

Key facts:

- startup recovery occurs after injecting stale startup overrides and reload;
- packaged stale override uses a non-empty invalid router URL (`http://127.0.0.1:1`) with `routerAutoStart: off`, so the failure is not normalized back to `DEFAULT_ROUTER_URL` and returns quickly enough for deterministic smoke timing;
- packaged smoke uses an isolated temporary profile per run, so verification starts from a clean packaged desktop state and only preserves localStorage across the intentional relaunch inside that single smoke run;
- packaged relaunch reaches ready status after the stale override is cleared;
- smoke records whether the auto-repair confirmation marker remained visible, but pass/fail is based on repaired state rather than that transient banner alone;
- stale localStorage value is cleared after recovery;
- packaged window still exposes visible `Settings` and `Open CAD File` controls after relaunch;
- settings modal refreshes to stable combined `[Router]` and `[DWG]` diagnostics without manual repair click;
- repaired form values match packaged defaults after the modal refresh.

### 4. Patch hygiene

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step269 is verified if startup recovery is automatic, deterministic, and non-destructive: stale startup overrides are repaired only when defaults are healthy, then startup returns to a ready state and local overrides are removed.
