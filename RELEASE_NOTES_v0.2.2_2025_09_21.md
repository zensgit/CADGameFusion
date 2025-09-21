# Release Notes — v0.2.2 (2025-09-21)

Highlights
- Offline/local lightweight validation options for developer scripts

What’s new
- tools/local_ci.sh
  - `--offline`: skip pip and schema validation for best‑effort offline checks
  - `--no-pip`: skip pip installs only
  - `-h|--help`: usage help
- scripts/check_verification.sh
  - `--no-struct`: skip NaN/structural heuristic for quick checks
- README
  - Added offline usage examples, Quick Links entries, and an "Offline Mode (Local)" section

Validation
- Local runs (offline + full) both PASS: 8 scenes exported, schema/structure/field checks OK
- CI runs PASS across platforms; Windows remains stable

Compatibility & Upgrade
- No breaking changes; defaults unchanged; flags are opt‑in
- No action required for existing users/CI

Links
- PR #68: feat(scripts): add offline/no-pip/no-struct options for local validation
- CHANGELOG.md entry for v0.2.2

