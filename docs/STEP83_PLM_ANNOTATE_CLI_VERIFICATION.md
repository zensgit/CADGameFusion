# Step 83: PLM Annotate CLI - Verification

## Checks
```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile tools/plm_annotate.py
```

## Manual smoke
```bash
cat > /tmp/plm_history_cli_annotate.jsonl <<'JSONL'
{"task_id":"t1","state":"done","created_at":"2024-05-01T00:00:00Z","started_at":"2024-05-01T00:00:01Z","finished_at":"2024-05-01T00:00:02Z","viewer_url":"http://example.com/viewer","error":"","project_id":"demo","document_label":"sample","annotations":[]}
JSONL

python3 tools/plm_router_service.py --history-file /tmp/plm_history_cli_annotate.jsonl --history-load 10 --port 10012 &
server_pid=$!
sleep 1

python3 tools/plm_annotate.py \
  --router http://localhost:10012 \
  --project-id demo \
  --document-label sample \
  --text "Reviewed via CLI" \
  --author sam

curl -s "http://localhost:10012/history?project_id=demo&event=annotation"

kill ${server_pid}
```

## Results
- `py_compile`: PASS
- Manual smoke: PASS
