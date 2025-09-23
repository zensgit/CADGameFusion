# Maintainers Operations (CI Alerts, Thresholds, Weekly Archive)

This guide summarizes how CI observability is configured and how to operate daily/weekly reporting, alerts, and recovery.

## Daily CI Status Report
- Workflow: `.github/workflows/daily-ci-status.yml` (name: "Daily CI Status Report")
- Triggers: schedule (daily) and manual (workflow_dispatch)
- Inputs (manual):
  - `sr_th` (success rate threshold, default 85)
  - `p95_th` (p95 duration threshold in minutes, default 6)
  - `assignees` (comma-separated usernames for alert Issues)
  - `team_mention` (e.g. `@org/ci-team` included in alert body)

### Per‑workflow thresholds
- Defaults and per‑workflow overrides live in `.github/ci/config.json`:
```json
{
  "alerts": { "assignees": "zensgit", "team_mention": "", "recovery_days": 3 },
  "thresholds": {
    "default": { "sr_th": 85, "p95_th": 6 },
    "per_workflow": {
      "Core Strict - Build and Tests": { "sr_th": 85, "p95_th": 6 },
      "Core Strict - Exports, Validation, Comparison": { "sr_th": 85, "p95_th": 6 },
      "Quick Check - Verification + Lint": { "sr_th": 90, "p95_th": 2 }
    }
  }
}
```
- Manual inputs override config for that run; otherwise per‑workflow > default > built-in.

### Alerts creation and auto‑recovery
- If a workflow’s 7‑day trend breaches thresholds, an Issue is created/updated with labels `ci, alert`, milestone `v0.3.1`, optional assignees/mention.
- Recovery: when a workflow meets thresholds for the last `alerts.recovery_days` (default 3) days, the runner comments on and closes the open alert Issue.

### vcpkg cache metrics and N/A semantics
- Daily reads `vcpkg_cache_stats.json` from the latest strict exports run. If only header‑only ports exist (`cacheable=false` or `total==0`), the report shows `Cache Hit Rate: N/A`.
- Evidence: strict workflows upload `vcpkg_archives_listing.txt` alongside the stats.

### Quick commands (requires gh+jq)
```bash
# Trigger Daily CI with defaults from config
gh workflow run "Daily CI Status Report"

# Trigger with overrides
gh workflow run "Daily CI Status Report" -f sr_th=85 -f p95_th=6 -f assignees=zensgit -f team_mention=@org/ci
```

## Weekly CI Trend Digest
- Workflow: `.github/workflows/weekly-ci-trend.yml` (name: "Weekly CI Trend Digest")
- Inputs (manual): `days` (default 7), `sr_th`, `p95_th`, `archive_pr` (default false)
- Schedule: runs weekly and auto‑archives the digest into `docs/ci/weekly/YYYY-WW.md` via a PR
- Manual: set `archive_pr=true` to create an archival PR for ad‑hoc runs

Quick command:
```bash
gh workflow run "Weekly CI Trend Digest" -f days=7 -f archive_pr=true
```

## Where to find artifacts
- Daily status artifact: `ci-daily-status-<run_id>` contains `CI_DAILY_STATUS.md`
- Exports validation evidence: `strict-exports-reports-ubuntu-latest` includes
  - `build/vcpkg_cache_stats.json`, `vcpkg_cache_stats.json`
  - `vcpkg_archives_listing.txt`
- Build tests evidence: `vcpkg-evidence-<OS>` includes `vcpkg_archives_listing.txt`

## Troubleshooting
- Missing metrics (offline/GH API errors): rerun manually from Actions; ensure `GITHUB_TOKEN` is present and `gh/jq` installed (workflows do this).
- Artifact name drift: Daily has fallbacks; adjust if exporters rename artifacts.
- Thresholds too strict/noisy: tune `.github/ci/config.json` per‑workflow values.

