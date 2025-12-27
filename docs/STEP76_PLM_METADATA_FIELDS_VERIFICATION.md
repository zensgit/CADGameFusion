# Step 76: PLM Metadata Fields - Verification

## Checks
```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile tools/plm_router_service.py
```

## Manual smoke
```bash
cat > /tmp/plm_history_meta.jsonl <<'JSONL'
{"task_id":"t1","state":"done","created_at":"2024-01-01T00:00:00Z","started_at":"2024-01-01T00:00:01Z","finished_at":"2024-01-01T00:00:02Z","viewer_url":"http://example.com/viewer","error":"","project_id":"demo","document_label":"sample","owner":"alex","tags":["proto","review"],"revision_note":"rev A"}
{"task_id":"t2","state":"done","created_at":"2024-01-02T00:00:00Z","started_at":"2024-01-02T00:00:01Z","finished_at":"2024-01-02T00:00:02Z","viewer_url":"http://example.com/viewer2","error":"","project_id":"demo","document_label":"sample","owner":"alex","tags":["proto","review"],"revision_note":"rev B"}
{"task_id":"t3","state":"error","created_at":"2024-01-03T00:00:00Z","started_at":"2024-01-03T00:00:01Z","finished_at":"2024-01-03T00:00:02Z","viewer_url":"","error":"failed","project_id":"alpha","document_label":"bracket","owner":"lee","tags":["urgent"],"revision_note":"fix hole"}
JSONL

python3 tools/plm_router_service.py --history-file /tmp/plm_history_meta.jsonl --history-load 10 --port 10004
curl -s "http://localhost:10004/projects?limit=5"
curl -s "http://localhost:10004/projects/demo/documents?limit=5"
python3 - <<'PY'
import base64
raw = "demo\nsample".encode("utf-8")
print(base64.urlsafe_b64encode(raw).decode("ascii").rstrip("="))
PY
curl -s "http://localhost:10004/documents/<document_id>/versions?limit=5"
```

## Results
- `py_compile`: PASS
- Manual smoke: PASS (metadata present in projects/documents/versions responses)
