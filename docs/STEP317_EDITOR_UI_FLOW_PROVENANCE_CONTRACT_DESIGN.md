# Step317 Editor UI Flow Provenance Contract Design

## Goal

Remove the stale `selection_provenance_summary` red point from `editor_ui_flow_smoke.sh` by aligning the smoke contract with the current layer-aware BYLAYER semantics.

## Problem

The smoke already understood the pre-edit contract:

- layer `0:0`
- `color-source = BYLAYER`
- `effective-color = #d0d7de`

But the post-edit half still waited for a legacy hard-coded target:

- `layer = 1:L1`
- `effective-color = #ff0000`

That no longer matched runtime behavior. In the current editor contract, reassigning to layer `1` resolves through the actual target layer definition, whose default color is `#9ca3af`.

The bottom Python gate in the same script also still checked the old assumptions:

- pre-edit `effective-color == #808080`
- post-edit `effective-color == #ff0000`

So the step was red because the smoke contract drifted, not because the editor regressed.

## Design

Update `tools/web_viewer/scripts/editor_ui_flow_smoke.sh` so `selection_provenance_summary` derives its post-edit expectations from the live layer contract:

- read the target layer with `readLayerById(1)`
- require `targetLayer.name` and `targetLayer.color`
- compute `targetLayerLabel = "1:<name>"`
- wait for selection details to show:
  - `layer == targetLayerLabel`
  - `color-source == BYLAYER`
  - `effective-color == targetLayer.color`

Persist that contract into `results.selection_provenance_summary.target_layer` so the Python gate can validate against the same runtime-derived expectation.

## Boundaries

This step does not change:

- editor layer semantics
- BYLAYER rendering logic
- property panel runtime behavior
- selection presenter contracts

It only updates the smoke and the gate to stop assuming a stale red target layer.

## Expected Outcome

`editor_ui_flow` should move past `selection_provenance_summary` using the real target layer contract, and the long-standing timeout at that step should disappear.
