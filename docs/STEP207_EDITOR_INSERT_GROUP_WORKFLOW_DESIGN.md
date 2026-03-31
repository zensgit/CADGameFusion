# STEP207 Editor Insert Group Workflow Design

## Scope

This step turns imported `INSERT` fragment provenance into a real editor workflow on top of Step206's current `space / layout` session contract:

- single-select editor UI now exposes `group id` and `block name` as first-class facts
- property metadata shows `Insert Group Members`
- imported `INSERT` fragments expose a `Select Insert Group` action
- command line exposes the same workflow through `insgrp`
- insert-group expansion stays scoped to the current fragment's `space / layout`

The intended behavior is closer to benchmark CAD editing than a passive provenance-only UI.

## Problem

Before this step:

- imported fragments already surfaced `Origin = INSERT / fragment`
- property metadata already showed `Block Name`
- the editor preserved `groupId / blockName / space / layout` in entity state

But the workflow still stopped at inspection:

- there was no editor command to expand one fragment into its full insert group
- property panel could not act on insert provenance
- group-aware selection behavior available in preview did not exist in editor
- multi-layout drawings had no guard against accidentally treating similarly tagged fragments in another layout as the same editing target

So the editor knew an entity came from an insert, but could not do anything useful with that fact.

## Design

### 1. Add a command-layer insert-group selection contract

- `tools/web_viewer/commands/command_registry.js`
  - adds `selection.insertGroup`

Selection rules:

- target entity must have:
  - `sourceType = INSERT`
  - finite `groupId`
- group expansion selects entities that match:
  - same `groupId`
  - same `sourceType = INSERT`
  - same `space / layout`

The same-space/layout rule is deliberate. Step206 already made `space / layout` a real editor session boundary, so insert-group selection must respect that boundary rather than reintroducing cross-layout ambiguity.

### 2. Keep read-only proxy members visible inside the group

`selection.insertGroup` does not strip or skip read-only proxy members when selecting the group.

That is the correct tradeoff for imported insert fragments:

- `fragment / exploded` members can still be edited
- `proxy` members stay selected for inspection/context
- existing mixed-selection protections already prevent invalid edits on proxy members

This matches the user's mental model better than silently dropping part of the insert from the selection.

### 3. Surface insert provenance where users actually work

- `tools/web_viewer/ui/selection_presenter.js`
  - single-select details now show:
    - `Group ID`
    - `Block Name`
- `tools/web_viewer/ui/property_panel.js`
  - metadata now shows:
    - `Group ID`
    - `Block Name`
    - `Insert Group Members`
  - action row now adds:
    - `Select Insert Group`

The important design point is that insert provenance is no longer buried in a single text line like `INSERT / fragment`. The user can now see both the instance identity and the expansion affordance directly in the editor.

### 4. Reuse the same workflow from the command line

- `tools/web_viewer/ui/workspace.js`
  - adds `insgrp`
  - alias: `insertgroup`

This keeps the contract consistent with the rest of the editor:

- property action for discovery
- command line for repeatable keyboard-driven workflow

Both routes resolve through the same `selection.insertGroup` command instead of duplicating selection logic in the UI.

### 5. Build on Step206 instead of bypassing it

This step intentionally reuses the current-session contract already present in:

- `tools/web_viewer/space_layout.js`
- `tools/web_viewer/state/documentState.js`

That matters because the insert group workflow should respect the active paper/model session and layout scoping, not treat the drawing as a flat global entity list.

## Behavior Contract

- single imported fragment:
  - shows `group id`
  - shows `block name`
  - shows `insert group members`
  - exposes `Select Insert Group` when sibling members exist
- property action:
  - expands selection to all matching insert members in the same `space / layout`
- command line:
  - `insgrp` performs the same expansion
- mixed groups:
  - may include read-only proxy members in the resulting selection
  - later property edits continue to skip those members safely
- cross-layout safety:
  - same `groupId` in another layout must not be pulled into the current insert-group selection

## Scope Limits

This step intentionally does not do the following:

- no block definition editor
- no insert transform / refedit / bedit workflow
- no explode command
- no group-local move/copy wrappers beyond normal selection semantics
- no block tree or instance browser panel

So Step207 closes the highest-value insert fragment gap without pretending the editor already has full block editing parity.

## Benchmark Intent

Step207 improves the editor in a benchmark-relevant way:

- closer to AutoCAD/BricsCAD insert-fragment inspection and recovery workflows
- stronger than provenance-only viewers because editor selection can now expand into the actual insert fragment set
- cleaner than ad hoc group picking because the command is explicitly layout-scoped

The key improvement is that imported insert provenance now drives an editing workflow, not just a label.
