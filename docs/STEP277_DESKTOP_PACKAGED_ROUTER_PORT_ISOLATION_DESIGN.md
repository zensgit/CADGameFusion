# Step277: Desktop Packaged Router Port Isolation Design

## Goal

Prevent the packaged VemCAD desktop app from accidentally attaching to an unrelated local router that is already listening on `127.0.0.1:9000`.

Step277 isolates the packaged router lane by moving its default URL to `127.0.0.1:19100` while keeping live/dev workflows on `127.0.0.1:9000`.

## Problem

The desktop app previously used the same default router URL in both live/dev and packaged modes:

- `http://127.0.0.1:9000`

That looks simple, but it breaks on machines that already have an older dev or legacy router running on `9000`.

In the failure reproduced on the default macOS desktop profile:

1. packaged VemCAD launched successfully;
2. stale local settings were already cleared, so the app fell back to its packaged defaults;
3. the packaged app connected to the router already listening on `9000`;
4. that router came from a different checkout and did not have packaged DWG conversion configured;
5. opening a real DWG failed with:

```text
Open CAD failed via direct-plugin:
{ "status": "error", "message": "DWG conversion not configured", "error_code": "DWG_CONVERT_NOT_CONFIGURED" }
```

The packaged app itself was healthy. The wrong router answered the request.

## Contract

### 1. Packaged and live defaults must stop sharing the same port

- live/dev desktop keeps `http://127.0.0.1:9000`
- packaged desktop defaults to `http://127.0.0.1:19100`

This applies both to:

- effective router settings resolution;
- default router autostart configuration.

### 2. Explicit overrides must still win

Step277 must not break support or QA overrides. These continue to take precedence:

- stored desktop settings;
- `--router-url`;
- `VEMCAD_ROUTER_URL`;
- `CADGF_ROUTER_URL`.

The new packaged default only applies when no explicit override exists.

### 3. The fix must work on the real default desktop profile

This step is not complete unless the user’s normal profile can:

1. leave an older router running on `127.0.0.1:9000`;
2. launch packaged VemCAD;
3. autostart or attach to its own router on `127.0.0.1:19100`;
4. open the real DWG sample successfully.

### 4. Smoke should assert durable recovery, not transient wording

The packaged settings smoke already proves startup auto-repair for stale router settings.
For the `bad routerStartCmd` lane, the durable proof is:

- ready status returns;
- stale settings are cleared.

The smoke should not fail only because a transient confirmation marker was overwritten by the later ready status line.

## Scope

- `tools/web_viewer_desktop/main.js`
- `tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`
- `docs/STEP277_DESKTOP_PACKAGED_ROUTER_PORT_ISOLATION_DESIGN.md`
- `docs/STEP277_DESKTOP_PACKAGED_ROUTER_PORT_ISOLATION_VERIFICATION.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`

## Acceptance

Step277 is complete when:

- packaged default router URL resolves to `http://127.0.0.1:19100`;
- live/dev default router URL remains `http://127.0.0.1:9000`;
- the real packaged app can preview the DWG on the default user profile even if an unrelated router still occupies `9000`;
- the packaged settings smoke passes again with the more stable auto-repair assertion.
