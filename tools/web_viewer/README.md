# Web Viewer Prototype

## Run locally
```bash
cd /path/to/CADGameFusion
python3 -m http.server 8080
```

Then open:
```
http://localhost:8080/tools/web_viewer/
```

When loaded inside Electron desktop, the live preview page now also exposes:
- `Open CAD File`
- `Settings`
- live `Test Router` / `Check DWG` readiness from the same viewer entrypoint (`tools/web_viewer/index.html`), instead of a separate dead shell page
- automatic DWG route/readiness refresh when the settings modal opens, plus route-aware open status (`Opened ... via direct-plugin.`)
- route/setup failures now auto-reopen `Settings` with a structured `Hint: ...` line, instead of leaving the user on a raw DWG error
- router failures now use the same structured recovery surface, including `Router URL / auto start / start cmd / plugin / convert_cli` facts plus a `Hint: ...`
- explicit `DWG Route Mode` control (`auto / direct-plugin / local-convert`) with both browser and real desktop smoke coverage
- `Use Recommended`, which clears stale local overrides and reapplies the current detected desktop defaults
- `Export Diagnostics`, which in desktop mode now uses the native bridge to save a structured `vemcad.desktop.diagnostics.v1` support bundle and reports the actual saved path in the live modal
- desktop startup readiness in the main status line, instead of a sample-scene/default `Loaded successfully.` message
- vendored `three@0.160.0` runtime under `tools/web_viewer/vendor/three`, so core viewer rendering no longer depends on `unpkg`
- vendored `Space Grotesk` and `IBM Plex Mono` under `tools/web_viewer/vendor/fonts`, so first paint no longer depends on Google Fonts

Automated regression for that workflow:
```bash
node tools/web_viewer/scripts/desktop_live_settings_smoke.js
```

## CAD editor mode (AutoCAD-like 2D workspace)
Open:
```
http://localhost:8080/tools/web_viewer/?mode=editor
```

Open a CADGF `document.json` directly:
```
http://localhost:8080/tools/web_viewer/?mode=editor&cadgf=/build/cad_regression/<run_id>/previews/<case>/document.json
```

Highlights:
- Workspace layout: top command bar, left tools, right property/layer panels, bottom status bar, center canvas
- Drawing tools: `Line`, `Polyline`, `Circle`, `Arc`, `Text`
- Modify tools: `Select`, `Move`, `Copy`, `Offset`, `Rotate`, `Scale`, `Break`, `Trim`, `Extend`, `Fillet`, `Chamfer`, `Delete`
- Grips (Select tool):
  - drag endpoints/vertices/centers/text position
  - polyline midpoint grip inserts a new vertex (then drag)
  - double-click polyline vertex grip deletes a vertex
  - arc radius grip at mid-angle
  - grip hover highlight (primary entity)
