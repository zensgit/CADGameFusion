# Step241: Editor Insert Peer Scope Preservation Design

## Goal

Keep canonical imported `INSERT` text-only selection scope intact when peer-targeting across layouts.

## Why This Slice

- Step214 and Step215 established peer navigation for imported insert instances.
- Earlier peer navigation already preserved `single`, `full-group`, and `editable-only` selection scopes.
- Step240 added `Select Insert Text` plus hidden attribute reachability, which made text-only insert selection a first-class workflow.
- The remaining gap was scope consistency: a canonical text-only insert selection should keep following the corresponding text members in sibling peer instances instead of collapsing back to a single fragment.

## Contract

For imported `INSERT` groups with peer instances across layouts:

- `single` selection keeps selecting the matched single fragment on the peer instance
- `full` selection keeps selecting the full peer instance group
- `editable` selection keeps selecting the peer instance's editable members only
- canonical `text` selection keeps selecting the peer instance's text members only

“Canonical text selection” in this slice means:

- current selection exactly matches the insert group's text members for the active peer instance
- property panel continues to expose peer actions for that selection
- peer-target commands preserve that text-only scope across layouts

This slice does not generalize arbitrary custom subsets. Non-canonical insert subsets still remain outside the peer-scope contract.

## Implementation Notes

- `tools/web_viewer/insert_group.js`
  - classifies exact insert-text member selection as `text`
  - resolves peer navigation through a shared helper that maps the current selection scope onto the target peer
- `tools/web_viewer/ui/workspace.js`
  - uses the shared peer-selection resolver for property-driven and command-driven peer navigation
- `tools/web_viewer/ui/property_panel.js`
  - keeps `Previous Peer Instance`, `Next Peer Instance`, and direct `Open N:` actions visible for canonical text-only selection
- `tools/web_viewer/tests/editor_commands.test.js`
  - locks helper-level scope preservation for canonical text-only and editable-only peer selection
- `tools/web_viewer/scripts/editor_insert_group_smoke.js`
  - validates the real browser path with a dedicated multi-text imported insert fixture path

## Real Browser Path

The smoke fixture adds a dedicated imported insert identity:

- `DoorNotes`
- three peer instances across `Layout-A`, `Layout-B`, and `Layout-C`
- one line fragment plus two text proxies per peer

That lets the browser smoke verify the real editor path for:

- text-only multi-selection `[21, 22]`
- direct peer action `Open 3: ...`
- command-line `inspeer Layout-B`
- command-line `insprev`

## Out Of Scope

- arbitrary partial text subsets inside an insert group
- changing hidden/constant attribute behavior from Step240
- releasing or editing geometry during peer navigation
- broadening peer-scope preservation beyond imported `INSERT`
