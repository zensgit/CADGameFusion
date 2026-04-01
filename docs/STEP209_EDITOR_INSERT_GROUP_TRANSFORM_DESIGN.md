# STEP209 Editor Insert Group Transform Design

## Scope

This step upgrades imported `INSERT` groups from selection-only recovery to instance-level transform behavior:

- full insert-group `move` keeps read-only proxy members aligned with editable fragments
- full insert-group `rotate` does the same
- property UI explains the boundary precisely:
  - property edits still skip proxy members
  - full-group `move/rotate` keep them with the instance

The scope is intentionally narrow. This is not block-definition editing and not a general relaxation of read-only proxy protections.

## Problem

After Step208, the editor had two valid imported-insert workflows:

- `Select Insert Group`
- `Select Editable Members`

But the highest-value mismatch with benchmark CAD behavior still remained:

- the full insert group could be selected
- proxy members stayed visible inside that group
- yet standard `selection.move` / `selection.rotate` still skipped those proxy members

That meant a user could select what looked like one logical imported instance, move or rotate it, and still leave some insert-derived proxy fragments behind.

For DWG-style editing, that is the wrong default. If the user explicitly selected the full logical insert group, instance-level transforms should behave like an instance-level operation.

## Design

### 1. Keep the existing read-only contract everywhere else

This step does **not** make proxy members generally editable.

The following remain unchanged:

- `propertyPatch`
- `copy`
- `delete`
- `offset`
- arbitrary mixed selections that happen to contain proxy members

So Step209 does not weaken the safety rule that derived proxy geometry is read-only for normal editing.

### 2. Add a narrow whole-instance transform allowance

- `tools/web_viewer/commands/command_registry.js`

`selection.move` and `selection.rotate` now detect one special case:

- the current selection exactly matches the full imported insert group
- that group is resolved from the current primary selection
- the group stays scoped to the same `space / layout`
- the read-only members are transform-safe insert proxies

Only in that case do transforms include those proxy members.

This is the important boundary:

- full insert-group selection:
  - treat `move/rotate` as instance-level transforms
- anything narrower:
  - keep the old read-only skip behavior

So `Select Editable Members` still means what it says: the user is choosing to operate only on the editable subset.

### 3. Keep the rule safe by limiting it to transform-safe proxy types

The allowance is limited to imported `INSERT` proxy members whose entity types already have stable geometric transform support:

- `line`
- `polyline`
- `circle`
- `arc`
- `text`

Unsupported placeholders stay read-only and non-transformable. That avoids silently pretending unsupported proxy geometry has a stable transform path when it does not.

### 4. Surface the behavior in property UI

- `tools/web_viewer/ui/property_panel.js`

When the current selection is a full mixed insert group, the note now says:

- property edits still skip read-only proxy members
- `move/rotate` keep them with the full insert group

This matters because the editor no longer tells the user only “some members are read-only.” It tells the user exactly which workflows still operate at whole-instance level.

## Behavior Contract

- full imported insert-group selection:
  - `move` transforms editable members and transform-safe proxy members together
  - `rotate` transforms editable members and transform-safe proxy members together
- editable-only insert selection:
  - `move/rotate` affect only the selected editable subset
- general proxy selection:
  - unchanged read-only behavior
- property panel:
  - mixed full-group selection shows a note clarifying:
    - property edits skip proxies
    - full-group `move/rotate` keep them with the instance

## Scope Limits

This step still does not do the following:

- no `REFEDIT` / `BEDIT`
- no block transform gizmo
- no insert scaling workflow
- no grouped copy/delete semantics
- no generalized proxy transform for non-`INSERT` sources

This is a specific imported-instance transform step, not a blanket editability change.

## Benchmark Intent

Step209 closes a more important CAD-behavior gap than another metadata field would:

- benchmark CAD tools expect one block reference to move/rotate as one object
- VemCAD still uses exploded imported fragments, but now recovers that instance-level transform behavior when the user explicitly selects the full logical insert group

That is stronger than flat-fragment editors and still more transparent than classic CAD, because the editable/proxy boundary remains visible instead of hidden.
