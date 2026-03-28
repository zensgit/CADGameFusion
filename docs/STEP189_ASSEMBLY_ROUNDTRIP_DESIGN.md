# STEP189 Assembly Roundtrip Design

## Goal
Promote the current assembly/instance provenance work from preview-only visibility into an
explicit editor roundtrip contract.

The roundtrip lane proves that imported assembly semantics survive the edit/export/import cycle.

## Why This Step Exists
The repository already has meaningful assembly metadata:
- `group_id`
- `block_name`
- `space`
- `layout`
- exploded insert provenance
- derived proxy metadata

Those fields matter only if they survive actual roundtrip flows. Step189 turns that into a
stable CTest lane.

## Lanes
The roundtrip contract is intentionally split into four lanes:
1. `editor_assembly_roundtrip_smoke`
   - model-space assembly baseline
2. `editor_assembly_roundtrip_paperspace_smoke`
   - paperspace insert/leader sample
3. `editor_assembly_roundtrip_mixed_smoke`
   - mixed origin sample with assembly + proxy + layout interaction
4. `editor_assembly_roundtrip_dense_smoke`
   - dense matrix over multiple Step186 real samples

## Core Contract
The roundtrip lane checks that exported/imported semantics do not drift for:
- assembly groups
- exploded insert origin fragments
- derived proxy entities
- `space/layout`
- text/proxy/layout relationships
- viewport-aware paperspace cases

The key outcome is not just that entities survive, but that provenance survives.

## Primary Metrics
The existing summaries already expose the useful high-level metrics:
- tracked assembly entity count
- assembly group count
- derived proxy count
- exploded origin count
- metadata drift count
- group drift count

These metrics are sufficient to guard the current product boundary without inventing a new schema.

## Non-Goals
- no block-instance native editing in this step;
- no full CAD assembly graph UI;
- no DWG-native instance graph;
- no promise that every imported block/proxy becomes editable.

## Exit Criteria
Step189 is complete when:
- all four assembly roundtrip CTests pass;
- metadata drift count remains `0`;
- group drift count remains `0`;
- dense lane continues to cover mixed/paperspace/annotation-heavy Step186 samples.

## Continuous Lane Position
Step189 remains a parallel lane, not a one-off migration check.

It is intentionally positioned beside:
1. Step187 `DWG open` business-path validation
2. Step188 `constraints basic` solver validation

That split is deliberate:
- Step187 proves product entrypoint readiness for `DWG`;
- Step188 proves minimal solver success-path stability;
- Step189 proves imported assembly/proxy provenance survives edit/export/import cycles.

For current product goals, Step189 is the main bridge between:
- Step186 preview/metadata work;
- future structured assembly editing;
- future instance-aware editor behavior.

## Dense Lane Scope
The dense lane now intentionally mixes three kinds of coverage:
1. assembly-heavy insert cases
2. paperspace proxy-heavy cases
3. text-only provenance cases that still exercise import/edit/export stability

Current dense matrix members include:
- `assembly_dense_insert_triad`
- `assembly_dense_mixed_origin`
- `assembly_dense_multi_layout`
- `assembly_dense_paperspace_insert_leader`
- `assembly_dense_paperspace_insert_styles`
- `assembly_dense_paperspace_insert_dimension`
- `assembly_dense_paperspace_insert_dimension_hatch`
- `assembly_dense_paperspace_annotation_bundle`
- `assembly_dense_paperspace_combo`
- `assembly_dense_mleader_textonly`
- `assembly_dense_table_textonly`

The `mleader/table` additions are deliberate. They do not increase assembly group counts, but
they do increase confidence that text/proxy provenance survives the same editor roundtrip path.

## Dense Lane Expansion
The dense Step189 lane now includes a twelfth case:
- `assembly_dense_text_kinds_textonly`

Source:
- `tests/plugin_data/step186_text_kinds_sample.dxf`

Why it belongs in Step189:
- it exercises the same import -> edit -> export -> re-import loop;
- it covers `attrib`, `attdef`, `mtext`, and plain `text` in one compact real sample;
- it increases provenance coverage without introducing new block/proxy assembly logic.

