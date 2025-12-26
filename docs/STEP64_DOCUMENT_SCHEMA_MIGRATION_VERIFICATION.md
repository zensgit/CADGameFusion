# Step 64: Document Schema Migration - Verification

## Checks
```bash
python3 -m py_compile tools/document_migrate.py
```

## Sample migration
```bash
mkdir -p build_vcpkg/tmp_migrate
cp build_vcpkg/convert_cli_smoke/document.json build_vcpkg/tmp_migrate/document_v0.json
python3 tools/document_migrate.py --input build_vcpkg/tmp_migrate/document_v0.json --output build_vcpkg/tmp_migrate/document_v2.json --target 2
```

## Results
- `py_compile`: PASS
- Migration output includes `schema_version` 2, `document_id`, `schema_migrated_at`
