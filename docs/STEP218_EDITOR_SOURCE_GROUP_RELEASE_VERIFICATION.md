# Step218 Editor Source Group Release Verification

## Scope

Verify that grouped non-`INSERT` imported source bundles now support:

- full-group `copy`
- full-group `delete`
- in-place `release`

while preserving:

- Step217 grouped-source transform behavior
- the richer imported `INSERT` workflow
- the broader selection/property quicklook contract

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
- `230/230`

New locked behaviors:

- `selection.sourceReleaseGroup` detaches grouped source members to editable geometry
- `selection.sourceReleaseGroup` rejects unsupported grouped-source members
- `selection.copy` duplicates full grouped source bundles as detached geometry
- `selection.delete` removes full grouped source bundles including read-only members

### 3. Real browser grouped-source lifecycle

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_source_group_smoke/20260323_201433/summary.json)

Key verified behaviors:

- grouped `DIMENSION` single-select exposes:
  - `Select Source Group`
  - `Fit Source Group`
  - `Release Source Group`
- full grouped `DIMENSION` selection keeps the read-only note but now explicitly advertises bundle-level:
  - `move/rotate/scale/copy/delete`
- full grouped `DIMENSION` copy returns:
  - `Copied source group as detached geometry (4 entities)`
- copied `DIMENSION` members are detached:
  - no `groupId`
  - no `sourceType`
  - no `editMode`
  - no `proxyKind`
- grouped `DIMENSION` release returns:
  - `Released source group to editable geometry (4 entities)`
- after release, the former dimension text no longer exposes grouped-source actions or read-only notes and the real property form exposes editable text fields
- grouped `HATCH` delete returns:
  - `Deleted source group (3 entities, including 3 read-only)`
- delete clears the selection and removes all same-layout hatch members

### 4. Insert workflow regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260323_201433/summary.json)

This confirms the grouped-source release/copy/delete slice did not regress the richer imported insert workflow.

### 5. Selection/property regression

`node deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js`

- PASS
- artifact: [summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_selection_summary_smoke/20260323_201433/summary.json)

This confirms the broader selection/property quicklook contract remains stable after the grouped-source property-note and action changes.

### 6. Patch hygiene

`git -C deps/cadgamefusion diff --check`

- PASS

## Conclusion

Step218 is verified.

Grouped non-`INSERT` imported annotation/proxy bundles now have a full operational lifecycle in the editor:

- transform as a bundle
- duplicate as detached native geometry
- delete as a bundle
- release in place to editable geometry

This moves grouped imported sources beyond passive provenance display and beyond the capability level of lighter reference implementations that stop at selection or fit-only affordances.
