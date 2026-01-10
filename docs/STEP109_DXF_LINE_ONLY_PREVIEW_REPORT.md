# Step 109: DXF Line-only Preview - Report

## Goal
Validate line-only DXF input can render in the preview pipeline via the glTF line fallback.

## Scope
- Use a minimal DXF with LINE/CIRCLE/ARC only (no polylines).
- Confirm `plm_preview.py` produces `mesh.gltf` + `mesh.bin` and a valid manifest.

## Input
Local DXF used for verification:
```text
0
SECTION
2
HEADER
0
ENDSEC
0
SECTION
2
TABLES
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
0
10
0.0
20
0.0
11
10.0
21
0.0
0
CIRCLE
8
0
10
5.0
20
5.0
40
2.0
0
ARC
8
0
10
5.0
20
5.0
40
3.0
50
0.0
51
180.0
0
ENDSEC
0
EOF
```

## Summary
- The preview pipeline emits glTF line primitives for line-only DXF input.
- Manifest reports `outputs: ["gltf", "json"]` with `mesh_bin` + `mesh_gltf` artifacts.
