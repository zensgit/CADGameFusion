# Step232: Editor Imported DIMENSION Anchor Metadata Verification

## Commands

From `deps/cadgamefusion`:

```bash
node --test tools/web_viewer/tests/editor_commands.test.js
cmake --build build --target cadgf_dxf_importer_plugin convert_cli test_dxf_paperspace_combo -j4
ctest --test-dir build --output-on-failure -R 'test_dxf_paperspace_combo_run'
build/tools/convert_cli --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib --input tests/plugin_data/step186_paperspace_combo_sample.dxf --out build/step232_combo_preview_a --json
node tools/web_viewer/scripts/editor_classic_leader_smoke.js
git diff --check
```

## Expected

- Node contract tests stay green after switching real imported `DIMENSION` guide resolution to explicit-first metadata.
- The combo importer test confirms both imported `DIMENSION` texts emit:
  - `source_anchor`
  - `source_anchor_driver_type = line`
  - `source_anchor_driver_kind = midpoint`
- The regenerated combo preview writes:
  - text `78` -> `source_anchor = [65, 0]`
  - text `58` -> `source_anchor = [235, 0]`
- The real browser smoke proves imported `DIMENSION` text `78` can run:
  - `srcdriver`
  - `srcanchor`
  - `dimflip`
  - `srcplace`
  using importer-authored anchor metadata rather than editor-only fallback inference.

## Recorded result

### Node tests

```text
node --test tools/web_viewer/tests/editor_commands.test.js
262/262 PASS
```

Notable passing coverage:

- explicit imported `DIMENSION` guide metadata resolves preferred anchor/driver
- adapter round-trip preserves explicit `DIMENSION` guide metadata
- move/reset tests still carry `sourceAnchor` forward

### Importer build and C++ verification

```text
cmake --build build --target cadgf_dxf_importer_plugin convert_cli test_dxf_paperspace_combo -j4
ctest --test-dir build --output-on-failure -R 'test_dxf_paperspace_combo_run'
```

Result:

- build passed
- `test_dxf_paperspace_combo_run` passed

### Preview artifact

Artifact:

- [step232 combo document.json](../build/step232_combo_preview_a/document.json)

Verified real imported `DIMENSION` text proxies:

- entity `25`:
  - `source_type = DIMENSION`
  - `source_anchor = [65, 0]`
  - `source_anchor_driver_type = line`
  - `source_anchor_driver_kind = midpoint`
- entity `37`:
  - `source_type = DIMENSION`
  - `source_anchor = [235, 0]`
  - `source_anchor_driver_type = line`
  - `source_anchor_driver_kind = midpoint`

### Browser smoke

Artifact:

- [editor_classic_leader_smoke summary.json](../build/editor_classic_leader_smoke/20260324_111949/summary.json)

Verified in the real browser path:

- imported `DIMENSION` text entity `25` exposes:
  - `Source Anchor = 65, 0`
  - `Source Anchor Driver = 21:line midpoint`
- `srcdriver` selects entity `21`
- `srcanchor` renders overlay anchor `65,0` with driver label `line midpoint`
- `dimflip` moves text from `(65, 152)` to `(65, -152)` while preserving:
  - `sourceTextPos = (65, 152)`
  - `sourceAnchor = (65, 0)`
- `srcplace` restores text back to `(65, 152)`

### Diff hygiene

```text
git diff --check
PASS
```
