# Windows Mirror Recovery Notes

Purpose
- Document when and how to restore Windows strict build/tests to blocking mode once upstream mirrors stabilize.

Signals of Stability
- Windows Nightly workflow succeeds for ≥ 3 consecutive days.
- No HTTP 404 or transient vcpkg/msys2 mirror errors in logs.
- Local reproductions (if applicable) show consistent install behavior.

How to Flip the Gate
1) Assess readiness:
```bash
./scripts/check_windows_nightly_health.sh --threshold 3
```
2) Edit `.github/workflows/core-strict-build-tests.yml`:
```yaml
env:
  WINDOWS_CONTINUE_ON_ERROR: 'false'
```
3) Push the change, open a PR, and verify Windows strict build now blocks on failures.

Built‑in Mitigations (Keep Enabled)
- vcpkg bootstrap/checkout retry (3 attempts, exponential backoff)
- Windows Nightly monitoring workflow (daily 02:00 UTC)

Rollback
- If new outages reappear, revert the env to `'true'` and rely on nightly monitoring until green streak returns.

