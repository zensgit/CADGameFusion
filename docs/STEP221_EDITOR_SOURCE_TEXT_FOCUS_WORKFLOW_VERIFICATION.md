# Step221 Editor Source Text Focus Workflow Verification

## Scope

Verify that grouped imported source bundles with text can now focus imported text proxies without release, while preserving:

- Step220 direct in-place proxy text overrides
- Step219 release-and-edit workflows
- insert-group workflows
- the broader imported editor property/selection contract

## Commands

From `/Users/huazhou/Downloads/Github/VemCAD`:

```bash
node --check deps/cadgamefusion/tools/web_viewer/commands/command_registry.js
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
- `239/239`

New locked behaviors:

- `selection.sourceSelectText` narrows grouped `DIMENSION` selection to imported text proxy members without release
- `selection.sourceSelectText` narrows grouped `LEADER` selection to imported text proxy members without release
- `selection.sourceSelectText` rejects source bundles without text using:
  - `GROUP_HAS_NO_TEXT`
- after `selection.sourceSelectText`, direct property edits still preserve proxy provenance

### 3. Real browser grouped-source focus workflow

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_source_group_smoke/20260323_221257/summary.json)

Key verified behaviors:

- full grouped `DIMENSION` selection exposes:
  - `Select Source Text`
- property action `Select Source Text` narrows the grouped `DIMENSION` selection to:
  - `24`
- that narrowed imported text proxy still shows:
  - `source-type = DIMENSION`
  - `edit-mode = proxy`
  - `proxy-kind = dimension`
- after focused in-place edit, the imported dimension text becomes:
  - `DIM_GROUP_PROXY_EDITED`
- full grouped `LEADER` selection also exposes:
  - `Select Source Text`
- command-line `srctext` narrows the grouped `LEADER` selection to:
  - `42`
- that narrowed imported text proxy still shows:
  - `source-type = LEADER`
  - `edit-mode = proxy`
  - `proxy-kind = leader`
- after focused in-place edit, the imported leader text becomes:
  - `LEADER_GROUP_PROXY_EDITED`
- Step219 release-and-edit still works in the same smoke:
  - released leader text ends at `LEADER_EDITED`

### 4. Insert workflow regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260323_221257/summary.json)

This confirms the new grouped-source text-focus path did not regress the richer imported insert workflow.

### 5. Selection/property regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260323_221257/summary.json)

This confirms the broader imported editor quicklook/property contract remains stable after adding the new grouped-source text-focus action.

### 6. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step221 is verified.

Imported grouped annotation editing now has a stronger ladder of workflows:

- focus imported source text without release
- edit proxy text in place while keeping provenance
- release and edit when detachment is actually needed

That is a materially better imported-annotation workflow than the common explode-first/reference pattern.
