# Step234: Legacy DIMENSION Bundle Fallback Verification

## Scope

Verify that the editor restores full imported `DIMENSION` bundle behavior when legacy CADGF payloads omit `source_bundle_id`.

## Commands

```bash
node --test tools/web_viewer/tests/editor_commands.test.js
jq '(.entities[] | select(.source_type=="DIMENSION")) |= del(.source_bundle_id)' \
  tools/web_viewer/tests/fixtures/editor_classic_leader_fixture.json \
  > build/step234_legacy_dimension_bundle_fixture.json
node tools/web_viewer/scripts/editor_classic_leader_smoke.js \
  --fixture /build/step234_legacy_dimension_bundle_fixture.json
git diff --check
```

## Expected signals

### Node contract tests

- `cadgf adapter derives DIMENSION sourceBundleId for split anonymous *D bundles when payload omits it`
- imported legacy `*D1` fragments recover `sourceBundleId = 5`
- `selection.sourceGroup` from arrowhead `26` expands to `[21, 25, 26, 27]`
- CADGF export writes back `source_bundle_id = 5` for the recovered bundle

### Legacy fixture

In [step234_legacy_dimension_bundle_fixture.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step234_legacy_dimension_bundle_fixture.json):

- all imported `DIMENSION` entities have `source_bundle_id = null`
- split arrowheads still keep distinct `group_id` values (`6/7`, `10/11`)
- anonymous `block_name` stays `*D1` / `*D2`

### Browser smoke

In [editor_classic_leader_smoke summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_classic_leader_smoke/20260324_194917/summary.json):

- `ok = true`
- imported dimension text still shows `source-group-members = 9`
- imported arrowhead still shows `source-bundle-id = 5`
- `srctext` still reports `Selected source text (1 of 9 entities)`
- `dimflip` still reports `Applied opposite DIMENSION text side (1 of 9 entities)`
- `srcplace` still reports `Reset source text placement (1 of 9 entities)`

## Result

Pass when legacy payloads without explicit `source_bundle_id` still behave identically to current importer-authored dimension bundles in editor selection, text focus, opposite-side placement, and placement reset workflows.