- Drafting aids: `Ortho`, `Object Snap` (endpoint/midpoint/quadrant/center/intersection/tangent/nearest), `Grid`, `Undo/Redo`
- Snap panel: per-snap toggles + `gridSize` / `snapRadiusPx`
- Layer panel: add layers and toggle `show/lock/freeze/print/construction` flags with immediate canvas filtering; selected entities auto-focus their layer row for recovery workflows, while `Use/Current` keeps creation context explicit instead of hard-wiring new geometry to layer `0`
- Property panel: edit geometry plus per-entity `line type / line weight / line type scale`; with no selection, the same panel edits current drafting context for `space / layout / current-layer color / line type / line weight`
- Property provenance: single-select property panel surfaces `layer / layer color / layer state / origin / color source / color ACI / space / layout / group id / source bundle id / group source / source group members / block name / insert group members / editable members / read-only members / group center / group size / group bounds / peer instance / peer instances / peer layouts / peer targets / line type source / line weight source / line type scale source`; explicit style overrides can be restored with `Use Layer Color` / `Use Layer Line Type` / `Use Layer Line Weight` / `Use Default Line Type Scale`, explicit `lineWeight=0` remains inspectable instead of disappearing into the `BYLAYER` fallback, locked-layer selection offers `Locate Layer` / `Unlock Layer`, unlocked selections expose `Lock Layer`, single imported `DIMENSION` / `LEADER` / `TABLE` text proxies, including real imported `MLEADER` text-only notes, real imported `TABLE` text-only notes, classic imported `LEADER + TEXT/MTEXT` note pairs from the DXF importer, and now real imported inserted `ATTRIB / ATTDEF` text, keep provenance but expose direct text overrides through the right contract while geometry stays proxy-only; `DIMENSION / LEADER / TABLE` source text stays on the broader `value / position / height / rotation` path, while imported `INSERT` text proxies keep full `INSERT / text / proxy` provenance and generic tag-like text stays on the narrow `value`-only override path so instance geometry is not silently detached. Real imported inserted `ATTRIB / ATTDEF` now go one step further: authoritative `lock-position=false` attributes also expose in-place `position.x / position.y`, while `lock-position=true` stays value-only until release. Imported `INSERT` attribute flags are now behavioral, not just descriptive: `constant` blocks in-place value edits until release, `invisible` hides the proxy from default canvas/visible-entity queries, `lock-position` gates whether attribute text position is editable in place, and `Select Insert Text` plus `instext` / `inserttext` deliberately focus hidden text proxies for inspection or allowed edits without breaking the insert-group overlay. Mixed imported insert-attribute groups now expose `Select Editable Insert Text` and `instextedit` / `inserteditabletext`, so the user can narrow to directly editable text proxies without dragging constant text along. Once released, imported insert-attribute text is normalized to plain text semantics, so detached text stops carrying live `attribute_*` contract fields and edits like native text instead of a stale attribute proxy, while editor-only archived release metadata keeps the original `INSERT / text / proxy` origin, original group id, block, text kind, and attribute facts visible as read-only context; when surviving imported insert members still exist, released text also exposes `Select Released Insert Group` and `Fit Released Insert Group`, so the user can jump back to the remaining imported instance context without reviving live attribute semantics. Imported `LEADER` text proxies additionally surface `Leader Landing / Leader Elbow / Leader Landing Length` when a real landing guide exists, classic imported leaders now prefer importer-supplied guide points over editor-side endpoint guessing while still falling back cleanly when the DXF path does not provide them, and real imported `DIMENSION` bundles can now carry importer-authored `source_bundle_id`, while legacy anonymous `*D...` payloads that omit it are backfilled by the adapter on import, so split arrowheads and the text/extension-line body still resolve as one source group instead of several partial groups. Grouped non-`INSERT` derived proxies expose `Select Source Group`, `Select Source Text`, `Select Anchor Driver`, `Use Opposite Text Side`, `Use Opposite Landing Side`, `Reset Source Text Placement`, `Fit Source Group`, `Fit Source Anchor`, `Fit Leader Landing`, `Release & Edit Source Text`, and `Release Source Group`; imported `INSERT` fragments add direct `Open 2: ...` / `Open 3: ...` peer-target actions plus `Previous Peer Instance`, `Next Peer Instance`, `Select Insert Group`, `Select Insert Text`, `Select Editable Insert Text`, `Select Editable Members`, `Fit Insert Group`, and `Release Insert Group`, and canonical insert text-only selections now keep that same peer-target scope across layouts instead of collapsing back to a single fragment. Full mixed insert-group selections warn that property edits still skip proxies while full-group `move/rotate/scale/copy/delete` stay instance-level until release; full source-group selections keep `move/rotate/scale/copy/delete` bundle-level until release detaches them to editable geometry. Grouped annotation text keeps its reversible source placement even after whole-bundle transforms so `srcplace` returns to the transformed source instead of stale import-space coordinates; grouped `DIMENSION` bundles with text can mirror to the opposite source side through the same anchor contract; grouped `LEADER` bundles can inspect the real elbow-to-landing guide, fit that guide, and mirror text to the opposite landing side without release; real imported `MLEADER` text-only notes and real imported `TABLE` text-only notes now ride the same source/proxy contract, classic imported `LEADER` note pairs now do the same without synthetic editor-only grouping, and real imported `DIMENSION` bundles can now be entered from split arrowhead fragments via the same source-group contract, so they can be corrected in place, reset back to imported placement, or one-step released into native editable text without explode/release detours; grouped source bundles in general can focus the imported text proxy in place, jump to its anchor-driving geometry, reset it back to source placement, inspect the current anchor/offset contract, fit the view to that guide, or jump straight to editable text via one-step release-and-focus, and editable off-current selections expose `Make Current`; real imported inserted `ATTRIB / ATTDEF` proxies also surface authoritative read-only `attribute_tag` metadata, and imported `ATTDEF` additionally keeps `attribute_default` separate from `attribute_prompt` so the editor `value` field semantically edits the default text while `attribute_prompt` stays read-only metadata; `attribute_flags` stay decoded into read-only modes `invisible / constant / verify / preset / lock-position`, with `constant`, `invisible`, and now `lock-position` enforced by the editor contract instead of being display-only labels
- Selection details: single-select summary now exposes a stable provenance/effective-style contract under `#cad-selection-details` (`origin / layer / layer color / layer state / effective color / color source / color ACI / space / layout / group id / group source / source group members / block name / insert group members / editable members / read-only members / group center / group size / group bounds / peer instance / peer instances / peer layouts / peer targets / line type / line type source / line weight / line weight source / line type scale / line type scale source`) with dedicated DOM hooks for browser smoke; imported `DIMENSION` / `LEADER` text proxies also surface `source-anchor / source-anchor-driver / source-offset / current-offset`, and `LEADER` adds `leader-landing / leader-elbow / leader-landing-length`, so anchor drift and its driving geometry are inspectable without releasing the bundle; released multi-select `INSERT` text now also surfaces common archived `released-from / released-group-id / released-block-name / released-selection-members / released-peer-*` facts instead of dropping back to an empty multi-select quicklook
- Insert instance affordance: selecting an imported `INSERT` member now draws a dashed instance boundary and center mark over the whole logical group, while property/command workflows can fit the camera to that exact group extent, cycle sibling instances across layouts, and jump directly to named or ordinal peer targets without losing imported-instance context
- Editor canvas: line style edits are visible immediately with dashed/center/hidden patterns and weight differences using the same mapping contract as preview artifacts, including live effective `BYLAYER` layer defaults for line type / line weight
- Current layer: status bar readout + `layer` / `clayer` command input let the user query or switch active creation context, while `laymcur` promotes the selected entity layer without collapsing focus into current; `Line`, `Polyline`, `Circle`, `Arc`, and `Text` create on the active current layer and keep raw `BYLAYER` style (`color / line type / line weight`) so later layer-default edits stay visible in editor summaries and canvas rendering
- Current space/layout: status bar + command input now expose the active drafting session (`space` / `layout` / `mspace` / `pspace`), canvas picking/rendering filter to that session, and no-selection property actions switch between `Model` and real paper layouts; new `Line`/`Polyline`/`Circle`/`Arc`/`Text` entities inherit the active `space / layout` instead of silently falling back to model space
- Layer workflows: `layiso` / `layuniso` isolate and restore visibility sessions; `layoff` / `layon` hide selected layers with safe current-layer fallback and reversible restore; `layfrz` / `laythw` freeze selected layers with the same fallback/restore guarantees; `laylck` / `layulk` lock or unlock selected layers without leaving creation on a locked current layer; layer-panel and property-panel layer actions reuse the same contract
- JSON adapter:
  - import/export editor document snapshots (`vemcad-web-2d-v1`)
  - import/export CADGF `document.json` (aligns with `schemas/document.schema.json`, used by `plm_preview`)

