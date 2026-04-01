# Step214 Editor Insert Peer Navigation Design

## Goal

Make imported `INSERT` instances navigable across peer layouts without losing editor-side provenance, selection intent, or camera context.

This extends the Step213 instance-boundary work. The editor already knew how to:

- identify one imported instance inside the active `space / layout`
- draw its boundary overlay
- fit the camera to that one instance

Step214 adds the missing cross-layout workflow:

- surface peer-instance facts in quicklook and property metadata
- let the user jump to the next/previous peer instance
- switch the active `space / layout` automatically
- preserve single-selection intent when the user started from one fragment
- keep overlay and fit logic on the same group-bounds contract

## Why This Slice

Reference products do not stop at showing imported block provenance. They let the user understand where the same logical reference exists and move to it quickly.

For VemCAD, this is higher ROI than another geometry micro-feature because it advances the DWG/editor workflow itself:

- imported block/reference context becomes explorable instead of static
- layout-scoped editing becomes less blind
- instance provenance remains explainable in the UI

## Contract

### 1. Peer identity

Two imported `INSERT` groups are peers when all of the following hold:

- `sourceType === INSERT`
- same `groupId`
- same `blockName` when the target has one
- different or same `space / layout` contexts are allowed during discovery

Peer summaries are grouped by `space / layout`, then each peer keeps:

- `memberIds`
- `editableIds`
- `readOnlyIds`
- `bounds`

### 2. Single-select facts

When a single imported fragment is selected and more than one peer instance exists, the selection quicklook and property metadata now expose:

- `Peer Instance`
- `Peer Instances`
- `Peer Layouts`

This is intentionally additive. Existing `group id / block name / member counts / bounds` facts stay unchanged.

### 3. Peer navigation actions

Imported `INSERT` selections now expose:

- `Previous Peer Instance`
- `Next Peer Instance`

These actions are available for:

- single imported fragment selection
- full-group selection of the current imported instance

They are not introduced as command-registry geometry commands. They are workspace navigation actions because they mutate editor session state (`space / layout`, selection, camera), not CAD geometry.

### 4. Command-bar parity

The same workflow is available from command input:

- `inspeer`
- `insprev`

### 5. Selection intent preservation

Peer navigation preserves the user’s selection scope:

- if the user started from a single fragment, peer navigation keeps a single matched fragment selected
- if the user started from a full insert-group selection, peer navigation keeps the full peer group selected
- if the user started from editable-only full-group selection, peer navigation keeps the peer editable subset when available

The important Step214 fix is the single-fragment case for singleton peers. A one-member peer is both a single selection and a full group, but Step214 deliberately prioritizes single-selection intent so navigation does not unexpectedly expand selection on the return hop.

### 6. Layout/session behavior

Peer navigation:

- switches current `space / layout`
- applies the peer selection in that context
- fits the camera to the peer bounds
- refreshes the existing insert-group overlay through the same bounds contract

No extra overlay-specific geometry path was added.

## Implementation Notes

### Shared peer summary

`tools/web_viewer/insert_group.js` now provides peer-instance summarization across layouts and a best-effort member matcher for mapping one selected fragment to its peer counterpart.

### UI surfaces

`tools/web_viewer/ui/selection_presenter.js`

- adds peer facts to the single-select detail contract

`tools/web_viewer/ui/property_panel.js`

- mirrors the same peer facts into read-only metadata
- adds previous/next peer actions

### Workspace navigation

`tools/web_viewer/ui/workspace.js`

- adds `inspeer` / `insprev`
- centralizes peer switching, selection mapping, status text, and camera fit

### Browser contract

`tools/web_viewer/scripts/editor_insert_group_smoke.js`

- verifies peer facts in `Layout-A`
- jumps to `Layout-B`
- checks the new peer bounds and overlay
- uses `insprev` to come back
- then continues through the existing fit/select/edit/release workflow to prove Step214 did not regress Step212/213

## Out Of Scope

Step214 does not add:

- block definition editing
- refedit/in-place block editing
- instance-tree explorer UI
- block insertion authoring

Those are later slices. Step214 only makes imported instance peers visible and navigable.
