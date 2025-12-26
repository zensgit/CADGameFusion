# Step 65: PLM Router Queue + Status - Design

## Goal
Add asynchronous queueing, task status endpoints, and TTL cleanup to the PLM router service.

## Behavior
- `POST /convert` creates a task and enqueues conversion.
- Default mode waits for completion and returns manifest/preview payload.
- Set `async=true` or `wait=false` to return immediately with `task_id`.
- `GET /status/<task_id>` returns task state and result when ready.

## Cleanup
- Output directories are pruned after `--ttl-seconds`.
- Cleanup runs every `--cleanup-interval` seconds.

## Files
- `tools/plm_router_service.py`
- `tools/web_viewer/README.md`
- `docs/STEP65_PLM_ROUTER_QUEUE_DESIGN.md`
- `docs/STEP65_PLM_ROUTER_QUEUE_VERIFICATION.md`
