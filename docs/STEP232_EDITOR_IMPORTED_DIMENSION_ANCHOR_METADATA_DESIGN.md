# Step232: Editor Imported DIMENSION Anchor Metadata Design

## Goal

Make real imported `DIMENSION` text proxies use importer-authored anchor metadata instead of relying on editor-side geometry heuristics.

## Problem

After Step231, real imported classic `LEADER` notes already carried explicit guide metadata:

- `source_anchor`
- `leader_landing`
- `leader_elbow`
- `source_anchor_driver_type`
- `source_anchor_driver_kind`

The editor-side source-guide resolver had already been upgraded to prefer explicit guide metadata first, but real imported `DIMENSION` text still depended on the fallback heuristic that inferred the anchor from the longest non-text member midpoint. That heuristic was stable enough for synthetic fixtures, but it was still the wrong authority for real imported dimension semantics.

This left a gap:

- real imported `DIMENSION` text could expose `srcanchor`, `srcdriver`, `dimflip`, and `srcplace`
- but those operations still derived their anchor from editor-side geometry reconstruction instead of importer truth

## Design

### Importer-authored dimension anchor

The importer now computes an explicit text anchor for real imported `DIMENSION` text proxies inside `dxf_importer_plugin.cpp`.

For classic horizontal/rotated dimensions:

1. Resolve the dimension axis
2. Build the axis line through the dimension definition point
3. Project the two extension-origin points onto that axis
4. Use the midpoint of those projected endpoints as the explicit `source_anchor`

This matches the actual visible dimension-line midpoint in the imported preview and yields the same semantic anchor the user expects to inspect or drive against.

### Driver metadata

Imported `DIMENSION` text proxies now also emit:

- `source_anchor_driver_type = line`
- `source_anchor_driver_kind = midpoint`

This makes the browser-side quicklook and property panel show a stable driver label like `21:line midpoint` without having to guess which geometry member is authoritative.

### Explicit-first editor contract reuse

No new editor-only DIMENSION guide logic was introduced. The existing explicit-first resolver from Step231 is reused:

- if explicit `source_anchor + source_anchor_driver_*` exists, use it
- otherwise fall back to the pre-existing geometry heuristic

That keeps the editor robust for older fixtures and partially annotated imports, while making real imported dimensions authoritative when the importer knows the answer.

### Transform behavior

The existing whole-group transform pipeline already carries `source_anchor` forward during:

- `move`
- `rotate`
- `scale`

and strips guide metadata during:

- `copy` to detached editable geometry
- `release`

So real imported `DIMENSION` bundles automatically inherit the same transformed-guide semantics that Step223 already established for grouped annotation placement resets.

## User-visible result

For real imported `DIMENSION` text proxies, the editor now has an importer-backed anchor contract:

- quicklook shows `Source Anchor = 65, 0`
- quicklook/property show `Source Anchor Driver = 21:line midpoint`
- `srcdriver` jumps to the real dimension line member
- `srcanchor` fits the view to the imported anchor
- `dimflip` mirrors across that same imported anchor
- `srcplace` returns to the imported text placement while preserving the imported anchor contract

## Benchmark impact

This moves real imported `DIMENSION` handling past reference implementations that only support:

- heuristic text placement reconstruction
- explode/release before meaningful text correction
- opaque dimension text dragging without a visible anchor contract

VemCAD now exposes a real imported, inspectable, reversible dimension-text anchor workflow grounded in importer semantics rather than browser-side guesswork.
