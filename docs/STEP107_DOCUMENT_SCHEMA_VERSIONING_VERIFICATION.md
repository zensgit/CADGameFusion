# Step 107: Document Schema Versioning - Verification

## Environment
- Repo: `/Users/huazhou/Downloads/Github/CADGameFusion`
- Build: `build_vcpkg`

## Conversion + Migration + Validation
```bash
python3 tools/plm_convert.py \
  --plugin build_vcpkg/plugins/libcadgf_json_importer_plugin.dylib \
  --input tests/plugin_data/importer_sample.json \
  --out build_vcpkg/plm_versioning_step107 \
  --emit json \
  --migrate-document --document-target 2 --document-backup \
  --validate-document --document-schema schemas/document.schema.json \
  --clean
```
Result:
- `manifest.json` written in `build_vcpkg/plm_versioning_step107/`
- `document.json` migrated to schema v2
- `document.json.bak` created

## Schema Checks
```bash
python3 - <<'PY'
import json
from pathlib import Path
path = Path('build_vcpkg/plm_versioning_step107/document.json')
with path.open() as f:
    data = json.load(f)
print('schema_version', data.get('schema_version'))
print('document_id', bool(data.get('document_id')))
print('schema_migrated_at', bool(data.get('schema_migrated_at')))
PY
```
Expected:
- `schema_version` = 2
- `document_id` present
- `schema_migrated_at` present
Observed:
- `schema_version` = 2
- `document_id` present
- `schema_migrated_at` present

## Manifest Check
```bash
python3 - <<'PY'
import json
from pathlib import Path
path = Path('build_vcpkg/plm_versioning_step107/manifest.json')
with path.open() as f:
    data = json.load(f)
print('document_schema_version', data.get('document_schema_version'))
print('outputs', data.get('outputs'))
print('status', data.get('status'))
PY
```
Expected:
- `document_schema_version` = 2
- `outputs` includes `json`
- `status` = `ok`
Observed:
- `document_schema_version` = 2
- `outputs` = `['json']`
- `status` = `ok`
