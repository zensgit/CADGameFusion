# STEP212 Editor Insert Group Copy Delete Design

## Scope

This step extends imported-instance behavior beyond transform-only workflows:

- full imported insert-group `copy` now creates a detached native clone of the whole instance
- full imported insert-group `delete` now removes the whole instance, including read-only proxy members
- the mixed insert-group note now explains that full-group `move/rotate/scale/copy/delete` are all instance-level

This step does not introduce a new block-reference object model. It closes the remaining operation gap for the existing imported exploded-instance workflow.

## Problem

After Steps 209-211, VemCAD had already recovered a lot of instance-level behavior:

- full-group `move`
- full-group `rotate`
- full-group `scale`
- explicit `Release Insert Group`

But two high-value benchmark operations were still inconsistent:

- `copy` still skipped read-only proxy members
- `delete` still left proxy fragments behind unless the user manually released first

That is weaker than expected DWG-style block-reference behavior. If the editor already recognizes the full logical insert instance, the core instance-level operations should stay coherent.

## Design

### 1. Keep the narrow full-group boundary

- `tools/web_viewer/commands/command_registry.js`

This step reuses the same whole-insert-group detection already used for transform commands:

- current selection must exactly match the full insert group
- group resolution remains scoped to the current `space / layout`
- partial selections keep the existing behavior

So the rule stays explicit:

- full-group selection:
  - `copy/delete` operate on the whole imported instance
- partial selection:
  - existing editable-only / read-only skip behavior stays in place

### 2. Make `copy` create detached geometry

`selection.copy` for a full imported insert group now:

- duplicates all releasable members, including former proxy members
- strips imported insert provenance from the copies
- selects the copied clone

That means the new copy is a native detached geometry set, not a second imported shadow instance.

This is intentionally more transparent than classic CAD block-reference copy. VemCAD does not pretend it recreated a real block reference; it creates a clean editable clone.

### 3. Make `delete` remove the full instance

`selection.delete` for a full imported insert group now removes:

- editable fragments
- read-only proxy members

That fixes the old mismatch where a visually complete imported instance could still leave read-only fragments behind after delete.

### 4. Keep `copy` conservative for unsupported placeholders

Copy remains conservative:

- if the full imported group contains unsupported placeholder members, full-group copy fails with `UNSUPPORTED_INSERT_MEMBER`

This is deliberate. A silent partial copy would be harder to reason about than an explicit refusal.

Delete does not need the same restriction, because removing the whole imported instance is still semantically clear even when some members are unsupported placeholders.

### 5. Keep the user-facing boundary explicit

- `tools/web_viewer/ui/property_panel.js`

The read-only note for a full mixed insert group now states that:

- property edits still skip proxies
- full-group `move/rotate/scale/copy/delete` stay instance-level
- `Release Insert Group` is still the path to fully native editable geometry

That matters because Step212 widens whole-instance behavior without hiding the underlying proxy/editable boundary.

## Behavior Contract

- exact full imported insert-group selection:
  - `copy` duplicates the full instance as detached geometry
  - `delete` removes the full instance including proxy members
- copied detached clone:
  - no `sourceType / editMode / proxyKind / groupId / blockName`
- partial imported selection:
  - unchanged copy/delete behavior
- unsupported members:
  - full-group `copy` returns `UNSUPPORTED_INSERT_MEMBER`
  - full-group `delete` still removes the instance

## Scope Limits

This step still does not add:

- true block-reference duplication
- grouped paste/reference ids
- block-definition authoring
- release of unsupported placeholder members into native editable entities

## Benchmark Intent

This step closes one of the last obvious operation mismatches with reference-style CAD behavior:

- if a user can already select and transform one logical imported instance as one thing, copy/delete must also behave as one thing

VemCAD now does that, while still being more explicit than benchmark CAD:

- copy produces a detached native clone
- release remains a separate, visible workflow
- the imported/proxy boundary is never hidden behind magical reference state