Command input examples:
```
line
copy
offset 5
linetype dashed
lineweight 0.35
ltscale 1.5
layout Layout-A
pspace Layout-B
mspace
insgrp
instext
inserttext
instextedit
inserteditabletext
srcgrp
insedit
insfit
srcfit
srcrel
srcedit
srctext
srcplace
srcflip
srcanchor
srcdriver
leadfit
leadflip
dimflip
inspeer
inspeer 3
inspeer Layout-C
inspeer prev
insprev
insrel
relinsgrp
relinsfit
relinspeer
relinspeer Layout-C
relinsprev
rotate
scale 0.5 0 0
break
join
fillet 2
chamfer 2 3
ze
undo
redo
tan
nea
quad
grid
ortho
layer 2
clayer REDLINE
laymcur
layoff
layon
layfrz
laythw
laylck
layulk
text NOTE_A
exportcadgf
```

## Editor round-trip smoke (import -> edit -> export -> plm_convert)
From repo root:
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode observe --limit 5
```
Optional gate mode:
```bash
node tools/web_viewer/scripts/editor_roundtrip_smoke.js --mode gate --limit 5
```
Artifacts are written under `build/editor_roundtrip/<run_id>/`.

## Editor selection summary smoke
From `deps/cadgamefusion`:
```bash
node tools/web_viewer/scripts/editor_selection_summary_smoke.js
```
This validates the imported editor path, not a synthetic debug-only path:
- loads `tools/web_viewer/tests/fixtures/editor_selection_summary_fixture.json`
- selects the imported line in the real browser
- asserts stable `#cad-selection-details` facts for `origin / layer / layer color / layer state / effective color / color source / color ACI / space / layout / line type / line type source / line weight / line weight source / line type scale / line type scale source`
- edits `Layer ID`, then overrides color to explicit `TRUECOLOR`
- exercises explicit `lineWeight=0` as a real override, then uses property-panel `Use Layer Color` / `Use Layer Line Type` / `Use Layer Line Weight` / `Use Default Line Type Scale` to restore raw `BYLAYER` or default style without leaving stale export fields behind
- locks the selected layer through the debug API, asserts the matching layer row is focused, and uses property-panel `Unlock Layer` to recover the editing path

Artifacts are written under `build/editor_selection_summary_smoke/<run_id>/`.

## Editor source-group smoke
From `deps/cadgamefusion`:
```bash
node tools/web_viewer/scripts/editor_source_group_smoke.js
```
This validates grouped non-`INSERT` derived proxy affordances in the real browser:
- loads `tools/web_viewer/tests/fixtures/editor_source_group_fixture.json`
- covers grouped `DIMENSION`, `LEADER`, and `HATCH` proxy bundles under the real imported editor path
- asserts `group id / group source / source group members / editable members / read-only members / group center / group size / group bounds` in both quicklook and property metadata
- proves single imported `DIMENSION` / `LEADER` text proxies expose direct property edits for `value / position / height / rotation` while preserving `sourceType / editMode / proxyKind`
- verifies grouped non-`INSERT` selections expose `Select Source Group`, `Select Source Text`, `Select Anchor Driver`, `Use Opposite Text Side`, `Reset Source Text Placement`, `Fit Source Group`, `Release & Edit Source Text`, and `Release Source Group`, but do not expose insert-only actions like `Select Insert Group` or `Release Insert Group`
- proves full grouped-source selections keep `move / rotate / scale / copy / delete` bundle-level even when every member is read-only
- proves `srcgrp`, `srctext`, `srcdriver`, `srcplace`, `srcflip`, `srcfit`, `dimflip`, `srcrel`, and `srcedit` use the same source-group contract as the property panel
- proves direct text proxy edits keep grouped-source provenance intact, so imported annotation wording can be corrected without an immediate release/explode step
- proves grouped `DIMENSION` / `LEADER` bundles can focus their imported text proxies without release, edit wording/placement in place, and restore source placement through the real property form or command line
- proves whole-bundle `move / rotate / scale` carry `Source Text Pos / Source Text Rotation` forward, so later `srcplace` resets to the transformed source placement rather than the original import-space coordinates
- proves imported `DIMENSION` / `LEADER` text proxies now expose `Source Anchor / Source Offset / Current Offset`, so the text-to-anchor contract is visible in both quicklook and property metadata
- proves property action `Fit Source Anchor` and command-line `srcanchor` fit the camera to the same source anchor guide rendered on canvas, with `DIMENSION` preferring importer-supplied `source_anchor + source_anchor_driver_*` metadata and falling back to the longest non-text member midpoint only when explicit guide metadata is absent, while `LEADER` prefers explicit landing metadata and otherwise falls back to the nearest landing endpoint
- proves property action `Select Anchor Driver` and command-line `srcdriver` jump from imported text proxy to the exact geometry member that drives the anchor, without releasing the source bundle
- proves grouped `DIMENSION` text can use property action `Use Opposite Text Side` and command-line `srcflip` / `dimflip` to mirror the current text placement across the same source anchor, while preserving `sourceTextPos` for later `srcplace` reset
- proves imported `LEADER` text proxies expose `Leader Landing / Leader Elbow / Leader Landing Length` in both quicklook and property metadata, so the real landing geometry is inspectable without release
- proves property action `Fit Leader Landing` and command-line `leadfit` fit the camera to the same elbow-to-landing guide rendered on canvas, without inventing synthetic attachment metadata
- proves imported `LEADER` text proxies can use property action `Use Opposite Landing Side` and command-line `leadflip` / `leaderflip` to mirror text across the real landing guide while preserving `sourceTextPos` for later `srcplace` reset
- proves `Release Source Group` detaches the imported bundle to editable native geometry and removes stale grouped-source provenance from the released entities
- proves grouped `DIMENSION` bundles can use `srcedit` to release straight into editable text, and grouped `LEADER` bundles can use the property action to do the same without an extra manual reselection step
- keeps same-`groupId` members from other layouts out of the selection while preserving the visible source-group overlay/bounds contract

