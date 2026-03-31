# STEP210 Editor Insert Group Scale Design

## Scope

This step extends the imported `INSERT` instance workflow from Step209:

- full insert-group `scale` now keeps transform-safe read-only proxy members aligned with editable fragments
- the editor now exposes a real `Scale` tool in the modify toolbar
- command input also supports direct whole-selection scaling:
  - `scale <factor> <centerX> <centerY>`

The boundary stays narrow. This is still not `REFEDIT`, not block-definition editing, and not a blanket removal of read-only proxy protections.

## Problem

After Step209, imported insert groups had instance-level behavior for:

- `move`
- `rotate`

But scale was still missing. That left a visible benchmark gap:

- the user could select the full imported insert group
- the property panel correctly described a mixed editable/proxy instance
- the editor could move or rotate the whole instance
- yet there was no matching instance-level scale workflow

For DWG-style recovery editing, that is inconsistent. If VemCAD already recognizes the full logical insert instance, `scale` should follow the same whole-instance contract as `move` and `rotate`.

## Design

### 1. Add geometric scale primitives once

- `tools/web_viewer/tools/geometry.js`

This step adds:

- `scalePoint(point, center, factor)`
- `scaleEntity(entity, center, factor)`

Supported transform-safe entity types match the current editor transform surface:

- `line`
- `polyline`
- `circle`
- `arc`
- `text`

Entity-specific behavior:

- `line` / `polyline`: scale all world points
- `circle` / `arc`: scale center and radius
- `text`: scale position and height

This keeps scale behavior deterministic and reusable across command and tool paths.

### 2. Reuse the Step209 whole-instance allowance

- `tools/web_viewer/commands/command_registry.js`

`selection.scale` uses the same whole-insert-group detection already established for `move/rotate`:

- selection must exactly match the imported insert group in the active `space / layout`
- read-only members must still be transform-safe proxy types
- partial selections keep the existing read-only skip behavior

So the rule stays simple:

- full imported insert-group selection:
  - `scale` behaves like an instance-level transform
- anything narrower:
  - read-only proxy members stay protected

### 3. Keep both command styles

This step intentionally supports two editor paths:

- interactive `Scale` tool:
  - pick center
  - pick reference point
  - pick target point
- direct command input:
  - `scale <factor> <centerX> <centerY>`

The direct command matters for repeatable smoke coverage and quick production use. The interactive tool matters for parity with existing `move/rotate` workflows and for future snap-driven editing.

### 4. Surface the behavior in the editor

- `tools/web_viewer/index.html`
- `tools/web_viewer/tools/tool_registry.js`
- `tools/web_viewer/tools/scale_tool.js`
- `tools/web_viewer/ui/canvas_view.js`
- `tools/web_viewer/ui/workspace.js`

This step wires the new transform through the full editor surface:

- toolbar button
- command input activation
- transient preview overlay
- status messages

The preview stays intentionally narrow: center/reference/target rays plus radius circles. The goal is a stable transform affordance, not a full gizmo.

### 5. Keep the property boundary explicit

- `tools/web_viewer/ui/property_panel.js`

The full mixed insert-group note now says:

- property edits still skip read-only proxy members
- `move/rotate/scale` keep them with the full insert group

That matters because Step210 expands whole-instance behavior without making proxy entities generally editable.

## Behavior Contract

- full imported insert-group selection:
  - `selection.scale` transforms editable fragments and transform-safe proxy members together
- editable-only insert selection:
  - `selection.scale` affects only the editable subset
- invalid factor or center:
  - stable `INVALID_SCALE`
- property edits:
  - unchanged; proxies remain read-only
- direct command:
  - `scale 0.5 0 0` applies `selection.scale` around `(0, 0)` with factor `0.5`

## Scope Limits

This step still does not introduce:

- non-uniform scale
- block-definition editing
- proxy copy/delete/property relaxation
- insert-specific scale handles or gizmos
- `BYBLOCK` style inheritance work

## Benchmark Intent

This step pushes VemCAD past the common “exploded fragments only” reference baseline:

- lightweight editors often let imported fragments drift apart during transforms
- VemCAD now preserves whole-instance behavior for `move`, `rotate`, and `scale` once the user explicitly selects the full imported insert group

That is closer to the effective behavior users expect from `AutoCAD`-style block references, while still keeping the editable/proxy boundary visible and auditable.
