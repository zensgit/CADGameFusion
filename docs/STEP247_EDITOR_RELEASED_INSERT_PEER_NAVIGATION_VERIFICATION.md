# Step247: Editor Released Insert Peer Navigation Verification

## Scope

Verify that released insert peer navigation works across surviving peer layouts while preserving:

- plain-text release semantics
- archive-driven peer discovery
- layout switching and camera fit
- property-panel and command-bar parity
- the existing insert-group smoke workflow

## Commands

From `deps/cadgamefusion`:

```bash
node --test tools/web_viewer/tests/editor_commands.test.js
node tools/web_viewer/scripts/editor_insert_group_smoke.js
git diff --check
```

## Results

### 1. Node contract tests

`node --test tools/web_viewer/tests/editor_commands.test.js`

- PASS
- `288/288 PASS`

Notes:

- added helper coverage for archive-driven released peer matching by archived `name`
- added fallback coverage for layouts where the peer text no longer exists and navigation must land on the surviving fragment

### 2. Browser smoke coverage

`node tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: `build/editor_insert_group_smoke/20260325_214155/summary.json`

Notes:

- confirmed released single-selection details/property expose `released-peer-instance = Archived / 2`, `released-peer-instances = 2`, `released-peer-layouts`, and `released-peer-targets`
- confirmed property actions include `open-released-insert-peer-1`, `open-released-insert-peer-2`, `previous-released-insert-peer`, and `next-released-insert-peer`
- confirmed `relinspeer Layout-B` falls back to the surviving fragment in `Layout-B`
- confirmed direct released-peer action opens the matching `INSERT` text peer in `Layout-C`
- confirmed released peer navigation switches layout, updates selection, and fits the target peer bounds without regressing the existing insert-group release workflow
- confirm the existing insert-group release workflow still passes after the peer-navigation additions

### 3. Patch hygiene

`git diff --check`

- PASS
- clean

## Conclusion

Step247 is verified when the released peer path is covered end-to-end in the smoke test and the editor command contract remains clean.
