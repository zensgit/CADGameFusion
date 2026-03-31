# Step335 Property Panel Selection Context State Design

## Goal

Extract `empty` / `missing` / `active` classification from `property_panel_selection_context.js` into a dedicated helper, without changing presentation building or the returned context contract.

## Why This Step

After Step334:

- entity lookup and normalization already live in `property_panel_selection_resolution.js`
- `property_panel_selection_context.js` is now mostly classification plus presentation assembly

That makes context classification the narrowest next seam.

## Problem

`resolvePropertyPanelSelectionContext(...)` still directly decides:

- whether the context is `empty`
- whether the context is `missing`
- whether the context is `active`
- which entities and primary id should feed presentation

So one wrapper still owns both:

- context classification
- presentation assembly

## Design

Introduce:

- `tools/web_viewer/ui/property_panel_selection_context_state.js`

Export one helper:

- `buildPropertyPanelSelectionContextState(resolution)`

It should consume the existing resolution object and return:

- `kind`
- `selectionIds`
- `entities`
- `primary`
- `presentationEntities`
- `presentationPrimaryId`

Behavior:

- `kind === 'empty'` when `selectionIds.length === 0`
- `kind === 'missing'` when `selectionIds.length > 0` and `entities.length === 0`
- `kind === 'active'` otherwise
- `presentationEntities` is `[]` for `empty` and `missing`, else `entities`
- `presentationPrimaryId` is:
  - `resolution.primaryId` for `empty` and `missing`
  - `primary?.id ?? resolution.primaryId` for `active`

`property_panel_selection_context.js` should then:

1. build `resolution`
2. build `contextState`
3. build presentation from `contextState.presentationEntities` and `contextState.presentationPrimaryId`
4. return the same public context object as today

## Boundaries

This step must not change:

- `resolvePropertyPanelSelectionContext(...)` export contract
- `buildPropertyPanelSelectionResolution(...)` behavior
- `buildSelectionPresentation(...)` behavior
- returned `kind`, `selectionIds`, `entities`, `primary`, `presentation`

## Test Plan

Add:

- `tools/web_viewer/tests/property_panel_selection_context_state.test.js`

Cover:

- empty classification
- missing classification
- active classification
- active presentation primary fallback
- empty/missing presentation entity clearing

Keep `property_panel_selection_context.test.js` focused on public context contract and presentation behavior.

## Expected Outcome

- selection classification becomes unit-testable in isolation
- `property_panel_selection_context.js` becomes a thin wrapper over:
  - resolution
  - classification
  - presentation assembly
- next cleanup can target presentation assembly without reopening lookup or classification behavior
