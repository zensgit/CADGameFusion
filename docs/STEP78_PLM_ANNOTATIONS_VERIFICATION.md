# Step 78: PLM Lightweight Annotations - Verification

## Checks
```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile tools/plm_router_service.py
```

## Manual smoke
```bash
cat > /tmp/plm_history_notes.jsonl <<'JSONL'
{"task_id":"t1","state":"done","created_at":"2024-01-01T00:00:00Z","started_at":"2024-01-01T00:00:01Z","finished_at":"2024-01-01T00:00:02Z","viewer_url":"http://example.com/viewer","error":"","project_id":"demo","document_label":"sample","annotations":[{"message":"First review","author":"alex","created_at":"2024-01-01T00:00:00Z"}]}
{"task_id":"t2","state":"done","created_at":"2024-01-02T00:00:00Z","started_at":"2024-01-02T00:00:01Z","finished_at":"2024-01-02T00:00:02Z","viewer_url":"http://example.com/viewer2","error":"","project_id":"demo","document_label":"sample","annotations":[{"message":"Approved","author":"sam","created_at":"2024-01-02T00:00:00Z"}]}
JSONL

python3 tools/plm_router_service.py --history-file /tmp/plm_history_notes.jsonl --history-load 10 --port 10008
curl -s "http://localhost:10008/history?project_id=demo"
curl -s "http://localhost:10008/projects?limit=5"
python3 - <<'PY'
import base64
raw = "demo\nsample".encode("utf-8")
print(base64.urlsafe_b64encode(raw).decode("ascii").rstrip("="))
PY
curl -s "http://localhost:10008/projects/demo/documents?limit=5"
```

## Results
- `py_compile`: PASS
- Manual smoke: PASS (annotations surfaced in history/projects/documents)
