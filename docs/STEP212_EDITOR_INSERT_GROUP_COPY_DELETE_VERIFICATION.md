# STEP212 Editor Insert Group Copy Delete Verification

## Scope

Verification for Step212 covers:

- command-layer full-group imported insert `copy`
- command-layer full-group imported insert `delete`
- regression that unsupported placeholder members still block full-group copy cleanly
- real-browser proof that copy/delete work in the same instance workflow chain as transform and release

## Node Test

Run:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Result:

- `220/220 PASS`

Relevant additions:

- `selection.copy duplicates full imported insert group as detached geometry`
- `selection.copy rejects full imported insert group with unsupported members`
- `selection.delete removes full imported insert group including read-only proxy`

## Syntax Check

Run:

```bash
node --check deps/cadgamefusion/tools/web_viewer/commands/command_registry.js
node --check deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js
```

Result:

- PASS

## Browser Smoke

Run:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js
```

Result:

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260323_171505/summary.json`

Key checked facts:

- full-group copy:
  - `after_copy.result.message = "Copied insert group as detached geometry (3 entities)"`
  - copied ids are `[12, 13, 14]`
  - copied members have no insert/proxy/group metadata
  - copied text lands at `(42, 11)` and stays a native text entity
- full-group delete:
  - `after_delete.result.message = "Deleted insert group (3 entities, including 1 proxy)"`
  - selection becomes empty
  - later undo restores the original imported instance so the smoke can continue into release/edit verification
- release regression remains green in the same run:
  - `after_release_edit.entity.value = "TAG-EDITABLE"`

This matters because Step212 is verified in the real chained workflow, not as an isolated synthetic branch.

## Regression Smoke

Run:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
```

Result:

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260323_171516/summary.json`

This confirms Step212 did not regress the existing single-selection provenance/effective-style contract.

## Diff Hygiene

Run:

```bash
git -C deps/cadgamefusion diff --check
```

Result:

- PASS
