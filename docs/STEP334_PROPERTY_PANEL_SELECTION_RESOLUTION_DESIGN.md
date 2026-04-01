# Step334 Property Panel Selection Resolution Design

## Goal

Extract selection normalization and entity lookup from `property_panel_selection_context.js` into a dedicated helper, without changing presentation building or the resolved context contract.

## Why This Step

After Step333:

- the render stack is already a thin, layered pipeline
- the next meaningful seam is `property_panel_selection_context.js`

That file still mixes:

- selection id normalization
- primary id normalization
- entity lookup through `documentState`
- context classification
- presentation assembly

The narrowest safe next split is to separate lookup/normalization from context shaping.

## Problem

`resolvePropertyPanelSelectionContext(selectionState, documentState)` currently does all of the following inline:

- normalize `selectionIds`
- normalize `primaryId`
- build lookup closures for layers/entities
- resolve selected entities
- resolve primary entity fallback
- classify `empty` / `missing` / `active`
- build selection presentation

This makes the lookup portion hard to test independently from the context contract.

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_selection_resolution.js`

Export one helper:

- `buildPropertyPanelSelectionResolution(selectionState, documentState)`

It should return a normalized object containing:

- `selectionIds`
- `primaryId`
- `entities`
- `primary`
- `getLayer`
- `listEntities`

Behavior:

- `selectionIds` is the filtered numeric selection list
- `primaryId` is numeric or `null`
- `entities` resolves only existing entities from `documentState`
- `primary` resolves `documentState.getEntity(primaryId)` or falls back to `entities[0]` or `null`
- `getLayer` and `listEntities` preserve current fallback behavior when `documentState` is absent

`property_panel_selection_context.js` should then:

1. call `buildPropertyPanelSelectionResolution(...)`
2. build presentation via `buildSelectionPresentation(...)`
3. return the same `empty` / `missing` / `active` contract as today

## Boundaries

This step must not change:

- `resolvePropertyPanelSelectionContext(...)` export contract
- `buildSelectionPresentation(...)` behavior
- context kinds: `empty`, `missing`, `active`
- primary fallback semantics
- returned `selectionIds`, `entities`, `primary`, `presentation`

## Test Plan

Add:

- `tools/web_viewer/tests/property_panel_selection_resolution.test.js`

Cover:

- selection id normalization
- primary id normalization
- missing entities are filtered out
- primary falls back to first resolved entity
- helper works without `documentState`

Keep `property_panel_selection_context.test.js` focused on context contract and presentation behavior.

## Expected Outcome

- lookup and normalization become unit-testable in isolation
- `property_panel_selection_context.js` becomes a context-shaping wrapper
- next cleanup can target presentation assembly without reopening entity lookup behavior
