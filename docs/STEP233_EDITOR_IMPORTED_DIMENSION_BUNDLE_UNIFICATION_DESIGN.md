# Step233: Imported DIMENSION Bundle Unification

## Goal

Make real imported `DIMENSION` bundles behave as one editor source group even when the importer emits split fragment `group_id`s for arrowheads.

## Problem

By `Step232`, real imported dimensions already carried explicit `source_anchor` and `source_anchor_driver_*` metadata, but the bundle boundary was still fragmented:

- text, extension lines, and anchor points stayed in one `group_id`
- arrowhead polylines were emitted under separate `group_id`s

In real combo/imported-dimension previews this meant:

- selecting the text saw only the 7-member body
- selecting an arrowhead saw only a 1-member fragment
- `Select Source Group` / `Select Source Text` / `dimflip` / `srcplace` did not consistently operate on the full imported dimension instance

That is below benchmark behavior. Real imported annotation should not depend on which fragment the user happens to click first.

## Design

### 1. Bundle identity in preview/editor contract

The preview/editor contract now carries `source_bundle_id` for real imported dimensions. When explicit bundle metadata exists, it is preserved. When older/root-block DXF paths still only provide split `group_id`s, preview export derives a stable bundle id from:

- `space`
- `layout`
- `source_type = DIMENSION`
- `block_name` (anonymous `*D...` block)

That id is then shared across:

- dimension text
- dimension lines
- extension lines
- anchor points
- split arrowhead polylines

It deliberately does not replace `group_id`; it augments it. `group_id` still describes emitted fragment grouping, while `source_bundle_id` describes the full imported dimension bundle.

### 2. Editor grouping precedence

For non-`INSERT` source groups, the editor now resolves members in this order:

1. `source_bundle_id + source_type + space/layout`
2. fallback to `group_id + source_type + space/layout`

This keeps existing behavior for legacy fixtures and older imports, while making real imported dimensions bundle-complete as soon as importer metadata is present.

### 3. Provenance visibility

Quicklook/property only show `Source Bundle ID` when it differs from `Group ID`. This keeps normal selections quiet while making split arrowhead fragments explainable.

### 4. Detach/release cleanup

`copy` / `release` / detached created entities clear `sourceBundleId`, because once geometry is no longer imported proxy state, bundle provenance should not leak into native editable entities.

## User-visible result

Real imported dimensions now support these flows from either text or arrowhead fragments:

- `Select Source Group`
- `Select Source Text`
- `Select Anchor Driver`
- `Fit Source Anchor`
- `Use Opposite Text Side`
- `Reset Source Text Placement`

This closes the real-data gap between imported dimension body fragments and split arrowhead fragments.
