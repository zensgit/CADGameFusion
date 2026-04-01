# Step248: Editor Released Insert Text Scope Peer Navigation Verification

## Scope

Verify that released insert text preserves text-only scope across peer instances and layouts when peer matching is resolved from archived member `name`.

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
- `289/289 PASS`
- confirmed coverage:
  - archived-name resolution for released peer selection
  - fallback to the narrowest surviving peer fragment when the exact peer text is missing
  - released text-only scope preservation across peer instances
  - plain-text release semantics remain intact

### 2. Browser smoke coverage

`node tools/web_viewer/scripts/editor_insert_group_smoke.js`

- PASS
- artifact: `build/editor_insert_group_smoke/20260325_215019/summary.json`
- confirmed coverage:
  - the `DoorNotes` release path produces detached released text `[21,22]` with archived peer actions
  - command `relinspeer Layout-C` maps released `[21,22]` to live peer text `[27,28]`
  - property action `open-released-insert-peer-2` maps the same released scope to live peer text `[24,25]`
  - text-only scope remains intact while navigating across surviving peer layouts
  - earlier Step247 released-peer paths for `DoorTag` still pass in the same smoke run

### 3. Patch hygiene

`git diff --check`

- PASS
- clean

## Conclusion

Step248 is verified when the released text peer path is covered in the browser smoke, the archived-name matcher routes to the correct live peer text, and the repo stays clean under `git diff --check`.
