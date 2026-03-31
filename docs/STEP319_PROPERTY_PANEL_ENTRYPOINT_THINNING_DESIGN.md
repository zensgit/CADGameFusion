# Step319 Property Panel Entrypoint Thinning Design

## Goal

Keep shrinking `property_panel.js` toward a pure exported entrypoint without changing render semantics, lifecycle behavior, or collaborator contracts.

## Problem

After Step317, the main file was already small, but it still owned two tiny entrypoint concerns:

- DOM root lookup and form guard
- cherry-picking `domBindings` methods only to pass them straight into collaborators

Those concerns were local plumbing, not panel behavior.

## Design

Add:

- `tools/web_viewer/ui/property_panel_dom_roots.js`

The module exports:

- `resolvePropertyPanelDomRoots({ rootDocument, formId, summaryId, detailsId })`

It owns:

- resolving `cad-property-form`
- resolving optional `cad-selection-summary`
- resolving optional `cad-selection-details`
- returning `null` when the form shell is absent

Also tighten collaborator assembly:

- `createPropertyPanelCollaborators(...)` now accepts `domBindings`
- when present, collaborators read `addActionRow`, `appendFieldDescriptors`, and `appendInfoRows` directly from the bag
- legacy flat parameters remain supported for compatibility and tests

## Boundaries

This step does not change:

- controller behavior
- lifecycle behavior
- render dispatch
- collaborator wiring semantics
- action ids, field order, or note copy

It only removes entrypoint plumbing from `property_panel.js`.

## Expected Outcome

`property_panel.js` becomes a thinner exported entrypoint, DOM root resolution becomes directly testable, and collaborator wiring depends on the already-established `domBindings` bag instead of local cherry-picks.
