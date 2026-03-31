# Step222 Editor Source Text Placement Reset Verification

## Scope

Verify that imported `DIMENSION` / `LEADER` text proxies now preserve original source placement and can reset back to it without release, while preserving:

- Step220 direct in-place proxy text edits
- Step221 grouped-source text focus
- Step219 release-and-edit workflows
- insert-group and broader selection/property contracts

## Commands

From `/Users/huazhou/Downloads/Github/VemCAD`:

```bash
node --check deps/cadgamefusion/tools/web_viewer/state/documentState.js
node --check deps/cadgamefusion/tools/web_viewer/adapters/cadgf_document_adapter.js
node --check deps/cadgamefusion/tools/web_viewer/commands/command_registry.js
node --check deps/cadgamefusion/tools/web_viewer/ui/selection_presenter.js
node --check deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
node --check deps/cadgamefusion/tools/web_viewer/ui/workspace.js
node --check deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js
node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
node deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js
node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js
node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
git -C deps/cadgamefusion diff --check
```

## Results

### 1. Syntax checks

All `node --check` commands above passed.

### 2. Node contract tests

`node --test deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js`

- PASS
- `241/241`

New locked behaviors:

- `selection.sourceResetTextPlacement` restores `DIMENSION` proxy text placement
- `selection.sourceResetTextPlacement` also re-syncs `dimTextPos / dimTextRotation`
- `selection.sourceResetTextPlacement` restores `LEADER` proxy text placement from grouped selection
- proxy provenance stays intact after reset

### 3. Real browser source placement workflow

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_source_group_smoke/20260323_223111/summary.json)

Key verified behaviors:

- grouped `DIMENSION` text focus exposes:
  - `Source Text Pos = 0, 14`
  - `Source Text Rotation = 0`
- after grouped in-place placement drift, property action reset returns the imported dimension text to:
  - `position = 0, 14`
  - `rotation = 0`
- the same reset also restores:
  - `dimTextPos = 0, 14`
  - `dimTextRotation = 0`
- the dimension text still keeps:
  - `sourceType = DIMENSION`
  - `editMode = proxy`
  - `proxyKind = dimension`
- grouped `LEADER` text focus exposes:
  - `Source Text Pos = 58, 7`
  - `Source Text Rotation = 0`
- after grouped in-place placement drift, command-line `srcplace` returns the imported leader text to:
  - `position = 58, 7`
  - `rotation = 0`
- the leader text still keeps:
  - `sourceType = LEADER`
  - `editMode = proxy`
  - `proxyKind = leader`
- Step219 release-and-edit still remains valid in the same smoke:
  - released leader text ends at `LEADER_EDITED`

### 4. Insert workflow regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_insert_group_smoke/20260323_223036/summary.json)

This confirms the source text placement reset slice did not regress the imported insert workflow.

### 5. Selection/property regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_selection_summary_smoke/20260323_223036/summary.json)

This confirms the broader imported editor quicklook/property contract remains stable after adding source text placement reset.

### 6. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step222 is verified.

Imported annotation text now has a reversible placement workflow:

- focus imported source text
- move/rotate it in place while preserving provenance
- restore it back to source placement without release
- still release and edit when detachment is the real goal

That is a materially stronger imported annotation workflow than the common one-way override or explode-first reference path.
