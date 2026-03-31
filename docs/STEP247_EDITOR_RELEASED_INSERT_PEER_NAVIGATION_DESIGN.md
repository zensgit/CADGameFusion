# Step247: Editor Released Insert Peer Navigation Design

## Goal

Let released imported insert text navigate across its surviving peer instances and layouts using the archived release provenance preserved in Step245/246.

This is the missing follow-on to released-context relink:

- Step245 kept the released text plain while preserving archived provenance.
- Step246 let that archive jump back to the surviving imported insert group.
- Step247 extends the same archive-driven path to peer navigation inside the released insert family.

## Why This Slice

Released insert text can already explain where it came from, and it can already relink to the surviving insert group when that source still exists. The next practical step is to move between the surviving peer instances of that released source without reviving live insert semantics.

That gives the user:

- a way to inspect alternate surviving imported instances that belong to the released source family
- layout-aware navigation without manual selection hunting
- consistent command-bar and property-panel affordances for the released state

## Contract

### 1. Released peer identity

Released insert peer discovery is archive-driven.

- the entity itself stays plain text
- peer lookup uses `releasedInsertArchive`
- peer matching resolves against surviving imported `INSERT` peer groups, not against revived live fields on the released text itself
- archived `name` is preserved on release so text members can map to the matching peer text when that member still exists

When a released insert has more than one surviving peer, the editor exposes peer metadata for the released context:

- `Released Peer Instance`
- `Released Peer Instances`
- `Released Peer Layouts`
- `Released Peer Targets`

### 2. Released peer actions

Property/selection UI exposes peer navigation actions for released insert text:

- `Open Released Insert Peer <n>`
- `Previous Released Peer`
- `Next Released Peer`

The direct peer actions are rendered as:

- `open-released-insert-peer-<n>`
- `previous-released-insert-peer`
- `next-released-insert-peer`

These actions navigate to surviving imported peers of the released source family. They do not restore the live imported insert proxy contract on the released text entity itself.

### 3. Command-bar parity

The same behavior is available from command input:

- `relinspeer`
- `relinsprev`

`relinspeer` may target a specific peer by index or layout token, while `relinsprev` steps backward through the surviving released peer list.

### 4. Selection and view behavior

When navigating released peers, the workspace:

- switches to the peer's `space / layout`
- maps selection to the most specific surviving peer member:
  - the matching peer text member when archived `name` resolves cleanly
  - otherwise the narrowest surviving fallback member
- fits the camera to the peer bounds
- keeps the originating released entity plain text if the user returns to it later

If the released text's original layout no longer has a surviving imported peer, the released context shows `Released Peer Instance = Archived / N` instead of pretending the detached text is still one of the live peer slots.

The important invariant is that peer navigation is session navigation, not a reactivation of live insert editing.

### 5. Missing-peer behavior

If the archive does not resolve to more than one surviving peer:

- released peer navigation actions are omitted
- command verbs fail cleanly
- the released entity remains editable as plain text
- relink/fit actions still appear only when a same-layout surviving imported group exists

## Key Files

- `tools/web_viewer/ui/selection_presenter.js`
  - adds released peer summary facts to single-selection details

- `tools/web_viewer/ui/property_panel.js`
  - exposes released peer actions and the peer-indexed open actions

- `tools/web_viewer/ui/workspace.js`
  - implements `relinspeer` / `relinsprev`
  - resolves released peer targets, selection mapping, context switching, and camera fit

- `tools/web_viewer/insert_group.js`
  - provides released peer summary and selection helpers based on archived provenance

- `tools/web_viewer/scripts/editor_insert_group_smoke.js`
  - locks the browser contract for released peer metadata, actions, and command navigation

## Out Of Scope

Step247 does not add:

- restoring live imported insert proxy semantics on released text
- editing the original imported insert group from the released entity
- a general peer explorer UI
- new CADGF export fields for released archive metadata

## Acceptance

Step247 is complete when:

- released insert text surfaces peer facts only when surviving peers exist
- property actions can open specific released peers and step previous/next
- `relinspeer` and `relinsprev` navigate the released peer set correctly
- navigation switches layout, preserves plain-text release semantics for the detached source, and fits the view
- `editor_insert_group_smoke.js` covers the released peer path without regressing the existing insert-group workflow
