# Step215 Editor Insert Direct Peer Targeting Design

## Goal

Extend Step214 peer navigation from cyclic browsing to direct targeting.

After Step214, imported `INSERT` peers could be reached only by:

- `Previous Peer Instance`
- `Next Peer Instance`
- `inspeer` / `insprev`

That is workable for two peers, but it does not scale. Real drafting workflows often know the exact target layout already.

Step215 adds:

- direct peer-target metadata
- direct property actions per peer
- direct command targeting by ordinal or layout name
- explicit verification that single-select, full-group, and editable-only scopes survive cross-layout peer jumps

## Why This Slice

This is a better benchmark move than adding another local geometry feature because it improves workflow quality around imported block/reference semantics:

- the UI becomes layout-aware instead of just peer-aware
- command-bar usage becomes precise instead of sequential
- instance navigation becomes explainable from the metadata itself

That is closer to how mature 2D CAD tools feel in real DWG sessions.

## Contract

### 1. Peer targets

Single-select imported `INSERT` quicklook and property metadata now add:

- `Peer Targets`

Format:

`1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C`

This preserves the existing `Peer Instance`, `Peer Instances`, and `Peer Layouts` rows, but adds an ordinalized target map that the command bar and property actions can both mirror.

### 2. Direct property actions

For every non-current peer, property actions now expose a direct jump:

- `Open 2: Paper / Layout-B`
- `Open 3: Paper / Layout-C`

These coexist with:

- `Previous Peer Instance`
- `Next Peer Instance`

The cyclic actions remain useful for keyboard-like stepping. The direct actions are for intentional targeting.

### 3. Direct command targeting

`inspeer` now supports:

- no args: next peer
- ordinal: `inspeer 2`
- layout name: `inspeer Layout-C`
- previous alias: `inspeer prev`

`insprev` remains as a short explicit reverse command.

### 4. Scope preservation

Direct peer targeting preserves selection scope across layouts:

- single fragment stays single fragment
- full-group selection stays full-group selection
- editable-only selection stays editable-only selection when the target peer has editable members

This is the real Step215 contract. Direct targeting would be low-value if it collapsed user intent back to a generic single select every time.

### 5. Bounds and overlay reuse

No second rendering contract was introduced.

Direct targeting still reuses:

- peer bounds
- insert-group frame overlay
- camera fit
- space/layout switching

That keeps Step213/214 behavior unified instead of forking “direct” and “cyclic” paths.

## Implementation

### Fixture expansion

`tools/web_viewer/tests/fixtures/editor_insert_group_fixture.json`

The peer matrix is expanded from two layouts to three:

- `Layout-A`
- `Layout-B`
- `Layout-C`

`Layout-C` intentionally has a full mixed group so the browser smoke can verify scope-preserving jumps for:

- single-select
- full-group
- editable-only

### Presenter and property metadata

`tools/web_viewer/ui/selection_presenter.js`

- adds `Peer Targets`

`tools/web_viewer/ui/property_panel.js`

- mirrors `Peer Targets`
- adds direct `Open <peer>` actions

### Workspace command behavior

`tools/web_viewer/ui/workspace.js`

- extends `inspeer` parsing
- supports ordinal and layout-target resolution
- keeps the Step214 selection-scope transfer behavior

## Out Of Scope

Step215 still does not add:

- block tree browsing
- refedit
- peer thumbnails
- cross-layout simultaneous editing
- block definition authoring

This slice stays inside imported-instance navigation and editor session control.
