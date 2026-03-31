# Step263: Desktop Recommended Setup Repair Design

## Goal

Give ordinary users and QA a one-click way to recover from stale local Settings overrides by reapplying the current authoritative desktop defaults.

## Problem

Before Step263:

- Settings persisted local overrides correctly
- Reset cleared all local values
- packaged/runtime truth was visible

But there was still no explicit "repair me using current detected runtime" action. A stale bad override could mask healthy packaged defaults until the user manually edited fields or reset everything.

## Contract

### 1. Settings exposes a first-class repair action

The live modal now includes:

- `Use Recommended`

### 2. Recommended setup means authoritative defaults, not new overrides

Clicking `Use Recommended` must:

- re-fetch current defaults from the desktop bridge
- repopulate the form from those defaults
- clear locally stored overrides instead of saving a new copy of defaults

This keeps future runtime changes visible instead of freezing another stale snapshot.

### 3. Repair keeps readiness visible

After repair, the modal must immediately re-render combined `[Router]` + `[DWG]` readiness and prefix it with an explicit confirmation line:

- `Applied recommended desktop setup from detected runtime.`

## Key Files

- `tools/web_viewer/index.html`
- `tools/web_viewer/preview_app.js`
- `tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `tools/web_viewer_desktop/README.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`
- `docs/Tools.md`
- `docs/VEMCAD_QA_CHECKLIST.md`

## Acceptance

Step263 is complete when:

- `Use Recommended` is visible in the live modal
- clicking it restores authoritative defaults
- local settings storage is cleared
- `Open CAD File` uses the repaired defaults afterward
- both mocked-live and packaged-live smokes cover the workflow
