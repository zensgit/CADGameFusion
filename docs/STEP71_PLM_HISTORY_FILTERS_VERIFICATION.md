# Step 71: PLM History Filters - Verification

## Checks
```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile tools/plm_router_service.py
```

## Manual smoke
```bash
cat > /tmp/plm_history_test.jsonl <<'JSONL'
{"task_id":"t1","state":"done","created_at":"2024-01-01T00:00:00Z","started_at":"2024-01-01T00:00:01Z","finished_at":"2024-01-01T00:00:02Z","viewer_url":"http://example.com/viewer","error":"","project_id":"demo","document_label":"sample"}
{"task_id":"t2","state":"error","created_at":"2024-01-02T00:00:00Z","started_at":"2024-01-02T00:00:01Z","finished_at":"2024-01-02T00:00:02Z","viewer_url":"","error":"failed","project_id":"other","document_label":"other_doc"}
JSONL

python3 tools/plm_router_service.py --history-file /tmp/plm_history_test.jsonl --history-load 10 --port 10001
curl -s "http://localhost:10001/history?limit=5&project_id=demo&state=done"
```

## Results
- `py_compile`: PASS
- Manual smoke: PASS (status ok, count 1, item project_id=demo state=done)