That keeps the dense lane balanced across:
- assembly-heavy insert cases;
- paperspace proxy-heavy cases;
- text-only provenance cases.

## Dense Leader Proxy Expansion
The dense Step189 lane now includes a thirteenth case:
- `assembly_dense_leader_proxy`

Source:
- `tests/plugin_data/step186_leader_sample.dxf`

Why it belongs in Step189:
- it is a real proxy-only leader sample that still exercises the same editor roundtrip path;
- it strengthens coverage between the richer paperspace leader bundle and the text-only
  `mleader/table` samples;
- it widens provenance coverage without changing the current roundtrip contract shape.

## Dense Viewport Sample Expansion
The dense Step189 lane now includes a fourteenth case:
- `assembly_dense_viewport_sample`

Source:
- `tests/plugin_data/viewport_sample.dxf`

Why it belongs in Step189:
- it is a real paperspace/layout sample that still runs through the same import -> edit ->
  export -> re-import loop;
- it strengthens `space/layout` roundtrip coverage without depending on additional block/proxy
  complexity;
- it closes the gap between the richer paperspace proxy cases and the simpler layout-only
  metadata cases already proven in Step186.

## Dense Hatch Proxy Expansion
The dense Step189 lane now includes a fifteenth case:
- `assembly_dense_hatch_proxy`

Source:
- `tests/plugin_data/hatch_dash_sample.dxf`

Why it belongs in Step189:
- it is a compact real hatch proxy sample that still exercises the same import -> edit ->
  export -> re-import loop;
- it gives the dense lane a standalone `HATCH` proxy case instead of only paperspace
  `dimension+hatch` bundles;
- it strengthens provenance coverage around `source_type=HATCH`, `proxy_kind=hatch`, and
  `hatch_pattern` retention without introducing extra block/layout variables.

## Sixteen-Case Dense Matrix
The dense Step189 lane now includes a sixteenth real case:
- `assembly_dense_hatch_dense_proxy`

Source:
- `tests/plugin_data/hatch_dense_sample.dxf`

Why it belongs in Step189:
- it is still a real importer/exporter roundtrip, but it is meaningfully denser than the earlier
  compact hatch sample;
- it pressure-tests the proxy-only roundtrip path on a larger `HATCH`-derived document without
  mixing in unrelated `INSERT` or paperspace variables;
- it turns the dense lane into a better guardrail for real hatch-heavy proxy exports instead of
  only small proxy examples.

## Dense Text-Alignment Expansion
The dense Step189 lane now includes a sixteenth case:
- `assembly_dense_text_align_extended`

Source:
- `tests/plugin_data/text_align_partial_extended.dxf`

Why it belongs in Step189:
- it is a real text-only sample that still uses the same import -> edit -> export ->
  re-import loop;
- it adds another stable provenance-preserving text case without relying on block groups or
  proxy-only behavior;
- it complements `text_kinds_textonly` with a more layout/alignment-oriented sample, so the
  dense lane is less biased toward proxy-heavy paperspace cases.

## Dense Hatch Gap — Resolved
`hatch_dense_sample.dxf` was previously excluded from the default dense matrix because it
triggered truncated exported JSON ("Unexpected end of JSON input" during roundtrip).

Root cause: `write_document_json()` in `convert_cli.cpp` lacked explicit `fflush`/`ferror`
checking before `fclose`, allowing buffered write errors to go undetected on large outputs
(4761 entities, ~2.9 MB JSON).

Fix applied:
- added `fflush(f)` + `ferror(f)` guard before every `fclose(f)` in convert_cli.cpp
  (write_document_json, write_manifest_json, write_mesh_metadata);
- verified: hatch_dense_sample.dxf now converts to valid JSON and passes full roundtrip
  (schema valid, fingerprint stable, zero failure codes);
- promoted `assembly_dense_hatch_dense_proxy` into the default dense matrix (case 27).

## Seventeen-Case Dense Matrix
The dense Step189 lane now includes a seventeenth real case:
- `assembly_dense_hatch_large_boundary`

Source:
- `tests/plugin_data/hatch_large_boundary_budget_sample.dxf`

