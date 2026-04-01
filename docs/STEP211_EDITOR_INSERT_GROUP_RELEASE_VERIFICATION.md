# STEP211 Editor Insert Group Release Verification

## Scope

Verification for Step211 covers:

- command-layer release of imported insert groups
- regression that unsupported placeholder members block release cleanly
- real-browser proof that the former proxy text becomes editable through the normal property form after release

## Node Test

Run:

```bash
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Result:

- `217/217 PASS`

Relevant additions:

- `selection.insertReleaseGroup releases imported insert members to editable geometry`
- `selection.insertReleaseGroup rejects insert groups with unsupported members`

Key command facts now locked:

- single-member selection can release the full insert group
- release clears `sourceType / editMode / proxyKind / groupId / blockName`
- former proxy text can immediately pass `selection.propertyPatch`
- unsupported insert members return `UNSUPPORTED_INSERT_MEMBER`

## Syntax Check

Run:

```bash
node --check deps/cadgamefusion/tools/web_viewer/commands/command_registry.js
node --check deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
node --check deps/cadgamefusion/tools/web_viewer/ui/workspace.js
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
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260323_170452/summary.json`

Key checked facts:

- initial single imported fragment exposes:
  - `Select Insert Group`
  - `Select Editable Members`
  - `Release Insert Group`
- after release:
  - `statusText = "Released insert group to editable geometry (3 entities)"`
  - selection expands to `[7, 8, 9]`
  - released members keep `layer / space / layout / style` facts
  - released members no longer expose `sourceType / editMode / proxyKind / groupId / blockName`
- released single text member:
  - no longer shows `INSERT` origin
  - no longer exposes insert-group actions
  - edits through the real property field `input[name="value"]`
  - persists `value = "TAG-EDITABLE"`

Concrete artifact facts:

- `after_release.entities[2].value = "TAG-A"`
- `after_release.entities[2]` has no insert/proxy/group metadata
- `after_release_edit.entity.value = "TAG-EDITABLE"`
- `after_release_edit.statusText = "Text updated"`

## Regression Smoke

Run:

```bash
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
```

Result:

- PASS
- artifact:
  - `/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260323_170508/summary.json`

This confirms Step211 did not regress the existing single-selection provenance/effective-style workflow.

## Diff Hygiene

Run:

```bash
git -C deps/cadgamefusion diff --check
```

Result:

- PASS