Artifacts are written under `build/editor_source_group_smoke/<run_id>/`.

## Editor MLEADER smoke
From `deps/cadgamefusion`:
```bash
node tools/web_viewer/scripts/editor_mleader_smoke.js
```
This validates the real imported `MLEADER` text-only path in the browser:
- loads `tools/web_viewer/tests/fixtures/editor_mleader_fixture.json`, a CADGF fixture copied from the real `step186_mleader_sample.dxf` preview output
- proves adapter import now infers a stable `LEADER / mleader / proxy` source-group contract instead of leaving the note as a plain text entity with no provenance
- asserts `group id / group source / source group members / editable members / read-only members / text kind / source text pos / source text rotation` in both quicklook and property metadata
- proves imported `MLEADER` text proxies expose direct property edits for `value / position / height / rotation` while preserving grouped-source provenance
- proves command-line `srcplace` resets the edited note back to the preserved imported placement
- proves property action `Fit Source Group` exposes the same source-group overlay contract for the one-text imported note
- proves text-only `MLEADER` falls back to a minimal self-anchor guide (`Source Anchor = Source Text Pos`) so reset/fit remains inspectable without inventing a fake driver entity
- proves command-line `srcedit` releases the imported note to native editable text in one step, without losing `text_kind=mleader`
- proves text-only `MLEADER` does not invent unsupported driver/elbow actions like `Select Anchor Driver`, `Fit Leader Landing`, or `Use Opposite Landing Side` when the real import path does not provide that geometry

Artifacts are written under `build/editor_mleader_smoke/<run_id>/`.

## Editor TABLE smoke
From `deps/cadgamefusion`:
```bash
node tools/web_viewer/scripts/editor_table_smoke.js
```
This validates the real imported `TABLE` text-only path in the browser:
- loads `tools/web_viewer/tests/fixtures/editor_table_fixture.json`, a CADGF fixture copied from the real `step186_table_sample.dxf` preview output
- proves adapter import now infers a stable `TABLE / table / proxy` source-group contract instead of leaving the note as plain editable text with no provenance
- asserts `group id / group source / source group members / editable members / read-only members / text kind / source text pos / source text rotation / source anchor / source offset / current offset` in both quicklook and property metadata
- proves imported `TABLE` text proxies expose direct property edits for `value / position / height / rotation` while preserving grouped-source provenance
- proves command-line `srcplace` resets the edited note back to the preserved imported placement
- proves property action `Fit Source Group` exposes the same source-group overlay contract for the one-text imported note
- proves command-line `srcedit` releases the imported note to native editable text in one step, without losing `text_kind=table`
- proves text-only `TABLE` does not invent unsupported driver/elbow/landing actions when the real import path does not provide that geometry

Artifacts are written under `build/editor_table_smoke/<run_id>/`.

## Editor classic leader smoke
From `deps/cadgamefusion`:
```bash
node tools/web_viewer/scripts/editor_classic_leader_smoke.js
```
This validates the real imported classic `LEADER + TEXT/MTEXT` browser path:
- loads `tools/web_viewer/tests/fixtures/editor_classic_leader_fixture.json`, a CADGF fixture copied from the real `step186_paperspace_combo_sample.dxf` preview output after importer-side leader-note association
- proves only the high-confidence `THIRD NOTE` pair becomes a `LEADER / leader / proxy` source group, while the other nearby paperspace text stays plain imported text
- asserts the imported note exposes the same grouped-source quicklook/property contract as synthetic leader bundles: `group id / group source / source group members / source anchor / source anchor driver / leader landing / leader elbow / source offset / current offset`
- proves the real imported note now carries explicit importer guide fields `source_anchor / leader_landing / leader_elbow / source_anchor_driver_type / source_anchor_driver_kind`, so `leadfit` and `srcdriver` resolve `188,150 -> 204,162` from importer metadata first and only fall back to geometry heuristics when explicit guide metadata is absent
- proves the same real combo fixture now carries explicit imported `DIMENSION` anchor metadata (`source_anchor / source_anchor_driver_type / source_anchor_driver_kind`) plus importer-authored `source_bundle_id`, and that older anonymous `*D...` payloads still recover the same bundle boundary through adapter-side fallback, so `srcdriver`, `srcanchor`, `srctext`, `dimflip`, and `srcplace` on text `78` or split arrowhead fragments resolve one unified 9-member source bundle instead of falling back to editor-side longest-member guessing
- proves direct proxy text edits still preserve `LEADER` provenance, `srcplace` resets back to the imported note position, and `srcdriver` jumps to the real imported leader polyline endpoint
- proves `leadfit`, `srcgrp`, `srctext`, `srcedit`, `srcanchor`, `srcdriver`, `dimflip`, and `srcplace` all operate on real imported combo content instead of a synthetic fixture-only path, and that shared `DIMENSION/LEADER` source-group flows still pass after the resolver switches to explicit-first and bundle-aware grouping
- proves releasing the note detaches provenance cleanly while preserving the edited text value

