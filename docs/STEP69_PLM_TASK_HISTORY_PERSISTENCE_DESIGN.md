# Step 69: PLM Task History Persistence - Design

## Goal
Persist the in-memory task history to disk so it survives service restarts.

## Behavior
- `--history-file` (or `CADGF_ROUTER_HISTORY_FILE`) enables JSONL append mode.
- Each completed task writes one JSON object per line.
- `--history-load` (or `CADGF_ROUTER_HISTORY_LOAD`) loads recent entries on startup (0 = all).
- `/history` continues to serve from memory with `--history-limit` bounds.

## Files
- `tools/plm_router_service.py`
- `docs/STEP69_PLM_TASK_HISTORY_PERSISTENCE_DESIGN.md`
- `docs/STEP69_PLM_TASK_HISTORY_PERSISTENCE_VERIFICATION.md`
