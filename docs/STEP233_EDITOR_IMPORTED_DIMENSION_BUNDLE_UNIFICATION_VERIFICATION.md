# Step233: Imported DIMENSION Bundle Unification Verification

## Scope

Verify that real imported `DIMENSION` bundles use preview/editor `source_bundle_id` to unify split arrowhead fragments with the dimension text/body in editor workflows.

## Commands

```bash
node --test tools/web_viewer/tests/editor_commands.test.js
cmake --build build --target cadgf_dxf_importer_plugin convert_cli test_dxf_paperspace_combo test_dxf_paperspace_insert_dimension -j4
ctest --test-dir build --output-on-failure -R 'test_dxf_(paperspace_combo|paperspace_insert_dimension)_run'
./build/tools/convert_cli --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib --input ./tests/plugin_data/step186_paperspace_combo_sample.dxf --out ./build/step233_combo_preview_b
./build/tools/convert_cli --plugin ./build/plugins/libcadgf_dxf_importer_plugin.dylib --input ./tests/plugin_data/step186_paperspace_insert_dimension_sample.dxf --out ./build/step233_insert_dimension_preview_b
node tools/web_viewer/scripts/editor_classic_leader_smoke.js
git diff --check
```

## Expected signals

### Node contract tests

- `selection.sourceGroup uses sourceBundleId to include split imported DIMENSION fragments`
- `selection presentation uses sourceBundleId for split imported DIMENSION bundle facts`
- `resolveSourceTextGuide resolves DIMENSION anchor from split bundle arrowhead selection when sourceBundleId is present`
- `cadgf adapter imports and exports DIMENSION source bundle metadata`

### Importer tests

`paperspace_combo`:

- dimension text `"78"` and `"58"` each establish a bundle id
- each bundle has `9` members
- each bundle has `2` split members where `group_id != source_bundle_id`

`paperspace_insert_dimension`:

- imported dimension bundle has `9` members
- `2` split arrowhead members carry the same `source_bundle_id`

### Preview artifacts

In [step233_combo_preview_b/document.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step233_combo_preview_b/document.json):

- text `25` keeps `group_id=5` and carries `source_bundle_id=5`
- arrowheads `26` and `27` keep `group_id=6/7` and also carry `source_bundle_id=5`
- second dimension text `37` and arrowheads `38/39` behave the same for bundle `9`

In [step233_insert_dimension_preview_b/document.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/step233_insert_dimension_preview_b/document.json):

- text/body members and split arrowhead members share one `source_bundle_id`

### Browser smoke

In [editor_classic_leader_smoke summary.json](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/build/editor_classic_leader_smoke):

- imported dimension text shows `source-group-members = 9`
- imported arrowhead shows `source-bundle-id = 5`
- `srctext` from the arrowhead selects text `25`
- `dimflip` reports `Applied opposite DIMENSION text side (1 of 9 entities)`
- `srcplace` reports `Reset source text placement (1 of 9 entities)`

## Result

Pass when importer, adapter, quicklook/property, and real browser interaction all agree on full imported dimension bundle membership, including split arrowheads.
