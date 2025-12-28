# STEP89 PLM Smoke Script Verification

## Scope
- Validate the new `tools/plm_smoke.sh` end-to-end flow (router -> convert -> annotate).
- Confirm the script works with default JSON sample inputs.

## Environment
- Host: macOS (local)
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Script: `tools/plm_smoke.sh`
- Default input: `tests/plugin_data/importer_sample.json`
- Default plugin: `build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib`

## Steps
```bash
tools/plm_smoke.sh
```

## Results
- Convert returned `status=ok` and emitted `manifest.json` + artifacts.
- Annotate returned `status=ok` with `document_id=ZGVtbwpzYW1wbGU`.
- Script exited with `plm smoke OK`.

## Notes
- For DXF validation, override `INPUT`, `PLUGIN`, and `DOCUMENT_LABEL`.
