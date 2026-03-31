# Step277: Desktop Packaged Router Port Isolation Verification

## Scope

Verify that packaged VemCAD no longer binds itself to an unrelated router already listening on `127.0.0.1:9000`, and that the real packaged app can open the DWG sample from the default desktop profile by using its packaged router on `127.0.0.1:19100`.

## Commands

From repo root:

```bash
node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js
npm --prefix deps/cadgamefusion/tools/web_viewer_desktop run pack
lsof -nP -iTCP:9000 -sTCP:LISTEN
lsof -nP -iTCP:19100 -sTCP:LISTEN
curl -fsS http://127.0.0.1:9000/health
curl -fsS http://127.0.0.1:19100/health
node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js \
  --input-dwg "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg" \
  --outdir /tmp/desktop-packaged-smoke-router-port-fix
git -C deps/cadgamefusion diff --check
```

The real-user-profile repro and validation were additionally performed by:

1. backing up `/Users/huazhou/Library/Application Support/cadgf-web-viewer-desktop/Local Storage` to `/tmp/vemcad-profile-backups/20260326_214442`;
2. clearing that Local Storage so stale desktop overrides would not mask the default packaged path;
3. relaunching the packaged app from:
   - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer_desktop/dist/mac-arm64/VemCAD.app`
4. opening the real DWG sample from the default user profile.

## Expected Results

### 1. Static checks

Expected to pass:

- `node --check deps/cadgamefusion/tools/web_viewer_desktop/main.js`
- `node --check deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js`

### 2. Port split is real

Expected facts from the host:

- `127.0.0.1:9000` may still be occupied by a legacy/dev router;
- packaged VemCAD should bring up or use its packaged router on `127.0.0.1:19100`.

Observed facts from the verified run on March 26, 2026:

- `lsof -nP -iTCP:9000 -sTCP:LISTEN` showed a legacy router still listening:
  - PID `90046`
- `lsof -nP -iTCP:19100 -sTCP:LISTEN` showed the packaged router listening:
  - PID `92401`

Health responses also proved the split:

- `http://127.0.0.1:9000/health` came from the legacy lane that still exposed `DWG_CONVERT_NOT_CONFIGURED`;
- `http://127.0.0.1:19100/health` came from the packaged lane used by the new app session.

### 3. Real default-profile packaged open succeeds

Expected user-visible result:

- packaged VemCAD no longer shows `DWG_CONVERT_NOT_CONFIGURED` on the default desktop profile for the real sample DWG;
- the opened DWG is added to recent files;
- the active packaged window shows visible CAD geometry.

Observed evidence from the verified run on March 26, 2026:

- bad-state screenshot before the fix:
  - `/var/folders/23/dzwf05nn7nvgxc1fz30kn5gh0000gn/T/codex-shot-2026-03-26_21-46-14.png`
- good-state screenshot after the fix:
  - `/var/folders/23/dzwf05nn7nvgxc1fz30kn5gh0000gn/T/codex-shot-2026-03-26_21-50-56.png`
- recent-file store updated successfully:
  - `/Users/huazhou/Library/Application Support/cadgf-web-viewer-desktop/recent_cad_files.json`
- first recent entry became:
  - path: `/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg`
  - label: `BTJ02230301120-03保护罩组件v1`
  - timestamp: `2026-03-26T13:50:38.521Z`

### 4. Packaged settings smoke regression

Expected to pass:

- `node deps/cadgamefusion/tools/web_viewer/scripts/desktop_packaged_settings_smoke.js --input-dwg ...`

The important regression criteria are:

- packaged settings still auto-repair stale startup overrides;
- `bad routerStartCmd` still converges back to ready state;
- stale overrides are cleared;
- the in-page DWG open still succeeds from packaged resources.

Evidence from the rerun after the port-isolation and smoke-assertion update:

- summary: `/tmp/desktop-packaged-smoke-step277/20260326_215623/summary.json`

The passing run showed:

- startup auto-repair returned to packaged ready state;
- bad `routerStartCmd` startup repair returned to packaged ready state and cleared stored overrides;
- in-page DWG open finished with:
  - `Opened BTJ02230301120-03保护罩组件v1 via direct-plugin with document fallback preview.`

### 5. Patch hygiene

Expected to pass:

- `git -C deps/cadgamefusion diff --check`

## Conclusion

Step277 is verified when packaged desktop uses its own default router port `19100`, avoids older routers bound on `9000`, and the default-profile packaged app can once again open and preview the real DWG sample.
