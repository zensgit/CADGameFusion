# v0.3.2 — Issue Seeds (Local Draft)

- Pre-push hook variants and docs (strict/quick/offline)
  - Acceptance: hook runs strict by default; README + Troubleshooting updated.
- Promote `make quick` in README with short rationale; link Offline guide
  - Acceptance: README updated; OFFLINE_MODE.md referenced.
- Minimal C API example in `examples/` wired to CTest
  - Acceptance: builds in CI; referenced in README.
- Decision table: Quick vs Strict vs Offline; expected gates
  - Acceptance: new doc section linked from README.
- CTest gate enforcement docs and CI job alignment
  - Acceptance: `ctest --test-dir build -V` documented; CI job mirrors quick path.
- Exporter defaults stabilization + doc examples
  - Acceptance: basic export path works via editor; examples and docs updated.

