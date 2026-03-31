# Step269: Desktop Startup Auto-Repair Design

## Goal

Recover from stale desktop settings stored in localStorage automatically on app startup, so users do not have to manually open Settings after a broken override has been persisted.

## Problem

- Startup readiness is now visible in the main status bar.
- `Use Recommended` exists in settings.
- But if local overrides (persisted from a previous run) make startup readiness fail, users still need to manually open Settings and press the repair action.

This adds a startup auto-repair path:

1. startup status checks run first on desktop launch;
2. if readiness is not ready and stored overrides are stale for startup-relevant fields;
3. the app compares against freshly-fetched defaults;
4. if defaults are ready, it applies recommended settings and clears stale local overrides automatically.

## Contract

### 1. Auto-repair trigger only when needed

Auto-repair is not unconditional. It runs only when:

- desktop bridge is present;
- current startup readiness is not ready;
- localStorage has startup-relevant differences from current defaults;
- defaults themselves pass startup readiness (`ready via ...`).

### 2. Auto-repair action semantics

When triggered, startup flow must:

- re-apply detected defaults into the form;
- clear stored overrides (same semantics as `Use Recommended`);
- recalculate startup readiness immediately after repair;
- show a main status summary that includes an auto-repair confirmation line.

### 3. Visibility and confidence

Users should clearly see:

- `Startup settings auto-repair applied recommended desktop setup.`
- followed by the recovered readiness sentence (for example `Desktop ready via direct-plugin from ...`).

### 4. Scope

- `tools/web_viewer/preview_app.js`
- `tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `docs/STEP269_DESKTOP_STARTUP_AUTO_REPAIR_DESIGN.md`
- `docs/STEP269_DESKTOP_STARTUP_AUTO_REPAIR_VERIFICATION.md`

## Packaged Smoke Hardening

Packaged verification must avoid relying on empty-string overrides for startup breakage.

- packaged desktop defaults in `main.js` intentionally coerce an empty `routerUrl` back to `DEFAULT_ROUTER_URL`;
- because of that, packaged smoke must inject a non-empty invalid router URL instead of `""`;
- the current hardened case uses `http://127.0.0.1:1` together with `routerAutoStart: off`, which preserves the "stale override" semantics without being normalized away and fails fast instead of waiting on a bad startup command.

Packaged verification must also wait for actual desktop controls, not just class toggles.

- `desktop_packaged_settings_smoke.js` waits for `domcontentloaded`;
- it then verifies `window.vemcadDesktop` exists and both `#settings-btn` and `#open-cad-btn` are genuinely visible via computed style and bounding box checks;
- this avoids false negatives where the window exists but the renderer has not fully promoted desktop actions yet.
- each smoke run launches the packaged app with an isolated temporary profile, so stale localStorage from prior failed runs cannot contaminate the next verification.

Packaged verification should assert stable post-repair signals.

- the main status banner is the durable source for the startup auto-repair confirmation text;
- after opening Settings, the modal is expected to refresh into combined `[Router]` and `[DWG]` diagnostics;
- packaged smoke gates success on repaired state facts: ready startup status, cleared persisted override, restored form values, and combined diagnostics;
- the confirmation marker is still recorded when present, but the smoke does not rely on it as the only post-relaunch synchronization signal.

## Acceptance

Step269 is complete when:

- startup with stale startup-relevant local overrides auto-repairs and returns to ready status;
- startup auto-repair clears stale local overrides;
- existing manual `Use Recommended` and `Reset` flows remain intact;
- mocked-live and packaged smoke prove startup recovery is exercised;
- packaged smoke proves the failure injection is not absorbed by desktop default coercion and that visible desktop controls survive the repaired relaunch.
