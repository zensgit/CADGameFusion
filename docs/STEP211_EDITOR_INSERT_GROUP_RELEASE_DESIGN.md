# STEP211 Editor Insert Group Release Design

## Scope

This step adds an explicit escape hatch from imported-instance recovery mode into native editing mode:

- imported `INSERT` groups now expose `Release Insert Group`
- command line exposes the same workflow through `insrel`
- release clears imported insert provenance and group/proxy metadata from the whole instance
- former read-only proxy members become directly editable native geometry

This is not block-definition editing. It is a deliberate one-way release from imported exploded-instance semantics into editor-native entity semantics.

## Problem

After Steps 207-210, VemCAD could already:

- identify an imported insert instance
- expand it to the full group
- narrow it to editable members
- move, rotate, and scale the full instance while keeping transform-safe proxy members aligned

That was already stronger than flat fragment editors, but one benchmark gap remained:

- the user could inspect the full logical instance
- the user could transform the full logical instance
- but the user still could not turn that mixed imported instance into fully editable native geometry

Classic CAD tools usually solve that with some combination of `EXPLODE`, `REFEDIT`, or block editing. VemCAD already imports exploded fragments, so the missing capability here is not another explode. The missing capability is a clear, explicit release from imported-instance provenance.

## Design

### 1. Add a narrow release command, not a broad read-only exemption

- `tools/web_viewer/commands/command_registry.js`

This step adds:

- `selection.insertReleaseGroup`

The command resolves the same session-scoped insert group used by:

- `selection.insertGroup`
- `selection.insertEditableGroup`
- full-group `move/rotate/scale`

So release works only when the target still belongs to a real imported insert group in the active `space / layout`.

This keeps the contract clean:

- before release:
  - imported group semantics stay visible
- after release:
  - the same entities are no longer treated as imported insert members

### 2. Release in place

Release does not create duplicate geometry. It updates the existing entities in place and keeps their ids stable.

That matters because:

- current selection/history remain meaningful
- later property edits keep referencing the same entities
- browser smoke can prove the former proxy member became editable without a selection remap guess

### 3. Clear import/group metadata, preserve drawing facts

Release removes imported-instance identity:

- `groupId`
- `sourceType`
- `editMode`
- `proxyKind`
- `blockName`

Release preserves real drawing facts:

- geometry
- layer
- `space / layout`
- visibility
- explicit or `BYLAYER` style fields that still make sense after release

The important distinction is:

- imported provenance is removed
- drawing state is preserved

### 4. Normalize `BYBLOCK` during release

Release also fixes one semantic edge case that would otherwise leak invalid block-local style state into native geometry:

- `colorSource = BYBLOCK` is promoted to explicit `TRUECOLOR` using the currently visible effective color
- `lineType = BYBLOCK` is promoted to `CONTINUOUS`

Without this, released entities could still carry block-dependent style semantics after the block context had been removed.

### 5. Keep release conservative

This step only releases insert groups whose members are already supported native editor entity types:

- `line`
- `polyline`
- `circle`
- `arc`
- `text`

If a group contains unsupported placeholders, release fails with a stable error instead of partially converting the instance and leaving the user with ambiguous state.

### 6. Surface release in property UI and command input

- `tools/web_viewer/ui/property_panel.js`
- `tools/web_viewer/ui/workspace.js`

Single imported insert fragments now expose:

- `Select Insert Group`
- `Select Editable Members`
- `Release Insert Group`

This matters because release is not just a backend capability. It is the transition from imported recovery workflow into ordinary editing workflow, so it must be visible where users already inspect block/group facts.

## Behavior Contract

- selecting one imported insert member and invoking release:
  - releases the whole insert group in the same `space / layout`
  - keeps the affected entity ids stable
  - selects the released group
- after release:
  - group/proxy/imported origin facts disappear
  - former proxy members are editable through normal property edits
- unsupported insert members:
  - block release and surface `UNSUPPORTED_INSERT_MEMBER`
- locked layers:
  - block release with `LAYER_LOCKED`

## Scope Limits

This step still does not introduce:

- block-definition editing
- refedit/bedit
- reverse re-grouping back into an imported insert instance
- release for unsupported placeholder members
- block-local attribute semantics

## Benchmark Intent

This step is deliberately more transparent than classic CAD:

- benchmark tools often hide the transition between reference-level behavior and editable exploded geometry behind separate commands and implicit state
- VemCAD keeps the imported/proxy boundary visible, then offers an explicit `Release Insert Group` to convert the whole instance into normal editable geometry

That is a stronger workflow than “everything is always exploded but some pieces stay mysteriously read-only,” and it is easier to reason about than opaque reference editing modes.
