# Step230: Editor Imported Classic LEADER Association Verification

## Scope

Verify that real imported classic `LEADER + TEXT/MTEXT` notes:

- associate only on the intended positive sample
- remain unassociated on ambiguous or negative samples
- enter the browser source/proxy workflow without synthetic fixtures or editor-side pairing logic

## Commands

From `deps/cadgamefusion`:

```bash
cmake --build build --target cadgf_dxf_importer_plugin test_dxf_paperspace_combo test_dxf_paperspace_insert_leader test_dxf_paperspace_annotation_bundle test_dxf_mleader_metadata -j4
ctest --test-dir build --output-on-failure -R 'test_dxf_(paperspace_combo|paperspace_insert_leader|paperspace_annotation_bundle|mleader_metadata)_run'
node --check tools/web_viewer/scripts/editor_classic_leader_smoke.js
node tools/web_viewer/scripts/editor_classic_leader_smoke.js
git -C . diff --check
```

## Expected Importer Results

### Positive

On [step186_paperspace_combo_sample.dxf](../tests/plugin_data/step186_paperspace_combo_sample.dxf):

- exactly one text entity becomes `source_type=LEADER`
- that text is `THIRD NOTE`
- that text shares a `group_id` with one `LEADER` polyline
- the other nearby classic leader remains a solo `LEADER` proxy group

### Negative

On [step186_paperspace_insert_leader_sample.dxf](../tests/plugin_data/step186_paperspace_insert_leader_sample.dxf):

- zero text entities become `source_type=LEADER`

On [step186_paperspace_annotation_bundle_sample.dxf](../tests/plugin_data/step186_paperspace_annotation_bundle_sample.dxf):

- zero text entities become `source_type=LEADER`

## Browser Smoke

Fixture:

- [editor_classic_leader_fixture.json](../tools/web_viewer/tests/fixtures/editor_classic_leader_fixture.json)

Script:

- [editor_classic_leader_smoke.js](../tools/web_viewer/scripts/editor_classic_leader_smoke.js)

The smoke must prove:

- the real imported note appears as `LEADER / leader / proxy`
- the classic note exposes `select-source-group`, `select-source-anchor-driver`, `fit-source-anchor`, `fit-leader-landing`, `fit-source-group`, `edit-source-text`, `release-source-group`
- direct proxy text edits preserve provenance
- `srcplace` returns the note to its imported placement
- `srcdriver` selects the real imported leader polyline
- `leadfit` produces a valid guide overlay
- `srcgrp` expands to the 2-member imported leader bundle
- `srctext` narrows back to the note text
- `srcedit` releases that real imported note into native editable text

## Recorded Result

Importer tests:

- `test_dxf_paperspace_combo_run`: PASS
- `test_dxf_paperspace_insert_leader_run`: PASS
- `test_dxf_paperspace_annotation_bundle_run`: PASS
- `test_dxf_mleader_metadata_run`: PASS

Browser smoke:

- [summary.json](../build/editor_classic_leader_smoke/20260324_085713/summary.json)

Supporting importer preview artifacts:

- [combo document.json](../build/step230_combo_preview_a/document.json)
- [insert leader document.json](../build/step230_insert_leader_preview_a/document.json)
- [annotation bundle document.json](../build/step230_annotation_bundle_preview_a/document.json)

Worktree hygiene:

- `git diff --check`: PASS
