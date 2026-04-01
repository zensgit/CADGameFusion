# Step229: Editor Imported MLEADER Proxy Verification

## Commands
From `deps/cadgamefusion`:

```bash
node --check tools/web_viewer/adapters/cadgf_document_adapter.js
node --check tools/web_viewer/scripts/editor_mleader_smoke.js
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_mleader_smoke.js
node tools/web_viewer/scripts/editor_source_group_smoke.js
node tools/web_viewer/scripts/editor_selection_summary_smoke.js
git diff --check
```

## Expected Contract
- imported `TEXT + text_kind=mleader` is inferred as `LEADER / proxy / mleader`
- adapter assigns a stable synthetic single-entity `groupId` when the imported payload has none
- imported `MLEADER` text keeps `text_kind=mleader` while gaining `sourceTextPos / sourceTextRotation`
- direct property edits keep proxy provenance intact
- `srcplace` restores the imported placement
- `srcedit` releases the note to native editable text and strips source/group provenance while keeping `text_kind=mleader`
- text-only `MLEADER` exposes a minimal self-anchor guide, but does not invent driver/elbow actions

## Verification Notes
- `node --check` passed for `cadgf_document_adapter.js` and `editor_mleader_smoke.js`
- `node --test tools/web_viewer/tests/editor_commands.test.js` passed with `255/255`
- `node tools/web_viewer/scripts/editor_mleader_smoke.js` passed
- `node tools/web_viewer/scripts/editor_source_group_smoke.js` passed
- `node tools/web_viewer/scripts/editor_selection_summary_smoke.js` passed
- `git diff --check` passed

## Key Results
Command-layer regression confirmed:
- adapter import maps real imported `mleader` text to `sourceType=LEADER`, `editMode=proxy`, `proxyKind=mleader`
- synthetic single-entity groups are stable and monotonic (`42`, `43` in the adapter regression fixture)
- `selection.sourceEditGroupText` releases a single imported `MLEADER` proxy with message `Released source group and selected source text (1 of 1 entities)`
- released text keeps `textKind = mleader` while losing `groupId / sourceType / editMode / proxyKind`

Browser artifacts:
- `build/editor_mleader_smoke/20260324_083733/summary.json`
- `build/editor_source_group_smoke/20260324_083643/summary.json`
- `build/editor_selection_summary_smoke/20260324_083643/summary.json`

Key browser assertions from `editor_mleader_smoke`:
- `before.details.items["group-source"] == "LEADER / mleader"`
- `before.details.items["source-text-pos"] == "12, 18"`
- `before.details.items["source-anchor"] == "12, 18"`
- `before.property.actions` includes `reset-source-text-placement`, `fit-source-anchor`, `fit-source-group`, `edit-source-text`, `release-source-group`
- `before.property.actions` excludes `select-source-anchor-driver`, `fit-leader-landing`, `flip-leader-landing-side`
- `after_proxy_edit.entity.value == "MLEADER_PROXY_EDITED"`
- `after_proxy_edit.entity.position == { "x": 16, "y": 20 }`
- `after_reset.entity.position == { "x": 12, "y": 18 }`
- `after_fit.overlay.groupId == 1`
- `after_release_edit.entity.textKind == "mleader"`
- `after_released_patch.entity.value == "MLEADER_RELEASED_EDIT"`