Artifacts are written under `build/editor_classic_leader_smoke/<run_id>/`.

## Editor insert-group smoke
From `deps/cadgamefusion`:
```bash
node tools/web_viewer/scripts/editor_insert_group_smoke.js
```
This validates the imported `INSERT` fragment group workflow in the real browser:
- loads `tools/web_viewer/tests/fixtures/editor_insert_group_fixture.json`
- switches into `Paper / Layout-A` and keeps the group workflow scoped to that active paper session
- single-selects one imported fragment and asserts `group id / block name / insert group members / editable members / read-only members`
- asserts `group center / group size / group bounds / peer instance / peer layouts / peer targets` in both quicklook and property metadata
- uses property-panel direct peer-target actions plus command-line `inspeer 2` / `inspeer Layout-C` / `insprev` to move the same imported instance identity across `Layout-A`, `Layout-B`, and `Layout-C`
- proves single-fragment, canonical text-only, full-group, and editable-only selections preserve their scope when peer-targeting across layouts
- uses property-panel `Fit Insert Group` to keep the imported instance boundary overlay and camera fit aligned to the same extents contract
- single-selects the imported proxy text member and proves `value` stays editable in place while `position / height / rotation` remain hidden and `INSERT / text / proxy` provenance stays intact
- uses property-panel `Select Insert Group` to expand selection to all matching `INSERT` members in the same `space / layout`
- verifies full-group `move`, `rotate`, and command-line `scale 0.5 0 0` keep the read-only proxy member aligned with the rest of the imported instance
- verifies full-group `copy` creates a detached native clone and full-group `delete` removes the proxy member with the rest of the instance
- uses property-panel `Select Editable Members` to collapse that mixed selection back to editable fragments only
- replays the editable-only path through command-line `insedit`
- uses property-panel `Release Insert Group` to strip imported insert provenance/group metadata from the whole instance and proves the former proxy text becomes directly editable through the real property form
- proves released `DoorNotes` text-only selections keep their archived text scope across surviving peer instances, so detached `[21,22]` can map through `relinspeer Layout-C` to `[27,28]` and through property action `Open ...` to `[24,25]` instead of collapsing to a single fragment
- proves that same released `DoorNotes` multi-selection now surfaces common archived context in both quicklook and property metadata, including `released-from / released-group-id / released-block-name / released-selection-members / released-peer-instance / released-peer-targets`
- keeps same-group fragments from other layouts out of the selection, while still exposing read-only proxy members inside the active insert group

Artifacts are written under `build/editor_insert_group_smoke/<run_id>/`.

## Editor insert-attribute smoke
From `deps/cadgamefusion`:
```bash
node tools/web_viewer/scripts/editor_insert_attribute_smoke.js
```
This validates the real imported inserted `ATTRIB / ATTDEF` text workflow in the browser:
- loads `tools/web_viewer/tests/fixtures/editor_insert_attribute_fixture.json`
- single-selects real imported `ATTRIB` text and confirms it is promoted to `INSERT / text / proxy`
- asserts `group id / block name / text kind / attribute tag / attribute flags` remain visible for imported `ATTRIB` text while the `value` field continues to edit the imported text payload
- asserts imported `ATTDEF` text exposes separate `attribute default / attribute prompt / attribute flags` metadata while the `value` field continues to edit default text semantics
- confirms `attribute_flags` drive the read-only `invisible / constant / verify / preset / lock-position` modes, with `lock-position=false` widening only real imported attribute text to `value + position.x / position.y` while `lock-position=true` stays value-only
- proves hidden constant insert text stays absent from visible-entity queries, can still be focused through `Select Insert Text`, and rejects in-place value edits with `UNSUPPORTED_READ_ONLY`
- proves hidden editable insert text also stays absent from visible-entity queries, but can be focused through `Select Insert Text` and edited through the same imported attribute proxy contract for both `value` and `position` without losing selection or the insert-group overlay
- proves mixed imported insert-attribute groups distinguish `Select Insert Text` from `Select Editable Insert Text`, so constant text can stay out of the narrowed editable selection while `instextedit` replays the same scope from the command bar
- proves `Release & Edit Insert Text` detaches imported attribute semantics as well as insert provenance, so the released text edits like plain text instead of retaining live `attribute_*` contract fields, while still surfacing archived read-only `released-from / released-block-name / released-text-kind / released-attribute-*` context in selection/property UI
- proves released insert text can jump back to surviving imported insert members through property action `Select Released Insert Group`, command-line `relinsgrp`, and property action `Fit Released Insert Group`, all driven by archived `groupId` instead of revived live insert semantics
- proves released insert text can also navigate directly across surviving peer instances through property actions `Open ...` / `Previous Released Peer` / `Next Released Peer` and command-line `relinspeer` / `relinsprev`, while staying archived plain text until the user intentionally re-enters live insert context
- edits the `ATTRIB` text value in place and keeps `INSERT` provenance intact
- uses `Select Insert Group` to expand from the text proxy back to the two-member insert instance
- repeats the same contract for real imported inserted `ATTDEF` text, where `value` semantically edits the authoritative default text, `attribute_prompt` stays read-only metadata, and unlocked attributes can also reposition text in place while staying `INSERT / text / proxy`

