# STEP203 Editor Style Source Controls Design

## Scope

This step closes the next style-contract gap after Step202:

- single-select inspection now exposes source facts for `line type` and `line weight`, not just effective values
- property-panel editing gains explicit recovery actions back to layer defaults
- CADGF export now preserves that recovery instead of leaking stale `color_aci` or stale line-weight fields from imported base entities

The target is an editor contract that is closer to AutoCAD/BricsCAD-style layer override workflows and more explicit than the lightweight reference editors that only show effective style.

## Problem

Before this step:

- Step202 already resolved effective `BYLAYER` style in canvas, selection summary, and property metadata
- but the UI still made users infer whether `line type` and `line weight` were explicit overrides or inherited from the layer
- property editing could push an imported entity into explicit style override state, but there was no one-click path to recover `BYLAYER`
- CADGF export still had a structural bug: reverting explicit color to `BYLAYER` could leave stale `color_aci` behind because patch deletion got lost when merged with the imported base entity

That created a benchmark-visible weakness:

- commercial CAD users expect clear override vs inherited state
- the layer-aware editor now had the right effective-style machinery, but not the recovery workflow
- import/export truth was weaker than UI truth

## Design

### 1. Source facts become first-class UI contract

- `tools/web_viewer/line_style.js`
  - adds `resolveEntityStyleSources(entity)`
  - normalizes:
    - `colorSource`
    - `lineTypeSource`
    - `lineWeightSource`
- `tools/web_viewer/ui/selection_presenter.js`
  - appends `line-type-source` and `line-weight-source` into single-select detail facts
- `tools/web_viewer/ui/property_panel.js`
  - mirrors the same source rows in readonly metadata

The contract is now:

- effective style answers “what the user sees”
- source rows answer “why the user sees it”

That separation is important for imported DWG/CADGF content where effective style alone is not enough to decide whether a layer change should propagate.

### 2. Property panel gets reversible layer-style recovery actions

- `tools/web_viewer/ui/property_panel.js`
  - adds:
    - `Use Layer Color`
    - `Use Layer Line Type`
    - `Use Layer Line Weight`
  - only shows each action when the selected entity is currently overriding that layer default
  - keeps action visibility aligned with the same normalized source rules used in selection details

This is deliberately benchmark-oriented:

- the common operation is not “type BYLAYER manually”
- the common operation is “remove the override and go back to the layer”

So the step optimizes the recovery path, not just the raw field editing path.

### 3. Export finalize path preserves field deletion semantics

- `tools/web_viewer/adapters/cadgf_document_adapter.js`
  - `ensureCadgfEntityBase(...)` no longer invents `color_aci` when the field is intentionally absent
  - export branches now finalize from a cloned base entity and apply patch/style/color updates in place before the final normalize pass
  - this prevents imported base fields from reappearing after an explicit reset to layer defaults

This is the core persistence fix in Step203.

Without it:

- property UI could say `BYLAYER`
- in-memory entity could say `BYLAYER`
- export could still emit stale explicit provenance

After this step, the recovery action is honest all the way through export.

### 4. Step203 stays intentionally narrow

This step does not attempt to solve all style provenance.

Specifically:

- `lineTypeScale` still remains entity-scoped and has no explicit/default source contract yet
- `lineWeight` still uses the existing pragmatic `0 => BYLAYER` editor rule
- no `BYBLOCK` line-weight propagation engine is introduced

Those are real follow-up items, but they are separate from the Step203 goal of making layer-style overrides inspectable and reversible.

## Behavior Contract

- selection details expose:
  - `line-type-source`
  - `line-weight-source`
- property metadata exposes the same source rows
- explicit style overrides can be cleared through dedicated property actions instead of manual keyword entry
- after `Use Layer Color`, export no longer leaks stale `color_aci`
- after `Use Layer Line Weight`, export no longer leaks stale imported `line_weight`
- imported base entities and editor-created entities now converge on the same persisted truth after recovery to layer defaults

## Benchmark Intent

Step203 is not “more geometry”. It is a workflow-quality step.

Relative to benchmark products and references:

- closer to AutoCAD/BricsCAD because override-vs-layer recovery is now explicit in the editing surface
- stronger than lightweight viewer-editors because inspection and persistence now agree
- cleaner than many reference implementations because the same source normalization feeds selection details, property UI, and export behavior

The main improvement is that the editor no longer forces the user to reverse-engineer style provenance from effective values alone.
