# Step230: Editor Imported Classic LEADER Association Design

## Goal

Promote real imported classic `LEADER + TEXT/MTEXT` notes into the same editor-side source/proxy workflow already used by synthetic leader bundles and imported `MLEADER`, without introducing broad pairing heuristics or editor-only guesswork.

## Problem

Before this step, classic DXF `LEADER` entities arrived as `LEADER / proxy` polylines, but nearby note text remained plain imported `TEXT/MTEXT`. That left a real product gap versus benchmark editors:

- the imported note could not use `srctext`, `srcdriver`, `srcplace`, `leadfit`, or `srcedit`
- the browser only had the richer `LEADER` workflow on synthetic fixtures
- multiple classic leaders inside the same paperspace root block inherited the same coarse root `group_id`, so editor-side grouping could not safely distinguish one note bundle from another

## Design

### 1. Importer-side association, not editor-side guessing

The association is resolved inside [dxf_importer_plugin.cpp](../plugins/dxf_importer_plugin.cpp), after `space/layout` attribution is known and before CADGF entities are emitted.

This keeps the source contract authoritative at import time and avoids pushing ambiguous pairing into the editor.

### 2. Low-recall, high-confidence heuristic

The new `associate_classic_leader_notes(...)` pass only considers:

- classic `LEADER` polylines already tagged as `source_type=LEADER`, `edit_mode=proxy`, `proxy_kind=leader`
- plain `TEXT/MTEXT` only
- same `space/layout` only
- distance from the note insertion point to the leader tail endpoint or final segment only

Acceptance requires both sides to have a clear winner:

- note distance must be within `max(15, 5 * text_height)`
- leader-side best candidate must beat the second candidate by `1.8x`
- text-side best leader must beat the second leader by `1.8x`

Rejected evidence by design:

- `330 owner_handle`
- same layer
- nearby file ordering or handle adjacency
- broad nearest-neighbor pairing across all leader segments

### 3. Per-leader local grouping

Every classic leader gets its own local source-group tag, even when unmatched.

Why:

- paperspace root blocks can contain multiple classic leaders
- a single inherited root block `group_id` would incorrectly merge unrelated `LEADER` proxies
- the editor’s source-group contract groups by `group_id + source_type + space/layout`, so importer-side per-leader grouping is the narrowest stable fix

These local tags are converted to actual CADGF `group_id` values at emission time:

- top-level entities allocate from a top-level local-group map
- each block emission frame allocates from its own local-group map
- root-space blocks can therefore hold multiple distinct leader note bundles without cross-merging

### 4. Root-space only

Classic leader-note association is applied to:

- top-level entities
- root-space blocks only (`*MODEL_SPACE`, `*PAPER_SPACE*`)

It intentionally does not rewrite arbitrary reusable block definitions into standalone `LEADER` source bundles inside imported `INSERT` workflows.

## Resulting Contract

For a matched classic note:

- leader polyline and note text share the same `group_id`
- note text gets `source_type=LEADER`, `edit_mode=proxy`, `proxy_kind=leader`
- note keeps its original `text_kind=text|mtext`
- existing adapter fallback turns imported text `pos/rot` into `sourceTextPos/sourceTextRotation`
- existing editor guide logic derives `source-anchor / source-anchor-driver / leader-landing / leader-elbow`

This means the editor can immediately reuse existing commands and property actions:

- `srcgrp`
- `srctext`
- `srcdriver`
- `srcplace`
- `leadfit`
- `srcedit`

No JS runtime logic changes were required for the source-group workflow itself.

## Positive / Negative Samples

Positive sample:

- [step186_paperspace_combo_sample.dxf](../tests/plugin_data/step186_paperspace_combo_sample.dxf)

Expected positive pair:

- `LEADER 6C`
- `TEXT 6D = THIRD NOTE`

Required negatives:

- [step186_paperspace_insert_leader_sample.dxf](../tests/plugin_data/step186_paperspace_insert_leader_sample.dxf)
- [step186_paperspace_annotation_bundle_sample.dxf](../tests/plugin_data/step186_paperspace_annotation_bundle_sample.dxf)

These must keep zero classic leader-note text associations.

## Benchmark Impact

This closes a real gap versus reference editors that can inspect imported leader notes as an annotation workflow rather than as unrelated geometry + text.

It also exceeds weaker reference behavior that requires explode/release before the note can participate in a structured provenance workflow.