The browser smoke and `tools/web_viewer/tests/editor_commands.test.js` both verify that imported `ATTDEF` default text and prompt stay split, and that `constant / invisible / lock-position` flags now drive real editor behavior rather than metadata-only labels.

Artifacts are written under `build/editor_insert_attribute_smoke/<run_id>/`.

## Editor current-layer smoke
From `deps/cadgamefusion`:
```bash
node tools/web_viewer/scripts/editor_current_layer_smoke.js
```
This validates the drafting-side current-layer contract:
- imported editable layers become the initial current layer
- layer panel `Use/Current` switches creation context without hijacking focused layer
- selecting an entity can keep focus on one layer while current layer remains on another
- property-panel `Make Current` and command-line `laymcur` promote the selected entity layer into current
- no-selection property panel rows expose current-layer drafting defaults for `color / line type / line weight`
- `Line` creation lands on the active current layer, including after `laymcur`, keeps raw `BYLAYER` style, and renders with the target layer effective `color / line type / line weight`
- drafted entities also keep `lineTypeScaleSource = DEFAULT`, so `line_type_scale` is omitted on export until the user makes it explicit
- `laymcur` refuses locked drawing targets instead of silently switching
- locking the current layer falls back to a safe editable layer before the next creation

Artifacts are written under `build/editor_current_layer_smoke/<run_id>/`.

## Editor space/layout smoke
From `deps/cadgamefusion`:
```bash
node tools/web_viewer/scripts/editor_space_layout_smoke.js
```
This validates the editor-side current `space / layout` session contract:
- CADGF import initializes the editor in model space when model entities exist, while still discovering available paper layouts
- command-line `layout` / `pspace` / `mspace` switch the active drafting session instead of only changing metadata labels
- canvas rendering and hit-testing filter to the active `space / layout`, so model and paper entities stop overlapping in the same edit surface
- no-selection property-panel actions expose `Use Model Space` and `Use Layout ...` for available paper layouts
- `Line` creation in `Layout-A`, `Layout-B`, and `Model` inherits the active `space / layout` through the real tool path, not a debug-only patch path
- single-selection facts continue to show `Space` / `Layout` provenance for created entities in each session

Artifacts are written under `build/editor_space_layout_smoke/<run_id>/`.

## Editor layer-session smoke
From `deps/cadgamefusion`:
```bash
node tools/web_viewer/scripts/editor_layer_session_smoke.js
```
This validates reversible layer session workflows beyond the raw flag toggles:
- property-panel `Turn Off Layer` hides the selected layer and falls current back to an editable visible layer
- command-line `layon` restores the prior layer-off session and current-layer preference
- property-panel `Lock Layer` locks the selected layer and falls current back before the next creation when the current drafting target is locked
- command-line `layulk` unlocks the selected layer without mutating unrelated locked layers
- command-line `layfrz` freezes the selected layer and keeps new drawing on the fallback current layer
- fallback creations after `laylck` / `layfrz` inherit the fallback layer raw `BYLAYER` style (`color / line type / line weight`) instead of editor hard-coded draft values
- fallback creations also keep `lineTypeScaleSource = DEFAULT`, matching the regular drafting path instead of baking an explicit `line_type_scale`
- property-panel `Thaw Layers` restores the prior freeze session and returns current layer to the restored drafting target
- layer-panel `Frozen/Live` keeps its persistent toggle semantics while still refusing to strand drawing on an unfrozen-invalid current layer; when freezing the current layer, the next creation falls onto the safe fallback layer

Artifacts are written under `build/editor_layer_session_smoke/<run_id>/`.

## Preview provenance smoke
From `deps/cadgamefusion`:
```bash
node tools/web_viewer/scripts/preview_provenance_smoke.js
```
The script now starts a temporary static server automatically and prints:
- `run_id=...`
- `run_dir=...`
- `summary_json=...`

You can still target an existing server with:
```bash
node tools/web_viewer/scripts/preview_provenance_smoke.js --base-url http://127.0.0.1:8080/
```

You can also point it at an explicit case set:
```bash
node tools/web_viewer/scripts/preview_provenance_smoke.js \
  --cases tools/web_viewer/tests/fixtures/preview_provenance_failure_cases.json
```

This checks three preview contract paths:
- `line-only` exploded insert provenance via `build/step186_origin_blocks/manifest.json&mesh=0`
- `document-only` dimension provenance via `build/step186_origin_dimension/manifest.json`
- `line-only` hatch provenance via `build/step186_origin_hatch/manifest.json&mesh=0`

Artifacts are written under `build/preview_provenance_smoke/<run_id>/`.

