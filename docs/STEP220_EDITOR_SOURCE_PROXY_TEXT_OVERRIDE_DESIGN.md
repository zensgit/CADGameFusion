# Step220 Editor Source Proxy Text Override Design

## Goal

Allow imported annotation text proxies to be corrected in place without forcing an immediate release step.

The target cases are:

- `DIMENSION` text proxies
- `LEADER` text proxies

Before Step220, the editor already supported grouped-source recovery with:

- `Release Source Group`
- `Release & Edit Source Text`
- `srcrel`
- `srcedit`

That was useful, but it still assumed every imported annotation correction should detach the bundle first. Step220 adds a narrower and higher-value path: direct text overrides on the imported proxy itself while the rest of the grouped geometry remains read-only.

## Why This Slice

This goes past the usual benchmark behavior of “select imported annotation, then explode/release before doing anything useful”.

For common import cleanup work, users often only need to:

- fix a dimension label
- rewrite a leader note
- adjust imported annotation text position or rotation

Requiring a release for those edits is heavier than necessary and destroys provenance earlier than needed. Step220 keeps provenance intact until the user actually wants to detach the source bundle.

## Contract

### 1. Scope is intentionally narrow

Direct proxy editing is allowed only when all of the following are true:

- single selected entity
- `type === text`
- `editMode === proxy`
- `sourceType === DIMENSION` or `sourceType === LEADER`

Everything else remains on the existing contracts:

- grouped-source actions
- insert-group actions
- generic read-only proxy protection

### 2. Only text-safe fields are editable

The command layer allows only these patch keys on matching source text proxies:

- `value`
- `position`
- `height`
- `rotation`

All other patch keys stay blocked for read-only proxies, including:

- layer changes
- style provenance changes
- generic geometry edits on non-text proxy members

### 3. Dimension metadata stays synced

`DIMENSION` text proxies still carry dimension-specific text metadata. When direct text overrides happen:

- `position` also updates `dimTextPos`
- `rotation` also updates `dimTextRotation`

This keeps export/import contracts aligned instead of letting visible text and dimension text metadata diverge.

### 4. Provenance stays intact

Direct text overrides do not detach the imported source bundle.

The edited proxy keeps:

- `groupId`
- `sourceType`
- `editMode`
- `proxyKind`
- `space`
- `layout`

This is the key distinction from `Release & Edit Source Text`: Step220 edits wording and text placement while preserving imported/source-group identity.

### 5. Property panel reflects the narrow capability

Single imported `DIMENSION` / `LEADER` text proxies now show:

- editable text fields
- a read-only note that explains the boundary

The note makes the contract explicit:

- text overrides stay editable
- geometry remains proxy-only

### 6. Release-and-edit still matters

Step220 does not replace Step219.

Users still need `srcedit` / `Release & Edit Source Text` when they want:

- detached native geometry
- full text authoring with provenance removed
- bundle-level release before broader edits

The product now offers both paths:

- direct in-place correction while imported provenance remains
- release-and-edit when detachment is the actual goal

## Implementation

### Command layer

`tools/web_viewer/commands/command_registry.js`

Adds a narrow direct-edit path inside `selection.propertyPatch`:

- identify eligible source text proxies
- whitelist safe text fields only
- sync dimension text metadata on direct edits
- preserve existing read-only rejection for everything else

### Property panel

`tools/web_viewer/ui/property_panel.js`

Adds the matching UI contract:

- expose text inputs for direct-editable source text proxies
- show an explanatory read-only/proxy boundary note
- keep the generic disabled state for non-text proxies and non-eligible cases

### Test coverage

`tools/web_viewer/tests/editor_commands.test.js`

Locks:

- direct `DIMENSION` proxy text override
- `dimTextPos` sync
- `LEADER` proxy text override
- CADGF export of synced dimension text metadata after in-place edits

### Browser workflow coverage

`tools/web_viewer/scripts/editor_source_group_smoke.js`

Verifies the real browser path for:

- direct `DIMENSION` proxy text edit
- direct `LEADER` proxy text edit
- preserved provenance after in-place edits
- existing Step219 release-and-edit workflows

## Out Of Scope

Step220 does not add:

- direct editing for non-text grouped proxies
- dimension-line or leader-geometry authoring on imported proxies
- style/layer override editing on read-only proxies
- refedit-style source-definition editing

This slice is specifically about the highest-value imported annotation correction path: text edits without unnecessary detachment.
