# Step234: Legacy DIMENSION Bundle Fallback

## Goal

Keep split imported `DIMENSION` bundles usable in the editor even when older CADGF payloads do not carry explicit `source_bundle_id`.

## Problem

`Step233` made real imported dimensions bundle-complete by carrying `source_bundle_id` through preview/editor contract, but older fixtures and cached preview payloads can still arrive without that field.

When that happens, anonymous imported dimension blocks regress to fragment-level grouping:

- text/body members stay on one `group_id`
- split arrowheads stay on their own `group_id`
- `Select Source Group` from an arrowhead collapses to the fragment instead of the full dimension bundle

That makes editor behavior depend on whether the payload was regenerated, which is the wrong failure mode.

## Design

### 1. Import-time fallback only

The fallback lives in the CADGF adapter import path, not in quicklook/presenter code.

On import, if an entity matches all of these conditions:

- `source_type = DIMENSION`
- `block_name` is an anonymous dimension block (`*D...`)
- `space/layout` are known
- `source_bundle_id` is missing

the adapter derives a bundle id from the minimum available fragment id across the same:

- `space`
- `layout`
- `block_name`

In practice that means legacy split fragments such as:

- text/body on `group_id = 5`
- arrowheads on `group_id = 6/7`

all recover `sourceBundleId = 5` during import.

### 2. Narrow scope

This fallback is deliberately limited to anonymous imported dimension blocks:

- it does not try to infer bundle ids for arbitrary grouped proxies
- it does not override explicit `source_bundle_id`
- it does not change non-`DIMENSION` grouping rules

That keeps the heuristic high-confidence and aligned with the importer contract already established in `Step233`.

### 3. Roundtrip normalization

Once the adapter infers the missing bundle id, normal editor/export paths treat it as first-class metadata:

- source-group selection becomes bundle-aware again
- quicklook/property can surface `Source Bundle ID`
- export writes back explicit `source_bundle_id`

So the recovery happens once at import time and the document stays normalized afterwards.

## User-visible result

Older preview payloads without explicit `source_bundle_id` now behave like current importer output:

- arrowhead fragment selection still expands to the full imported dimension bundle
- `srctext`, `dimflip`, and `srcplace` continue to work on the whole bundle
- saved/exported editor state no longer loses the recovered bundle boundary