Why it belongs in Step189:
- it promotes a larger real `HATCH` boundary sample that stayed green in the same import -> edit ->
  export -> re-import loop instead of remaining only a probe;
- it thickens the dense lane around proxy-heavy boundary geometry without requiring unrelated block
  or paperspace variables;
- it raises real-case boundary complexity while keeping the known-red `hatch_dense_sample.dxf`
  explicitly outside the promoted default matrix.

## Eighteen-Case Dense Matrix
The dense Step189 lane now includes an eighteenth real case:
- `assembly_dense_blocks_importer`

Source:
- `tests/plugin_data/importer_blocks.dxf`

Why it belongs in Step189:
- it adds a smaller real `INSERT`/block-oriented model-space sample to the dense lane instead of
  relying only on larger paperspace bundles;
- it improves coverage around block provenance and grouped assembly metadata without pulling in the
  known-red `hatch_dense_sample.dxf` path;
- it keeps the promoted matrix grounded in already-stable importer/exporter behavior.

## Eighteen-Case Dense Matrix
The dense Step189 lane now includes an eighteenth real case:
- `assembly_dense_blocks_importer`

Source:
- `tests/plugin_data/importer_blocks.dxf`

Why it belongs in Step189:
- it promotes a stable importer-origin block sample into the same edit -> export -> re-import guard;
- it thickens the dense lane around `INSERT`/exploded assembly provenance instead of only paperspace
  and proxy-heavy cases;
- it raises real assembly/instance coverage while keeping the known-red `hatch_dense_sample.dxf`
  explicitly outside the promoted default matrix.

## Nineteen-Case Dense Matrix
The dense Step189 lane now includes a nineteenth real case:
- `assembly_dense_importer_entities`

Source:
- `tests/plugin_data/importer_entities.dxf`

Why it belongs in Step189:
- it brings a stable importer-facing entity sample that already lives in the `tests/plugin_data`
  corpus rather than inventing a new fixture;
- it thickens the dense lane with multiple direct-model-space primitives (`LWPOLYLINE`, `LINE`, `CIRCLE`, `ARC`,
  `ELLIPSE`, `SPLINE`, `TEXT`) so the import -> edit -> export plumbing sees text and alignment proxies
  without introducing paperspace bundles;
- it keeps the promoted matrix anchored in importer-aligned behavior while still excluding the known-red
  `hatch_dense_sample.dxf` gap.

## Twenty-One-Case Dense Matrix
The dense Step189 lane now includes a twenty-first real case:
- `assembly_dense_importer_text_metadata`

Source:
- `tests/plugin_data/importer_text_metadata.dxf`

Why it belongs in Step189:
- it is a stable text-only importer fixture that already exists in `tests/plugin_data`, so the lane
  grows without inventing new synthetic assembly data;
- it complements `assembly_dense_mleader_textonly`, `assembly_dense_table_textonly`, and
  `assembly_dense_text_kinds_textonly` with a smaller `TEXT + DIMENSION` importer-origin sample;
- it thickens text/proxy roundtrip coverage without promoting the known-red
  `hatch_dense_sample.dxf` export gap into the default green matrix.

## Twenty-Two-Case Dense Matrix
The dense Step189 lane now includes a twenty-second real case:
- `assembly_dense_nonfinite_text_skip`

Source:
- `tests/plugin_data/nonfinite_numbers_sample.dxf`

Why it belongs in Step189:
- it promotes a real text-oriented importer fixture that verifies non-finite text values are
  skipped or normalized without breaking the convert -> edit -> export -> re-import loop;
- it adds robustness coverage around importer sanitation and text metadata without widening the
  matrix into unrelated geometry families;
- it keeps the promoted matrix strict by growing through already-green real inputs rather than by
  weakening roundtrip assertions.

## Twenty-Three-Case Dense Matrix
The dense Step189 lane now includes a twenty-third real case:
- `assembly_dense_hatch_dash_proxy`

Source:
- `tests/plugin_data/hatch_dash_sample.dxf`

Why it belongs in Step189:
- it promotes a stable real `HATCH` proxy sample with patterned output (`ANSI31`) instead of
  relying only on larger boundary-heavy hatch cases;
