# STEP90 PLM Smoke DXF Verification

## Scope
- Validate `tools/plm_smoke.sh` using the DXF importer.

## Environment
- Host: macOS (local)
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Script: `tools/plm_smoke.sh`
- Input: `tests/plugin_data/importer_sample.dxf`
- Plugin: `build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib`

## Steps
```bash
INPUT=tests/plugin_data/importer_sample.dxf \
PLUGIN=build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
DOCUMENT_LABEL=sample_dxf \
tools/plm_smoke.sh
```

## Results
- Convert returned `status=ok` and emitted `manifest.json` + artifacts.
- Annotate returned `status=ok` with `document_id=ZGVtbwpzYW1wbGVfZHhm`.
- Script exited with `plm smoke OK`.
