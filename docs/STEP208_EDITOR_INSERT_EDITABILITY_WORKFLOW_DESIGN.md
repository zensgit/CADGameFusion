# STEP208 Editor Insert Editability Workflow Design

## Scope

This step closes the next practical gap after Step207's insert-group expansion:

- imported `INSERT` fragments now expose group editability facts
- property metadata and quicklook show `editable members` and `read-only members`
- property panel exposes `Select Editable Members`
- command bar exposes the same narrowing workflow through `insedit`
- multi-select insert groups keep enough block context visible to recover from mixed editable/proxy selections

The goal is not full block editing. The goal is a clear, session-scoped edit boundary for exploded insert groups.

## Problem

After Step207, the editor could do one useful thing with imported insert provenance:

- expand one fragment into its full insert group

That was a real improvement, but it still left a workflow gap:

- imported groups can legitimately contain both editable `fragment/exploded` members and read-only `proxy` members
- selecting the full group is the right inspection action, but not always the right editing action
- once the full mixed group is selected, the user only sees a generic mixed read-only note and has no one-click way to narrow back to the editable subset

That makes the editor weaker than it needs to be. Traditional CAD tools rarely expose exploded insert provenance this explicitly at all; once VemCAD does expose it, the editor should go further and tell the user where the editable boundary actually is.

## Design

### 1. Add a command-layer editable-member selection contract

- `tools/web_viewer/commands/command_registry.js`
  - adds `selection.insertEditableGroup`

Selection rules:

- target entity must still be an imported `INSERT` fragment with a finite `groupId`
- group resolution reuses the same Step207 contract:
  - same `groupId`
  - same `sourceType = INSERT`
  - same active `space / layout`
- resulting selection keeps only editable members
  - `editMode = proxy`
  - unsupported placeholders
  - explicit `readOnly`
  are excluded

So the editor now exposes two legitimate workflows for the same imported insert:

- `selection.insertGroup`
  - inspect the whole logical instance
- `selection.insertEditableGroup`
  - operate only on the members that can actually be edited

### 2. Centralize insert-group member resolution

- `tools/web_viewer/insert_group.js`

This step factors insert-group matching into shared helpers so command/UI logic stop reimplementing:

- `INSERT` source normalization
- same-group lookup
- same-space/layout guard
- editable vs read-only member summary

That keeps Step207 and Step208 aligned instead of letting command and property behavior drift.

### 3. Surface edit boundary facts where the user is looking

- `tools/web_viewer/ui/selection_presenter.js`
- `tools/web_viewer/ui/property_panel.js`

Single-select imported fragments now show:

- `Insert Group Members`
- `Editable Members`
- `Read-only Members`

Property metadata mirrors the same facts.

This matters because the editor no longer tells the user only that an entity came from `INSERT / fragment`; it now also tells the user whether the logical instance is fully editable or only partially editable.

### 4. Keep insert context visible even after group expansion

Step207 intentionally allowed read-only proxy members inside the selected insert group. That behavior stays correct.

Step208 improves the follow-up experience:

- when a mixed insert group is selected, property UI still shows block/group context derived from the primary entity
- the user can immediately narrow that mixed selection to editable members only

So the editor stops dropping the insert workflow context exactly when the selection becomes more complex.

### 5. Property action and command bar share one contract

- property action:
  - `Select Editable Members`
- command line:
  - `insedit`
  - alias: `inserteditable`

Both routes go through `selection.insertEditableGroup`.

That keeps recovery and keyboard workflows aligned with the rest of the editor instead of adding a UI-only shortcut.

## Behavior Contract

- single imported fragment with a mixed insert group:
  - shows `group id`
  - shows `block name`
  - shows `insert group members`
  - shows `editable members`
  - shows `read-only members`
  - exposes both:
    - `Select Insert Group`
    - `Select Editable Members`
- full mixed insert-group selection:
  - continues to show read-only warning
  - still exposes `Select Editable Members`
- editable-only selection:
  - excludes proxy/read-only members
  - remains scoped to the same `space / layout`
- proxy-target recovery:
  - if the primary selected entity is itself a read-only proxy member, `Select Editable Members` still resolves the group and falls back to the first editable member as the new primary

## Scope Limits

This step still does not do the following:

- no block definition editor
- no `REFEDIT`/`BEDIT`
- no block transform wrapper
- no block tree or instance browser
- no explode/unexplode roundtrip workflow

This is deliberately a narrow editor-boundary step, not a pretend full block editor.

## Benchmark Intent

Step208 is stronger than a provenance-only insert workflow:

- benchmark CAD tools typically let users work with a block as one selectable thing, but they do not usually expose the exact editable/proxy split of flattened imported fragments
- VemCAD now does both:
  - preserves logical instance grouping
  - exposes the real edit boundary inside that imported instance

That is a meaningful product-level advantage for exploded-import recovery workflows, especially on mixed paper-space drawings where proxy annotation and editable geometry coexist.
