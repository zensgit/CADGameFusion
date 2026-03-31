# Step290 Property Panel Branch Helper Design

## Goal

Reduce the remaining duplicated branch rendering inside [property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js) without expanding the presenter contract.

This cut intentionally keeps the Step289 boundary:

- [selection_presenter.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/selection_presenter.js) still owns note policy through `buildPropertyPanelNotePlan(...)`
- [property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js) still owns branch sequencing, DOM creation, and action wiring

## Problem

After Step289, note wording already came from presenter-side builders, but [property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js) still repeated the same branch-local rendering sequence in three places:

- render metadata
- render layer or group context
- append source/insert actions
- optionally append released-selection info or released actions

The logic was not conceptually separate enough to justify another presenter-side context object, but it was still duplicated enough to make future edits risky.

## Design

### 1. Keep note and branch facts where they already belong

Do not introduce a new shared `branch plan` contract.

[property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js) continues to derive:

- `readOnlyCount`
- `lockedCount`
- `sourceGroupSummary`
- `insertGroupSummary`
- `releasedInsertArchiveSelection`

and continues to consume:

- `buildSelectionActionContext(...)`
- `buildPropertyPanelNotePlan(...)`

### 2. Extract one local branch helper

Add a local `appendBranchContext(...)` helper inside `render()` in [property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js).

That helper centralizes the repeated DOM-side work:

- single-selection metadata plus layer actions
- multi-selection insert/source group info
- optional released-selection info
- shared source/insert action rows
- optional released-archive actions

The helper accepts only local rendering switches:

- `showReleasedSelectionInfo`
- `showReleasedActions`
- `preferSourceGroupFallback`

### 3. Preserve branch ordering exactly

The render flow remains:

1. read-only branch
2. released note
3. locked-layer branch
4. default editable branch

Step290 does not change early returns or editing escape hatches. It only removes repeated rendering code from those branches.

## Files

- [property_panel.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/ui/property_panel.js)

## Why This Is The Right Cut

This keeps the architecture disciplined:

- presenter owns facts and note policy
- property panel owns control flow and DOM rendering

That is a cleaner boundary than introducing a third shared context object just to move a few remaining booleans around.
