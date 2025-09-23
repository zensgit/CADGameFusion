Title: ci(observability): tune per-workflow thresholds

Summary
- Update `.github/ci/config.json` thresholds to reflect current stability and goals:
  - Exports: sr_th=90, p95_th=5
  - Quick Check: sr_th=95, p95_th=2

Rationale
- Reduce noise while keeping meaningful signal for regressions.

Verification
- Trigger Daily CI; confirm Alerts table and created/updated Issues use new thresholds.
- Weekly Digest reflects new per-workflow thresholds in the Alert column.

