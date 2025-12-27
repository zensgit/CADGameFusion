# Step 81: PLM History Event Filter - Verification

## Checks
```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile tools/plm_router_service.py
```

## Manual smoke
```bash
cat > /tmp/plm_history_event_filter.jsonl <<'JSONL'
{"task_id":"t1","state":"done","created_at":"2024-04-01T00:00:00Z","started_at":"2024-04-01T00:00:01Z","finished_at":"2024-04-01T00:00:02Z","viewer_url":"http://example.com/viewer","error":"","project_id":"demo","document_label":"sample","annotations":[]}
JSONL

python3 tools/plm_router_service.py --history-file /tmp/plm_history_event_filter.jsonl --history-load 10 --port 10011 &
server_pid=$!
sleep 1

curl -s "http://localhost:10011/history?project_id=demo&event=convert"
curl -s -X POST "http://localhost:10011/annotate" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"demo","document_label":"sample","annotation_text":"Reviewed","annotation_author":"sam"}'
curl -s "http://localhost:10011/history?project_id=demo&event=annotation"

kill ${server_pid}
```

## Results
- `py_compile`: PASS
- Manual smoke: PASS
