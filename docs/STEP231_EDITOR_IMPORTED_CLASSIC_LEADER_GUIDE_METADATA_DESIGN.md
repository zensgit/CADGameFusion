# Step231: Editor Imported Classic LEADER Guide Metadata Design

## Goal

Make real imported classic `LEADER + TEXT/MTEXT` notes carry an explicit anchor/landing/elbow contract from the DXF importer all the way into the editor, so `srcdriver`, `leadfit`, and `leadflip` stop depending on editor-side endpoint guessing when importer truth is available.

## Problem

Step230 solved the first half of the problem: real classic leader notes were promoted into the grouped `LEADER / proxy` workflow. But their guide geometry was still reconstructed inside [insert_group.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/insert_group.js) from group members.

That left three gaps:

- the importer knew which classic note was matched, but did not publish the guide points that made the match interpretable
- `leadfit` / `srcdriver` still depended on runtime geometry heuristics instead of importer-authored structure
- whole-group `move / rotate / scale` and `release / copy` had no explicit guide metadata to carry or strip

## Design

### 1. Importer emits explicit guide metadata for matched classic leader notes

When [dxf_importer_plugin.cpp](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/plugins/dxf_importer_plugin.cpp) accepts a classic leader-note pair, it now writes these fields onto the matched text proxy metadata:

- `source_anchor`
- `leader_landing`
- `leader_elbow`
- `source_anchor_driver_type`
- `source_anchor_driver_kind`

For the current classic `LEADER` path:

- `source_anchor` is the chosen leader endpoint nearest the matched note text
- `leader_landing` currently equals `source_anchor`
- `leader_elbow` is the adjacent polyline vertex
- driver hints are emitted as `polyline / endpoint`

The classic leader association heuristic itself is intentionally unchanged; Step231 only makes its accepted guide explicit and reusable downstream.

### 2. JSON export surfaces guide fields as first-class entity fields

[convert_cli.cpp](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/convert_cli.cpp) now promotes those importer metadata values into top-level entity JSON:

- `"source_anchor": [x, y]`
- `"leader_landing": [x, y]`
- `"leader_elbow": [x, y]`
- `"source_anchor_driver_type": "..."`
- `"source_anchor_driver_kind": "..."`

This keeps the editor contract visible in real preview artifacts and smoke fixtures instead of hiding it only inside document metadata.

### 3. Adapter and state normalize the explicit guide contract

[cadgf_document_adapter.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/adapters/cadgf_document_adapter.js) and [documentState.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/state/documentState.js) now normalize:

- `source_anchor -> sourceAnchor`
- `leader_landing -> leaderLanding`
- `leader_elbow -> leaderElbow`
- `source_anchor_driver_type -> sourceAnchorDriverType`
- `source_anchor_driver_kind -> sourceAnchorDriverKind`

The adapter also exports these fields back out, so roundtrip fixtures and editor-edited documents preserve the guide contract.

### 4. Source-text guide resolution becomes explicit-first, heuristic-fallback

[insert_group.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/insert_group.js) now resolves grouped annotation guides in this order:

1. If a text proxy has explicit guide metadata, use it.
2. Try to match the explicit anchor back to a real member entity to recover `anchorDriverId`.
3. Only fall back to the old geometry heuristic when explicit guide fields are absent.

This keeps current `DIMENSION` and synthetic grouped-source behavior intact while making real imported classic leaders importer-authoritative.

### 5. Whole-group transforms carry the explicit guide; release/copy strip it

[geometry.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/tools/geometry.js) now moves/rotates/scales:

- `sourceAnchor`
- `leaderLanding`
- `leaderElbow`

alongside existing `sourceTextPos / sourceTextRotation`.

[command_registry.js](/Users/huazhou/Downloads/Github/VemCAD/deps/cadgamefusion/tools/web_viewer/commands/command_registry.js) now strips the explicit guide fields when imported provenance is intentionally detached:

- created detached copies
- released insert/source entities

This keeps native geometry clean after release while preserving the reversible grouped-source contract before release.

## Scope Boundaries

Included:

- real classic `LEADER + TEXT/MTEXT` pairs that importer already accepts
- explicit guide propagation into preview JSON, adapter import/export, and editor state
- explicit-first guide resolution for grouped `LEADER` text proxies

Not included:

- widening the classic leader-note pairing heuristic
- guessing associations for ambiguous nearby texts
- introducing new editor-only guide inference rules for unmatched imports

## Benchmark Impact

This pushes VemCAD past the weaker reference pattern of:

- pairing the note but rebuilding guide geometry only in the editor
- or requiring explode/release before the note becomes structurally understandable

The importer now publishes the same guide contract that the editor and browser smoke consume, which is a stronger and more debuggable end-to-end workflow on real imported data.
