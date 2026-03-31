# Step220 Editor Source Proxy Text Override Verification

## Scope

Verify that imported `DIMENSION` / `LEADER` text proxies now support direct in-place text overrides without release, while preserving:

- grouped-source provenance
- Step219 release-and-edit workflows
- insert-group workflows
- the broader imported editor property/selection contract

## Commands

From `/Users/huazhou/Downloads/Github/VemCAD`:

```bash
node --check deps/cadgamefusion/tools/web_viewer/commands/command_registry.js
node --check deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
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
- `236/236`

New locked behaviors:

- `selection.propertyPatch` allows direct text override on read-only `DIMENSION` text proxies
- `selection.propertyPatch` syncs `position -> dimTextPos` for direct dimension text overrides
- `selection.propertyPatch` allows direct text override on read-only `LEADER` text proxies
- CADGF export keeps imported proxy provenance while writing synced dimension text override metadata

### 3. Real browser grouped-source workflow

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_source_group_smoke/20260323_220228/summary.json)

Key verified behaviors:

- single imported `DIMENSION` text proxy exposes editable property fields:
  - `value`
  - `position.x`
  - `position.y`
  - `height`
  - `rotation`
- the `DIMENSION` text proxy note explicitly says text overrides stay editable while geometry remains proxy-only
- direct property edit changes the imported dimension text value to:
  - `DIM_PROXY_EDITED`
- after that edit, the entity still keeps:
  - `sourceType = DIMENSION`
  - `editMode = proxy`
  - `proxyKind = dimension`
- single imported `LEADER` text proxy also supports direct in-place text override
- direct property edit changes the imported leader text value to:
  - `LEADER_PROXY_EDITED`
- after that edit, the entity still keeps:
  - `sourceType = LEADER`
  - `editMode = proxy`
  - `proxyKind = leader`
- grouped `DIMENSION` and `LEADER` bundles still support Step219 release-and-edit flows:
  - `srcedit`
  - `Release & Edit Source Text`
- the released leader text still ends at:
  - `LEADER_EDITED`
- grouped `HATCH` still follows the non-text bundle contract and ends with:
  - `Deleted source group (3 entities, including 3 read-only)`

### 4. Insert workflow regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_insert_group_smoke/20260323_220252/summary.json)

This confirms the new source-text proxy override path did not regress the richer imported insert workflow.

### 5. Selection/property regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js`

- PASS
- artifact: [summary.json](../build/editor_selection_summary_smoke/20260323_220252/summary.json)

This confirms the broader imported editor quicklook/property contract remains stable after opening direct text edits on imported source text proxies.

### 6. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step220 is verified.

Imported annotation text no longer has only two extremes:

- completely read-only proxy
- fully released editable geometry

The editor now supports a more valuable middle path:

- direct in-place text correction for imported `DIMENSION` / `LEADER` text proxies
- preserved grouped-source provenance
- release-and-edit still available when detachment is actually needed
