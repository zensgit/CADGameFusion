# STEP91 PLM Router Smoke Summary

## Scope
Summarize the PLM router stability fix, CLI improvements, smoke tooling, and verification status.

## Changes
- `tools/plm_router_service.py`: avoid /convert deadlock by moving `record_history()` out of the task lock and always signaling task completion.
- `tools/plm_annotate.py`: add `--print-document-id` for quick document_id generation.
- `tools/plm_smoke.sh`: new end-to-end smoke script (router -> convert -> annotate).
- `tools/local_ci.sh`: optional `RUN_PLM_SMOKE=1` hook for smoke validation.
- `docs/API.md`: add `document_id` generation example + convert response payload example.
- `docs/Tools.md`: quickstart expanded, DXF variant, smoke script usage, environment overrides, router env vars.
- `README.md`: PLM quickstart + smoke script pointer.

## Verification
- `/convert` deadlock fix validated (JSON + DXF) — see `docs/STEP88_PLM_ROUTER_DEADLOCK_FIX_VERIFICATION.md`.
- `tools/plm_smoke.sh` JSON flow validated — see `docs/STEP89_PLM_SMOKE_SCRIPT_VERIFICATION.md`.
- `tools/plm_smoke.sh` DXF flow validated — see `docs/STEP90_PLM_SMOKE_DXF_VERIFICATION.md`.

## Notes
- `tools/plm_smoke.sh` defaults to JSON importer; override `INPUT`, `PLUGIN`, `DOCUMENT_LABEL` for DXF.
- `RUN_PLM_SMOKE=1` is optional and does not affect default local CI behavior.