CI integration:
- `tools/editor_gate.sh` now runs preview provenance smoke in gate mode by default
- `tools/editor_gate.sh` also runs a preview provenance failure-injection case set against:
  - missing `document_json`
  - invalid manifest JSON
  - invalid `mesh_metadata` JSON
- `tools/editor_gate.sh` also runs preview artifact validator failure injection against:
  - invalid `mesh_metadata` JSON
  - provenance mismatch between `document.json` and `mesh_metadata.json`
  - layout/viewport metadata mismatch
  - `summary.spaces[*]` count mismatch
  - duplicate layout names / multiple default layouts
  - `source_type` semantic mismatch for `INSERT` / `DIMENSION` / `HATCH`
  - `color_source` semantic mismatch for `INDEX` / `TRUECOLOR` / `BYLAYER`
  - style-precedence drift for `line_type` / `line_weight` / `line_type_scale`
- `tools/local_ci.sh` exposes:
  - `RUN_PREVIEW_PROVENANCE_SMOKE=1`
  - `RUN_PREVIEW_PROVENANCE_SMOKE_GATE=1`
  - `RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION=1`
  - `RUN_PREVIEW_PROVENANCE_FAILURE_INJECTION_GATE=1`
  - `RUN_PREVIEW_ARTIFACT_SMOKE=1`
  - `RUN_PREVIEW_ARTIFACT_SMOKE_GATE=1`
  - `RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION=1`
  - `RUN_PREVIEW_ARTIFACT_VALIDATOR_FAILURE_INJECTION_GATE=1`

Artifact-validator red-path runner:
```bash
python3 tools/validate_plm_preview_artifacts_failure_injection.py
```
This consumes:
- `tools/web_viewer/tests/fixtures/preview_artifact_validator_failure_cases.json`

Positive real-artifact smoke runner:
```bash
python3 tools/validate_plm_preview_artifacts_smoke.py
```
This consumes:
- `tools/web_viewer/tests/fixtures/preview_artifact_smoke_cases.json`

Current positive case set covers:
- `build/step186_origin_blocks`
- `build/step186_origin_dimension/manifest.json`
- `build/step186_origin_hatch`
- `build/step186_text_kinds/manifest.json`
- `build/step186_mleader/manifest.json`
- `build/step186_table/manifest.json`
- `build/step186_leader`
- `build/step186_origin_mixed`
- `build/step186_multi_layout`
- `build/step186_paperspace_insert_styles`
- `build/step186_viewport_sample`

Optional legacy-only case set:
- `tools/web_viewer/tests/fixtures/preview_artifact_smoke_cases_legacy.json`
- `build/plm_preview_dim_hatch`
- `build/plm_preview_btj01239601522_layout`
- `build/plm_preview_j0225034_layoutfix_meta`

`build/step186_origin_mixed` is generated from:
- `tests/plugin_data/step186_mixed_origin_sample.dxf`

`build/step186_multi_layout` is generated from:
- `tests/plugin_data/step186_multi_layout_sample.dxf`

`build/step186_text_kinds` is generated from:
- `tests/plugin_data/step186_text_kinds_sample.dxf`

It is intended to keep one real converter artifact that spans:
- exploded `INSERT` provenance
- proxy `DIMENSION` provenance on both text and geometry
- proxy `HATCH` provenance
- paper-layout viewport metadata

Default preview smoke no longer depends on pre-existing large legacy artifacts.
`tools/prepare_step186_preview_artifacts.py` regenerates the default eleven Step186 artifacts from local DXF fixtures, and both `tools/local_ci.sh` and `tools/editor_gate.sh` run that prep stage automatically before preview smoke.

`tools/editor_weekly_validation.sh` keeps the larger legacy preview set on a separate weekly-only lane:
- `tools/web_viewer/tests/fixtures/preview_artifact_smoke_cases_legacy.json`
- `build/plm_preview_dim_hatch`
- `build/plm_preview_btj01239601522_layout`
- `build/plm_preview_j0225034_layoutfix_meta`

That weekly-only lane now runs in two stages:
- `tools/prepare_legacy_preview_artifacts.py` regenerates each target directory from its existing `manifest.json` (`input` / `plugin` / `outputs`);
- `tools/validate_plm_preview_artifacts_smoke.py` then validates the refreshed legacy directories under the same strict Step186 rules as current artifacts.

`tools/local_ci.sh` now defaults all preview smoke/failure-injection outdirs under `build/`, so an empty environment variable no longer causes summaries to spill into the repo root.

You can also pass query params to auto-load artifacts:
```
http://localhost:8080/tools/web_viewer/index.html?gltf=sample_exports/scene_sample/mesh_group_0.gltf
http://localhost:8080/tools/web_viewer/index.html?manifest=build_vcpkg/convert_cli_smoke/manifest.json
http://localhost:8080/tools/web_viewer/index.html?manifest=build_vcpkg/convert_cli_smoke/manifest.json&project_id=demo&document_label=sample&document_id=ZGVtbwpzYW1wbGU
```
Fresh `convert_cli --json --gltf` output directories now emit `manifest.json` directly, so a raw converter run can be opened without `plm_convert.py` wrapping:
```
http://localhost:8080/tools/web_viewer/index.html?manifest=build/step186_viewport_sample/manifest.json
```
Document metadata fields (`project_id`, `document_label`, `document_id`) are optional, but if provided they appear in the Document panel.
If the manifest also contains these fields, the viewer falls back to them when the URL omits query parameters.

