# Step 85: PLM Index Event Filter - Verification

## Checks
```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile tools/plm_router_service.py
```

## Manual smoke
```bash
cat > /tmp/plm_index_event_filter.jsonl <<'JSONL'
{"task_id":"t1","state":"done","created_at":"2024-07-01T00:00:00Z","started_at":"2024-07-01T00:00:01Z","finished_at":"2024-07-01T00:00:02Z","viewer_url":"http://example.com/viewer","error":"","project_id":"demo","document_label":"sample","annotations":[]}
JSONL

python3 tools/plm_router_service.py --history-file /tmp/plm_index_event_filter.jsonl --history-load 10 --port 10014 &
server_pid=$!
sleep 1

curl -s -X POST "http://localhost:10014/annotate" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"demo","document_label":"sample","annotation_text":"Reviewed","annotation_author":"sam"}'

curl -s "http://localhost:10014/projects?event=annotation"
curl -s "http://localhost:10014/projects/demo/documents?event=annotation"

kill ${server_pid}
```

## Results
- `py_compile`: PASS
- Manual smoke: PASS
