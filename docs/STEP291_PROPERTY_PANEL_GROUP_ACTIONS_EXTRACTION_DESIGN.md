# Step291 Property Panel Group Actions Extraction Design

## Goal

Extract the property-panel group action assembly into a dedicated module so [property_panel.js](../tools/web_viewer/ui/property_panel.js) stops owning the full source-group, insert-group, and released-insert action-label matrix inline.

This cut keeps the current architecture boundary:

- presenter still owns selection facts and note policy
- property panel still owns DOM wiring via `addActionRow(...)`
- the new module owns only action descriptor assembly

## Problem

Before this step, [property_panel.js](../tools/web_viewer/ui/property_panel.js) still embedded three long action builders:

- `appendSourceGroupActions(...)`
- `appendInsertGroupActions(...)`
- `appendReleasedInsertArchiveActions(...)`

Each one mixed together:

- selection-contract consumption
- button label decisions
- callback dispatch
- failure-status wording

That made the file large and made action-label regressions harder to isolate.

## Design

### 1. Add a dedicated group-actions module

Create [property_panel_group_actions.js](../tools/web_viewer/ui/property_panel_group_actions.js) with pure builders:

- `buildSourceGroupActions(...)`
- `buildInsertGroupActions(...)`
- `buildReleasedInsertArchiveActions(...)`

Each builder:

- accepts the selected entity
- accepts the already-derived `actionContext`
- accepts a dependency object containing callbacks like `selectSourceGroup`, `openInsertPeer`, `fitReleasedInsertGroup`, and `setStatus`
- returns plain action descriptors with `id`, `label`, and `onClick`

### 2. Keep DOM rendering in property_panel

[property_panel.js](../tools/web_viewer/ui/property_panel.js) still owns:

- `addActionRow(...)`
- when each action section is shown
- branch sequencing with read-only / released / locked / default rendering

The only change is that the three `append*Actions(...)` wrappers now delegate action list construction to the new module.

### 3. Preserve button-label and failure-message contracts

This step intentionally preserves the exact labels and failure messages already exercised by smoke:

- source-group actions such as `Select Source Group (...)`, `Release & Edit Source Text (...)`, `Release Source Group (...)`
- insert-group peer and editable-text actions
- released-insert peer navigation and group actions

## Files

- [property_panel_group_actions.js](../tools/web_viewer/ui/property_panel_group_actions.js)
- [property_panel.js](../tools/web_viewer/ui/property_panel.js)
- [property_panel_group_actions.test.js](../tools/web_viewer/tests/property_panel_group_actions.test.js)

## Why This Is The Right Cut

This is the first real `actions` module cut and it is low-risk:

- no presenter contract changes
- no DOM behavior changes
- action labels become testable in isolation

It also makes the next cuts clearer: layer actions and edit fields can now be split with the same pattern.