## PLM preview loop
Generate artifacts with `tools/plm_preview.py`, then open the provided URL.
```
python3 tools/plm_preview.py --plugin path/to/plugin.so --input path/to/input.dxf --out build_vcpkg/plm_preview
```
To include document metadata in the preview URL:
```
python3 tools/plm_preview.py --plugin path/to/plugin.so --input path/to/input.dxf --out build_vcpkg/plm_preview --project-id demo --document-label sample
```

## PLM router service
Run a local service that accepts uploads and returns a preview URL:
```
python3 tools/plm_router_service.py --default-plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib --default-convert-cli build_vcpkg/tools/convert_cli
```
Then upload a file:
```
curl -s -X POST -F "file=@tests/plugin_data/importer_sample.dxf" http://localhost:9000/convert
```
The JSON response includes `viewer_url` for the web preview.

CLI helper for the same flow:
```
python3 tools/plm_router_smoke.py \
  --input tests/plugin_data/importer_sample.dxf \
  --plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
  --emit json,gltf,meta
```

Async upload with status polling:
```
curl -s -X POST -F "file=@tests/plugin_data/importer_sample.dxf" -F "async=true" http://localhost:9000/convert
curl -s http://localhost:9000/status/<task_id>
```

## Notes
- Default glTF path points to `sample_exports/scene_sample/mesh_group_0.gltf`.
- Use the URL field to load artifacts produced by `convert_cli` (e.g., `build_vcpkg/convert_cli_smoke/mesh.gltf`).
- When a manifest provides `document_json` and `mesh_metadata`, the viewer applies per-entity colors and shows DXF color metadata on selection.
- Layer list is populated from document.json (preferred) or mesh_metadata when available.
- Shift + click adds a simple annotation marker.
- A basic PWA manifest + service worker are included for offline caching of the viewer UI (assets only).
- Core Three.js modules are vendored under `tools/web_viewer/vendor/three`, so viewer module loading no longer depends on `https://unpkg.com`.
- UI fonts are vendored under `tools/web_viewer/vendor/fonts`, so the viewer no longer depends on `fonts.googleapis.com` or `fonts.gstatic.com` for first paint.

## Preview Provenance Smoke Coverage
`tools/web_viewer/scripts/preview_provenance_smoke.js` now covers twelve stable browser cases:
- exploded `INSERT`
- proxy `DIMENSION`
- proxy `HATCH`
- real `ATTRIB` text-kind selection from `build/step186_text_kinds`
- real `ATTDEF` text-kind selection from `build/step186_text_kinds`
- real `MTEXT` text-kind selection from `build/step186_text_kinds`
- real `MLEADER` text-kind selection from `build/step186_mleader`
- real `TABLE` text-kind selection from `build/step186_table`
- real `LEADER` line-only proxy selection from `build/step186_leader`
- real mixed paper-space text from `build/step186_origin_mixed`
- real multi-layout paper-space text from `build/step186_multi_layout`
- real paper-space exploded insert style/provenance from `build/step186_paperspace_insert_styles`

The text-kind artifact loads:
```text
tools/web_viewer/index.html?manifest=build/step186_text_kinds/manifest.json&text_filter=all
```

Expected selections include:
- `Value / ATTRIB_FULL_ALIGN` + `Text Kind / attrib`
- `Value / ATTDEF_PARTIAL_ALIGN_Y_ONLY` + `Text Kind / attdef`
- `Value / MTEXT_PARTIAL_ALIGN_X_ONLY` + `Text Kind / mtext`
- `Value / MLEADER_STEP186 SECOND_LINE` + `Text Kind / mleader`
- `Value / TABLE_STEP186 ROW_2` + `Text Kind / table`

The provenance smoke runner now falls back from coarse viewport grid clicks to text-label targeting for text-only artifacts, so these browser checks stay stable even when the document has no mesh or line geometry.

The mixed paper-space case loads:
```text
tools/web_viewer/index.html?manifest=build/step186_origin_mixed/manifest.json&mesh=0&text_filter=all&space=1&layout=LayoutMixed
```

Expected selection includes:
- `Value / PAPER NOTE`

The paper-space insert style case loads:
```text
tools/web_viewer/index.html?manifest=build/step186_paperspace_insert_styles/manifest.json&mesh=0&space=1&layout=LayoutStyle
```

Expected selection includes:
- `Color Source / BYBLOCK`
- `Line Type / CENTER`
- `Line Weight / 0.5`
- `Line Type Scale / 0.25`
- `Origin / INSERT/insert | exploded`
- `Block Name / PaperStyledBlock`
- `Space / 1`
- `Layout / LayoutStyle`

This case exists to guard a real importer path where paper-space entities come from `*Paper_Space*` DXF blocks rather than top-level entity storage.

The `LEADER` case loads:
```text
tools/web_viewer/index.html?manifest=build/step186_leader/manifest.json&mesh=0
```

Expected selection includes:
- `Origin / LEADER/leader | proxy`
- `Space / 0`

The multi-layout case loads:
```text
tools/web_viewer/index.html?manifest=build/step186_multi_layout/manifest.json&mesh=0&text_filter=all&space=1&layout=LayoutB
```

Expected selection includes:
- `Value / LAYOUT B NOTE`
- `Space / 1`
- `Layout / LayoutB`

This case exists to guard the second real paper layout path where:
- `LayoutA` content arrives from top-level `ENTITIES`; and
- `LayoutB` content arrives from `*Paper_Space1` block storage and must still survive importer + converter + preview selection.
