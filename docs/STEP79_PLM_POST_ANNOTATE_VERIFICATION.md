# Step 79: PLM Post-Annotation - Verification

## Checks
```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile tools/plm_router_service.py
```

## Manual smoke
```bash
cat > /tmp/plm_history_post_annotate.jsonl <<'JSONL'
{"task_id":"t1","state":"done","created_at":"2024-02-01T00:00:00Z","started_at":"2024-02-01T00:00:01Z","finished_at":"2024-02-01T00:00:02Z","viewer_url":"http://example.com/viewer","error":"","project_id":"demo","document_label":"sample","owner":"alex","tags":["review"],"revision_note":"rev A","annotations":[]}
JSONL

python3 tools/plm_router_service.py --history-file /tmp/plm_history_post_annotate.jsonl --history-load 10 --port 10009 &
server_pid=$!
sleep 1

curl -s -X POST "http://localhost:10009/annotate" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"demo","document_label":"sample","annotation_text":"Reviewed","annotation_author":"sam"}'
curl -s "http://localhost:10009/history?project_id=demo"
curl -s "http://localhost:10009/projects?limit=5"

doc_id=$(python3 - <<'PY'
import base64
raw = "demo\nsample".encode("utf-8")
print(base64.urlsafe_b64encode(raw).decode("ascii").rstrip("="))
PY
)

curl -s "http://localhost:10009/documents/${doc_id}/versions?limit=5"

kill ${server_pid}
```

## Results
- `py_compile`: PASS
- Manual smoke: PASS