- it thickens dense roundtrip coverage around importer-origin proxy metadata and patterned hatch
  semantics without pulling the known-red `hatch_dense_sample.dxf` into the default green lane;
- it keeps the lane focused on green, explainable, real inputs that survive the full
  import -> edit -> export -> re-import loop.

## Twenty-Four-Case Dense Matrix
The dense Step189 lane now includes a twenty-fourth real case:
- `assembly_dense_insert_text_bundle`

Source:
- `tests/plugin_data/step186_insert_text_bundle_sample.dxf`

Why it belongs in Step189:
- it adds a compact but stable `INSERT + TEXT` bundle that exercises exploded assembly provenance
  and plain text metadata in the same roundtrip loop;
- it broadens dense assembly coverage with a real green fixture instead of promoting the known-red
  `hatch_dense_sample.dxf` into the default matrix;
- it strengthens the bridge between Step186 provenance semantics and Step189 export drift guards by
  forcing the lane to keep `source_type=INSERT`, `edit_mode=exploded`, `proxy_kind=insert`, and
  `block_name=BlockBundle` stable through export and re-import.

## Twenty-Five-Case Dense Matrix
The dense Step189 lane now includes a twenty-fifth real case:
- `assembly_dense_paperspace_insert_styles_variant`

Source:
- `tests/plugin_data/step186_paperspace_insert_styles_variant_sample.dxf`

Why it belongs in Step189:
- it is a stable variant derived from an already-green paperspace insert styles sample, so the lane
  grows through a real convert -> edit -> export -> re-import path instead of through a synthetic
  JSON-only shortcut;
- it adds another paperspace `INSERT` bundle with distinct block and layer names
  (`PaperStyledBlockB`, `PAPER_INSERT_LAYER_B`) while preserving the same `group_id`, layout, and
  line-style semantics that the roundtrip lane is supposed to guard;
- it increases real paperspace assembly coverage without promoting the still-red
  `step186_paperspace_insert_text_bundle_sample.dxf`, which remains a tracked importer gap rather
  than a green default-matrix case.

## Twenty-Six-Case Dense Matrix
The dense Step189 lane now includes a twenty-sixth real case:
- `assembly_dense_text_kinds_textonly`

Source:
- `tests/plugin_data/step186_text_kinds_sample.dxf`

Why it belongs in Step189:
- it promotes a real importer-origin text-kinds fixture that already covers `TEXT`, `MTEXT`,
  `ATTRIB`, and `ATTDEF` semantics without introducing a synthetic JSON-only shortcut;
- it broadens the dense lane beyond geometry-heavy `INSERT` and paperspace bundles by making the
  roundtrip contract defend richer text metadata and text-kind preservation in the same export
  guard;
- it strengthens the lane in a direction where lightweight preview stacks are usually weak:
  preserving explainable text semantics through import -> edit -> export -> re-import, which is one
  of the practical places this project can exceed simpler viewer-only competitors.

## Twenty-Seven-Case Dense Matrix
The dense Step189 lane now includes a twenty-seventh real case:
- `assembly_dense_hatch_dense_proxy`

Source:
- `tests/plugin_data/hatch_dense_sample.dxf`

Why it belongs in Step189:
- it was previously a known-red gap that exposed a real roundtrip/export truncation issue;
- after fixing `fflush`/`ferror` handling in `convert_cli.cpp`, this sample now converts to a valid
  2.9 MB JSON document (4761 entities: 1 polyline boundary + 4760 scanline LINEs) and passes full
  roundtrip validation with fingerprint stability;
- it is the densest hatch sample in the matrix by entity count, exercising the export pipeline
  under realistic load from the hatch scanline tessellator;
- promoting it closes the last documented known-red gap in the Step189 dense matrix.

## Scope Status

- Designed dense matrix scope: 27 cases.
- Fresh verified baseline: 26/26 pass (see STEP189_ASSEMBLY_ROUNDTRIP_VERIFICATION.md).
- Case 27 (`assembly_dense_hatch_dense_proxy`) is designed and documented above but has not yet
  been promoted into the fresh verified baseline.
