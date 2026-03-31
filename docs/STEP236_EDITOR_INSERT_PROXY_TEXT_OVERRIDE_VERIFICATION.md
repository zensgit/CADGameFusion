# Step236: Editor INSERT Proxy Text Override Verification

## Commands

From `deps/cadgamefusion`:

```bash
node --check tools/web_viewer/insert_group.js
node --check tools/web_viewer/commands/command_registry.js
node --check tools/web_viewer/ui/property_panel.js
node --check tools/web_viewer/scripts/editor_insert_group_smoke.js
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_insert_group_smoke.js
git diff --check
```

## Expected Contract

- single imported `INSERT` text proxies accept `selection.propertyPatch` with `{ value }`
- the same proxies reject geometry edits such as `position`
- property-panel single-select shows a `Text` field but not `position / height / rotation`
- in-place text override preserves `sourceType=INSERT`, `editMode=proxy`, `proxyKind=text`, `groupId`, and `blockName`
- `Release Insert Group` still detaches the instance and keeps the old post-release text-edit path valid

## Verification Notes

- `node --check tools/web_viewer/insert_group.js`: PASS
- `node --check tools/web_viewer/commands/command_registry.js`: PASS
- `node --check tools/web_viewer/ui/property_panel.js`: PASS
- `node --check tools/web_viewer/scripts/editor_insert_group_smoke.js`: PASS
- `node --test tools/web_viewer/tests/editor_commands.test.js`: PASS (`272/272`)
- `node tools/web_viewer/scripts/editor_insert_group_smoke.js`: PASS
- `git diff --check`: PASS

## Command-Layer Results

The new unit coverage confirms:

- `selection.propertyPatch` updates imported `INSERT` proxy text from `TAG` to `TAG-PROXY-EDITED`
- the same entity keeps `sourceType = INSERT`, `editMode = proxy`, `proxyKind = text`, and `groupId = 500`
- `selection.propertyPatch` with `position` on that proxy returns `UNSUPPORTED_READ_ONLY`
- exported CADGF still carries:
  - `source_type = INSERT`
  - `edit_mode = proxy`
  - `proxy_kind = text`
  - unchanged `text.pos`
  - updated `text.value = TAG-PROXY-EDITED`

## Browser Artifact

The real browser artifact is written to:

- [editor_insert_group_smoke summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_insert_group_smoke/20260324_223214/summary.json)

Key browser assertions to confirm in that artifact:

- `before_proxy_edit.details.items["origin"] == "INSERT / text / proxy"`
- `before_proxy_edit.property.fields["value"] == "TAG-A"`
- `before_proxy_edit.property.fields` does not include `position.x`
- `before_proxy_edit.property.fields` does not include `position.y`
- `before_proxy_edit.property.fields` does not include `height`
- `before_proxy_edit.property.fields` does not include `rotation`
- `before_proxy_edit.property.notes[0]` explains that text value stays editable while instance geometry remains proxy-only
- `after_proxy_edit.entity.value == "TAG-PROXY-EDITED"`
- `after_proxy_edit.entity.sourceType == "INSERT"`
- `after_proxy_edit.entity.editMode == "proxy"`
- `after_proxy_edit.entity.proxyKind == "text"`
- `after_proxy_edit.entity.position == { "x": 12, "y": 11 }`
- `after_proxy_edit.statusText` contains `Text updated`
- later full-group `move / rotate / scale / copy / delete` still operate on the edited proxy text without detaching provenance
- later `after_release_edit.entity.value == "TAG-EDITABLE"` still proves the old release path remains valid

## Notes

This slice is intentionally narrower than the `DIMENSION / LEADER / TABLE` direct proxy edit contract:

- only text value is editable in place
- geometry and instance boundaries remain protected
- real `ATTRIB / ATTDEF` semantics stay as the next importer-driven follow-up, not something guessed by the editor
