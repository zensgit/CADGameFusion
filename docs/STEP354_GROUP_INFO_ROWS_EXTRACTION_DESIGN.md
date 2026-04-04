# Step354: Group Info Rows Extraction

## Goal

Extract shared source-group / insert-group info-row assembly into a dedicated leaf helper used by both:

- `tools/web_viewer/ui/selection_detail_facts.js`
- `tools/web_viewer/ui/property_panel_info_rows.js`

The purpose is to remove duplicated member-count / bounds / peer-row formatting while preserving the current UI contract exactly.

## Scope

In scope:

- Extract group row assembly into a new dedicated helper module.
- Cover both source-group and insert-group variants.
- Keep exact row ordering, labels, keys, and value formatting unchanged.
- Keep `property_panel_info_rows.js` public exports unchanged.
- Keep `selection_detail_facts.js` public exports unchanged.

Out of scope:

- Released archive row behavior.
- Property metadata fact behavior.
- Selection presentation behavior.
- Property panel rendering behavior.
- Any wording or semantic change.

## Target Shape

Introduce a leaf helper, expected name:

- `tools/web_viewer/ui/group_info_rows.js`

Expected responsibility:

- Build shared rows for:
  - group identity rows
  - group member count rows
  - group bounds rows
  - peer summary rows

Expected consumers:

- `selection_detail_facts.js`
- `property_panel_info_rows.js`

## Constraints

- Do not import `selection_presenter.js` from the new helper.
- Do not create a new cycle through `property_panel_info_rows.js`.
- Do not change:
  - `Group ID`
  - `Group Source`
  - `Source Bundle ID`
  - `Block Name`
  - member count rows
  - `Group Center`
  - `Group Size`
  - `Group Bounds`
  - `Peer Instance`
  - `Peer Instances`
  - `Peer Layouts`
  - `Peer Targets`
- Preserve insert-group-only behaviors:
  - `Insert Group Members`
  - `Block Name`
  - peer rows
- Preserve source-group-only behaviors:
  - `Source Group Members`
  - no block-name row
  - no peer rows

## Recommended Implementation

1. Extract shared row assembly into `group_info_rows.js`.
2. Move only the minimal formatting helpers needed by that module, if any.
3. Update `property_panel_info_rows.js` so its group-row builders delegate to the new helper.
4. Update `selection_detail_facts.js` so its source/insert group sections reuse the same helper output.
5. Keep released-archive selection rows on their current helper.

## Acceptance

Accept Step354 only if:

- no behavior changes are introduced
- no new dependency cycle is created
- focused tests cover both source-group and insert-group paths
- `editor_commands.test.js` stays green
- `git diff --check` stays clean
