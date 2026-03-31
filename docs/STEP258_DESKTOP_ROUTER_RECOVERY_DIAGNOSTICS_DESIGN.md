# Step258: Desktop Router Recovery Diagnostics Design

## Goal

Make router failures in the desktop `Open CAD File` workflow as actionable as DWG route failures.

## Problem

By Step257, the desktop workflow already had:

- explicit `DWG Route Mode`
- route-aware open success messages
- DWG setup hints that reopened `Settings`

But router failures were still weaker:

- `Open CAD File` could auto-reopen `Settings`, but the recovery detail was mostly a raw error
- `Test Router` success exposed `/health`, while failure paths did not expose the same setup context
- users could still be blocked by a missing `Router URL` or unusable start command without seeing the exact next step in the same structured format as DWG failures

## Contract

### 1. Router readiness becomes a structured fact set

Desktop router results now carry:

- `router_url`
- `router_auto_start`
- `router_start_ready`
- `router_start_source`
- `router_start_cmd`
- `router_start_cmd_suggested`
- `router_plugin`
- `router_convert_cli`

These facts are available on router failures, router tests, and router-backed open failures.

### 2. Router failures get explicit recovery hints

The desktop main process now maps router error lanes to actionable `Hint: ...` text:

- `ROUTER_NOT_CONFIGURED`
- `ROUTER_NOT_AVAILABLE`
- `ROUTER_START_NOT_CONFIGURED`
- `ROUTER_START_FAILED`
- `ROUTER_START_TIMEOUT`

The hint must explain the next operator action instead of only returning the error code.

### 3. Live UI shows router recovery state in the same settings surface

`formatDesktopRouterStatus()` and `formatDesktopOpenResult()` now surface router recovery details:

- current router URL
- effective auto-start state
- whether a start command is ready
- start command/source
- router plugin / convert CLI
- structured recovery hint

This keeps router recovery in the same modal already used for DWG route recovery.

### 4. Browser smoke must prove router recovery

The live desktop settings smoke must now prove:

1. `Test Router` success shows structured router readiness facts
2. clearing `Router URL` and using `Open CAD File` auto-reopens `Settings`
3. the reopened modal shows router-specific structured details plus a `Hint: ...`
4. reset restores the defaults after router-failure recovery

### 5. Real Electron DWG open must stay green

This slice changes the desktop main process, so the real desktop DWG smoke must still pass unchanged on the success path.

## Key Files

- `tools/web_viewer_desktop/main.js`
- `tools/web_viewer/desktop_settings.js`
- `tools/web_viewer/tests/desktop_settings.test.js`
- `tools/web_viewer/scripts/desktop_live_settings_smoke.js`
- `tools/web_viewer/README.md`
- `tools/web_viewer_desktop/README.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`
- `docs/Tools.md`
- `docs/VEMCAD_QA_CHECKLIST.md`

## Non-Goals

Step258 does not:

- change DWG conversion logic
- change router conversion payloads
- package additional router binaries

## Acceptance

Step258 is complete when:

- router failures expose structured readiness fields and a concrete hint
- `Open CAD File` router failures auto-reopen `Settings` with those structured facts visible
- `Test Router` success/failure use the same richer formatter
- the real desktop DWG success smoke still passes
