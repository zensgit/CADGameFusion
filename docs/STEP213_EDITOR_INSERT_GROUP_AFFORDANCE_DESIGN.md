# STEP213 Editor Insert Group Affordance Design

## Scope

This step upgrades imported insert handling from “operationally correct” to “visually legible”:

- single imported insert selections now surface `group center / group size / group bounds`
- property UI adds `Fit Insert Group`
- command line adds `insfit`
- canvas draws a dashed instance boundary plus center mark for the full logical insert group

This is not new geometry capability. It is a workflow/interaction step that makes the recovered instance model readable and navigable.

## Problem

After Steps 207-212, VemCAD could already:

- expand imported insert groups
- narrow to editable members
- move/rotate/scale/copy/delete the full logical instance
- release the instance into native editable geometry

But there was still a usability gap:

- the editor knew the logical insert group
- the user did not get a clear visual or spatial summary of that instance
- fit/extents was still document-wide, not instance-aware

Benchmark CAD tools often make references feel coherent because users can see and target the reference as one object. VemCAD already had the behavior contract; this step exposes it as an interaction contract.

## Design

### 1. Compute bounds from real entity geometry, not guessed metadata

- `tools/web_viewer/insert_group.js`

This step adds reusable bounds helpers:

- `computeEntityBounds`
- `computeEntitiesBounds`
- `computeInsertGroupBounds`

The design intentionally avoids inventing a fake `insert_point`. The current imported editor contract does not carry a reliable block insertion point, so Step213 uses provable derived facts instead:

- group center
- group size
- group bounds

That keeps the feature honest and deterministic.

### 2. Surface group extents in quicklook and property metadata

- `tools/web_viewer/ui/selection_presenter.js`
- `tools/web_viewer/ui/property_panel.js`

Single imported insert selection now shows:

- `Group Center`
- `Group Size`
- `Group Bounds`

These facts are computed from the full logical group in the same `space / layout`, not from the currently selected fragment only.

### 3. Add instance-fit as a first-class action

- `tools/web_viewer/ui/property_panel.js`
- `tools/web_viewer/ui/workspace.js`

This step adds two entry points:

- property action: `Fit Insert Group`
- command input: `insfit`

Both use the same extents contract and reuse view-fitting logic instead of inventing a separate navigation path.

### 4. Draw the whole logical instance, not just the selected fragment

- `tools/web_viewer/ui/workspace.js`
- `tools/web_viewer/ui/canvas_view.js`

When the primary selection belongs to an imported insert group, the editor now draws:

- dashed rectangle over the full group bounds
- center cross
- lightweight label using block name or group id

This is intentionally derived from the same computed bounds used by quicklook and fit. One contract drives all three surfaces:

- metadata
- navigation
- canvas affordance

### 5. Keep the affordance tied to imported-instance state

The overlay and extra facts disappear after release, because release removes imported insert provenance. That is the correct boundary:

- imported instance:
  - show instance affordance
- released native geometry:
  - stop pretending there is still an imported insert group

## Behavior Contract

- single imported insert member selected:
  - quicklook shows `group center / group size / group bounds`
  - property metadata shows the same facts
  - `Fit Insert Group` action is available
  - canvas shows the full-group boundary overlay
- `insfit` or `Fit Insert Group`:
  - fits the view to the computed insert-group extents
  - updates status text
- after release:
  - insert-group affordance disappears with the rest of imported/group provenance

## Scope Limits

This step still does not introduce:

- a real block insertion point
- refedit grips or reference gizmos
- block hierarchy navigation
- nested insert traversal

## Benchmark Intent

Step213 goes beyond “the command works” and targets “the object feels coherent”:

- benchmark tools benefit from strong object affordance around references
- VemCAD now exposes the recovered imported instance as a spatial object with bounds, center, fit, and overlay

That is stronger than flat fragment editors and still more transparent than opaque reference state, because every visual affordance is backed by explicit computed facts.
