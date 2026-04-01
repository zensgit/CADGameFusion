# Step289 Selection Note Policy Consolidation Design

## Goal

Consolidate the remaining property-panel note policy so:

- [property_panel.js](../tools/web_viewer/ui/property_panel.js) stops rebuilding read-only, released, and locked-layer note strings on its own
- presenter-side selection logic becomes the single source of truth for note wording
- the existing note text contracts stay stable for smoke scripts and regression tests

## Problem

After Step287 and Step288, most property metadata and action context already came from [selection_presenter.js](../tools/web_viewer/ui/selection_presenter.js), but [property_panel.js](../tools/web_viewer/ui/property_panel.js) still owned a second cluster of branch-local note policy:

- read-only note wording for detached INSERT ATTDEF text, source-group entities, and generic imported entities
- released archive note wording for detached ATTDEF provenance
- locked-layer note wording
- its own `supportsInsertTextPositionEditing(...)` decision

That duplication was brittle because the exact strings are part of the regression contract:

- locked-layer smoke expects `locked layer 2:REDLINE`
- released ATTDEF flows expect `archived ATTDEF provenance remains visible as read-only context`
- source-group release flows depend on not showing an extra read-only note after release

## Design

### 1. Move note builders into selection_presenter

Extend [selection_presenter.js](../tools/web_viewer/ui/selection_presenter.js) with shared exports:

- `supportsInsertTextPositionEditing(...)`
- `buildPropertyPanelReadOnlyNote(...)`
- `buildPropertyPanelReleasedArchiveNote(...)`
- `buildPropertyPanelLockedLayerNote(...)`

These builders sit next to the shared selection/action context logic, so the same module now owns:

- what selection facts mean
- what action context means
- what read-only/locked/released note text should say

### 2. Keep property_panel as the renderer

[property_panel.js](../tools/web_viewer/ui/property_panel.js) still owns:

- branch timing and early returns
- DOM creation
- button labels and click handlers
- edit widgets

It now only asks presenter-side helpers for note text instead of synthesizing those strings locally.

### 3. Preserve caller-specific sequencing

This cut intentionally does not change branch precedence. The existing render flow in [property_panel.js](../tools/web_viewer/ui/property_panel.js) still decides when to show:

- read-only notes
- released notes
- locked-layer notes

Step289 only centralizes policy generation, not panel branch ordering.

## Files

- [selection_presenter.js](../tools/web_viewer/ui/selection_presenter.js)
- [property_panel.js](../tools/web_viewer/ui/property_panel.js)
- [editor_commands.test.js](../tools/web_viewer/tests/editor_commands.test.js)

## Why This Is The Right Cut

This finishes the low-risk presenter/property-panel consolidation path before any larger panel split:

1. Step287 unified property metadata facts
2. Step288 unified action context
3. Step289 unifies note policy

After this, [property_panel.js](../tools/web_viewer/ui/property_panel.js) is much closer to a pure renderer plus interaction layer, which is the right place to pause before a larger branch-policy or file-splitting refactor.
