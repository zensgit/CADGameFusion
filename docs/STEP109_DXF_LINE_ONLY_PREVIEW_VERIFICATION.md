# Step 109: DXF Line-only Preview - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Input Preparation
```bash
cat <<'EOF' > build_vcpkg/line_only_sample.dxf
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

## Preview Helper (DXF line-only)
```bash
python3 tools/plm_preview.py \
  --plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input build_vcpkg/line_only_sample.dxf \
  --out build_vcpkg/plm_preview_step109 \
  --emit json,gltf \
  --project-id demo \
  --document-label dxf_line_only
```

Artifacts:
```bash
ls build_vcpkg/plm_preview_step109
```

Observed:
- `manifest.json`
- `document.json`
- `mesh.gltf`
- `mesh.bin`

Manifest summary:
- `status` = `ok`
- `outputs` = `["gltf", "json"]`
- `artifacts` include `document_json`, `mesh_gltf`, `mesh_bin`

Viewer URL:
- `http://localhost:8080/tools/web_viewer/index.html?manifest=build_vcpkg/plm_preview_step109/manifest.json&project_id=demo&document_label=dxf_line_only&document_id=ZGVtbwpkeGZfbGluZV9vbmx5`
