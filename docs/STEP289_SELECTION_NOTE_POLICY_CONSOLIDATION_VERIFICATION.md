# Step289 Selection Note Policy Consolidation Verification

## Scope

Verify that:

- read-only, released, and locked-layer property-panel notes now come from presenter-side shared builders
- exact note wording stays stable for brittle smoke contracts
- Step287 and Step288 shared metadata/action context behavior remains green

## Static Checks

Passed:

```bash
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/selection_presenter.js
node --check /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js
```

## Unit Tests

Passed:

```bash
node --test /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tests/editor_commands.test.js
```

Results:

- `editor_commands.test.js`: `297/297` pass

Coverage confirmed:

- detached INSERT ATTDEF text still shows the same read-only note wording
- full source-group selections still show the same read-only note wording
- released ATTDEF archive note still contains `archived ATTDEF provenance remains visible as read-only context`
- locked-layer note still contains `locked layer 2:REDLINE`

## Browser Smoke

Passed:

```bash
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_selection_summary_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_source_group_smoke.js
node /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_insert_attribute_smoke.js
bash /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/scripts/editor_ui_flow_smoke.sh --mode observe --outdir /tmp/editor-ui-flow-step289
```

Artifacts:

- [editor_selection_summary summary.json](../build/editor_selection_summary_smoke/20260329_005600/summary.json)
- [editor_source_group summary.json](../build/editor_source_group_smoke/20260329_005600/summary.json)
- [editor_insert_attribute summary.json](../build/editor_insert_attribute_smoke/20260329_005600/summary.json)
- editor_ui_flow summary.json: `/tmp/editor-ui-flow-step289/summary.json`

Confirmed:

- selection-summary locked-layer note contract remains stable
- source-group flows still preserve their existing note/branch behavior
- detached ATTDEF release flows still preserve archived provenance messaging
- broader editor UI flow stays green after presenter-side note consolidation

## Sanity

Passed:

```bash
git -C /Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion diff --check
```
