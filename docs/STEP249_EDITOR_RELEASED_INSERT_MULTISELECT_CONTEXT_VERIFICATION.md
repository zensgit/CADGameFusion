# Step249: Editor Released Insert Multi-Select Context Verification

## Scope

Verify that detached multi-select released insert text now exposes shared archived context in both quicklook and property metadata, while keeping the Step248 peer-navigation behavior intact.

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
- `290/290 PASS`
- confirmed coverage:
  - selection presentation exposes common archived insert context for released multi-text selection
  - shared facts include `released-from / released-group-id / released-block-name / released-selection-members / released-peer-instance / released-peer-targets`
  - Step248 released peer navigation behavior still passes

### 2. Browser smoke coverage

`node tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: `build/editor_insert_group_smoke/20260325_215936/summary.json`
- confirmed coverage:
  - released `DoorNotes` selection `[21,22]` now shows quicklook items:
    - `released-from = INSERT / text / proxy`
    - `released-group-id = 700`
    - `released-block-name = DoorNotes`
    - `released-selection-members = 2`
    - `released-peer-instance = 1 / 3`
    - `released-peer-targets = 1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C`
  - property metadata exposes the same shared released facts
  - the same released selection still routes to live peer text `[27,28]` through `relinspeer Layout-C`
  - the same released selection still routes to live peer text `[24,25]` through property action `Open ...`

### 3. Patch hygiene

`git diff --check`

- PASS
- clean

## Conclusion

Step249 is verified when released multi-select insert text exposes shared archived context in both quicklook and property metadata, and the existing released peer-navigation flow continues to pass in the real browser.
