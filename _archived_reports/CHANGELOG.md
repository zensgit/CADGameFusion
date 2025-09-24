## v0.2.2 (2025-09-21)

Enhancements
- Scripts: offline/local lightweight validation options
  - tools/local_ci.sh: add `--offline`, `--no-pip`, and `-h|--help`
  - scripts/check_verification.sh: add `--no-struct`
  - README: document offline usage and add Quick Links + Offline Mode section

Validation
- Local: offline and full runs PASS (8 scenes, schema/structure/fields OK)
- CI: PR #68 passed 13/13 checks; Windows stable

Compatibility
- Default behavior unchanged; CI unaffected; flags are opt‑in

