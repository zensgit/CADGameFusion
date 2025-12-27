# Step 70: PLM Project/Document Grouping - Verification

## Checks
```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile tools/plm_router_service.py
```

## Manual smoke (if localhost bind available)
```bash
python3 tools/plm_router_service.py --port 9080
curl -s -F "file=@tests/plugin_data/importer_sample.dxf" -F "project_id=demo" -F "document_label=sample" http://localhost:9080/convert
curl -s http://localhost:9080/history?limit=5
```

## Results
- `py_compile`: PASS
- Manual smoke: blocked by localhost bind permissions in this environment
