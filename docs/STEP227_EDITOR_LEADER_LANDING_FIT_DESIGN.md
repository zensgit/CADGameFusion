# Step227: Editor LEADER Landing Fit Design

## Goal
Make imported `LEADER` text proxies expose their real landing geometry as a first-class editor contract, so users can inspect and fit the actual `elbow -> landing -> text` path without releasing the source bundle.

## Why This Slice
- `DIMENSION` already has anchor and side-preset affordances; `LEADER` still lacked an equally concrete geometry-facing action.
- Reference editors usually stop at provenance display or force explode/release before meaningful inspection.
- A narrow landing-fit slice has better ROI than speculative attachment metadata because the imported data already contains enough geometry to render and verify the real guide.

## Contract
Single imported `LEADER` text proxies now expose:
- `Leader Landing`
- `Leader Elbow`
- `Leader Landing Length`

Grouped non-`INSERT` source workflows now add:
- property action `Fit Leader Landing`
- command-line `leadfit` and `leaderfit`

The fit action:
- keeps the selection on the same imported `LEADER` text proxy
- reuses the existing `sourceTextGuide` overlay instead of introducing a second overlay type
- fits the view to the real landing guide derived from source geometry
- does not release the bundle
- does not mutate source metadata

## Implementation Notes
- `insert_group.js` extends `resolveSourceTextGuide()` for `LEADER` with `landingPoint`, `elbowPoint`, and `landingLength`.
- `selection_presenter.js` and `property_panel.js` surface the leader-specific facts in quicklook and property metadata.
- `canvas_view.js` reuses the current guide overlay and renders the extra leader segment for `LEADER`.
- `workspace.js` wires `leadfit` / `leaderfit` to the same fit contract as the property action.
- `editor_source_group_smoke.js` validates the browser path against real imported fixtures, not a synthetic debug-only selection.

## Out Of Scope
- Editing or reshaping leader elbow/landing geometry
- Inventing attachment enums or synthetic leader metadata not present in the imported source
- General annotation authoring beyond the existing source-group workflow
