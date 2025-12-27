# Step 73: Document Schema Versioning + Migration CLI - Verification

## Checks
```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile tools/plm_convert.py
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile tools/plm_router_service.py
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile tools/document_migrate.py
```

## Manual smoke
```bash
cat > /tmp/fake_convert_cli.sh <<'SH'
#!/bin/sh
out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--out" ]; then
    out="$2"
    shift 2
    continue
  fi
  shift
 done
mkdir -p "$out"
cat > "$out/document.json" <<'JSON'
{
  "cadgf_version": "0.0.0"
}
JSON
exit 0
SH
chmod +x /tmp/fake_convert_cli.sh

echo "DXF" > /tmp/plm_input.dxf
rm -rf /tmp/plm_migrate_test
python3 tools/plm_convert.py \
  --plugin /tmp/placeholder.plugin \
  --input /tmp/plm_input.dxf \
  --out /tmp/plm_migrate_test \
  --emit json \
  --convert-cli /tmp/fake_convert_cli.sh \
  --migrate-document \
  --document-target 2

python3 - <<'PY'
import json
from pathlib import Path
path = Path("/tmp/plm_migrate_test/document.json")
data = json.loads(path.read_text())
print(data.get("schema_version"), bool(data.get("document_id")), bool(data.get("schema_migrated_at")))
PY
```

## Results
- `py_compile`: PASS
- Manual smoke: PASS (schema_version=2, document_id/schema_migrated_at present)
