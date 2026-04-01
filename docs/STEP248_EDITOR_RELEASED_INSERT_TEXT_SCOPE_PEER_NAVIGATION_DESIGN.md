# Step248: Editor Released Insert Text Scope Peer Navigation Design

## Goal

Keep released imported `INSERT` text in plain-text edit mode while letting multiple released text members from the same archived insert group preserve text-only scope across peer instances and layouts.

This extends the Step247 peer-navigation path one level deeper:

- archive-driven peer matching still comes from `releasedInsertArchive`
- the released entity remains plain text
- peer navigation resolves by archived `name`, then maps the released selection to the surviving live peer text member in the target layout

## Why This Slice

Step247 proved that released insert text can move across surviving peer layouts without restoring live insert semantics. The remaining gap is text-scope continuity for released members that belong to the same archived insert group.

Without that continuity:

- released text can land on the right peer layout but lose member-specific scope
- peer targets can collapse to the wrong surviving fragment when the archived member name is the only stable key
- the browser smoke cannot assert that the released `DoorNotes` pair stays anchored to the correct live peer text in `Layout-B` and `Layout-C`

Step248 closes that gap while keeping release behavior strictly text-only.

## Contract

### 1. Released text stays plain

Released insert text does not regain live insert proxy behavior.

- no restored `sourceType`
- no restored `editMode`
- no restored `proxyKind`
- no restored live insert editing contract

The released entity remains editable as normal text, even while it carries archive metadata for peer navigation.

### 2. Peer matching uses archived `name`

Peer resolution for released insert text is archive-driven and name-based.

- the helper matches the released member against the archived member `name`
- the match is resolved against surviving live peer text members
- the target selection becomes the live peer text corresponding to that archived member

For the `DoorNotes` release path covered by the smoke fixture:

- released selection `[21,22]` resolves through `relinspeer Layout-C` to live peer text `[27,28]`
- the same released scope can open the peer action target in `Layout-B` and land on `[24,25]`

That mapping is the invariant: released text scope follows the archived member identity, not a revived insert proxy.

### 3. Multiple released members preserve peer scope

When the same archived insert group has multiple released text members, each released member keeps a text-only peer scope.

- selection stays anchored to the released member
- property details can expose peer-instance facts for the archived family
- navigation to another peer layout updates the live target selection without turning the source selection back into an insert proxy

### 4. UI actions stay consistent

The released text UI continues to expose peer navigation actions for the archived family.

- `open-released-insert-peer-<n>`
- `previous-released-insert-peer`
- `next-released-insert-peer`
- command-line `relinspeer <layout>`
- command-line `relinsprev`

For Step248, the smoke specifically exercises:

- command `relinspeer Layout-C`
- property action `open-released-insert-peer-2`

Those actions must land on the surviving live peer text that corresponds to the archived released member, not merely on any surviving fragment in the same group.

### 5. Fallback remains text-safe

If the exact archived member name no longer resolves cleanly:

- the released entity remains plain text
- the helper falls back to the narrowest surviving peer fragment
- peer navigation still avoids reactivating live insert editing semantics

## Key Files

- `tools/web_viewer/insert_group.js`
  - resolves released peer selection by archived member `name`
  - keeps text-scope matching stable across surviving peer layouts

- `tools/web_viewer/ui/property_panel.js`
  - exposes released peer actions from archived released text selections
  - renders the `open-released-insert-peer-2` affordance used by the multi-text `DoorNotes` smoke path

- `tools/web_viewer/ui/workspace.js`
  - routes `relinspeer` / `relinsprev`
  - maps released selection to the surviving live peer text target

- `tools/web_viewer/scripts/editor_insert_group_smoke.js`
  - exercises the `DoorNotes` release path
  - proves `relinspeer Layout-C` and `open-released-insert-peer-2` preserve released text scope across peer layouts

- `tools/web_viewer/tests/editor_commands.test.js`
  - covers archived-name matching and fallback behavior for released peer selection

## Out Of Scope

Step248 does not add:

- restoration of live insert proxy editing on released text
- a generalized released-peer browser
- new CADGF export fields for archive-only peer scope
- changes to non-`INSERT` release behavior

## Acceptance

Step248 is complete when:

- released `INSERT` text remains plain text after release
- peer selection matches by archived member `name`
- released selection `[21,22]` maps to the expected live peer text in `Layout-B` or `Layout-C`
- `relinspeer Layout-C` and `open-released-insert-peer-2` preserve text-only scope across peer instances/layouts
- the browser smoke covers the `DoorNotes` path without regressing the existing released peer navigation behavior
