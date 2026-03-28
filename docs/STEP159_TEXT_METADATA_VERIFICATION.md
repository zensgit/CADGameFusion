# STEP159 Text Alignment & Dimension Metadata Verification

## Setup
- Build plugin + convert CLI as usual (e.g. build_vcpkg).
- Ensure cadgf_dxf_importer_plugin is available.

## Minimal TEXT alignment sample
Create a minimal DXF with horizontal/vertical alignment codes:
```bash
cat <<'DXF' > /tmp/cadgf_text_align_sample.dxf
0
SECTION
2
ENTITIES
0
TEXT
8
LayerText
10
0
20
0
40
1
1
Aligned Text
72
2
73
2
0
ENDSEC
0
EOF
DXF
```

Run conversion (if you used `scripts/build_core.sh`, binaries live under `build/`):
```bash
./build/tools/convert_cli \
  --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input /tmp/cadgf_text_align_sample.dxf \
  --out /tmp/cadgf_text_align_out \
  --json
```

Expected in /tmp/cadgf_text_align_out/document.json:
- The text entity includes text_kind.
- text_halign and text_valign are present and match DXF values (72/73).

## Partial align_pos axis regression (strict mode)
The importer must never treat a missing `11/21` axis as `0`. Added:
- DXF fixture: `tests/plugin_data/text_align_partial.dxf`
  - `FULL_ALIGN`: has `11/21` -> expected final pos = (5,2)
  - `PARTIAL_ALIGN_X_ONLY`: has only `11` (no `21`) -> expected final pos remains (10,20)
- Automated test: `test_dxf_text_alignment_partial_run`

```bash
ctest --test-dir build -R test_dxf_text_alignment_partial_run -V
```

Expected doc meta (import attribution):
- `dxf.text.align_policy=strict`
- `dxf.text.entities_seen=2`, `dxf.text.entities_emitted=2`
- `dxf.text.align_complete=1`, `dxf.text.align_partial=1`, `dxf.text.align_used=1`

## Extended entity coverage (TEXT/MTEXT/ATTRIB/ATTDEF)
Added:
- DXF fixture: `tests/plugin_data/text_align_partial_extended.dxf`
  - Verifies strict alignment behavior across `TEXT`, `ATTRIB`, `ATTDEF`, `MTEXT`.
- Automated test: `test_dxf_text_alignment_extended_run`

```bash
ctest --test-dir build -R test_dxf_text_alignment_extended_run -V
```

## Non-finite numbers (NaN/Inf) are rejected
DXF files with corrupted numeric fields should not inject `NaN/Inf` into geometry.
Added:
- DXF fixture: `tests/plugin_data/nonfinite_numbers_sample.dxf`
  - Contains a valid `LINE` plus two invalid `TEXT` (one with `10=nan`, one with `20=inf`)
- Automated test: `test_dxf_nonfinite_numbers_run` asserts invalid TEXT entities are skipped.

```bash
ctest --test-dir build -R test_dxf_nonfinite_numbers_run -V
```

Expected doc meta:
- `dxf.text.entities_seen=2`, `dxf.text.entities_emitted=0`
- `dxf.text.skipped_missing_xy=2`
- `dxf.text.nonfinite_values=2`

## Dimension metadata (optional)
Use a DXF with DIMENSION entities and re-run convert. Expected:
- dim_type appears on the generated dimension text entity.
- dim_text_pos appears when provided by the DXF.
- dim_text_rotation is emitted in radians.

Minimal DIMENSION sample (parser requires a block name):
```bash
cat <<'DXF' > /tmp/cadgf_dimension_sample.dxf
0
SECTION
2
ENTITIES
0
DIMENSION
8
LayerDim
2
*D0
10
0
20
0
11
5
21
2
13
0
23
0
14
10
24
0
42
123.45
1
<> 
3
STANDARD
70
0
0
ENDSEC
0
EOF
DXF
```

Run:
```bash
./build/tools/convert_cli \
  --plugin build/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input /tmp/cadgf_dimension_sample.dxf \
  --out /tmp/cadgf_dimension_out \
  --json

jq '.entities[] | select(.type==7 and .text_kind=="dimension") |
    {id, text_kind, dim_type, dim_style, dim_text_pos, dim_text_rotation, text}' \
  /tmp/cadgf_dimension_out/document.json
```

## Status
- Text alignment sample: PASS.
- Dimension metadata sample: PASS.
- Automated test: PASS (test_dxf_text_metadata_run).

## Run log (local)
- Input: `/tmp/cadgf_text_align_sample.dxf`
- Output: `/tmp/cadgf_text_align_out/document.json`
- Observed fields on text entity: `text_kind="text"`, `text_halign=2`, `text_valign=2`, `text_attachment=6`.
- Input: `/tmp/cadgf_dimension_sample.dxf`
- Output: `/tmp/cadgf_dimension_out/document.json`
- Observed fields on dimension text entity: `text_kind="dimension"`, `dim_type=0`, `dim_text_pos=[5,2]`, `dim_text_rotation=0`.
- Input: `/Users/huazhou/Downloads/训练图纸/训练图纸_dxf_oda_20260123/LTJ012306102-0084调节螺栓v1.dxf`
- Output: `/tmp/cadgf_real_dim_out/document.json`
- Observed:
  - Dimension text entities with `text_kind="dimension"`: 18
  - Sample dimension fields:
    - `dim_type=160`, `dim_style="HC_GBDIM"`, `dim_text_pos=[75.983921,118.646496]`, `dim_text_rotation=1.570796`
  - Text alignment fields present on text entities (2 occurrences), e.g. `text_halign=4`, `text_valign=2`.

## Automated test
```bash
ctest --test-dir build -R test_dxf_text_metadata_run -V
```
