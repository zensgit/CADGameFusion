# Step229: Editor Imported MLEADER Proxy Design

## Goal
Bring real imported `MLEADER` text-only notes into the same editor-side source/proxy workflow as imported `DIMENSION` and `LEADER` text proxies, without inventing unsafe classic `LEADER + TEXT` pairing heuristics.

## Why This Slice
- Real imported `MLEADER` already reaches CADGF as `TEXT + text_kind=mleader`, but it previously stopped there and looked like ordinary editable text with no provenance.
- Classic `LEADER + TEXT/MTEXT` pairing is not yet safe to generalize from current importer evidence, so pushing hard on heuristic association would risk false bundles.
- `MLEADER` is the real imported path that already carries text semantics end-to-end; turning it into a first-class proxy workflow is the narrowest high-value step.

## Contract
Imported `TEXT` entities with `text_kind=mleader` and no explicit source metadata now import into the editor as:
- `sourceType = LEADER`
- `editMode = proxy`
- `proxyKind = mleader`
- synthetic single-entity `groupId`
- `sourceTextPos / sourceTextRotation` copied from the imported text geometry

That contract enables existing editor workflows on real imported `MLEADER` notes:
- direct in-place text overrides for `value / position / height / rotation`
- `srcplace` / `Reset Source Text Placement`
- `Fit Source Group`
- `Release & Edit Source Text`
- `Release Source Group`
- grouped-source facts in quicklook/property metadata

Text-only `MLEADER` uses a minimal self-anchor guide:
- `Source Anchor = Source Text Pos`
- `Leader Landing = Source Text Pos`
- `Source Offset = 0, 0` when unmodified

This preserves a stable reset/fit contract without pretending there is a real driver entity or elbow segment.

## Implementation Notes
- `cadgf_document_adapter.js`
  - infers `LEADER / proxy / mleader` for imported `TEXT` entities with `text_kind=mleader`
  - synthesizes stable `groupId` values only when the imported payload lacks them
  - keeps `text_kind=mleader` unchanged through import and export
- `editor_commands.test.js`
  - covers adapter inference/export
  - covers one-step `selection.sourceEditGroupText` release on single imported `MLEADER` proxy text
- `editor_mleader_smoke.js`
  - loads a CADGF fixture copied from the real `step186_mleader_sample.dxf` preview output
  - verifies real-browser in-place edit, `srcplace`, `Fit Source Group`, and `srcedit`

## Out Of Scope
- Classic `LEADER + TEXT/MTEXT` association heuristics
- Importer-side handle/link reconstruction for leader-note pairing
- Synthesizing fake elbow/driver metadata for text-only `MLEADER`
- New command ids; this slice intentionally reuses the existing source/proxy command surface
