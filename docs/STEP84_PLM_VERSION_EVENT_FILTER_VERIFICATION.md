# Step 84: PLM Version Event Filter - Verification

## Checks
```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile tools/plm_router_service.py
```

## Manual smoke
```bash
cat > /tmp/plm_version_event_filter.jsonl <<'JSONL'
{"task_id":"t1","state":"done","created_at":"2024-06-01T00:00:00Z","started_at":"2024-06-01T00:00:01Z","finished_at":"2024-06-01T00:00:02Z","viewer_url":"http://example.com/viewer","error":"","project_id":"demo","document_label":"sample","annotations":[]}
JSONL

python3 tools/plm_router_service.py --history-file /tmp/plm_version_event_filter.jsonl --history-load 10 --port 10013 &
server_pid=$!
sleep 1

curl -s -X POST "http://localhost:10013/annotate" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"demo","document_label":"sample","annotation_text":"Reviewed","annotation_author":"sam"}'

doc_id=$(python3 - <<'PY'
import base64
raw = "demo\nsample".encode("utf-8")
print(base64.urlsafe_b64encode(raw).decode("ascii").rstrip("="))
PY
)

curl -s "http://localhost:10013/documents/${doc_id}/versions?event=convert"
curl -s "http://localhost:10013/documents/${doc_id}/versions?event=annotation"

kill ${server_pid}
```

## Results
- `py_compile`: PASS
- Manual smoke: PASS
