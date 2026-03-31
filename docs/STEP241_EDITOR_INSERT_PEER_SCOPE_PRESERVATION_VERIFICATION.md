# Step241: Editor Insert Peer Scope Preservation Verification

## Commands

From `deps/cadgamefusion`:

```bash
node --check tools/web_viewer/insert_group.js
node --check tools/web_viewer/ui/workspace.js
node --check tools/web_viewer/ui/property_panel.js
node --check tools/web_viewer/tests/editor_commands.test.js
node --check tools/web_viewer/scripts/editor_insert_group_smoke.js
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_insert_group_smoke.js
git diff --check
```

## Expected Contract

- canonical imported insert text-only selection keeps peer actions visible
- direct peer action `Open 3: ...` preserves text-only scope across layouts
- command-line `inspeer Layout-B` preserves the same text-only scope
- command-line `insprev` restores the original peer and text-only scope
- multi-select quicklook remains `mode=multiple`, while peer facts are asserted through property metadata
- existing single-fragment, full-group, editable-only, proxy-edit, transform, copy/delete, and release flows remain green

## Node Test Coverage

`tools/web_viewer/tests/editor_commands.test.js` covers:

- canonical text-only peer selection:
  - current selection equals the peer's text member set
  - resolver returns `scope = "text"`
  - target peer selection becomes the peer's text members
  - primary selection follows the matched peer text member
- editable-only peer selection:
  - existing editable-only preservation remains intact

## Browser Smoke Assertions

Artifact:

- [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260325_150204/summary.json)

The browser smoke validates:

- `DoorNotes` text-only multi-selection starts on `Layout-A` with selection `[21, 22]`
- property metadata still exposes:
  - `block-name = DoorNotes`
  - `insert-group-members = 3`
  - `peer-instance = 1 / 3`
- property actions still expose:
  - `open-insert-peer-2`
  - `open-insert-peer-3`
  - `previous-insert-peer`
  - `next-insert-peer`
  - `select-insert-group`
- direct peer action `open-insert-peer-3` moves selection to `[27, 28]` on `Layout-C`
- command `inspeer Layout-B` moves selection to `[24, 25]` on `Layout-B`
- command `insprev` restores selection to `[21, 22]` on `Layout-A`
- the insert-group overlay continues to resolve the same peer instance bounds during the text-only path

## Results

- `node --test tools/web_viewer/tests/editor_commands.test.js`
  - `280/280 PASS`
- `node tools/web_viewer/scripts/editor_insert_group_smoke.js`
  - PASS
  - run dir:
    - `build/editor_insert_group_smoke/20260325_150204`
- `git diff --check`
  - PASS

## Observed Real Browser Signals

The final browser artifact confirms:

- `text_scope_before`
  - multi-select detail mode stays `multiple`
  - property metadata shows `block-name = DoorNotes`
  - property metadata shows `peer-instance = 1 / 3`
  - peer actions include `open-insert-peer-2`, `open-insert-peer-3`, `previous-insert-peer`, and `next-insert-peer`
- `text_scope_after_direct_peer`
  - direct property action jumps to `Layout-C`
  - peer metadata becomes `3 / 3`
- `text_scope_after_command_peer`
  - command `inspeer Layout-B` jumps to `Layout-B`
  - peer metadata becomes `2 / 3`
- `text_scope_after_prev`
  - command `insprev` returns to `Layout-A`
  - peer metadata returns to `1 / 3`
